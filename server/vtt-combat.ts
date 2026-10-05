import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { combatSchema, sortCombat, type Combat, type CombatView } from '../shared/vtt-combat.js';
import type { VttDocument, VttToken, VttScene } from '../shared/vtt.js';
import { deriveSheet } from '../shared/character-sheet.js';
type DB = Pick<PoolClient, 'query'>;
type Room = {
  id: string;
  owner_id: string;
  document: VttDocument;
  role?: string | null;
  viewing_user_id?: string | null;
  combat?: unknown;
};
type Access = (db: DB, id: string, user: string, lock?: boolean) => Promise<Room>;
const uuid = z.string().uuid();
const inputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), tokenIds: z.array(uuid).min(1).max(1000) }).strict(),
  z.object({ kind: z.literal('remove'), tokenId: uuid }).strict(),
  z.object({ kind: z.literal('roll'), tokenId: uuid }).strict(),
  z
    .object({ kind: z.literal('set'), tokenId: uuid, value: z.number().int().min(-100).max(1000) })
    .strict(),
  z.object({ kind: z.literal('goto'), tokenId: uuid }).strict(),
  z.object({ kind: z.literal('step'), direction: z.union([z.literal(-1), z.literal(1)]) }).strict(),
  z.object({ kind: z.literal('start') }).strict(),
  z.object({ kind: z.literal('end') }).strict(),
]);
function current(room: Room): Combat {
  const scene = room.document.scenes.find((s) => s.id === room.document.activeScene)!;
  let c: Combat = room.combat
    ? combatSchema.parse(room.combat)
    : {
        sceneId: scene.id,
        revision: 0,
        active: false,
        round: 1,
        currentId: null,
        entries: room.document.initiative.map((e) => ({ ...e, die: null, bonus: null })),
      };
  if (c.sceneId !== scene.id)
    c = {
      sceneId: scene.id,
      revision: c.revision,
      active: false,
      round: 1,
      currentId: null,
      entries: [],
    };
  c.entries = c.entries.filter((e) =>
    scene.tokens.some((t) => t.id === e.tokenId && t.layer === 'tokens' && !t.hidden),
  );
  if (!c.entries.some((e) => e.tokenId === c.currentId))
    c.currentId = c.entries[0]?.tokenId || null;
  if (!c.entries.length) c.active = false;
  return c;
}
export function vttCombatRouter(
  getRoom: Access,
  canSee: (t: VttToken, s: VttScene, user: string) => boolean,
) {
  const router = Router();
  async function view(room: Room, user: string, db: DB = pool): Promise<CombatView> {
    const c = current(room),
      scene = room.document.scenes.find((s) => s.id === c.sceneId)!,
      gm = room.owner_id === user && (await isAdministrator(user, db as PoolClient));
    let viewer = user;
    if (room.role === 'spectator' && !gm) {
      const members = (
        await db.query(
          'SELECT m.user_id FROM vtt_members m JOIN "user" u ON u.id=m.user_id WHERE m.room_id=$1 AND m.role=\'player\' ORDER BY u.name',
          [room.id],
        )
      ).rows;
      viewer =
        members.find((m) => m.user_id === room.viewing_user_id)?.user_id ||
        members.find((m) =>
          scene.tokens.some((t) => t.controller === m.user_id && !t.hidden && t.layer === 'tokens'),
        )?.user_id ||
        '';
    }
    const entries = c.entries.flatMap((e) => {
      const t = scene.tokens.find((t) => t.id === e.tokenId)!;
      if (
        !gm &&
        !(room.role === 'spectator' && !scene.fog && !viewer ? !t.hidden : canSee(t, scene, viewer))
      )
        return [];
      return [
        {
          ...e,
          name: t.name,
          image: t.image,
          canRoll: !c.active && (gm || (room.role !== 'spectator' && t.controller === user)),
        },
      ];
    });
    const index = c.entries.findIndex((e) => e.tokenId === c.currentId),
      nextId = c.entries.length > 1 ? c.entries[(index + 1) % c.entries.length].tokenId : null;
    return {
      ...c,
      entries,
      currentId: entries.some((e) => e.tokenId === c.currentId) ? c.currentId : null,
      nextId: entries.some((e) => e.tokenId === nextId) ? nextId : null,
    };
  }
  router.get('/vtt/rooms/:id/combat', async (req, res) =>
    res.json(
      await view(
        await getRoom(pool, uuid.parse(req.params.id), res.locals.user.id),
        res.locals.user.id,
      ),
    ),
  );
  router.post('/vtt/rooms/:id/combat', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      user = res.locals.user.id,
      input = inputSchema.parse(req.body);
    const result = await transaction(async (db) => {
      const r = await getRoom(db, rid, user, true),
        c = current(r),
        scene = r.document.scenes.find((s) => s.id === c.sceneId)!,
        gm = r.owner_id === user && (await isAdministrator(user, db as PoolClient));
      if (r.role === 'spectator' && !gm)
        throw new AppError(403, 'Espectadores podem somente assistir.');
      if (input.kind !== 'roll') {
        await requireAdministrator(user, db as PoolClient);
        if (!gm) throw new AppError(403, 'Somente o mestre controla a ordem dos turnos.');
      }
      if (input.kind === 'add') {
        if (c.active)
          throw new AppError(409, 'Encerre o combate antes de adicionar participantes.');
        for (const id of new Set(input.tokenIds)) {
          if (!scene.tokens.some((t) => t.id === id && t.layer === 'tokens' && !t.hidden))
            throw new AppError(400, 'Escolha tokens visíveis do mapa ativo.');
          if (!c.entries.some((e) => e.tokenId === id))
            c.entries.push({ tokenId: id, value: null, die: null, bonus: null });
        }
      } else if (input.kind === 'roll') {
        const entry = c.entries.find((e) => e.tokenId === input.tokenId),
          token = scene.tokens.find((t) => t.id === input.tokenId);
        if (!entry || !token) throw new AppError(404, 'Token fora da ordem dos turnos.');
        if (c.active) throw new AppError(409, 'A iniciativa já foi definida para este combate.');
        if (!gm && (token.controller !== user || token.hidden || !canSee(token, scene, user)))
          throw new AppError(403, 'Você pode rolar somente pelo seu personagem.');
        let bonus = Math.floor(((token.sheet?.stats[1] ?? 10) - 10) / 2);
        if (token.characterId) {
          const ch = (
            await db.query(
              'SELECT c.* FROM characters c JOIN vtt_character_links l ON l.character_id=c.id AND l.room_id=$2 WHERE c.id=$1 AND c.deleted_at IS NULL',
              [token.characterId, rid],
            )
          ).rows[0];
          if (!ch || (!gm && ch.user_id !== user))
            throw new AppError(403, 'Personagem não pertence a você.');
          const sheet = (
            await db.query(
              'SELECT choices,finalized_at FROM character_sheets WHERE character_id=$1',
              [token.characterId],
            )
          ).rows[0];
          bonus =
            sheet?.finalized_at && sheet.choices
              ? deriveSheet(ch, sheet.choices).initiative
              : Math.floor((ch.stats[1] - 10) / 2);
        }
        entry.bonus = bonus;
        entry.die = randomInt(1, 21);
        entry.value = entry.die + entry.bonus;
        await db.query(
          'INSERT INTO vtt_messages(room_id,author_id,author,text,roll) VALUES($1,$2,$3,$4,$5)',
          [
            rid,
            user,
            token.name,
            token.name + ' · iniciativa',
            JSON.stringify({
              formula: '1d20' + (entry.bonus >= 0 ? '+' : '') + entry.bonus,
              dice: [entry.die],
              total: entry.value,
            }),
          ],
        );
        sortCombat(c);
        c.currentId = c.entries[0]?.tokenId || null;
      } else if (input.kind === 'set') {
        const e = c.entries.find((e) => e.tokenId === input.tokenId);
        if (!e) throw new AppError(404, 'Token fora da ordem.');
        e.value = input.value;
        e.die = null;
        e.bonus = null;
        sortCombat(c);
      } else if (input.kind === 'remove')
        c.entries = c.entries.filter((e) => e.tokenId !== input.tokenId);
      else if (input.kind === 'start') {
        if (!c.entries.length || c.entries.some((e) => e.value === null))
          throw new AppError(409, 'Todos os participantes precisam definir a iniciativa.');
        sortCombat(c);
        c.active = true;
        c.round = 1;
        c.currentId = c.entries[0].tokenId;
      } else if (input.kind === 'end') {
        c.entries = [];
        c.active = false;
        c.currentId = null;
        c.round = 1;
      } else if (input.kind === 'goto') {
        if (!c.entries.some((e) => e.tokenId === input.tokenId))
          throw new AppError(404, 'Token fora da ordem.');
        c.currentId = input.tokenId;
      } else if (input.kind === 'step') {
        if (!c.entries.length) throw new AppError(409, 'Adicione participantes.');
        const old = c.entries.findIndex((e) => e.tokenId === c.currentId),
          next = (Math.max(0, old) + input.direction + c.entries.length) % c.entries.length;
        if (c.active && input.direction === 1 && next === 0) c.round++;
        if (c.active && input.direction === -1 && old === 0) c.round = Math.max(1, c.round - 1);
        c.currentId = c.entries[next].tokenId;
      }
      if (!c.entries.some((e) => e.tokenId === c.currentId))
        c.currentId = c.entries[0]?.tokenId || null;
      if (!c.entries.length) c.active = false;
      c.revision++;
      r.combat = combatSchema.parse(c);
      await db.query('UPDATE vtt_rooms SET combat=$2 WHERE id=$1', [rid, JSON.stringify(r.combat)]);
      return view(r, user, db);
    });
    res.json(result);
  });
  return router;
}
