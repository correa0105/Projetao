import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { requireAdministrator, isAdministrator } from './administrators.js';
import {
  houseCatalog,
  houseTemplates,
  initialHouseRooms,
  layoutSchema,
  roomKinds,
} from '../shared/house.js';
import { achievementCatalog } from '../shared/achievements.js';
const uuid = z.string().uuid(),
  uid = z.string().min(1).max(100);
type DB = Pick<PoolClient, 'query'>;
async function owned(db: DB, id: string, user: string) {
  const c = (
    await db.query(
      'SELECT id,user_id,name,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
      [id, user],
    )
  ).rows[0];
  if (!c) throw new AppError(404, 'Personagem não encontrado.');
  return c;
}
async function access(db: DB, id: string, user: string, edit = false) {
  const h = (
    await db.query(
      `SELECT h.*,c.user_id,c.name AS owner_name,c.gold_cp FROM house_homes h JOIN characters c ON c.id=h.character_id WHERE h.id=$1 AND c.deleted_at IS NULL FOR UPDATE OF h`,
      [id],
    )
  ).rows[0];
  if (!h) throw new AppError(404, 'Casa não encontrada.');
  if (h.user_id !== user) {
    if (
      edit ||
      !(
        await db.query(
          `SELECT 1 FROM house_invites i WHERE i.home_id=$1 AND i.user_id=$2 AND i.status='accepted' AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=$3)OR(b.blocker_id=$3 AND b.blocked_id=$2))`,
          [id, user, h.user_id],
        )
      ).rowCount
    )
      throw new AppError(404, 'Casa não encontrada.');
  }
  return h;
}
async function pair(db: DB, a: string, b: string) {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    JSON.stringify([a, b].sort()),
  ]);
  if (
    (
      await db.query(
        'SELECT 1 FROM social_blocks WHERE(blocker_id=$1 AND blocked_id=$2)OR(blocker_id=$2 AND blocked_id=$1)',
        [a, b],
      )
    ).rowCount
  )
    throw new AppError(403, 'Esta interação não está disponível.');
}
async function imageBytes(encoded: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new AppError(400, 'Imagem inválida.');
  const raw = Buffer.from(encoded, 'base64');
  if (raw.length > 5 * 1024 * 1024) throw new AppError(400, 'A imagem deve ter até 5 MB.');
  try {
    const p = sharp(raw, { limitInputPixels: 20000000 });
    const m = await p.metadata();
    if (!['png', 'jpeg', 'webp'].includes(m.format || '')) throw Error();
    return await p
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new AppError(400, 'Envie uma imagem PNG, JPEG ou WebP válida.');
  }
}
const itemFields = 'id,catalog_id,content,source,(image IS NOT NULL) AS has_image';
async function state(db: DB, h: any, user: string) {
  const owner = h.user_id === user;
  const placed = h.rooms.flatMap((r: any) =>
    r.placements.filter((p: any) => p.kind === 'item').map((p: any) => p.ref),
  );
  // One transaction client executes queries sequentially while its access lock is held.
  const items = await db.query(
    `SELECT ${itemFields},(SELECT name FROM "user" WHERE id=sender_id) AS sender_name FROM house_items WHERE character_id=$1 ${owner ? '' : 'AND id=ANY($2::uuid[])'} ORDER BY created_at,id`,
    owner ? [h.character_id] : [h.character_id, placed],
  );
  const companions = await db.query(
    `SELECT id,'pet' AS kind,name,pet_id,appearance,NULL AS mount_id,NULL AS coat,NULL AS equipment FROM character_pets WHERE character_id=$1 UNION ALL SELECT id,'mount',name,NULL,NULL,mount_id,coat,equipment FROM character_mounts WHERE character_id=$1`,
    [h.character_id],
  );
  const presence = await db.query(
    `SELECT p.user_id,p.character_id,c.name,p.variant_id,p.room,p.x,p.y,p.scale FROM house_presence p JOIN characters c ON c.id=p.character_id WHERE p.home_id=$1 AND c.deleted_at IS NULL AND (p.user_id=$2 OR EXISTS(SELECT 1 FROM house_invites i WHERE i.home_id=p.home_id AND i.user_id=p.user_id AND i.status='accepted')) AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=p.user_id AND b.blocked_id=$2)OR(b.blocker_id=$2 AND b.blocked_id=p.user_id))`,
    [h.id, h.user_id],
  );
  const messages = await db.query(
    `SELECT m.id,c.name,m.body,m.created_at FROM house_messages m JOIN characters c ON c.id=m.character_id WHERE home_id=$1 ORDER BY m.created_at DESC,m.id DESC LIMIT 150`,
    [h.id],
  );
  const invites = owner
    ? await db.query(
        `SELECT i.user_id,u.name,i.status FROM house_invites i JOIN "user" u ON u.id=i.user_id WHERE i.home_id=$1 ORDER BY u.name`,
        [h.id],
      )
    : { rows: [] };
  return {
    id: h.id,
    character_id: h.character_id,
    name: h.name,
    revision: h.revision,
    rooms: h.rooms,
    is_owner: owner,
    ...(owner ? { gold_cp: h.gold_cp } : {}),
    owner_name: h.owner_name,
    inventory: owner ? items.rows : [],
    items: items.rows.filter((i) => placed.includes(i.id)),
    companions: owner
      ? companions.rows
      : companions.rows.filter((c) =>
          h.rooms.some((r: any) => r.placements.some((p: any) => p.ref === c.id)),
        ),
    presence: presence.rows,
    messages: messages.rows.reverse(),
    invites: invites.rows,
  };
}
export function houseRouter() {
  const router = Router();
  router.get('/house', async (_req, res) => {
    const u = res.locals.user.id;
    const [homes, invites, variants] = await Promise.all([
      pool.query(
        `SELECT h.id,h.character_id,h.name,c.name AS character_name FROM house_homes h JOIN characters c ON c.id=h.character_id WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY h.created_at`,
        [u],
      ),
      pool.query(
        `SELECT i.home_id,i.status,h.name,c.name AS character_name,u.name AS owner_name FROM house_invites i JOIN house_homes h ON h.id=i.home_id JOIN characters c ON c.id=h.character_id JOIN "user" u ON u.id=c.user_id WHERE i.user_id=$1 AND i.status IN('pending','accepted') AND c.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE(b.blocker_id=$1 AND b.blocked_id=c.user_id)OR(b.blocker_id=c.user_id AND b.blocked_id=$1)) ORDER BY i.created_at DESC`,
        [u],
      ),
      pool.query(
        `SELECT v.id,v.character_id,v.name FROM house_variants v JOIN characters c ON c.id=v.character_id WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY v.created_at`,
        [u],
      ),
    ]);
    res.json({
      homes: homes.rows,
      invites: invites.rows,
      variants: variants.rows,
      catalog: houseCatalog,
      templates: houseTemplates,
      can_admin: await isAdministrator(u),
    });
  });
  router.post('/house', async (req, res) => {
    const { character_id } = z.object({ character_id: uuid }).strict().parse(req.body);
    const h = await transaction(async (db) => {
      const c = await owned(db, character_id, res.locals.user.id);
      await db.query(
        `INSERT INTO house_homes(character_id,name,rooms)VALUES($1,$2,$3)ON CONFLICT(character_id)DO NOTHING`,
        [c.id, `Casa de ${c.name}`, JSON.stringify(initialHouseRooms())],
      );
      return (await db.query('SELECT id FROM house_homes WHERE character_id=$1', [c.id])).rows[0];
    });
    res.status(201).json(h);
  });
  router.get('/house/:id', async (req, res) =>
    res.json(
      await transaction(async (db) =>
        state(
          db,
          await access(db, uuid.parse(req.params.id), res.locals.user.id),
          res.locals.user.id,
        ),
      ),
    ),
  );
  router.put('/house/:id', async (req, res) => {
    const input = layoutSchema.parse(req.body);
    res.json(
      await transaction(async (db) => {
        const h = await access(db, uuid.parse(req.params.id), res.locals.user.id, true);
        if (h.revision !== input.revision)
          throw new AppError(409, 'A casa mudou em outra aba. Atualize antes de salvar.');
        const all = input.rooms.flatMap((r) => r.placements);
        for (const kind of ['item', 'pet', 'mount']) {
          const refs = all.filter((p) => p.kind === kind).map((p) => p.ref);
          const table =
            kind === 'item'
              ? 'house_items'
              : kind === 'pet'
                ? 'character_pets'
                : 'character_mounts';
          if (
            refs.length &&
            (
              await db.query(
                `SELECT id FROM ${table} WHERE character_id=$1 AND id=ANY($2::uuid[])`,
                [h.character_id, refs],
              )
            ).rowCount !== refs.length
          )
            throw new AppError(400, 'Use somente peças e companheiros deste personagem.');
        }
        const saved = (
          await db.query(
            'UPDATE house_homes SET name=$2,rooms=$3,revision=revision+1,updated_at=now()WHERE id=$1 RETURNING revision',
            [h.id, input.name, JSON.stringify(input.rooms)],
          )
        ).rows[0];
        return saved;
      }),
    );
  });
  router.post('/house/:id/invites', async (req, res) => {
    const input = z.object({ user_id: uid }).strict().parse(req.body);
    await transaction(async (db) => {
      const h = await access(db, uuid.parse(req.params.id), res.locals.user.id, true);
      if (input.user_id === h.user_id) throw new AppError(400, 'Você já é dono da casa.');
      await pair(db, h.user_id, input.user_id);
      if (!(await db.query('SELECT 1 FROM "user" WHERE id=$1', [input.user_id])).rowCount)
        throw new AppError(404, 'Jogador não encontrado.');
      await db.query(
        `INSERT INTO house_invites(home_id,user_id,status)VALUES($1,$2,'pending')ON CONFLICT(home_id,user_id)DO UPDATE SET status=CASE WHEN house_invites.status='accepted' THEN 'accepted' ELSE 'pending' END,created_at=now()`,
        [h.id, input.user_id],
      );
    });
    res.json({ ok: true });
  });
  router.put('/house/:id/invites/:user', async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['accepted', 'declined', 'revoked']) })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const id = uuid.parse(req.params.id),
        target = uid.parse(req.params.user),
        u = res.locals.user.id;
      const h = (
        await db.query(
          'SELECT h.id,c.user_id FROM house_homes h JOIN characters c ON c.id=h.character_id WHERE h.id=$1 AND c.deleted_at IS NULL FOR UPDATE OF h',
          [id],
        )
      ).rows[0];
      if (!h) throw new AppError(404, 'Convite não encontrado.');
      await pair(db, h.user_id, u === h.user_id ? target : u);
      if (status === 'revoked') {
        if (h.user_id !== u) throw new AppError(403, 'Somente o dono pode revogar.');
      } else if (target !== u) throw new AppError(403, 'Responda somente ao seu convite.');
      const r = await db.query(
        `UPDATE house_invites SET status=$3 WHERE home_id=$1 AND user_id=$2 ${status === 'revoked' ? '' : "AND status IN('pending','accepted')"}`,
        [id, target, status],
      );
      if (!r.rowCount) throw new AppError(404, 'Convite não encontrado.');
      if (status !== 'accepted')
        await db.query('DELETE FROM house_presence WHERE home_id=$1 AND user_id=$2', [id, target]);
    });
    res.json({ ok: true });
  });
  const purchaseSchema = z
    .object({
      character_id: uuid,
      catalog_id: z.string().max(60),
      idempotency_key: uuid,
      content: z
        .object({
          title: z.string().trim().max(80).default(''),
          text: z.string().trim().max(3000).default(''),
        })
        .strict()
        .default({ title: '', text: '' }),
      image: z
        .string()
        .max(7 * 1024 * 1024)
        .optional(),
    })
    .strict();
  router.post('/house/purchase', async (req, res) => {
    const input = purchaseSchema.parse(req.body),
      item = houseCatalog.find((i) => i.id === input.catalog_id);
    if (!item) throw new AppError(404, 'Mobília não encontrada.');
    if (input.image && item.id !== 'frame')
      throw new AppError(400, 'Só quadros recebem uma imagem.');
    if (!['frame', 'letter'].includes(item.id) && (input.content.title || input.content.text))
      throw new AppError(400, 'Este móvel não recebe uma dedicatória.');
    const bytes = input.image ? await imageBytes(input.image) : null;
    const result = await transaction(async (db) => {
      const c = await owned(db, input.character_id, res.locals.user.id);
      const previous = (
        await db.query(
          'SELECT request,item_id,total_cp FROM house_orders WHERE character_id=$1 AND idempotency_key=$2',
          [c.id, input.idempotency_key],
        )
      ).rows[0];
      const request = {
        catalog_id: item.id,
        content: input.content,
        image: input.image ? createHash('sha256').update(input.image).digest('hex') : '',
      };
      if (previous) {
        const p = previous.request;
        if (
          p.catalog_id !== request.catalog_id ||
          p.image !== request.image ||
          p.content.title !== input.content.title ||
          p.content.text !== input.content.text
        )
          throw new AppError(409, 'Chave já usada para outro pedido.');
        return { item_id: previous.item_id, gold_cp: c.gold_cp, replayed: true };
      }
      if (c.gold_cp < item.price_cp) throw new AppError(409, 'Ouro insuficiente.');
      const added = (
        await db.query(
          `INSERT INTO house_items(character_id,catalog_id,content,image,source)VALUES($1,$2,$3,$4,'purchase')RETURNING id`,
          [c.id, item.id, input.content, bytes],
        )
      ).rows[0];
      const gold = (
        await db.query('UPDATE characters SET gold_cp=gold_cp-$2 WHERE id=$1 RETURNING gold_cp', [
          c.id,
          item.price_cp,
        ])
      ).rows[0];
      await db.query(
        'INSERT INTO house_orders(character_id,idempotency_key,request,total_cp,item_id)VALUES($1,$2,$3,$4,$5)',
        [c.id, input.idempotency_key, request, item.price_cp, added.id],
      );
      return { item_id: added.id, gold_cp: gold.gold_cp, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  router.post('/house/items/:id/gift', async (req, res) => {
    const { character_id } = z.object({ character_id: uuid }).strict().parse(req.body);
    await transaction(async (db) => {
      const id = uuid.parse(req.params.id),
        u = res.locals.user.id;
      const item = (
        await db.query(
          `SELECT i.*,c.user_id FROM house_items i JOIN characters c ON c.id=i.character_id WHERE i.id=$1 AND c.deleted_at IS NULL FOR UPDATE OF i`,
          [id],
        )
      ).rows[0];
      if (!item || item.user_id !== u) throw new AppError(404, 'Peça não encontrada.');
      if (!['frame', 'letter'].includes(item.catalog_id))
        throw new AppError(400, 'Ofereça uma carta ou um quadro personalizado.');
      if ((await db.query('SELECT 1 FROM house_gift_audit WHERE item_id=$1', [id])).rowCount)
        throw new AppError(409, 'Este presente já foi enviado.');
      const target = (
        await db.query('SELECT id,user_id FROM characters WHERE id=$1 AND deleted_at IS NULL', [
          character_id,
        ])
      ).rows[0];
      if (!target || target.user_id === u)
        throw new AppError(400, 'Escolha um personagem de outro jogador.');
      await pair(db, u, target.user_id);
      const h = (
        await db.query('SELECT id,rooms FROM house_homes WHERE character_id=$1 FOR UPDATE', [
          item.character_id,
        ])
      ).rows[0];
      if (h && h.rooms.some((r: any) => r.placements.some((p: any) => p.ref === id)))
        throw new AppError(409, 'Guarde a peça antes de oferecer.');
      await db.query('UPDATE house_items SET character_id=$2,sender_id=$3,source=$4 WHERE id=$1', [
        id,
        target.id,
        u,
        'gift',
      ]);
      await db.query(
        'INSERT INTO house_gift_audit(item_id,from_character,to_character,sent_by)VALUES($1,$2,$3,$4)',
        [id, item.character_id, target.id, u],
      );
    });
    res.json({ ok: true });
  });
  router.get('/house/items/:id/image', async (req, res) => {
    const id = uuid.parse(req.params.id),
      u = res.locals.user.id;
    const item = (
      await pool.query(
        'SELECT i.image,i.character_id,c.user_id FROM house_items i JOIN characters c ON c.id=i.character_id WHERE i.id=$1 AND c.deleted_at IS NULL',
        [id],
      )
    ).rows[0];
    if (!item?.image) throw new AppError(404, 'Imagem não encontrada.');
    if (item.user_id !== u)
      await transaction(async (db) => {
        const h = (
          await db.query('SELECT id,rooms FROM house_homes WHERE character_id=$1', [
            item.character_id,
          ])
        ).rows[0];
        if (
          !h ||
          !h.rooms.some((r: any) =>
            r.placements.some((p: any) => p.kind === 'item' && p.ref === id),
          )
        )
          throw new AppError(404, 'Imagem não encontrada.');
        await access(db, h.id, u);
      });
    res.type('webp').send(item.image);
  });
  router.post('/house/variants', async (req, res) => {
    const input = z
      .object({
        character_id: uuid,
        name: z.string().trim().min(2).max(60),
        image: z
          .string()
          .max(7 * 1024 * 1024)
          .optional(),
      })
      .strict()
      .parse(req.body);
    const bytes = input.image ? await imageBytes(input.image) : null;
    const result = await transaction(async (db) => {
      await owned(db, input.character_id, res.locals.user.id);
      if (
        Number(
          (
            await db.query('SELECT count(*) FROM house_variants WHERE character_id=$1', [
              input.character_id,
            ])
          ).rows[0].count,
        ) >= 20
      )
        throw new AppError(409, 'Limite de vinte versões por personagem.');
      const portrait =
        bytes ||
        (
          await db.query('SELECT image FROM character_portraits WHERE character_id=$1', [
            input.character_id,
          ])
        ).rows[0]?.image;
      if (!portrait)
        throw new AppError(409, 'Envie a imagem da versão ou gere a arte do personagem.');
      return (
        await db.query(
          'INSERT INTO house_variants(character_id,name,image)VALUES($1,$2,$3)RETURNING id,character_id,name',
          [input.character_id, input.name, portrait],
        )
      ).rows[0];
    });
    res.status(201).json(result);
  });
  router.get('/house/variants/:id/image', async (req, res) => {
    const u = res.locals.user.id,
      id = uuid.parse(req.params.id);
    const v = (
      await pool.query(
        'SELECT v.image,c.user_id FROM house_variants v JOIN characters c ON c.id=v.character_id WHERE v.id=$1 AND c.deleted_at IS NULL',
        [id],
      )
    ).rows[0];
    if (!v) throw new AppError(404, 'Versão não encontrada.');
    if (v.user_id !== u) {
      const homes = (
        await pool.query('SELECT home_id FROM house_presence WHERE variant_id=$1', [id])
      ).rows;
      let allowed = false;
      for (const h of homes)
        try {
          await transaction((db) => access(db, h.home_id, u));
          allowed = true;
          break;
        } catch {}
      if (!allowed) throw new AppError(404, 'Versão não encontrada.');
    }
    res.type('webp').send(v.image);
  });
  router.put('/house/:id/presence', async (req, res) => {
    const input = z
      .object({
        character_id: uuid,
        variant_id: uuid.nullable(),
        room: z.enum(roomKinds),
        x: z.number().min(0.02).max(0.98),
        y: z.number().min(0.1).max(0.98),
        scale: z.number().min(0.05).max(0.45),
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const h = await access(db, uuid.parse(req.params.id), res.locals.user.id);
      await owned(db, input.character_id, res.locals.user.id);
      if (
        input.variant_id &&
        !(
          await db.query('SELECT 1 FROM house_variants WHERE id=$1 AND character_id=$2', [
            input.variant_id,
            input.character_id,
          ])
        ).rowCount
      )
        throw new AppError(400, 'Versão inválida.');
      await db.query(
        `INSERT INTO house_presence(home_id,user_id,character_id,variant_id,room,x,y,scale)VALUES($1,$2,$3,$4,$5,$6,$7,$8)ON CONFLICT(home_id,user_id)DO UPDATE SET character_id=excluded.character_id,variant_id=excluded.variant_id,room=excluded.room,x=excluded.x,y=excluded.y,scale=excluded.scale,updated_at=now()`,
        [
          h.id,
          res.locals.user.id,
          input.character_id,
          input.variant_id,
          input.room,
          input.x,
          input.y,
          input.scale,
        ],
      );
    });
    res.json({ ok: true });
  });
  router.delete('/house/:id/presence', async (req, res) => {
    await transaction(async (db) => {
      const h = await access(db, uuid.parse(req.params.id), res.locals.user.id);
      await db.query('DELETE FROM house_presence WHERE home_id=$1 AND user_id=$2', [
        h.id,
        res.locals.user.id,
      ]);
    });
    res.json({ ok: true });
  });
  router.post('/house/:id/messages', async (req, res) => {
    const input = z
      .object({
        character_id: uuid,
        body: z.string().trim().min(1).max(2000),
        idempotency_key: uuid,
      })
      .strict()
      .parse(req.body);
    const result = await transaction(async (db) => {
      const h = await access(db, uuid.parse(req.params.id), res.locals.user.id);
      await owned(db, input.character_id, res.locals.user.id);
      const prior = (
        await db.query(
          'SELECT id,body,character_id FROM house_messages WHERE home_id=$1 AND user_id=$2 AND idempotency_key=$3',
          [h.id, res.locals.user.id, input.idempotency_key],
        )
      ).rows[0];
      if (prior) {
        if (prior.body !== input.body || prior.character_id !== input.character_id)
          throw new AppError(409, 'Mensagem já enviada com outro conteúdo.');
        return prior;
      }
      if (
        (
          await db.query(
            "SELECT 1 FROM house_messages WHERE home_id=$1 AND user_id=$2 AND created_at>now()-interval '1 second'",
            [h.id, res.locals.user.id],
          )
        ).rowCount
      )
        throw new AppError(429, 'Aguarde um instante antes de enviar.');
      return (
        await db.query(
          'INSERT INTO house_messages(home_id,user_id,character_id,body,idempotency_key)VALUES($1,$2,$3,$4,$5)RETURNING id',
          [h.id, res.locals.user.id, input.character_id, input.body, input.idempotency_key],
        )
      ).rows[0];
    });
    res.status(201).json(result);
  });
  router.post('/house/admin/grants', async (req, res) => {
    const input = z
      .object({
        character_id: uuid,
        catalog_id: z.string().max(60),
        reason: z.string().trim().min(3).max(300),
        idempotency_key: uuid,
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      await requireAdministrator(res.locals.user.id, db);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `house-grant:${res.locals.user.id}:${input.idempotency_key}`,
      ]);
      const prior = (
        await db.query(
          'SELECT * FROM house_admin_grants WHERE granted_by=$1 AND idempotency_key=$2',
          [res.locals.user.id, input.idempotency_key],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.character_id !== input.character_id ||
          prior.catalog_id !== input.catalog_id ||
          prior.reason !== input.reason
        )
          throw new AppError(409, 'Esta concessão já foi registrada com outro conteúdo.');
        return;
      }
      if (!houseCatalog.some((i) => i.id === input.catalog_id))
        throw new AppError(400, 'Mobília inválida.');
      if (
        !(
          await db.query('SELECT 1 FROM characters WHERE id=$1 AND deleted_at IS NULL', [
            input.character_id,
          ])
        ).rowCount
      )
        throw new AppError(404, 'Personagem não encontrado.');
      const added = await db.query(
        'INSERT INTO house_items(character_id,catalog_id,source,sender_id,content)VALUES($1,$2,$3,$4,$5)RETURNING id',
        [input.character_id, input.catalog_id, 'admin', res.locals.user.id, { text: input.reason }],
      );
      await db.query(
        'INSERT INTO house_admin_grants(granted_by,idempotency_key,character_id,catalog_id,reason,item_id)VALUES($1,$2,$3,$4,$5,$6)',
        [
          res.locals.user.id,
          input.idempotency_key,
          input.character_id,
          input.catalog_id,
          input.reason,
          added.rows[0].id,
        ],
      );
    });
    res.status(201).json({ ok: true });
  });
  router.get('/house/admin/rewards', async (_req, res) => {
    await requireAdministrator(res.locals.user.id);
    const [rules, missions, achievements] = await Promise.all([
      pool.query('SELECT * FROM house_reward_rules ORDER BY created_at'),
      pool.query(
        "SELECT id,title FROM board_posts WHERE kind='mission' ORDER BY created_at DESC LIMIT 200",
      ),
      Promise.resolve({ rows: achievementCatalog }),
    ]);
    res.json({ rules: rules.rows, missions: missions.rows, achievements: achievements.rows });
  });
  router.post('/house/admin/rewards', async (req, res) => {
    const input = z
      .object({
        catalog_id: z.string().max(60),
        mission_id: uuid.nullable().default(null),
        achievement_code: z.string().max(100).nullable().default(null),
        mission_count: z.number().int().min(1).max(10000).nullable().default(null),
      })
      .strict()
      .refine(
        (v) =>
          [v.mission_id, v.achievement_code, v.mission_count].filter((v) => v !== null).length ===
          1,
      )
      .parse(req.body);
    const r = await transaction(async (db) => {
      await requireAdministrator(res.locals.user.id, db);
      if (!houseCatalog.some((i) => i.id === input.catalog_id))
        throw new AppError(400, 'Mobília inválida.');
      if (
        input.mission_id &&
        !(
          await db.query("SELECT 1 FROM board_posts WHERE id=$1 AND kind='mission'", [
            input.mission_id,
          ])
        ).rowCount
      )
        throw new AppError(400, 'Missão inválida.');
      if (
        input.achievement_code &&
        !achievementCatalog.some((a) => a.code === input.achievement_code)
      )
        throw new AppError(400, 'Conquista inválida.');
      return (
        await db.query(
          'INSERT INTO house_reward_rules(catalog_id,mission_id,achievement_code,mission_count,created_by)VALUES($1,$2,$3,$4,$5)RETURNING *',
          [
            input.catalog_id,
            input.mission_id,
            input.achievement_code,
            input.mission_count,
            res.locals.user.id,
          ],
        )
      ).rows[0];
    });
    res.status(201).json(r);
  });
  router.put('/house/admin/rewards/:id', async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).strict().parse(req.body);
    await transaction(async (db) => {
      await requireAdministrator(res.locals.user.id, db);
      if (
        !(
          await db.query('UPDATE house_reward_rules SET active=$2 WHERE id=$1', [
            uuid.parse(req.params.id),
            active,
          ])
        ).rowCount
      )
        throw new AppError(404, 'Recompensa não encontrada.');
    });
    res.json({ ok: true });
  });
  router.post('/house/:id/rewards', async (req, res) => {
    z.object({}).strict().parse(req.body);
    const count = await transaction(async (db) => {
      const h = await access(db, uuid.parse(req.params.id), res.locals.user.id, true);
      await owned(db, h.character_id, res.locals.user.id);
      const eligible = (
        await db.query(
          `SELECT r.* FROM house_reward_rules r WHERE r.active AND NOT EXISTS(SELECT 1 FROM house_reward_grants g WHERE g.character_id=$1 AND g.rule_id=r.id)AND ((r.mission_id IS NOT NULL AND EXISTS(SELECT 1 FROM mission_rewards m JOIN board_posts b ON b.id=m.post_id WHERE m.character_id=$1 AND m.post_id=r.mission_id AND b.status='completed'))OR(r.achievement_code IS NOT NULL AND EXISTS(SELECT 1 FROM achievements a WHERE a.character_id=$1 AND a.code=r.achievement_code))OR(r.mission_count IS NOT NULL AND(SELECT count(*) FROM mission_rewards m JOIN board_posts b ON b.id=m.post_id WHERE m.character_id=$1 AND b.status='completed')>=r.mission_count)) ORDER BY r.id LIMIT 100`,
          [h.character_id],
        )
      ).rows;
      for (const r of eligible) {
        const item = (
          await db.query(
            `INSERT INTO house_items(character_id,catalog_id,source)VALUES($1,$2,'reward')RETURNING id`,
            [h.character_id, r.catalog_id],
          )
        ).rows[0];
        await db.query(
          'INSERT INTO house_reward_grants(character_id,rule_id,item_id)VALUES($1,$2,$3)',
          [h.character_id, r.id, item.id],
        );
      }
      return eligible.length;
    });
    res.json({ granted: count });
  });
  return router;
}
