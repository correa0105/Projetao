import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import sharp from 'sharp';
import { petArtwork } from '../shared/pet-art.js';
import { ownedMountImage } from '../shared/mounts.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator } from './administrators.js';
import { rpPlacementSchema, rpDocumentSchema, rpScenes } from '../shared/rp-lobby.js';
const uuid = z.string().uuid(),
  userId = z.string().min(1).max(100);
const active = 'r.closed_at IS NULL AND (r.expires_at IS NULL OR r.expires_at>now())';
type DB = Pick<PoolClient, 'query'>;
async function blocked(db: DB, a: string, b: string) {
  return !!(
    await db.query(
      'SELECT 1 FROM social_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)',
      [a, b],
    )
  ).rowCount;
}
async function friends(db: DB, a: string, b: string) {
  return (
    !!(
      await db.query(
        "SELECT 1 FROM social_friendships WHERE ((user_a=$1 AND user_b=$2) OR (user_a=$2 AND user_b=$1)) AND status='accepted'",
        [a, b],
      )
    ).rowCount && !(await blocked(db, a, b))
  );
}
async function roomAccess(db: DB, id: string, uid: string, edit = false, lock = false) {
  const r = (
    await db.query(
      `SELECT r.*,u.name AS owner_name FROM rp_rooms r LEFT JOIN "user" u ON u.id=r.owner_id WHERE r.id=$1 AND ${active}${lock ? ' FOR UPDATE OF r' : ''}`,
      [id],
    )
  ).rows[0];
  if (!r) throw new AppError(404, 'Sala encerrada ou não encontrada.');
  const owner = r.owner_id === uid;
  let canEdit = owner;
  if (r.kind === 'fixed') canEdit = await isAdministrator(uid, db as PoolClient);
  else if (!owner) {
    const invite = (
      await db.query(
        "SELECT can_edit FROM rp_room_invites WHERE room_id=$1 AND user_id=$2 AND status='accepted'",
        [id, uid],
      )
    ).rows[0];
    if (!invite || !(await friends(db, uid, r.owner_id)))
      throw new AppError(404, 'Sala não encontrada.');
    canEdit = invite.can_edit;
  }
  if (edit && !canEdit) throw new AppError(403, 'Você não pode editar esta sala.');
  return { ...r, can_edit: canEdit, is_owner: owner };
}
async function ownCharacter(db: DB, id: string, uid: string) {
  if (
    !(
      await db.query('SELECT 1 FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [
        id,
        uid,
      ])
    ).rowCount
  )
    throw new AppError(404, 'Escolha um personagem seu.');
}
async function state(db: DB, r: any, uid: string) {
  const presence = (
    await db.query(
      `SELECT p.user_id,p.character_id,c.name,p.x,p.y,p.scale,p.flip_x,p.depth_layer,p.scene_items FROM rp_room_presence p JOIN characters c ON c.id=p.character_id WHERE p.room_id=$1 AND p.updated_at>now()-interval '5 minutes' AND c.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.user_id) OR (b.blocked_id=$2 AND b.blocker_id=p.user_id)) ORDER BY p.user_id`,
      [r.id, uid],
    )
  ).rows;
  const messages = (
    await db.query(
      `SELECT m.id,m.user_id,m.character_id,c.name,m.body,m.created_at FROM rp_room_messages m JOIN characters c ON c.id=m.character_id WHERE m.room_id=$1 AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=m.user_id) OR (b.blocked_id=$2 AND b.blocker_id=m.user_id)) ORDER BY m.id DESC LIMIT 100`,
      [r.id, uid],
    )
  ).rows.reverse();
  const invites = r.is_owner
    ? (
        await db.query(
          'SELECT i.user_id,u.name,i.status,i.can_edit FROM rp_room_invites i JOIN "user" u ON u.id=i.user_id WHERE i.room_id=$1 ORDER BY u.name',
          [r.id],
        )
      ).rows
    : [];
  return {
    ...r,
    document: rpDocumentSchema.parse(r.document),
    presence: await Promise.all(
      presence.map(async (p) => ({
        ...p,
        scene_items: await enrichItems(db, r.id, p.character_id, p.scene_items),
      })),
    ),
    messages,
    invites,
    participants: presence.length,
  };
}
async function companionSources(db: DB, cid: string) {
  return (
    await db.query(
      "SELECT id,'pet' AS kind,name,pet_id AS species,appearance,NULL AS coat,NULL AS equipment FROM character_pets WHERE character_id=$1 UNION ALL SELECT id,'mount',name,mount_id,NULL,coat,equipment FROM character_mounts WHERE character_id=$1",
      [cid],
    )
  ).rows;
}
async function enrichItems(db: DB, rid: string, cid: string, items: any[]) {
  if (!items?.some((i) => i.kind !== 'prop')) return items || [];
  const sources = await companionSources(db, cid);
  return (items || [])
    .filter(
      (i) => i.kind === 'prop' || sources.some((s) => s.id === i.wardrobe_id && s.kind === i.kind),
    )
    .map((i) => {
      const source = sources.find((s) => s.id === i.wardrobe_id);
      return i.kind === 'prop'
        ? i
        : {
            ...i,
            name: source.name,
            image: '/api/rp-lobby/' + rid + '/companions/' + cid + '/' + source.id + '/image',
          };
    });
}
export function rpLobbyRouter() {
  const router = Router();
  router.get('/rp-lobby', async (_req, res) => {
    const uid = res.locals.user.id;
    const rooms = (
      await pool.query(
        `SELECT r.*,u.name AS owner_name,(SELECT count(*)::int FROM rp_room_presence p WHERE p.room_id=r.id AND p.updated_at>now()-interval '5 minutes') AS participants FROM rp_rooms r LEFT JOIN "user" u ON u.id=r.owner_id WHERE ${active} AND (r.kind='fixed' OR r.owner_id=$1 OR EXISTS(SELECT 1 FROM rp_room_invites i JOIN social_friendships f ON ((f.user_a=$1 AND f.user_b=r.owner_id) OR (f.user_b=$1 AND f.user_a=r.owner_id)) AND f.status='accepted' WHERE i.room_id=r.id AND i.user_id=$1 AND i.status='accepted' AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=r.owner_id) OR (b.blocked_id=$1 AND b.blocker_id=r.owner_id)))) ORDER BY r.kind,r.name,r.id`,
        [uid],
      )
    ).rows;
    const invites = (
      await pool.query(
        `SELECT i.room_id,r.name,u.name AS owner_name,i.status FROM rp_room_invites i JOIN rp_rooms r ON r.id=i.room_id JOIN "user" u ON u.id=r.owner_id WHERE i.user_id=$1 AND i.status='pending' AND ${active} AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=r.owner_id) OR (b.blocked_id=$1 AND b.blocker_id=r.owner_id)) ORDER BY r.created_at DESC`,
        [uid],
      )
    ).rows;
    res.json({ rooms, invites });
  });
  router.post('/rp-lobby', async (req, res) => {
    const input = z
        .object({
          name: z.string().trim().min(2).max(80),
          character_id: uuid,
          scene: z.string().refine((id) => rpScenes.some((s) => s.id === id)),
          hours: z.number().int().min(1).max(24).default(12),
        })
        .strict()
        .parse(req.body),
      uid = res.locals.user.id;
    res.status(201).json(
      await transaction(async (db) => {
        await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [uid]);
        await ownCharacter(db, input.character_id, uid);
        await db.query(
          "UPDATE rp_rooms SET closed_at=now() WHERE owner_id=$1 AND kind='temporary' AND closed_at IS NULL AND expires_at<=now()",
          [uid],
        );
        if (
          (
            await db.query(
              "SELECT 1 FROM rp_rooms WHERE owner_id=$1 AND kind='temporary' AND closed_at IS NULL",
              [uid],
            )
          ).rowCount
        )
          throw new AppError(
            409,
            'Você já tem uma sala temporária aberta. Entre nela ou encerre antes de criar outra.',
          );
        return (
          await db.query(
            "INSERT INTO rp_rooms(name,kind,owner_id,character_id,document,expires_at) VALUES($1,'temporary',$2,$3,$4,now()+($5*interval '1 hour')) RETURNING id",
            [
              input.name,
              uid,
              input.character_id,
              JSON.stringify({ scene: input.scene, placements: [] }),
              input.hours,
            ],
          )
        ).rows[0];
      }),
    );
  });
  router.get('/rp-lobby/companion-library', async (req, res) => {
    const cid = uuid.parse(req.query.character_id);
    await ownCharacter(pool, cid, res.locals.user.id);
    res.json({
      sources: (await companionSources(pool, cid)).map((s) => ({
        ...s,
        image: '/api/companions/' + cid + '/' + s.kind + '/' + s.id + '/base-image',
      })),
    });
  });
  router.put('/rp-lobby/:id/scene-items', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id;
    const itemSchema = rpPlacementSchema.safeExtend({
      kind: z.enum(['prop', 'pet', 'mount']),
      wardrobe_id: uuid.optional(),
    });
    const input = z
      .object({ character_id: uuid, items: z.array(itemSchema) })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const r = await roomAccess(db, id, uid, false, true);
      await ownCharacter(db, input.character_id, uid);
      if (new Set(input.items.map((i) => i.id)).size !== input.items.length)
        throw new AppError(400, 'Peças repetidas.');
      if (
        (r.kind === 'fixed' || !r.is_owner) &&
        input.items.filter((i) => i.kind === 'prop').length > 4
      )
        throw new AppError(409, 'Cada jogador pode colocar até 4 itens neste lobby.');
      if (input.items.filter((i) => i.kind !== 'prop').length > 20)
        throw new AppError(400, 'Muitos acompanhantes na cena.');
      const animals = input.items.filter((i) => i.kind !== 'prop');
      if (new Set(animals.map((i) => i.kind + ':' + i.wardrobe_id)).size !== animals.length)
        throw new AppError(400, 'Acompanhante repetido.');
      const sources = await companionSources(db, input.character_id);
      for (const i of input.items)
        if (i.kind !== 'prop' && !sources.some((s) => s.id === i.wardrobe_id && s.kind === i.kind))
          throw new AppError(404, 'Este acompanhante não pertence ao personagem.');
      const saved = await db.query(
        'UPDATE rp_room_presence SET scene_items=$4::jsonb,updated_at=now() WHERE room_id=$1 AND user_id=$2 AND character_id=$3',
        [id, uid, input.character_id, JSON.stringify(input.items)],
      );
      if (!saved.rowCount) throw new AppError(409, 'Entre na sala com este personagem.');
    });
    res.json({ ok: true });
  });
  router.get('/rp-lobby/:id/companions/:character/:animal/image', async (req, res) => {
    const id = uuid.parse(req.params.id),
      cid = uuid.parse(req.params.character),
      aid = uuid.parse(req.params.animal),
      uid = res.locals.user.id;
    await roomAccess(pool, id, uid);
    const p = (
      await pool.query(
        "SELECT user_id,scene_items FROM rp_room_presence WHERE room_id=$1 AND character_id=$2 AND updated_at>now()-interval '5 minutes'",
        [id, cid],
      )
    ).rows[0];
    if (
      !p ||
      (await blocked(pool, uid, p.user_id)) ||
      !p.scene_items.some((i: any) => i.wardrobe_id === aid)
    )
      throw new AppError(404, 'Acompanhante indisponível.');
    const source = (await companionSources(pool, cid)).find((s) => s.id === aid);
    if (!source) throw new AppError(404, 'Acompanhante indisponível.');
    const art = (
      await pool.query('SELECT image FROM companion_artworks WHERE wardrobe_id=$1', [aid])
    ).rows[0];
    let bytes = art?.image;
    if (!bytes) {
      const pet = source.kind === 'pet' ? petArtwork(source.species, source.appearance) : null;
      const file = pet
        ? pet.source
        : ownedMountImage({
            mount_id: source.species,
            coat: source.coat,
            equipment: source.equipment || [],
          });
      for (const root of ['public', 'dist/client'])
        try {
          bytes = await readFile(resolve(root, file.replace(/^\//, '')));
          if (pet) {
            const [left, top, width, height] = pet.frame;
            bytes = await sharp(bytes).extract({ left, top, width, height }).png().toBuffer();
          }
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
    }
    if (!bytes) throw new AppError(404, 'Imagem não disponível.');
    res
      .set('Cache-Control', 'private, no-store')
      .type('webp')
      .send(await sharp(bytes).webp().toBuffer());
  });
  router.get('/rp-lobby/:id', async (req, res) =>
    res.json(
      await state(
        pool,
        await roomAccess(pool, uuid.parse(req.params.id), res.locals.user.id),
        res.locals.user.id,
      ),
    ),
  );
  router.put('/rp-lobby/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id;
    const input = z
      .object({
        name: z.string().trim().min(2).max(80),
        document: rpDocumentSchema,
        revision: z.number().int().min(0),
      })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (db) => {
        const r = await roomAccess(db, id, uid, true, true);
        if (r.revision !== input.revision)
          throw new AppError(
            409,
            'A sala mudou. Seu rascunho foi mantido; recarregue antes de salvar novamente.',
          );
        return (
          await db.query(
            'UPDATE rp_rooms SET name=$2,document=$3,revision=revision+1 WHERE id=$1 RETURNING revision',
            [id, input.name, JSON.stringify(input.document)],
          )
        ).rows[0];
      }),
    );
  });
  router.post('/rp-lobby/:id/close', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id;
    await transaction(async (db) => {
      const r = await roomAccess(db, id, uid, false, true);
      if (!r.is_owner || r.kind !== 'temporary')
        throw new AppError(403, 'Somente o anfitrião pode encerrar esta sala.');
      await db.query('UPDATE rp_rooms SET closed_at=now() WHERE id=$1', [id]);
      await db.query('DELETE FROM rp_room_presence WHERE room_id=$1', [id]);
    });
    res.json({ closed: true });
  });
  router.post('/rp-lobby/:id/invites', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      input = z
        .object({ user_id: userId, can_edit: z.boolean().default(false) })
        .strict()
        .parse(req.body);
    await transaction(async (db) => {
      const r = await roomAccess(db, id, uid, false, true);
      if (!r.is_owner) throw new AppError(403, 'Somente o anfitrião pode convidar.');
      if (input.user_id === uid || !(await friends(db, uid, input.user_id)))
        throw new AppError(403, 'Escolha um amigo aceito para convidar.');
      if (
        (await db.query('SELECT count(*)::int n FROM rp_room_invites WHERE room_id=$1', [id]))
          .rows[0].n >= 50 &&
        !(
          await db.query('SELECT 1 FROM rp_room_invites WHERE room_id=$1 AND user_id=$2', [
            id,
            input.user_id,
          ])
        ).rowCount
      )
        throw new AppError(409, 'Esta sala atingiu o limite de convites.');
      await db.query(
        "INSERT INTO rp_room_invites(room_id,user_id,can_edit) VALUES($1,$2,$3) ON CONFLICT(room_id,user_id) DO UPDATE SET can_edit=excluded.can_edit,status=CASE WHEN rp_room_invites.status='accepted' THEN 'accepted' ELSE 'pending' END",
        [id, input.user_id, input.can_edit],
      );
    });
    res.json({ invited: true });
  });
  router.put('/rp-lobby/:id/invite', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      input = z.object({ accept: z.boolean() }).strict().parse(req.body);
    await transaction(async (db) => {
      const r = (
        await db.query(`SELECT r.* FROM rp_rooms r WHERE r.id=$1 AND ${active} FOR UPDATE`, [id])
      ).rows[0];
      if (!r || !(await friends(db, uid, r.owner_id)))
        throw new AppError(404, 'Convite indisponível.');
      const changed = await db.query(
        'UPDATE rp_room_invites SET status=$3 WHERE room_id=$1 AND user_id=$2 RETURNING user_id',
        [id, uid, input.accept ? 'accepted' : 'declined'],
      );
      if (!changed.rowCount) throw new AppError(404, 'Convite não encontrado.');
      if (!input.accept)
        await db.query('DELETE FROM rp_room_presence WHERE room_id=$1 AND user_id=$2', [id, uid]);
    });
    res.json({ accepted: input.accept });
  });
  router.delete('/rp-lobby/:id/invites/:user', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      target = userId.parse(req.params.user);
    await transaction(async (db) => {
      const r = await roomAccess(db, id, uid, false, true);
      if (!r.is_owner) throw new AppError(403, 'Somente o anfitrião pode remover convidados.');
      await db.query('DELETE FROM rp_room_invites WHERE room_id=$1 AND user_id=$2', [id, target]);
      await db.query('DELETE FROM rp_room_presence WHERE room_id=$1 AND user_id=$2', [id, target]);
    });
    res.json({ removed: true });
  });
  router.put('/rp-lobby/:id/presence', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      input = z
        .object({
          character_id: uuid,
          x: z.number().finite().min(0.03).max(0.97),
          y: z.number().finite().min(0.4).max(0.98),
          scale: z.number().finite().min(0.06).max(0.35),
          flip_x: z.boolean(),
          depth_layer: z.number().int().min(1).max(6).default(4),
        })
        .strict()
        .parse(req.body);
    await transaction(async (db) => {
      await roomAccess(db, id, uid, false, true);
      await ownCharacter(db, input.character_id, uid);
      await db.query(
        'INSERT INTO rp_room_presence(room_id,user_id,character_id,x,y,scale,flip_x,depth_layer) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(room_id,user_id) DO UPDATE SET character_id=excluded.character_id,x=excluded.x,y=excluded.y,scale=excluded.scale,flip_x=excluded.flip_x,depth_layer=excluded.depth_layer,scene_items=CASE WHEN rp_room_presence.character_id=excluded.character_id THEN rp_room_presence.scene_items ELSE jsonb_build_array() END,updated_at=now()',
        [
          id,
          uid,
          input.character_id,
          input.x,
          input.y,
          input.scale,
          input.flip_x,
          input.depth_layer,
        ],
      );
    });
    res.json({ joined: true });
  });
  router.delete('/rp-lobby/:id/presence', async (req, res) => {
    await pool.query('DELETE FROM rp_room_presence WHERE room_id=$1 AND user_id=$2', [
      uuid.parse(req.params.id),
      res.locals.user.id,
    ]);
    res.json({ left: true });
  });
  router.get('/rp-lobby/:id/portraits/:character', async (req, res) => {
    const id = uuid.parse(req.params.id),
      cid = uuid.parse(req.params.character),
      uid = res.locals.user.id;
    await roomAccess(pool, id, uid);
    const p = (
      await pool.query(
        "SELECT a.image,p.user_id FROM rp_room_presence p JOIN characters c ON c.id=p.character_id JOIN character_portraits a ON a.character_id=c.id WHERE p.room_id=$1 AND p.character_id=$2 AND p.updated_at>now()-interval '5 minutes' AND c.deleted_at IS NULL",
        [id, cid],
      )
    ).rows[0];
    if (!p || (await blocked(pool, uid, p.user_id)))
      throw new AppError(404, 'Retrato indisponível.');
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('webp').send(await sharp(p.image).webp({ quality: 90 }).toBuffer());
  });
  router.post('/rp-lobby/:id/messages', async (req, res) => {
    const id = uuid.parse(req.params.id),
      uid = res.locals.user.id,
      input = z
        .object({ character_id: uuid, body: z.string().trim().min(1).max(2000), request_id: uuid })
        .strict()
        .parse(req.body);
    res.json(
      await transaction(async (db) => {
        await roomAccess(db, id, uid, false, true);
        await ownCharacter(db, input.character_id, uid);
        if (
          !(
            await db.query(
              'SELECT 1 FROM rp_room_presence WHERE room_id=$1 AND user_id=$2 AND character_id=$3',
              [id, uid, input.character_id],
            )
          ).rowCount
        )
          throw new AppError(409, 'Entre com este personagem antes de enviar RP.');
        const replay = (
          await db.query(
            'SELECT id FROM rp_room_messages WHERE room_id=$1 AND user_id=$2 AND request_id=$3',
            [id, uid, input.request_id],
          )
        ).rows[0];
        if (replay) return { ...replay, replayed: true };
        if (
          (
            await db.query(
              "SELECT count(*)::int n FROM rp_room_messages WHERE room_id=$1 AND user_id=$2 AND created_at>now()-interval '10 seconds'",
              [id, uid],
            )
          ).rows[0].n >= 6
        )
          throw new AppError(429, 'Aguarde um instante antes da próxima mensagem.');
        return (
          await db.query(
            'INSERT INTO rp_room_messages(room_id,user_id,character_id,body,request_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
            [id, uid, input.character_id, input.body, input.request_id],
          )
        ).rows[0];
      }),
    );
  });
  return router;
}
