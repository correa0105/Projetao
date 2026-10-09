import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { companionAllocated } from './companion-inventory.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import { deriveSheet, classRules } from '../shared/character-sheet.js';
import { consumableItems } from '../shared/vtt-sheet.js';
import { applyTokenDeath, type VttDocument } from '../shared/vtt.js';
import { applyTokenBlood } from '../shared/vtt-blood.js';
type DB = Pick<PoolClient, 'query'>;
type Room = { id: string; owner_id: string; document: VttDocument; role?: string | null };
export type RoomAccess = (db: DB, id: string, user: string, lock?: boolean) => Promise<Room>;
const uuid = z.string().uuid();
const nine = z.array(z.number().int().min(0).max(30)).length(9);
export async function access(
  getRoom: RoomAccess,
  db: DB,
  rid: string,
  tid: string,
  user: string,
  lock = false,
) {
  const room = await getRoom(db, rid, user, lock);
  if (room.role === 'spectator') throw new AppError(403, 'Espectadores não têm acesso à ficha.');
  const scene = room.document.scenes.find((s) => s.id === room.document.activeScene)!;
  const token = scene.tokens.find((t) => t.id === tid);
  if (!token?.characterId) throw new AppError(404, 'Este token não tem personagem importado.');
  const isGm = room.owner_id === user && (await isAdministrator(user, db as PoolClient));
  const {
    rows: [character],
  } = await db.query(
    `SELECT c.*,EXISTS(SELECT 1 FROM "user" u WHERE u.id=c.user_id AND u.administrador=1) AS gold_unlimited FROM characters c JOIN vtt_character_links l ON l.character_id=c.id AND l.room_id=$2 WHERE c.id=$1 AND c.deleted_at IS NULL${lock ? ' FOR UPDATE OF c' : ''}`,
    [token.characterId, rid],
  );
  if (
    !character ||
    (!isGm &&
      (token.controller !== user ||
        character.user_id !== user ||
        token.layer !== 'tokens' ||
        token.hidden))
  )
    throw new AppError(403, 'Você não tem acesso à ficha deste personagem.');
  const {
    rows: [sheet],
  } = await db.query('SELECT * FROM character_sheets WHERE character_id=$1', [character.id]);
  return { room, token, character, sheet, isGm, canUse: isGm || token.controller === user };
}
export async function resources(
  db: DB,
  character: { id: string; class: string },
  sheet: { slots_used?: number; hit_dice_used?: number } | null,
  lock = false,
) {
  const totals = [classRules[character.class]?.slots || 0, ...Array(8).fill(0)];
  const used = [Math.min(totals[0], sheet?.slots_used || 0), ...Array(8).fill(0)];
  if (lock)
    await db.query(
      'INSERT INTO vtt_character_resources(character_id,slots_total,slots_used,hit_dice_used)VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING',
      [character.id, JSON.stringify(totals), JSON.stringify(used), sheet?.hit_dice_used || 0],
    );
  const {
    rows: [r],
  } = await db.query(
    'SELECT slots_total,slots_used,hit_dice_used FROM vtt_character_resources WHERE character_id=$1' +
      (lock ? ' FOR UPDATE' : ''),
    [character.id],
  );
  return r || { slots_total: totals, slots_used: used, hit_dice_used: sheet?.hit_dice_used || 0 };
}
async function sheetData(getRoom: RoomAccess, rid: string, tid: string, user: string) {
  const a = await access(getRoom, pool, rid, tid, user);
  const c = a.character;
  const [inventory, uses, r] = await Promise.all([
    pool.query(
      `SELECT i.item_id AS id,c.name,c.description,c.weight_lb,i.quantity,ARRAY(SELECT slot FROM character_equipment e WHERE e.character_id=i.character_id AND e.item_id=i.item_id) AS equipped FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 ORDER BY c.name`,
      [c.id],
    ),
    pool.query(
      'SELECT u.id,u.kind,u.item_id,c.name AS item_name,u.slot,u.created_at,u.restored_at FROM vtt_resource_uses u LEFT JOIN catalog_items c ON c.id=u.item_id WHERE u.character_id=$1 AND u.room_id=$2 ORDER BY u.created_at DESC LIMIT 100',
      [c.id, rid],
    ),
    resources(pool, c, a.sheet),
  ]);
  return {
    character: {
      id: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      level: c.level,
      background: c.background,
      biography: c.biography,
      stats: c.stats,
      gold_cp: c.gold_cp,
      gold_unlimited: c.gold_unlimited,
    },
    token: a.token,
    sheet: a.sheet || null,
    derived: a.sheet?.finalized_at && a.sheet.choices ? deriveSheet(c, a.sheet.choices) : null,
    inventory: inventory.rows.map((i) => ({ ...i, consumable: consumableItems.has(i.id) })),
    resources: r,
    uses: uses.rows,
    is_gm: a.isGm,
    can_use: a.canUse,
  };
}
export function vttSheetRouter(getRoom: RoomAccess) {
  const router = Router();
  router.get('/vtt/rooms/:id/sheets/:token', async (req, res) =>
    res.json(
      await sheetData(
        getRoom,
        uuid.parse(req.params.id),
        uuid.parse(req.params.token),
        res.locals.user.id,
      ),
    ),
  );
  router.post('/vtt/rooms/:id/sheets/:token/damage', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      user = res.locals.user.id;
    const { amount } = z
      .object({ amount: z.number().int().min(1).max(100000) })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const a = await access(getRoom, db, rid, tid, user, true);
      const oldHp = a.token.hp;
      const old = structuredClone(a.token);
      a.token.hp = Math.max(0, a.token.hp - amount);
      applyTokenDeath(a.token, oldHp);
      applyTokenBlood(
        a.room.document.scenes.find((s) => s.id === a.room.document.activeScene)!,
        a.token,
        old,
      );
      await db.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
        rid,
        JSON.stringify(a.room.document),
      ]);
      await db.query('INSERT INTO vtt_messages(room_id,author_id,author,text)VALUES($1,$2,$3,$4)', [
        rid,
        user,
        a.character.name,
        'Recebeu ' + amount + ' de dano.',
      ]);
    });
    res.json(await sheetData(getRoom, rid, tid, user));
  });
  router.post('/vtt/rooms/:id/sheets/:token/heal', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      user = res.locals.user.id;
    const { amount } = z
      .object({ amount: z.number().int().min(1).max(100000) })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      await requireAdministrator(user, db as PoolClient);
      const a = await access(getRoom, db, rid, tid, user, true);
      if (!a.isGm) throw new AppError(403, 'Somente o mestre desta mesa pode curar manualmente.');
      const oldHp = a.token.hp;
      const old = structuredClone(a.token);
      a.token.hp = Math.min(a.token.maxHp, a.token.hp + amount);
      applyTokenDeath(a.token, oldHp);
      applyTokenBlood(
        a.room.document.scenes.find((s) => s.id === a.room.document.activeScene)!,
        a.token,
        old,
      );
      await db.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
        rid,
        JSON.stringify(a.room.document),
      ]);
      await db.query('INSERT INTO vtt_messages(room_id,author_id,author,text)VALUES($1,$2,$3,$4)', [
        rid,
        user,
        a.character.name,
        'Recuperou ' + (a.token.hp - oldHp) + ' PV.',
      ]);
    });
    res.json(await sheetData(getRoom, rid, tid, user));
  });
  router.post('/vtt/rooms/:id/sheets/:token/use', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      user = res.locals.user.id;
    const input = z
      .object({
        kind: z.enum(['slot', 'hit-die', 'consumable']),
        slot: z.number().int().min(1).max(9).optional(),
        item_id: z.string().min(1).max(100).optional(),
        idempotency_key: uuid,
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const a = await access(getRoom, db, rid, tid, user, true),
        cid = a.character.id;
      const previous = await db.query(
        'SELECT * FROM vtt_resource_uses WHERE user_id=$1 AND idempotency_key=$2',
        [user, input.idempotency_key],
      );
      if (previous.rows[0]) {
        const p = previous.rows[0];
        if (
          p.room_id !== rid ||
          p.character_id !== cid ||
          p.kind !== input.kind ||
          p.item_id !== (input.item_id || null) ||
          p.slot !== (input.slot || null)
        )
          throw new AppError(409, 'Este uso já corresponde a outra ação.');
        return;
      }
      const r = await resources(db, a.character, a.sheet, true);
      let label = '';
      if (input.kind === 'consumable') {
        if (!input.item_id || input.slot || !consumableItems.has(input.item_id))
          throw new AppError(400, 'Escolha um consumível do inventário.');
        const {
          rows: [item],
        } = await db.query(
          'SELECT i.quantity,c.name FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=$2 FOR UPDATE OF i',
          [cid, input.item_id],
        );
        if (!item)
          throw new AppError(409, 'Este consumível já foi gasto ou não está no inventário.');
        const animalCopies = (await companionAllocated(db, cid))[input.item_id] || 0;
        if (item.quantity - animalCopies < 1)
          throw new AppError(409, 'Desequipe o item do animal antes de consumi-lo.');
        if (item.quantity === 1) {
          await db.query('DELETE FROM character_equipment WHERE character_id=$1 AND item_id=$2', [
            cid,
            input.item_id,
          ]);
          await db.query('DELETE FROM inventory WHERE character_id=$1 AND item_id=$2', [
            cid,
            input.item_id,
          ]);
        } else
          await db.query(
            'UPDATE inventory SET quantity=quantity-1 WHERE character_id=$1 AND item_id=$2',
            [cid, input.item_id],
          );
        label = 'usou ' + item.name;
      } else if (input.kind === 'slot') {
        if (!input.slot || input.item_id)
          throw new AppError(400, 'Escolha o nível do espaço de magia.');
        const index = input.slot - 1;
        if (r.slots_used[index] >= r.slots_total[index])
          throw new AppError(409, 'Não há espaços disponíveis neste nível.');
        r.slots_used[index]++;
        label = 'gastou um espaço de magia de nível ' + input.slot;
      } else {
        if (input.slot || input.item_id) throw new AppError(400, 'Uso inválido de dado de vida.');
        if (r.hit_dice_used >= a.character.level)
          throw new AppError(409, 'Não há dados de vida disponíveis.');
        r.hit_dice_used++;
        label = 'gastou um dado de vida';
      }
      await db.query(
        'UPDATE vtt_character_resources SET slots_used=$2,hit_dice_used=$3,updated_at=now()WHERE character_id=$1',
        [cid, JSON.stringify(r.slots_used), r.hit_dice_used],
      );
      await db.query(
        'INSERT INTO vtt_resource_uses(room_id,character_id,user_id,kind,item_id,slot,idempotency_key)VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          rid,
          cid,
          user,
          input.kind,
          input.item_id || null,
          input.slot || null,
          input.idempotency_key,
        ],
      );
      await db.query('INSERT INTO vtt_messages(room_id,author_id,author,text)VALUES($1,$2,$3,$4)', [
        rid,
        user,
        a.character.name,
        label + '.',
      ]);
    });
    res.json(await sheetData(getRoom, rid, tid, user));
  });
  router.post('/vtt/rooms/:id/sheets/:token/restore', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      user = res.locals.user.id;
    const input = z
      .object({
        kind: z.enum(['all', 'hp', 'slot', 'hit-die', 'use']),
        slot: z.number().int().min(1).max(9).optional(),
        use_id: uuid.optional(),
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      await requireAdministrator(user, db as PoolClient);
      const a = await access(getRoom, db, rid, tid, user, true);
      if (!a.isGm) throw new AppError(403, 'Somente o mestre desta mesa pode restaurar recursos.');
      const cid = a.character.id,
        r = await resources(db, a.character, a.sheet, true);
      const old = structuredClone(a.token);
      if (input.kind === 'use') {
        const {
          rows: [use],
        } = await db.query(
          'SELECT * FROM vtt_resource_uses WHERE id=$1 AND character_id=$2 AND room_id=$3 FOR UPDATE',
          [input.use_id, cid, rid],
        );
        if (!use) throw new AppError(404, 'Uso não encontrado.');
        if (use.restored_at) throw new AppError(409, 'Este uso já foi corrigido.');
        if (use.kind === 'consumable')
          await db.query(
            'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,1)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=inventory.quantity+1',
            [cid, use.item_id],
          );
        else if (use.kind === 'slot')
          r.slots_used[use.slot - 1] = Math.max(0, r.slots_used[use.slot - 1] - 1);
        else r.hit_dice_used = Math.max(0, r.hit_dice_used - 1);
        await db.query(
          'UPDATE vtt_resource_uses SET restored_at=now(),restored_by=$2 WHERE id=$1',
          [use.id, user],
        );
      } else if (input.kind === 'all') {
        r.slots_used.fill(0);
        r.hit_dice_used = 0;
        a.token.hp = a.token.maxHp;
        await db.query(
          "UPDATE vtt_resource_uses SET restored_at=now(),restored_by=$2 WHERE character_id=$1 AND kind<>'consumable' AND restored_at IS NULL",
          [cid, user],
        );
      } else if ((input.kind === 'slot' && input.slot) || input.kind === 'hit-die') {
        if (input.kind === 'slot')
          r.slots_used[input.slot! - 1] = Math.max(0, r.slots_used[input.slot! - 1] - 1);
        else r.hit_dice_used = Math.max(0, r.hit_dice_used - 1);
        await db.query(
          'UPDATE vtt_resource_uses SET restored_at=now(),restored_by=$4 WHERE id=(SELECT id FROM vtt_resource_uses WHERE character_id=$1 AND kind=$2 AND slot IS NOT DISTINCT FROM $3 AND restored_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE)',
          [cid, input.kind, input.slot || null, user],
        );
      } else if (input.kind === 'hp') a.token.hp = a.token.maxHp;
      else throw new AppError(400, 'Escolha o recurso a restaurar.');
      if (input.kind === 'hp' || input.kind === 'all') a.token.deathAt = null;
      applyTokenBlood(
        a.room.document.scenes.find((s) => s.id === a.room.document.activeScene)!,
        a.token,
        old,
      );
      await db.query(
        'UPDATE vtt_character_resources SET slots_used=$2,hit_dice_used=$3,updated_at=now()WHERE character_id=$1',
        [cid, JSON.stringify(r.slots_used), r.hit_dice_used],
      );
      await db.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
        rid,
        JSON.stringify(a.room.document),
      ]);
      await db.query('INSERT INTO vtt_messages(room_id,author_id,author,text)VALUES($1,$2,$3,$4)', [
        rid,
        user,
        'Mestre',
        'Restaurou recursos de ' + a.character.name + '.',
      ]);
    });
    res.json(await sheetData(getRoom, rid, tid, user));
  });
  router.put('/vtt/rooms/:id/sheets/:token/slots', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token),
      user = res.locals.user.id;
    const input = z.object({ totals: nine }).strict().parse(req.body);
    await transaction(async (db) => {
      await requireAdministrator(user, db as PoolClient);
      const a = await access(getRoom, db, rid, tid, user, true);
      if (!a.isGm) throw new AppError(403, 'Somente o mestre pode definir os espaços.');
      const r = await resources(db, a.character, a.sheet, true);
      await db.query(
        'UPDATE vtt_character_resources SET slots_total=$2,slots_used=$3,updated_at=now()WHERE character_id=$1',
        [
          a.character.id,
          JSON.stringify(input.totals),
          JSON.stringify(r.slots_used.map((n: number, i: number) => Math.min(n, input.totals[i]))),
        ],
      );
    });
    res.json(await sheetData(getRoom, rid, tid, user));
  });
  return router;
}
