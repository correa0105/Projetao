import express from 'express';
import { randomInt, randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { requireAdministrator, isAdministrator } from './administrators.js';
import { AppError } from './services.js';
import { deriveSheet } from '../shared/character-sheet.js';
import { vttSheetRouter } from './vtt-sheet.js';
import { vttHotbarRouter } from './vtt-hotbar.js';
import { vttCombatRouter } from './vtt-combat.js';
import {
  vttPremiumRouter,
  premiumSettings,
  premiumAssets,
  validatePremiumImages,
} from './vtt-premium.js';
import { vttMonsterPresetRouter, saveMonsterPresets } from './vtt-monster-presets.js';
import { vttDamageRouter } from './vtt-damage.js';
import { movementBlocked } from '../shared/vtt-movement.js';
import { translateMonsterLines } from './vtt-translate.js';
import { rollFormula } from '../shared/vtt-roll.js';
import { vttProtocolVersion, vttUpdateMessage } from '../shared/vtt-protocol.js';
import {
  documentSchema,
  newDocument,
  newToken,
  tokenSchema,
  pointSchema,
  visiblePoint,
  viewerSees,
  manualFogSees,
  sceneBossBars,
  applyTokenDeath,
  type VttDocument,
  type VttScene,
  type VttToken,
  type VttFocusSignal,
} from '../shared/vtt.js';
const uuid = z.string().uuid();
type DB = Pick<PoolClient, 'query'>;
async function room(db: DB, id: string, user: string, lock = false) {
  const {
    rows: [r],
  } = await db.query(
    `SELECT r.*, (SELECT role FROM vtt_members WHERE room_id=r.id AND user_id=$2) AS role,
      (SELECT viewing_user_id FROM vtt_members WHERE room_id=r.id AND user_id=$2) AS viewing_user_id FROM vtt_rooms r WHERE r.id=$1 AND (r.owner_id=$2 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=r.id AND m.user_id=$2))${lock ? ' FOR UPDATE' : ''}`,
    [id, user],
  );
  if (!r) throw new AppError(404, 'Mesa não encontrada.');
  r.document = documentSchema.parse(r.document);
  return r as {
    id: string;
    owner_id: string;
    document: VttDocument;
    revision: number;
    invite: string;
    role: 'player' | 'spectator' | null;
    viewing_user_id: string | null;
    focus_signal: VttFocusSignal | null;
  };
}
async function gm(db: DB, id: string, user: string, lock = false) {
  const r = await room(db, id, user, lock);
  await requireAdministrator(user, db as PoolClient);
  if (r.owner_id !== user) throw new AppError(403, 'Somente o mestre desta mesa pode fazer isso.');
  return r;
}
function canSee(t: VttToken, s: VttScene, user: string) {
  if (t.hidden || t.layer === 'gm') return false;
  if (t.controller === user) return true;
  if (s.fog && s.fogMode === 'manual' && !manualFogSees(t, s)) return false;
  if (!s.lighting && !(s.fog && s.fogMode === 'vision')) return true;
  const viewers = s.tokens.filter((t) => t.controller === user && t.layer === 'tokens');
  return viewers.some((v) => !v.hidden && viewerSees(v, t, s));
}
function playerDocument(doc: VttDocument, user: string, spectator = false): VttDocument {
  const scene = doc.scenes.find((s) => s.id === doc.activeScene)!;
  const tokens = scene.tokens
    .filter((t) =>
      spectator && !scene.fog && !user ? !t.hidden && t.layer !== 'gm' : canSee(t, scene, user),
    )
    .map((t) => ({
      ...t,
      notes: '',
      monster: null,
      sheet: !spectator && t.controller === user ? t.sheet : null,
    }));
  return {
    ...doc,
    effects: [],
    folders: [],
    scenes: [
      {
        ...scene,
        folderId: null,
        tokens,
        drawings: scene.drawings.filter((d) => d.layer !== 'gm'),
      },
    ],
    journal: doc.journal.filter((j) => j.public),
    initiative: doc.initiative.filter((i) => tokens.some((t) => t.id === i.tokenId)),
  };
}
function paths(doc: VttDocument) {
  return doc.scenes
    .flatMap((s) => [
      s.background,
      ...s.tokens.map((t) => t.image),
      ...(s.onLoadAudio ? ['/api/vtt/assets/' + s.onLoadAudio] : []),
    ])
    .concat(
      doc.journal.map((j) => j.image),
      doc.music.assetId ? '/api/vtt/assets/' + doc.music.assetId : [],
    );
}
async function validateAssets(db: DB, rid: string, doc: VttDocument) {
  const ids = [
    ...new Set(
      paths(doc)
        .filter((p) => p.startsWith('/api/vtt/assets/'))
        .map((p) => uuid.parse(p.split('/').at(-1))),
    ),
  ];
  if (!ids.length) return;
  const assets = await db.query(
    'SELECT id,kind FROM vtt_assets WHERE room_id=$1 AND id=ANY($2::uuid[])',
    [rid, ids],
  );
  if (assets.rowCount !== ids.length)
    throw new AppError(400, 'Imagem ou música não pertence a esta mesa.');
  const images = doc.scenes
    .flatMap((s) => [s.background, ...s.tokens.map((t) => t.image)])
    .concat(doc.journal.map((j) => j.image));
  for (const asset of assets.rows) {
    if (
      (images.includes('/api/vtt/assets/' + asset.id) && asset.kind !== 'image') ||
      ((asset.id === doc.music.assetId || doc.scenes.some((s) => s.onLoadAudio === asset.id)) &&
        asset.kind !== 'audio')
    )
      throw new AppError(400, 'Escolha uma imagem para a arte e um áudio para a trilha.');
  }
}
async function state(rid: string, user: string) {
  const r = await room(pool, rid, user);
  const isGm = r.owner_id === user && (await isAdministrator(user));
  const spectator = r.role === 'spectator' && !isGm;
  const viewpoints = (
    await pool.query(
      `SELECT u.id,u.name FROM "user" u JOIN vtt_members m ON m.user_id=u.id WHERE m.room_id=$1 AND m.role='player' ORDER BY u.name`,
      [rid],
    )
  ).rows.filter((m) =>
    r.document.scenes
      .find((s) => s.id === r.document.activeScene)!
      .tokens.some((t) => t.controller === m.id && t.layer === 'tokens' && !t.hidden),
  );
  const viewingUser = spectator
    ? viewpoints.some((m) => m.id === r.viewing_user_id)
      ? r.viewing_user_id
      : null
    : user;
  const document = isGm ? r.document : playerDocument(r.document, viewingUser || '', spectator);
  const [assets, members, messages] = await Promise.all([
    pool.query(
      'SELECT id,name,kind,width,height FROM vtt_assets WHERE room_id=$1 ORDER BY created_at DESC',
      [rid],
    ),
    pool.query(
      `SELECT u.id,u.name,COALESCE(m.role,'master') AS role FROM "user" u LEFT JOIN vtt_members m ON m.room_id=$2 AND m.user_id=u.id WHERE u.id=$1 OR m.user_id IS NOT NULL`,
      [r.owner_id, rid],
    ),
    pool.query(
      `SELECT id::text,author,text,roll,spell,private,created_at,damage,discarded,
        COALESCE((SELECT jsonb_agg(a.token_id) FROM vtt_damage_applications a WHERE a.message_id=vtt_messages.id),'[]'::jsonb) AS applied
        FROM vtt_messages WHERE room_id=$1 AND (NOT private OR author_id=$2 OR $3) ORDER BY vtt_messages.id DESC LIMIT 100`,
      [rid, user, isGm],
    ),
  ]);
  const visible = new Set(paths(document));
  return {
    id: rid,
    revision: r.revision,
    document,
    is_gm: isGm,
    role: isGm ? 'master' : spectator ? 'spectator' : 'player',
    viewingUser,
    viewpoints,
    ...(isGm ? { invite: r.invite } : {}),
    assets: assets.rows
      .filter((a) => isGm || visible.has('/api/vtt/assets/' + a.id))
      .map((a) => ({ ...a, path: '/api/vtt/assets/' + a.id })),
    members: members.rows,
    messages: messages.rows.reverse().map((m) => ({
      ...m,
      damage:
        !m.damage || isGm || document.scenes[0].tokens.some((t) => t.id === m.damage.target_id)
          ? m.damage
          : null,
    })),
    ...(await premiumSettings(user)),
    bossBars: sceneBossBars(r.document.scenes.find((s) => s.id === r.document.activeScene)!),
    focusSignal: r.focus_signal,
  };
}
async function importCharacter(
  db: DB,
  r: Awaited<ReturnType<typeof room>>,
  user: string,
  cid: string,
) {
  const {
    rows: [c],
  } = await db.query('SELECT * FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL', [
    cid,
    user,
  ]);
  if (!c) throw new AppError(404, 'Personagem não pertence à sua conta.');
  await db.query(
    'INSERT INTO vtt_character_links(room_id,character_id,imported_by)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',
    [r.id, cid, user],
  );
  const {
    rows: [sheet],
  } = await db.query('SELECT * FROM character_sheets WHERE character_id=$1', [cid]);
  const derived = sheet?.finalized_at ? deriveSheet(c, sheet.choices) : null;
  const {
    rows: [portrait],
  } = await db.query('SELECT image FROM character_portraits WHERE character_id=$1', [cid]);
  const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
  if (scene.tokens.some((t) => t.characterId === cid && t.controller === user)) return false;
  const previousToken = r.document.scenes
    .flatMap((s) => s.tokens)
    .find((t) => t.characterId === cid);
  const token = newToken(randomUUID(), scene);
  Object.assign(token, {
    name: c.name,
    hp: previousToken?.hp ?? sheet?.current_hp ?? c.hp,
    conditions: previousToken?.conditions || [],
    maxHp: c.hp,
    ac: c.armor_class,
    controller: user,
    characterId: cid,
    vision: ['Elfo', 'Anão', 'Gnomo', 'Orc', 'Tiefling', 'Draconato'].includes(c.race)
      ? ['Anão', 'Gnomo', 'Orc'].includes(c.race) || sheet?.choices?.subrace === 'Drow'
        ? 120
        : 60
      : 0,
    sheet: {
      source: 'Alvorada · SRD 5.2.1',
      race: c.race,
      class: c.class,
      level: c.level,
      stats: c.stats,
      speed: derived?.speed ? derived.speed / 0.3 : 30,
      biography: c.biography || '',
      details: derived
        ? [
            `Proficiência: +${derived.proficiency} · Iniciativa: ${derived.initiative >= 0 ? '+' : ''}${derived.initiative}`,
            `Deslocamento: ${derived.speed} m · Percepção passiva: ${derived.passivePerception}`,
            `Idiomas: ${derived.languages.join(', ')}`,
            'Perícias\n' +
              derived.skills
                .map(
                  (s) =>
                    `${s.name}: ${s.value >= 0 ? '+' : ''}${s.value}${s.trained ? ' (treinada)' : ''}`,
                )
                .join('\n'),
            'Características\n' + derived.features.join('\n'),
            'Equipamento declarado\n' + derived.equipment.join('\n'),
          ].join('\n\n')
        : 'Ficha básica importada do personagem. A ficha completa ainda não foi finalizada.',
    },
  });
  if (portrait) {
    const bytes = await sharp(portrait.image)
      .resize({ width: 512, height: 512, fit: 'cover', position: 'attention' })
      .webp({ quality: 90 })
      .toBuffer();
    const a = await db.query(
      "INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height)VALUES($1,$2,'image','image/webp',$3,512,512)RETURNING id",
      [r.id, c.name + ' · token', bytes],
    );
    token.image = '/api/vtt/assets/' + a.rows[0].id;
  }
  const offset = scene.tokens.filter((t) => t.characterId).length;
  token.x = Math.max(
    token.width / 2,
    Math.min(scene.width - token.width / 2, token.x + (offset % 6) * token.width * 1.2),
  );
  token.y = Math.max(
    token.height / 2,
    Math.min(
      scene.height - token.height / 2,
      token.y + Math.floor(offset / 6) * token.height * 1.2,
    ),
  );
  scene.tokens.push(tokenSchema.parse(token));
  return true;
}
async function chooseParticipation(
  db: DB,
  r: Awaited<ReturnType<typeof room>>,
  user: string,
  role: 'player' | 'spectator',
) {
  if (r.owner_id === user) return;
  await db.query(
    'INSERT INTO vtt_members(room_id,user_id,role)VALUES($1,$2,$3)ON CONFLICT(room_id,user_id)DO UPDATE SET role=EXCLUDED.role,viewing_user_id=NULL',
    [r.id, user, role],
  );
  let changed = false;
  if (role === 'player') {
    const { rows } = await db.query(
      'SELECT id FROM characters WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at,id',
      [user],
    );
    for (const c of rows) changed = (await importCharacter(db, r, user, c.id)) || changed;
  }
  if (changed)
    await db.query(
      'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now()WHERE id=$1',
      [r.id, JSON.stringify(documentSchema.parse(r.document))],
    );
}
export function vttRouter() {
  const router = express.Router();
  router.use('/vtt', express.json({ limit: '12mb' }));
  router.use('/vtt/rooms/:id', async (req, res, next) => {
    const roleChange = req.path === '/participation' || req.path === '/viewpoint';
    const privateRead = req.path.startsWith('/sheets/') || req.path.startsWith('/hotbar');
    if (!roleChange && (req.method !== 'GET' || privateRead)) {
      const r = await room(pool, uuid.parse(req.params.id), res.locals.user.id);
      if (r.role === 'spectator' && r.owner_id !== res.locals.user.id)
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
    }
    next();
  });
  router.use(vttSheetRouter(room));
  router.use(vttHotbarRouter(room));
  router.use(vttCombatRouter(room, canSee));
  router.use(vttDamageRouter(room, canSee, state));
  router.use(vttMonsterPresetRouter());
  router.use(vttPremiumRouter());
  router.post('/vtt/rooms/:id/translate-monster', async (req, res) => {
    await gm(pool, uuid.parse(req.params.id), res.locals.user.id);
    const input = z
      .object({ lines: z.array(z.string().max(24000)).max(300) })
      .strict()
      .parse(req.body);
    if (input.lines.join('').length > 40000) throw new AppError(400, 'Ficha muito extensa.');
    res.json({ lines: await translateMonsterLines(input.lines) });
  });
  router.post('/vtt/rooms/:id/monster-presets/:preset/import', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      pid = uuid.parse(req.params.preset),
      user = res.locals.user.id;
    const input = z
      .object({
        x: z.number().finite().min(-50000).max(50000),
        y: z.number().finite().min(-50000).max(50000),
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const r = await gm(db, rid, user, true);
      const {
        rows: [preset],
      } = await db.query('SELECT token FROM vtt_monster_presets WHERE id=$1 AND user_id=$2', [
        pid,
        user,
      ]);
      if (!preset) throw new AppError(404, 'Preset não pertence à sua conta.');
      const token = tokenSchema.parse(preset.token);
      await validatePremiumImages(db, user, [token.image]);
      if (token.image.startsWith('/api/vtt/assets/')) {
        const aid = uuid.parse(token.image.split('/').at(-1));
        const {
          rows: [asset],
        } = await db.query(
          `INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height)
          SELECT $1,a.name,a.kind,a.mime,a.bytes,a.width,a.height FROM vtt_assets a JOIN vtt_rooms source ON source.id=a.room_id
          WHERE a.id=$2 AND source.owner_id=$3 AND a.kind='image' RETURNING id`,
          [rid, aid, user],
        );
        if (!asset)
          throw new AppError(404, 'A imagem original do preset não está mais disponível.');
        token.image = '/api/vtt/assets/' + asset.id;
      }
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      token.id = randomUUID();
      token.characterId = null;
      token.controller = null;
      token.layer = 'tokens';
      token.x = Math.max(token.width / 2, Math.min(scene.width - token.width / 2, input.x));
      token.y = Math.max(token.height / 2, Math.min(scene.height - token.height / 2, input.y));
      scene.tokens.push(token);
      documentSchema.parse(r.document);
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
        [rid, JSON.stringify(r.document)],
      );
      await saveMonsterPresets(db, user, rid, r.document);
    });
    res.json(await state(rid, user));
  });
  router.get('/vtt', async (_req, res) =>
    res.json({
      can_create: await isAdministrator(res.locals.user.id),
      rooms: (
        await pool.query(
          `SELECT id,document->>'name' AS name,owner_id=$1 AS is_owner,updated_at FROM vtt_rooms r WHERE owner_id=$1 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=r.id AND m.user_id=$1) ORDER BY updated_at DESC`,
          [res.locals.user.id],
        )
      ).rows,
    }),
  );
  router.post('/vtt', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const name = z.string().trim().min(1).max(100).parse(req.body.name);
    const document = newDocument(randomUUID());
    document.name = name;
    const r = await pool.query(
      'INSERT INTO vtt_rooms(owner_id,document,invite)VALUES($1,$2,$3)RETURNING id',
      [res.locals.user.id, JSON.stringify(document), randomBytes(24).toString('hex')],
    );
    res.status(201).json(await state(r.rows[0].id, res.locals.user.id));
  });
  router.post('/vtt/join', async (req, res) => {
    const input = z
      .object({
        invite: z.string().regex(/^[0-9a-f]{48}$/),
        role: z.enum(['player', 'spectator']).default('player'),
      })
      .strict()
      .parse(req.body);
    const rid = await transaction(async (db) => {
      const {
        rows: [r],
      } = await db.query('SELECT * FROM vtt_rooms WHERE invite=$1 FOR UPDATE', [input.invite]);
      if (!r) throw new AppError(404, 'Convite inválido ou revogado.');
      r.document = documentSchema.parse(r.document);
      await chooseParticipation(db, r, res.locals.user.id, input.role);
      return r.id;
    });
    res.json(await state(rid, res.locals.user.id));
  });
  router.post('/vtt/rooms/:id/participation', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      role = z.enum(['player', 'spectator']).parse(req.body.role);
    await transaction(async (db) => {
      const r = await room(db, rid, res.locals.user.id, true);
      await chooseParticipation(db, r, res.locals.user.id, role);
    });
    res.json(await state(rid, res.locals.user.id));
  });
  router.put('/vtt/rooms/:id/viewpoint', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      user = res.locals.user.id;
    const viewer = z.string().min(1).max(100).nullable().parse(req.body.userId);
    await transaction(async (db) => {
      const r = await room(db, rid, user, true);
      if (r.role !== 'spectator')
        throw new AppError(403, 'Escolher a visão de outro jogador é exclusivo do espectador.');
      if (viewer) {
        const {
          rows: [m],
        } = await db.query(
          `SELECT user_id FROM vtt_members WHERE room_id=$1 AND user_id=$2 AND role='player'`,
          [rid, viewer],
        );
        if (
          !m ||
          !r.document.scenes
            .find((s) => s.id === r.document.activeScene)!
            .tokens.some((t) => t.controller === viewer && t.layer === 'tokens' && !t.hidden)
        )
          throw new AppError(400, 'Escolha um jogador com personagem visível neste mapa.');
      }
      await db.query('UPDATE vtt_members SET viewing_user_id=$3 WHERE room_id=$1 AND user_id=$2', [
        rid,
        user,
        viewer,
      ]);
    });
    res.json(await state(rid, user));
  });
  router.get('/vtt/compendium', async (_req, res) => {
    const catalog = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
    if ((await premiumSettings(res.locals.user.id)).premiumTokens) {
      const available = new Set((await premiumAssets()).map((a) => a.id));
      catalog.monsters = catalog.monsters.map((m: { id: string }) =>
        available.has(m.id) ? { ...m, image: '/api/vtt/premium-art/' + m.id } : m,
      );
    }
    res.json(catalog);
  });
  router.get('/vtt/rooms/:id', async (req, res) =>
    res.json(await state(uuid.parse(req.params.id), res.locals.user.id)),
  );
  router.get('/vtt/rooms/:id/signal', async (req, res) => {
    const {
      rows: [row],
    } = await pool.query(
      `SELECT focus_signal FROM vtt_rooms r WHERE id=$1 AND (owner_id=$2 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=r.id AND m.user_id=$2))`,
      [uuid.parse(req.params.id), res.locals.user.id],
    );
    if (!row) throw new AppError(404, 'Mesa não encontrada.');
    res.json(row.focus_signal);
  });
  router.post('/vtt/rooms/:id/signal', async (req, res) => {
    const rid = uuid.parse(req.params.id);
    const input = z
      .object({ sceneId: uuid, x: z.number().finite().min(0), y: z.number().finite().min(0) })
      .strict()
      .parse(req.body);
    const signal = await transaction(async (db) => {
      const r = await gm(db, rid, res.locals.user.id, true);
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      if (input.sceneId !== scene.id || input.x > scene.width || input.y > scene.height)
        throw new AppError(400, 'Sinalize um ponto dentro do mapa ativo.');
      const signal: VttFocusSignal = { ...input, id: randomUUID(), at: Date.now() };
      await db.query('UPDATE vtt_rooms SET focus_signal=$2 WHERE id=$1', [
        rid,
        JSON.stringify(signal),
      ]);
      return signal;
    });
    res.json(signal);
  });
  router.put('/vtt/rooms/:id', async (req, res) => {
    if (req.get('X-Vtt-Schema-Version') !== String(vttProtocolVersion))
      throw new AppError(409, vttUpdateMessage);
    const rid = uuid.parse(req.params.id),
      input = z
        .object({ revision: z.number().int().min(1), document: documentSchema })
        .strict()
        .parse(req.body);
    await transaction(async (db) => {
      const r = await gm(db, rid, res.locals.user.id, true);
      if (r.revision !== input.revision)
        throw new AppError(
          409,
          'Outra alteração chegou à mesa. Recarregue ou exporte seu rascunho.',
        );
      await validateAssets(db, rid, input.document);
      await validatePremiumImages(db, res.locals.user.id, paths(input.document), paths(r.document));
      for (const s of input.document.scenes)
        for (const t of s.tokens) {
          const old = r.document.scenes
            .find((previous) => previous.id === s.id)
            ?.tokens.find((previous) => previous.id === t.id);
          if (old) applyTokenDeath(t, old.hp);
        }
      const ids = (
        await db.query(`SELECT user_id FROM vtt_members WHERE room_id=$1 AND role='player'`, [rid])
      ).rows.map((m) => m.user_id);
      if (
        input.document.scenes.some((s) =>
          s.tokens.some(
            (t) =>
              t.controller &&
              t.controller !== r.owner_id &&
              !ids.includes(t.controller) &&
              !r.document.scenes
                .flatMap((s) => s.tokens)
                .some((previous) => previous.id === t.id && previous.controller === t.controller),
          ),
        )
      )
        throw new AppError(400, 'Controlador não participa da mesa.');
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
        [rid, JSON.stringify(input.document)],
      );
      await saveMonsterPresets(db, res.locals.user.id, rid, input.document);
    });
    res.json(await state(rid, res.locals.user.id));
  });
  router.post('/vtt/rooms/:id/effects/:effect/apply', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      effectId = uuid.parse(req.params.effect);
    const input = z
      .union([
        z.object({ tokenId: uuid }).strict(),
        z.object({ tokenIds: z.array(uuid).min(1).max(1000) }).strict(),
      ])
      .parse(req.body);
    const tokenIds = [...new Set('tokenIds' in input ? input.tokenIds : [input.tokenId])];
    await transaction(async (db) => {
      const r = await gm(db, rid, res.locals.user.id, true);
      const preset = r.document.effects.find((e) => e.id === effectId);
      if (!preset) throw new AppError(404, 'Este efeito não está mais salvo na mesa.');
      const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
      const tokens = tokenIds.map((id) =>
        scene.tokens.find((t) => t.id === id && t.layer !== 'map'),
      );
      if (tokens.some((t) => !t))
        throw new AppError(404, 'Selecione tokens neste mapa para aplicar o efeito.');
      const at = Date.now();
      for (const token of tokens) {
        if (!token) continue;
        if (preset.kind === 'death') token.deathAt = at;
        else {
          token.effects = token.effects.filter(
            (e) => e.kind !== preset.kind && (!e.duration || e.at + e.duration * 1000 > at),
          );
          token.effects.push({
            id: randomUUID(),
            kind: preset.kind,
            color: preset.color,
            scale: preset.scale,
            duration: preset.duration,
            at,
          });
        }
      }
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
        [rid, JSON.stringify(r.document)],
      );
    });
    res.json(await state(rid, res.locals.user.id));
  });
  router.post('/vtt/rooms/:id/invite', async (req, res) => {
    const rid = uuid.parse(req.params.id);
    await gm(pool, rid, res.locals.user.id);
    const invite = randomBytes(24).toString('hex');
    await pool.query('UPDATE vtt_rooms SET invite=$2 WHERE id=$1', [rid, invite]);
    res.json({ invite });
  });
  router.delete('/vtt/rooms/:id/members/:user', async (req, res) => {
    const rid = uuid.parse(req.params.id);
    await gm(pool, rid, res.locals.user.id);
    await transaction(async (db) => {
      const r = await gm(db, rid, res.locals.user.id, true);
      await db.query('DELETE FROM vtt_members WHERE room_id=$1 AND user_id=$2', [
        rid,
        req.params.user,
      ]);
      for (const s of r.document.scenes)
        for (const t of s.tokens) if (t.controller === req.params.user) t.controller = null;
      await db.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
        rid,
        JSON.stringify(r.document),
      ]);
    });
    res.json(await state(rid, res.locals.user.id));
  });
  router.patch('/vtt/rooms/:id/tokens/:token', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      tid = uuid.parse(req.params.token);
    const input = z
      .object({
        x: z.number().finite().min(0).max(16000).optional(),
        y: z.number().finite().min(0).max(16000).optional(),
        hp: z.number().min(-10000).max(100000).optional(),
        rotation: z.number().finite().min(-360).max(360).optional(),
        flipX: z.boolean().optional(),
        flipY: z.boolean().optional(),
        conditions: z.array(z.string().max(40)).max(30).optional(),
        path: z.array(pointSchema).min(1).max(2000).optional(),
      })
      .strict()
      .parse(req.body);
    await transaction(async (db) => {
      const r = await room(db, rid, res.locals.user.id, true),
        s = r.document.scenes.find((s) => s.id === r.document.activeScene)!,
        t = s.tokens.find((t) => t.id === tid);
      if (r.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      if (!t || t.hidden || t.layer !== 'tokens' || t.controller !== res.locals.user.id || t.locked)
        throw new AppError(403, 'Você não controla este token.');
      if (input.hp !== undefined && input.hp > t.hp)
        throw new AppError(403, 'Somente o mestre pode restaurar pontos de vida.');
      if (input.conditions && t.conditions.some((c) => !input.conditions!.includes(c)))
        throw new AppError(403, 'Somente o mestre pode remover condições.');
      const destination = { x: input.x ?? t.x, y: input.y ?? t.y };
      if (destination.x > s.width || destination.y > s.height)
        throw new AppError(400, 'Movimento fora do mapa.');
      const path = input.path || [destination];
      const final = path.at(-1)!;
      if (final.x !== destination.x || final.y !== destination.y)
        throw new AppError(400, 'O percurso deve terminar na posição informada.');
      let from = { x: t.x, y: t.y };
      for (const to of path) {
        if (to.x < 0 || to.y < 0 || to.x > s.width || to.y > s.height)
          throw new AppError(400, 'Movimento fora do mapa.');
        if (movementBlocked(s, from, to))
          throw new AppError(
            400,
            'Uma parede, porta fechada ou janela fechada bloqueia o movimento.',
          );
        from = to;
      }
      const oldHp = t.hp;
      const { path: _path, ...patch } = input;
      Object.assign(t, patch);
      applyTokenDeath(t, oldHp);
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now()WHERE id=$1',
        [rid, JSON.stringify(r.document)],
      );
    });
    res.json(await state(rid, res.locals.user.id));
  });
  router.post('/vtt/rooms/:id/messages', async (req, res) => {
    const rid = uuid.parse(req.params.id);
    const current = await room(pool, rid, res.locals.user.id);
    if (current.role === 'spectator')
      throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
    const input = z
      .object({
        text: z.string().trim().max(2000).default(''),
        formula: z.string().trim().max(100).default(''),
        private: z.boolean().default(false),
        spell_id: z.string().min(1).max(150).optional(),
        damage: z.object({ actor_id: uuid, target_id: uuid }).strict().optional(),
      })
      .strict()
      .parse(req.body);
    let roll = null;
    if (input.formula) {
      try {
        roll = rollFormula(input.formula, randomInt);
      } catch (e) {
        throw new AppError(400, (e as Error).message);
      }
    }
    let spell = null;
    if (input.spell_id) {
      const catalog = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
      const entry =
        catalog.spells.find((s: { id: string }) => s.id === input.spell_id) ||
        current.document.custom.find((s) => s.kind === 'spell' && s.id === input.spell_id);
      if (!entry) throw new AppError(404, 'Magia não encontrada na biblioteca.');
      const { id, name, details, level, school, time, range, duration, components } = entry;
      spell = { id, name, details, level, school, time, range, duration, components };
    }
    if (!input.text && !roll && !spell)
      throw new AppError(400, 'Escreva uma mensagem ou role dados.');
    const created = await transaction(async (db) => {
      const r = await room(db, rid, res.locals.user.id, true);
      if (r.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      let damage = null;
      if (input.damage) {
        if (!roll) throw new AppError(400, 'Role o dano antes de vinculá-lo ao alvo.');
        const scene = r.document.scenes.find((s) => s.id === r.document.activeScene)!;
        const actor = scene.tokens.find(
          (t) => t.id === input.damage!.actor_id && t.layer === 'tokens',
        );
        const target = scene.tokens.find(
          (t) => t.id === input.damage!.target_id && t.layer === 'tokens',
        );
        const isGm =
          r.owner_id === res.locals.user.id && (await isAdministrator(res.locals.user.id, db));
        if (
          !actor ||
          !target ||
          (!isGm &&
            (actor.controller !== res.locals.user.id || !canSee(target, scene, res.locals.user.id)))
        )
          throw new AppError(403, 'Atacante ou alvo indisponível.');
        damage = { ...input.damage, target_name: target.name };
      }
      return await db.query(
        'INSERT INTO vtt_messages(room_id,author_id,author,text,roll,private,spell,damage)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id::text',
        [
          rid,
          res.locals.user.id,
          res.locals.user.name,
          input.text,
          roll ? JSON.stringify(roll) : null,
          input.private,
          spell ? JSON.stringify(spell) : null,
          damage ? JSON.stringify(damage) : null,
        ],
      );
    });
    res
      .status(201)
      .json({ ...(await state(rid, res.locals.user.id)), createdMessageId: created.rows[0].id });
  });
  router.get('/vtt/rooms/:id/messages', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      user = res.locals.user.id;
    const current = await room(pool, rid, user);
    const before = z
      .string()
      .regex(/^\d{1,19}$/)
      .optional()
      .parse(req.query.before);
    const isGm = current.owner_id === user && (await isAdministrator(user));
    const { rows } = await pool.query(
      `SELECT id::text,author,text,roll,spell,private,created_at,damage,discarded,
        COALESCE((SELECT jsonb_agg(a.token_id) FROM vtt_damage_applications a WHERE a.message_id=vtt_messages.id),'[]'::jsonb) AS applied
        FROM vtt_messages WHERE room_id=$1 AND (NOT private OR author_id=$2 OR $3) AND ($4::bigint IS NULL OR id<$4::bigint) ORDER BY vtt_messages.id DESC LIMIT 101`,
      [rid, user, isGm, before || null],
    );
    const visible = isGm
      ? current.document
      : playerDocument(
          current.document,
          current.role === 'spectator' ? current.viewing_user_id || '' : user,
          current.role === 'spectator',
        );
    res.json({
      messages: rows
        .slice(0, 100)
        .reverse()
        .map((m) => ({
          ...m,
          damage:
            !m.damage || isGm || visible.scenes[0].tokens.some((t) => t.id === m.damage.target_id)
              ? m.damage
              : null,
        })),
      has_more: rows.length > 100,
    });
  });
  router.post('/vtt/rooms/:id/characters/:character', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      cid = uuid.parse(req.params.character);
    await room(pool, rid, res.locals.user.id);
    await transaction(async (db) => {
      const r = await room(db, rid, res.locals.user.id, true);
      if (r.role === 'spectator')
        throw new AppError(403, 'Espectadores podem somente assistir à mesa.');
      if (await importCharacter(db, r, res.locals.user.id, cid))
        await db.query(
          'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now()WHERE id=$1',
          [rid, JSON.stringify(documentSchema.parse(r.document))],
        );
    });
    res.status(201).json(await state(rid, res.locals.user.id));
  });
  router.post(
    '/vtt/rooms/:id/assets',
    express.raw({
      type: [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/avif',
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/webm',
      ],
      limit: '32mb',
    }),
    async (req, res) => {
      const rid = uuid.parse(req.params.id);
      await gm(pool, rid, res.locals.user.id);
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new AppError(400, 'Arquivo inválido.');
      let bytes = req.body,
        mime = req.headers['content-type']!.split(';')[0],
        width = null,
        height = null;
      const kind = mime.startsWith('image/') ? 'image' : 'audio';
      const name = z.string().trim().min(1).max(120).parse(req.query.name);
      if (kind === 'image') {
        try {
          const result = await sharp(bytes, { limitInputPixels: 64000000 })
            .rotate()
            .resize({ width: 8000, height: 8000, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 92 })
            .toBuffer({ resolveWithObject: true });
          bytes = result.data;
          width = result.info.width;
          height = result.info.height;
          mime = 'image/webp';
        } catch {
          throw new AppError(400, 'Imagem inválida ou maior que 64 megapixels.');
        }
      } else if (!(
        bytes.subarray(0, 3).toString() === 'ID3' ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224) ||
        (bytes.subarray(0, 4).toString() === 'RIFF' &&
          bytes.subarray(8, 12).toString() === 'WAVE') ||
        bytes.subarray(0, 4).toString() === 'OggS' ||
        bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
      ))
        throw new AppError(400, 'Envie MP3, WAV, OGG ou WebM válido.');
      const r = await pool.query(
        'INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING id,name,kind,width,height',
        [rid, name, kind, mime, bytes, width, height],
      );
      res.status(201).json({ ...r.rows[0], path: '/api/vtt/assets/' + r.rows[0].id });
    },
  );
  router.get('/vtt/assets/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      {
        rows: [a],
      } = await pool.query('SELECT * FROM vtt_assets WHERE id=$1', [id]);
    if (!a) throw new AppError(404, 'Arquivo não encontrado.');
    const r = await room(pool, a.room_id, res.locals.user.id);
    const isGm = r.owner_id === res.locals.user.id && (await isAdministrator(res.locals.user.id));
    let viewAs = res.locals.user.id;
    if (r.role === 'spectator') {
      const {
        rows: [member],
      } = await pool.query(
        "SELECT user_id FROM vtt_members WHERE room_id=$1 AND user_id=$2 AND role='player'",
        [r.id, r.viewing_user_id],
      );
      viewAs = member?.user_id || '';
    }
    if (
      !isGm &&
      !paths(playerDocument(r.document, viewAs, r.role === 'spectator')).includes(
        '/api/vtt/assets/' + id,
      )
    )
      throw new AppError(404, 'Arquivo não disponível.');
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Accept-Ranges', 'bytes');
    const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = Number(match[1]),
        end = Math.min(a.bytes.length - 1, match[2] ? Number(match[2]) : a.bytes.length - 1);
      if (start > end || start >= a.bytes.length) {
        res.status(416).setHeader('Content-Range', `bytes */${a.bytes.length}`);
        res.end();
        return;
      }
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${a.bytes.length}`);
      res.end(a.bytes.subarray(start, end + 1));
    } else res.end(a.bytes);
  });
  router.delete('/vtt/rooms/:id/assets/:asset', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      aid = uuid.parse(req.params.asset);
    await transaction(async (db) => {
      const r = await gm(db, rid, res.locals.user.id, true);
      if (paths(r.document).includes('/api/vtt/assets/' + aid))
        throw new AppError(
          409,
          'Retire o arquivo dos mapas, tokens, diário ou música antes de excluí-lo.',
        );
      await db.query('DELETE FROM vtt_assets WHERE id=$1 AND room_id=$2', [aid, rid]);
    });
    res.json({ ok: true });
  });
  return router;
}
