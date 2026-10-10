import express from 'express';
import { z } from 'zod';
import sharp from 'sharp';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
import {
  profileSettingsSchema,
  hallSettingsSchema,
  defaultHallSettings,
  fameScore,
} from '../shared/social.js';
import { emptyShelf, achievementCatalog } from '../shared/achievements.js';
import { deriveSheet } from '../shared/character-sheet.js';
import { cards } from '../shared/cards.js';
import { withCompanionImages } from './companion-images.js';
const uuid = z.string().uuid(),
  userId = z.string().min(1).max(100);
const publicCharacterSql = `SELECT c.id,c.user_id,c.name,c.race,c.class,c.background,c.biography,c.level,c.hp,c.armor_class,c.stats,(SELECT s.choices->'options'->'size'->>0 FROM character_sheets s WHERE s.character_id=c.id) AS species_size,c.portrait_revision,c.progression_missions,c.title_position,t.document->>'name' AS displayed_title FROM characters c LEFT JOIN title_catalog t ON t.id=c.displayed_title_id AND t.deleted_at IS NULL AND EXISTS(SELECT 1 FROM character_titles ct WHERE ct.character_id=c.id AND ct.title_id=t.id AND NOT ct.revoked) WHERE c.deleted_at IS NULL`;
async function existing(id: string) {
  if (!(await pool.query('SELECT id FROM "user" WHERE id=$1', [id])).rowCount)
    throw new AppError(404, 'Perfil não encontrado.');
}
type DB = Pick<PoolClient, 'query'>;
async function pairTransaction<T>(a: string, b: string, fn: (db: PoolClient) => Promise<T>) {
  return transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      JSON.stringify([a, b].sort()),
    ]);
    return fn(db);
  });
}
async function blocked(a: string, b: string, db: DB = pool) {
  return !!(
    await db.query(
      'SELECT 1 FROM social_blocks WHERE (blocker_id=$1 AND blocked_id=$2)OR(blocker_id=$2 AND blocked_id=$1)',
      [a, b],
    )
  ).rowCount;
}
async function friendship(a: string, b: string, db: DB = pool) {
  return (
    (
      await db.query(
        'SELECT * FROM social_friendships WHERE(user_a=$1 AND user_b=$2)OR(user_a=$2 AND user_b=$1)',
        [a, b],
      )
    ).rows[0] || null
  );
}
const portrait = (uid: string, cid: string, revision = 0) =>
  `/api/profiles/${encodeURIComponent(uid)}/characters/${cid}/portrait?v=${revision}`;
const avatarSql = `COALESCE(NULLIF(p.document->>'avatar',''),(SELECT '/api/profiles/'||c.user_id||'/characters/'||c.id||'/portrait?thumb=1&v='||c.portrait_revision FROM characters c WHERE c.user_id=u.id AND c.deleted_at IS NULL ORDER BY c.created_at LIMIT 1),'')`;
export function socialRouter() {
  const router = express.Router();
  router.get('/profiles', async (req, res) => {
    const query = z
        .string()
        .max(100)
        .parse(req.query.q || ''),
      offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(req.query.offset || 0);
    const args = [`%${query.replace(/[\\%_]/g, '\\$&')}%`, offset];
    const result = await pool.query(
      `SELECT u.id,u.name,COALESCE(p.document->>'tagline','') AS tagline,${avatarSql} AS avatar,(SELECT count(*)::int FROM characters c WHERE c.user_id=u.id AND c.deleted_at IS NULL) AS characters,COALESCE((SELECT round(avg(score),2) FROM profile_reviews r WHERE r.target_id=u.id),0)::float AS rating,(SELECT count(*)::int FROM profile_reviews r WHERE r.target_id=u.id) AS rating_count FROM "user" u LEFT JOIN player_profiles p ON p.user_id=u.id WHERE u.name ILIKE $1 OR u.id ILIKE $1 ORDER BY lower(u.name),u.id LIMIT 40 OFFSET $2`,
      args,
    );
    res.json({ items: result.rows, has_more: result.rows.length === 40 });
  });
  router.get('/profiles/:user', async (req, res) => {
    const uid = userId.parse(req.params.user),
      {
        rows: [u],
      } = await pool.query(
        `SELECT u.id,u.name,COALESCE(p.document,'{}') AS document,COALESCE(p.revision,0) AS revision,${avatarSql} AS avatar FROM "user" u LEFT JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$1`,
        [uid],
      );
    if (!u) throw new AppError(404, 'Perfil não encontrado.');
    const [characters, reviews, friend, ratingSummary, ownReview] = await Promise.all([
      pool.query(publicCharacterSql + ' AND c.user_id=$1 ORDER BY c.created_at,c.id', [uid]),
      pool.query(
        'SELECT r.author_id,u.name AS author,r.score,r.comment,r.created_at FROM profile_reviews r JOIN "user" u ON u.id=r.author_id WHERE r.target_id=$1 ORDER BY r.created_at DESC LIMIT 100',
        [uid],
      ),
      friendship(res.locals.user.id, uid),
      pool.query(
        'SELECT count(*)::int AS count,COALESCE(avg(score),0)::float AS average FROM profile_reviews WHERE target_id=$1',
        [uid],
      ),
      pool.query(
        'SELECT r.author_id,u.name AS author,r.score,r.comment,r.created_at FROM profile_reviews r JOIN "user" u ON u.id=r.author_id WHERE r.target_id=$1 AND r.author_id=$2',
        [uid, res.locals.user.id],
      ),
    ]);
    res.json({
      ...u,
      document: profileSettingsSchema.parse(u.document),
      is_owner: uid === res.locals.user.id,
      characters: characters.rows.map((c) => ({
        ...c,
        portrait: portrait(uid, c.id, c.portrait_revision),
      })),
      reviews:
        ownReview.rows[0] && !reviews.rows.some((r) => r.author_id === res.locals.user.id)
          ? [ownReview.rows[0], ...reviews.rows]
          : reviews.rows,
      rating: ratingSummary.rows[0],
      friend: friend
        ? {
            id: friend.id,
            status: friend.status,
            incoming: friend.requested_by !== res.locals.user.id,
          }
        : null,
      blocked: await blocked(res.locals.user.id, uid),
      blocked_by_me: !!(
        await pool.query('SELECT 1 FROM social_blocks WHERE blocker_id=$1 AND blocked_id=$2', [
          res.locals.user.id,
          uid,
        ])
      ).rowCount,
    });
  });
  router.put('/profiles/:user', async (req, res) => {
    const uid = userId.parse(req.params.user);
    if (uid !== res.locals.user.id)
      throw new AppError(403, 'Você só pode editar seu próprio perfil.');
    const input = z
      .object({ document: profileSettingsSchema, revision: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    const doc = input.document;
    for (const path of [doc.avatar, doc.background])
      if (path && !['/character-camp-v2.png', '/notice-village-empty-v4.png'].includes(path)) {
        if (
          !/^\/api\/social\/assets\/[0-9a-f-]{36}$/.test(path) ||
          (
            await pool.query('SELECT id FROM profile_assets WHERE id=$1 AND user_id=$2', [
              path.split('/').at(-1),
              uid,
            ])
          ).rowCount !== 1
        )
          throw new AppError(400, 'Imagem de perfil inválida.');
      }
    if (
      doc.featured.length &&
      (
        await pool.query(
          'SELECT id FROM characters WHERE user_id=$1 AND id=ANY($2::uuid[])AND deleted_at IS NULL',
          [uid, doc.featured],
        )
      ).rowCount !== new Set(doc.featured).size
    )
      throw new AppError(400, 'Selecione somente personagens da sua conta.');
    const saved = await transaction(async (db) => {
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [uid]);
      const {
        rows: [current],
      } = await db.query('SELECT revision,document FROM player_profiles WHERE user_id=$1', [uid]);
      if ((current?.revision || 0) !== input.revision)
        throw new AppError(409, 'Seu perfil mudou. Reabra antes de salvar.');
      if (
        doc.background.startsWith('/api/social/assets/') &&
        doc.background !== current?.document?.background
      )
        throw new AppError(403, 'Cenários próprios não estão disponíveis para personalização.');
      return (
        await db.query(
          'INSERT INTO player_profiles(user_id,document)VALUES($1,$2)ON CONFLICT(user_id)DO UPDATE SET document=$2,revision=player_profiles.revision+1,updated_at=now()RETURNING document,revision',
          [uid, JSON.stringify(doc)],
        )
      ).rows[0];
    });
    res.json(saved);
  });
  router.get('/profiles/:user/characters/:character', async (req, res) => {
    const uid = userId.parse(req.params.user),
      cid = uuid.parse(req.params.character),
      {
        rows: [c],
      } = await pool.query(publicCharacterSql + ' AND c.id=$1 AND c.user_id=$2', [cid, uid]);
    if (!c) throw new AppError(404, 'Personagem não encontrado neste perfil.');
    const [shelf, achievements, mounts, pets, ownedCards, sheet, titles, definitions] =
      await Promise.all([
        pool.query(
          'SELECT material,medal_frame,slots,positions,rows FROM achievement_shelves WHERE character_id=$1',
          [cid],
        ),
        pool.query('SELECT code,unlocked_at FROM achievements WHERE character_id=$1', [cid]),
        pool.query(
          'SELECT id,mount_id,coat,name,equipment,displayed FROM character_mounts WHERE character_id=$1',
          [cid],
        ),
        pool.query(
          'SELECT id,pet_id,appearance,name,displayed FROM character_pets WHERE character_id=$1',
          [cid],
        ),
        pool.query(
          'SELECT card_id,level,slot FROM character_cards WHERE character_id=$1 ORDER BY slot NULLS LAST',
          [cid],
        ),
        pool.query('SELECT choices,finalized_at FROM character_sheets WHERE character_id=$1', [
          cid,
        ]),
        pool.query(
          'SELECT t.id,t.document FROM title_catalog t JOIN character_titles ct ON ct.title_id=t.id WHERE ct.character_id=$1 AND NOT ct.revoked AND t.deleted_at IS NULL',
          [cid],
        ),
        pool.query('SELECT code,title,description FROM achievement_definitions'),
      ]);
    const publicImages = async (
      animals: { id: string; displayed: boolean; image_url?: string | null }[],
    ) =>
      (await withCompanionImages(pool, cid, animals)).map((animal) => ({
        ...animal,
        image_url:
          animal.displayed && animal.image_url
            ? animal.image_url.replace(
                `/api/companions/${cid}/`,
                `/api/profiles/${encodeURIComponent(uid)}/characters/${cid}/companions/`,
              )
            : null,
      }));
    const [publicMounts, publicPets] = await Promise.all([
      publicImages(mounts.rows),
      publicImages(pets.rows),
    ]);
    res.json({
      character: { ...c, portrait: portrait(uid, cid, c.portrait_revision) },
      shelf: shelf.rows[0] || emptyShelf(),
      achievements: achievements.rows,
      definitions: achievementCatalog.map((a) => ({
        ...a,
        ...definitions.rows.find((d) => d.code === a.code),
      })),
      mounts: publicMounts,
      pets: publicPets,
      cards: ownedCards.rows.map((c) => ({
        ...cards.find((d) => d.id === c.card_id),
        level: c.level,
        slot: c.slot,
      })),
      titles: titles.rows,
      derived: sheet.rows[0]?.finalized_at ? deriveSheet(c, sheet.rows[0].choices) : null,
    });
  });
  router.get(
    '/profiles/:user/characters/:character/companions/:kind/:companion/image',
    async (req, res) => {
      const uid = userId.parse(req.params.user),
        cid = uuid.parse(req.params.character),
        kind = z.enum(['mount', 'pet']).parse(req.params.kind),
        companionId = uuid.parse(req.params.companion),
        table = kind === 'mount' ? 'character_mounts' : 'character_pets';
      const {
        rows: [art],
      } = await pool.query(
        `SELECT a.image FROM companion_artworks a
       JOIN companion_wardrobes w ON w.id=a.wardrobe_id
       JOIN characters c ON c.id=w.character_id
       JOIN ${table} animal ON animal.id=w.id AND animal.character_id=c.id
       WHERE c.user_id=$1 AND c.id=$2 AND w.id=$3 AND w.kind=$4
         AND c.deleted_at IS NULL AND animal.displayed
         AND NOT EXISTS(SELECT 1 FROM social_blocks b
           WHERE (b.blocker_id=$5 AND b.blocked_id=c.user_id)
              OR (b.blocker_id=c.user_id AND b.blocked_id=$5))`,
        [uid, cid, companionId, kind, res.locals.user.id],
      );
      if (!art) throw new AppError(404, 'Imagem não encontrada neste perfil.');
      res.setHeader('Cache-Control', 'private, no-store');
      res.type('png').send(art.image);
    },
  );
  router.get('/profiles/:user/characters/:character/portrait', async (req, res) => {
    const uid = userId.parse(req.params.user),
      cid = uuid.parse(req.params.character);
    const {
      rows: [p],
    } = await pool.query(
      'SELECT p.image FROM character_portraits p JOIN characters c ON c.id=p.character_id WHERE c.user_id=$1 AND c.id=$2 AND c.deleted_at IS NULL',
      [uid, cid],
    );
    if (!p) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.type('image/webp');
    if (req.query.face === '1') {
      const trimmed = await sharp(p.image).trim().toBuffer({ resolveWithObject: true });
      const sample = await sharp(trimmed.data)
        .resize(100, 100, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer();
      let sum = 0,
        weight = 0;
      for (let y = 0; y < 18; y++)
        for (let x = 0; x < 100; x++) {
          const alpha = sample[(y * 100 + x) * 4 + 3];
          sum += x * alpha;
          weight += alpha;
        }
      const height = Math.max(1, Math.round(trimmed.info.height * 0.44));
      const width = Math.min(trimmed.info.width, Math.max(1, Math.round(height * 0.67)));
      const center = weight
        ? ((sum / weight + 0.5) / 100) * trimmed.info.width
        : trimmed.info.width / 2;
      const left = Math.max(
        0,
        Math.min(trimmed.info.width - width, Math.round(center - width / 2)),
      );
      res.end(
        await sharp(trimmed.data)
          .extract({ left, top: 0, width, height })
          .resize(256, 400, { fit: 'cover', position: 'centre' })
          .webp({ quality: 91 })
          .toBuffer(),
      );
    } else if (req.query.thumb === '1')
      res.end(
        await sharp(p.image)
          .resize(256, 256, { fit: 'cover', position: 'attention' })
          .webp({ quality: 87 })
          .toBuffer(),
      );
    else res.end(await sharp(p.image).webp({ quality: 94 }).toBuffer());
  });
  router.post('/profiles/:user/review', async (req, res) => {
    const uid = userId.parse(req.params.user);
    await existing(uid);
    if (uid === res.locals.user.id)
      throw new AppError(403, 'Você não pode avaliar seu próprio perfil.');
    if (await blocked(uid, res.locals.user.id))
      throw new AppError(403, 'Avaliação indisponível entre estas contas.');
    const input = z
      .object({
        score: z.number().int().min(1).max(5),
        comment: z.string().trim().max(500).default(''),
      })
      .strict()
      .parse(req.body);
    await pool.query(
      'INSERT INTO profile_reviews(target_id,author_id,score,comment)VALUES($1,$2,$3,$4)ON CONFLICT(target_id,author_id)DO UPDATE SET score=$3,comment=$4,created_at=now()',
      [uid, res.locals.user.id, input.score, input.comment],
    );
    res.json({ ok: true });
  });
  router.delete('/profiles/:user/review', async (req, res) => {
    const uid = userId.parse(req.params.user);
    await pool.query('DELETE FROM profile_reviews WHERE target_id=$1 AND author_id=$2', [
      uid,
      res.locals.user.id,
    ]);
    res.json({ ok: true });
  });
  router.post(
    '/social/assets',
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '8mb' }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new AppError(400, 'Envie uma imagem.');
      let bytes: Buffer;
      try {
        bytes = await sharp(req.body, { limitInputPixels: 40000000 })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 91 })
          .toBuffer();
      } catch {
        throw new AppError(400, 'Imagem inválida.');
      }
      const {
        rows: [a],
      } = await pool.query('INSERT INTO profile_assets(user_id,bytes)VALUES($1,$2)RETURNING id', [
        res.locals.user.id,
        bytes,
      ]);
      res.status(201).json({ path: '/api/social/assets/' + a.id });
    },
  );
  router.get('/social/assets/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      {
        rows: [a],
      } = await pool.query('SELECT a.bytes,a.user_id FROM profile_assets a WHERE id=$1', [id]);
    if (!a) throw new AppError(404, 'Imagem não encontrada.');
    if (
      a.user_id !== res.locals.user.id &&
      !(
        await pool.query(
          `SELECT 1 FROM player_profiles WHERE user_id=$1 AND (document->>'avatar'=$2 OR document->>'background'=$2)`,
          [a.user_id, '/api/social/assets/' + id],
        )
      ).rowCount
    )
      throw new AppError(404, 'Imagem não publicada.');
    res.type('image/webp').end(a.bytes);
  });
  router.get('/social/friends', async (_req, res) => {
    const uid = res.locals.user.id;
    const { rows } = await pool.query(
      `SELECT f.id,f.status,f.requested_by<>$1 AS incoming,u.id AS user_id,u.name,${avatarSql} AS avatar FROM social_friendships f JOIN "user" u ON u.id=CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END LEFT JOIN player_profiles p ON p.user_id=u.id WHERE f.user_a=$1 OR f.user_b=$1 ORDER BY f.status,f.created_at DESC`,
      [uid],
    );
    const blocks = await pool.query(
      'SELECT b.blocked_id AS id,u.name FROM social_blocks b JOIN "user" u ON u.id=b.blocked_id WHERE b.blocker_id=$1',
      [uid],
    );
    res.json({
      items: rows.map((r) => ({ ...r, friendship_id: r.id, id: r.user_id })),
      blocks: blocks.rows,
    });
  });
  router.post('/social/friends/:user', async (req, res) => {
    const other = userId.parse(req.params.user),
      uid = res.locals.user.id;
    await existing(other);
    if (uid === other) throw new AppError(400, 'Escolha outro jogador.');
    await pairTransaction(uid, other, async (db) => {
      if (await blocked(uid, other, db))
        throw new AppError(403, 'Pedido indisponível entre estas contas.');
      await db.query(
        'INSERT INTO social_friendships(user_a,user_b,requested_by)VALUES($1,$2,$1)ON CONFLICT DO NOTHING',
        [uid, other],
      );
    });
    res.status(201).json({ ok: true });
  });
  router.patch('/social/friends/:user', async (req, res) => {
    const other = userId.parse(req.params.user),
      uid = res.locals.user.id;
    await pairTransaction(uid, other, async (db) => {
      if (await blocked(uid, other, db)) throw new AppError(403, 'Pedido indisponível.');
      const r = await db.query(
        `UPDATE social_friendships SET status='accepted' WHERE ((user_a=$1 AND user_b=$2)OR(user_a=$2 AND user_b=$1))AND requested_by=$2 AND status='pending' RETURNING id`,
        [uid, other],
      );
      if (!r.rowCount) throw new AppError(404, 'Pedido recebido não encontrado.');
    });
    res.json({ ok: true });
  });
  router.delete('/social/friends/:user', async (req, res) => {
    const other = userId.parse(req.params.user),
      uid = res.locals.user.id;
    await pairTransaction(uid, other, async (db) =>
      db.query(
        'DELETE FROM social_friendships WHERE(user_a=$1 AND user_b=$2)OR(user_a=$2 AND user_b=$1)',
        [uid, other],
      ),
    );
    res.json({ ok: true });
  });
  router.post('/social/blocks/:user', async (req, res) => {
    const other = userId.parse(req.params.user),
      uid = res.locals.user.id;
    await existing(other);
    if (other === uid) throw new AppError(400, 'Não pode bloquear a própria conta.');
    await pairTransaction(uid, other, async (db) => {
      await db.query(
        'INSERT INTO social_blocks(blocker_id,blocked_id)VALUES($1,$2)ON CONFLICT DO NOTHING',
        [uid, other],
      );
      await db.query(
        'DELETE FROM social_friendships WHERE(user_a=$1 AND user_b=$2)OR(user_a=$2 AND user_b=$1)',
        [uid, other],
      );
    });
    res.json({ ok: true });
  });
  router.delete('/social/blocks/:user', async (req, res) => {
    const uid = res.locals.user.id,
      other = userId.parse(req.params.user);
    await pairTransaction(uid, other, async (db) =>
      db.query('DELETE FROM social_blocks WHERE blocker_id=$1 AND blocked_id=$2', [uid, other]),
    );
    res.json({ ok: true });
  });
  router.get('/social/inbox', async (_req, res) => {
    const uid = res.locals.user.id;
    const { rows } = await pool.query(
      `SELECT DISTINCT ON(other.id)other.id,other.name,m.body,m.created_at,(SELECT count(*)::int FROM social_messages unseen WHERE unseen.sender_id=other.id AND unseen.recipient_id=$1 AND unseen.read_at IS NULL) AS unread FROM social_messages m JOIN "user" other ON other.id=CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END WHERE m.sender_id=$1 OR m.recipient_id=$1 ORDER BY other.id,m.id DESC`,
      [uid],
    );
    res.json(
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    );
  });
  router.get('/social/chat/:user', async (req, res) => {
    const uid = res.locals.user.id,
      other = userId.parse(req.params.user);
    await existing(other);
    const before = z.coerce
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .parse(req.query.before || Number.MAX_SAFE_INTEGER);
    const { rows } = await pool.query(
      'SELECT id::text,sender_id,recipient_id,body,created_at,read_at FROM social_messages WHERE ((sender_id=$1 AND recipient_id=$2)OR(sender_id=$2 AND recipient_id=$1))AND id<$3 ORDER BY id DESC LIMIT 50',
      [uid, other, before],
    );
    const can_send =
      (await friendship(uid, other))?.status === 'accepted' && !(await blocked(uid, other));
    res.json({
      items: rows.reverse(),
      has_more: rows.length === 50,
      can_send,
    });
  });
  router.post('/social/chat/:user/read', async (req, res) => {
    const other = userId.parse(req.params.user);
    await pool.query(
      'UPDATE social_messages SET read_at=now()WHERE recipient_id=$1 AND sender_id=$2 AND read_at IS NULL',
      [res.locals.user.id, other],
    );
    res.json({ ok: true });
  });
  router.post('/social/chat/:user', async (req, res) => {
    const other = userId.parse(req.params.user),
      uid = res.locals.user.id;
    const body = z.string().trim().min(1).max(2000).parse(req.body.body);
    const m = await pairTransaction(uid, other, async (db) => {
      if (
        (await friendship(uid, other, db))?.status !== 'accepted' ||
        (await blocked(uid, other, db))
      )
        throw new AppError(403, 'Mensagens privadas estão disponíveis entre amigos.');
      const {
        rows: [m],
      } = await db.query(
        'INSERT INTO social_messages(sender_id,recipient_id,body)VALUES($1,$2,$3)RETURNING id::text,sender_id,recipient_id,body,created_at,read_at',
        [uid, other, body],
      );
      return m;
    });
    res.status(201).json(m);
  });
  router.get('/hall', async (_req, res) => {
    await pool.query('INSERT INTO hall_settings(id,document)VALUES(1,$1)ON CONFLICT DO NOTHING', [
      JSON.stringify(defaultHallSettings),
    ]);
    const {
      rows: [settings],
    } = await pool.query('SELECT document,revision FROM hall_settings WHERE id=1');
    const { rows } = await pool.query(
      `SELECT c.id,c.user_id,c.name,c.race,c.class,c.level,c.progression_missions AS missions,c.portrait_revision,u.name AS owner_name,t.document->>'name' AS title,(SELECT count(*)::int FROM achievements a WHERE a.character_id=c.id)AS achievements,(SELECT count(*)::int FROM character_titles ct JOIN title_catalog active ON active.id=ct.title_id AND active.deleted_at IS NULL WHERE ct.character_id=c.id AND NOT ct.revoked)AS titles,(SELECT count(*)::int FROM profile_reviews r WHERE r.target_id=c.user_id)AS rating_count,COALESCE((SELECT sum(score)::int FROM profile_reviews r WHERE r.target_id=c.user_id),0)AS rating_sum FROM characters c JOIN "user" u ON u.id=c.user_id LEFT JOIN title_catalog t ON t.id=c.displayed_title_id AND t.deleted_at IS NULL AND EXISTS(SELECT 1 FROM character_titles ct WHERE ct.character_id=c.id AND ct.title_id=t.id AND NOT ct.revoked) WHERE c.deleted_at IS NULL`,
    );
    const entries = rows
      .map((r) => ({
        ...r,
        ...fameScore(r, settings.document.weights),
        portrait: portrait(r.user_id, r.id, r.portrait_revision),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.level - a.level ||
          b.achievements - a.achievements ||
          a.name.localeCompare(b.name, 'pt-BR') ||
          a.id.localeCompare(b.id),
      );
    res.json({
      ...settings,
      can_edit: await isAdministrator(res.locals.user.id),
      entries: entries.map((r, i) => ({ ...r, rank: i + 1 })),
    });
  });
  router.put('/hall/settings', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const input = z
      .object({ document: hallSettingsSchema, revision: z.number().int().min(1) })
      .strict()
      .parse(req.body);
    const result = await transaction(async (db) => {
      await requireAdministrator(res.locals.user.id, db);
      const {
        rows: [r],
      } = await db.query(
        'UPDATE hall_settings SET document=$1,revision=revision+1,updated_by=$2,updated_at=now()WHERE id=1 AND revision=$3 RETURNING document,revision',
        [JSON.stringify(input.document), res.locals.user.id, input.revision],
      );
      if (!r) throw new AppError(409, 'A pontuação mudou. Reabra as configurações.');
      return r;
    });
    res.json(result);
  });
  return router;
}
