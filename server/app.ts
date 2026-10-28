import { atlasPlacesRouter } from './atlas-places.js';
import { recoveryMailSettingsRouter } from './recovery-mail-settings.js';
import { ensurePersonalVtt, personalVttUrl } from './vtt-accounts.js';
import { maintenanceAreas, requireAreaAvailable } from './maintenance.js';
import { homeUpdatesRouter } from './home-updates.js';
import { calendarRouter } from './calendar.js';
import { loreRouter } from './lore.js';
import { loreTimelineRouter } from './lore-timeline.js';
import { rulebookRouter } from './rulebook.js';
import { vttRouter } from './vtt.js';
import { socialRouter } from './social.js';
import { guildsRouter } from './guilds.js';
import { guildFacilityDefinitionsRouter } from './guild-facility-definitions.js';
import { towerRouter } from './tower.js';
import { clothingPieceAppearance } from '../shared/clothing-bundles.js';
import express from 'express';
import { authenticationClientIp, configureReverseProxy } from './reverse-proxy.js';
import { sendCatalog, compressedBundle } from './http-transfer.js';
import { staticAssetCacheControl } from './static-asset-cache.js';
import { optimizedPublicImages } from './optimized-public-images.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { z } from 'zod';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { auth, origins } from './auth.js';
import { pool, transaction } from './db.js';
import { isAdministrator, administrativeScopes, administrationFor } from './administrators.js';
const boardAdministration = administrationFor('board'), eventAdministration = administrationFor('events');
import { AppError, purchase } from './services.js';
import { completeMission, completionSchema, publishMissionHook } from './missions.js';
import { houseRouter } from './house.js';
import { house2Router } from './house-v2.js';
import { worldClockRouter } from './world-clock.js';
import { accountPreview, basicPreviewPayload } from './account-preview.js';
import { atlasId, resolvePostLocation } from './atlas.js';
import { characterArtRouter, characterListSql } from './character-art.js';
import { characterSchema } from '../shared/character-art.js';
import { characterSheetRouter } from './character-sheet.js';
import { characterSlotRollsRouter } from './character-slot-rolls.js';
import {characterAccountRouter} from './character-account.js';
import {characterAdminRouter} from './character-admin.js';
import { achievementsRouter } from './achievements.js';
import { missionTagsRouter, setMissionTags } from './mission-tags.js';
import { missionTagIds } from '../shared/mission-tags.js';
import { inventoryRouter } from './inventory.js';
import { inventoryBagsRouter } from './inventory-bags.js';
import { companionEquipmentRouter } from './companion-equipment.js';
import { rpLobbyRouter } from './rp-lobby.js';
import { notificationsRouter } from './notifications.js';
import { stableRouter } from './stable.js';
import { petsRouter } from './pets.js';
import { eventsRouter } from './events.js';
import { titlesRouter } from './titles.js';
import { cardsRouter } from './cards.js';
import { shopRouter } from './shop.js';
import { shopItemRulesRouter } from './shop-item-rules.js';
import { PAPER_STYLES } from '../shared/notice-board.js';
import { testEligible, rankName, rankTitle, rankLabel, RANKS, RANK_REWARD_CP } from '../shared/progression.js';
import {
  KINGDOM_BACKGROUND_MAX_BYTES,
  KINGDOM_BACKGROUND_MAX_EDGE,
  KINGDOM_BACKGROUND_MAX_PIXELS,
  KINGDOM_DEFAULT_WIDTH,
  KINGDOM_DEFAULT_HEIGHT,
  KINGDOM_EDITOR_CATALOG,
} from '../shared/kingdom-editor.js';

const uuid = z.string().uuid();
const postSchema = z.object({
  paper_style: z.enum(PAPER_STYLES).default('parchment'),
  paper_summary: z.string().trim().max(180).default(''),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(15).max(3000),
  kind: z.enum(['mission', 'event']),
  event_source_id: uuid.optional(),
  mission_rank: z.enum(RANKS).default('Ferro'),
  rank_test_level: z
    .union([z.literal(4), z.literal(8), z.literal(12), z.literal(16)])
    .nullable()
    .default(null),
  starts_at: z.string().datetime({ offset: true }).optional(),
  location: z.string().trim().min(2).max(100).optional(),
  location_id: atlasId.optional(),
  difficulty: z.enum(['Tranquila', 'Moderada', 'Perigosa']),
  reward_cp: z.number().int().min(0).max(10000000).default(0),
  tag_ids: missionTagIds.default([]),
});
const kingdomEditorKinds = KINGDOM_EDITOR_CATALOG.map((entry) => entry.kind) as [
  (typeof KINGDOM_EDITOR_CATALOG)[number]['kind'],
  ...(typeof KINGDOM_EDITOR_CATALOG)[number]['kind'][],
];
const kingdomDraftSchema = z.object({
  revision: z.number().int().min(0),
  items: z
    .array(
      z.object({
        id: uuid,
        kind: z.enum(kingdomEditorKinds),
        x: z.number().finite().min(-40000).max(40000),
        y: z.number().finite().min(-40000).max(40000),
        height: z.number().finite().min(80).max(1200),
        direction: z.number().int().min(0).max(7),
      }),
    )
    .max(500)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
      message: 'Há itens repetidos no mapa.',
    }),
});
const kingdomViewSchema = z.object({
  x: z.number().finite().min(-40000).max(40000),
  y: z.number().finite().min(-40000).max(40000),
  zoom: z.number().finite().min(0.03).max(32),
  angle: z
    .number()
    .finite()
    .min(0)
    .refine((angle) => angle < 2 * Math.PI),
});

export function createApp() {
  const app = express();
  configureReverseProxy(app);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                'upgrade-insecure-requests': null,
                imgSrc: ["'self'", 'data:', 'https:'],
                mediaSrc: ["'self'", 'blob:'],
              },
            }
          : false,
    }),
  );
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.all(
    '/api/auth/*splat',
    authenticationClientIp,
    toNodeHandler(auth),
  );
  app.use((req, res, next) =>
    req.path === '/api/vtt' ||
    req.path.startsWith('/api/vtt/') ||
    req.path === '/api/character-art' ||
    req.path === '/api/event-images' ||
    req.path === '/api/lore' ||
    req.path.startsWith('/api/lore/') ||
    req.path.startsWith('/api/rulebook') ||
    req.path.startsWith('/api/house')
      ? next()
      : express.json({ limit: '128kb' })(req, res, next),
  );
  const isVttSync = (req: express.Request) =>
    req.method === 'GET' && /^\/vtt\/rooms\/[0-9a-f-]{36}\/(signal|combat|sounds|voice|siege)$/.test(req.path);
  const isVttArtwork = (req: express.Request) =>
    ['GET', 'HEAD'].includes(req.method) &&
    /^\/vtt\/premium-(?:preview-)?art\/monster-[a-z0-9-]+$/.test(req.path);
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Muitas solicitações. Tente novamente em um minuto.' },
      skip: async (req, res) => {
        if (!isVttSync(req) && !isVttArtwork(req)) return false;
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session) return false;
        res.locals.verifiedSession = session;
        return true;
      },
    }),
  );
  app.use('/api', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!req.headers.origin || !origins.includes(req.headers.origin))
    ) {
      throw new AppError(403, 'Origem da solicitação não autorizada.');
    }
    const session =
      res.locals.verifiedSession ||
      (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }));
    if (!session) throw new AppError(401, 'Entre na sua conta para continuar.');
    res.locals.user = session.user;
    if (req.get('X-Account-Preview') === 'basic' && (await isAdministrator(session.user.id))) {
      res.locals.user = {
        ...session.user,
        administrador: 0,
        role: 'player',
        gold_unlimited: false,
        canEditKingdom: false,
        admin_scopes: [],
      };
      const json = res.json.bind(res);
      res.json = (body) => json(basicPreviewPayload(body, session.user.id));
      return accountPreview.run(true, next);
    }
    next();
  });
  app.use('/api', async (req, res, next) => {
    const area = req.path.split('/')[1];
    const eventMediaWrite = area === 'event-images' && !['GET', 'HEAD'].includes(req.method);
    if (['events', 'events-scene'].includes(area) || eventMediaWrite)
      await requireAreaAvailable('events', res.locals.user.id);
    if (area === 'tower') await requireAreaAvailable('tower', res.locals.user.id);
    next();
  });
  app.use('/api', recoveryMailSettingsRouter());
  app.use('/api/board/:id', async (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && maintenanceAreas().includes('events')) {
      const post = await pool.query("SELECT 1 FROM board_posts WHERE id=$1 AND kind='event'", [uuid.parse(req.params.id)]);
      if (post.rowCount) await requireAreaAvailable('events', res.locals.user.id);
    }
    next();
  });
  // Frequent read-only updates have their own authenticated-user budget. Players
  // on one connection must not exhaust each other's chat and mutation allowance.
  // The 330-art compendium also needs an independent budget: loading thumbnails
  // must not consume the allowance used to save, drag tokens, or send messages.
  // Authentication is verified before this exemption; each image route still
  // checks premium/room access and keeps no-store for immediate revocation.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 1200,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => !isVttArtwork(req),
      keyGenerator: (_req, res) => res.locals.user.id,
      message: { error: 'Muitas imagens da mesa. Aguarde um instante.' },
    }),
  );
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => !isVttSync(req),
      keyGenerator: (_req, res) => res.locals.user.id,
      message: { error: 'Muitas atualizações da mesa. Aguarde um instante.' },
    }),
  );
  app.use('/api/character-art', express.json({ limit: '12mb' }));
  app.use('/api/house', express.json({ limit: '8mb' }));
  app.use('/api/house-v2', express.json({ limit: '512kb' }));
  app.use('/api/lore', express.json({ limit: '2mb' }));
  app.use('/api/rulebook', express.json({ limit: '12mb' }));
  app.use('/api', rulebookRouter());
  app.use('/api', loreRouter());
  app.use('/api', loreTimelineRouter());
  app.use('/api', characterArtRouter());
  app.use('/api', characterSheetRouter());
  app.use('/api', characterSlotRollsRouter());
  app.use('/api', characterAccountRouter());
  app.use('/api', characterAdminRouter());
  app.use('/api', inventoryRouter());
  app.use('/api', rpLobbyRouter());
  app.use('/api', inventoryBagsRouter());
  app.use('/api', companionEquipmentRouter());
  app.use('/api', notificationsRouter());
  app.use('/api', shopRouter());
  app.use('/api', shopItemRulesRouter());
  app.use('/api', stableRouter());
  app.use('/api', petsRouter());
  app.use('/api', eventsRouter());
  app.use('/api', titlesRouter());
  app.use('/api', cardsRouter());
  app.use('/api', achievementsRouter());
  app.use('/api', missionTagsRouter());
  app.use('/api', homeUpdatesRouter());
  app.use('/api', calendarRouter());
  app.use('/api', vttRouter());
  app.use('/api', socialRouter());
  app.use('/api', guildsRouter());
  app.use('/api', guildFacilityDefinitionsRouter());
  app.use('/api', towerRouter());
  app.use('/api', houseRouter());
  app.use('/api', house2Router());
  app.use('/api', worldClockRouter());
  app.get('/api/me', async (_req, res) => {
    const {
      rows: [permission],
    } = await pool.query(
      'SELECT u.administrador,s.role FROM "user" u LEFT JOIN guild_staff s ON s.user_id=u.id WHERE u.id=$1',
      [res.locals.user.id],
    );
    const scopes = await administrativeScopes(res.locals.user.id);
    res.json({
      ...res.locals.user,
      administrador: permission?.administrador ?? 0,
      gold_unlimited: permission?.administrador === 1,
      admin_scopes: scopes,
      role:
        permission?.administrador === 1
          ? 'admin'
          : scopes.length
            ? 'content-admin'
          : permission?.role === 'staff'
            ? 'staff'
            : 'player',
      canEditKingdom: scopes.includes('world'),
      maintenance_areas: maintenanceAreas().filter(area => !scopes.includes(area)),
    });
  });
  app.get('/api/characters', async (_req, res) => {
    res.json((await pool.query(characterListSql, [res.locals.user.id])).rows);
  });
  app.post('/api/characters', async (req, res) => {
    characterSchema.parse(req.body);
    throw new AppError(
      400,
      'Envie uma referência para o ilustrador. Novos personagens precisam de uma imagem gerada.',
    );
  });
  app.get('/api/characters/:id/details', async (req, res) => {
    const id = uuid.parse(req.params.id);
    if (
      !(
        await pool.query(
          'SELECT 1 FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
          [id, res.locals.user.id],
        )
      ).rowCount
    )
      throw new AppError(404, 'Personagem não encontrado.');
    const [inventory, achievements, history] = await Promise.all([
      pool.query(
        "SELECT i.quantity,c.*,CASE WHEN c.id='plate-armor' THEN 'Peitoral de placas' ELSE c.name END AS name FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 ORDER BY c.name",
        [id],
      ),
      pool.query(
        'SELECT code,unlocked_at FROM achievements WHERE character_id=$1 ORDER BY unlocked_at',
        [id],
      ),
      pool.query(
        'SELECT p.*,c.name FROM purchases p JOIN catalog_items c ON c.id=p.item_id WHERE p.character_id=$1 ORDER BY p.created_at DESC LIMIT 20',
        [id],
      ),
    ]);
    res.json({
      inventory: inventory.rows.map(clothingPieceAppearance),
      achievements: achievements.rows,
      history: history.rows,
    });
  });
  app.get('/api/catalog', async (req, res) =>
    sendCatalog(
      req,
      res,
      (
        await pool.query(
          `SELECT id,name,original_name,category,description,price_cp,weight_lb,source,source_url,
           image_path,audio_path,merchant_comment,weight_estimated,
           raw_data->>'magic_family' AS magic_family,raw_data->>'base_item' AS base_item,
           raw_data->>'damage_type' AS damage_type,raw_data->>'rarity' AS rarity,
           raw_data->>'variant' AS variant,raw_data->'enhancement' AS enhancement,
           COALESCE(raw_data->>'magic_kind',
             CASE WHEN raw_data->>'srd_type' LIKE 'Armor %' THEN 'armor'
                  WHEN raw_data->>'srd_type' LIKE 'Weapon %' THEN 'weapon' END) AS magic_kind,
           jsonb_strip_nulls(jsonb_build_object(
             'equipment_target',raw_data->'equipment_target',
             'equipment_slots',raw_data->'equipment_slots',
             'spell_binding',raw_data->'spell_binding',
             'two_handed',raw_data->'two_handed')) AS raw_data
           FROM catalog_items WHERE active=true ORDER BY category,name`,
        )
      ).rows,
    ),
  );
  app.post('/api/purchases', async (req, res) => {
    const data = z
      .object({
        character_id: uuid,
        item_id: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(99),
        idempotency_key: uuid,
        spell_id: z.string().min(1).max(100).optional(),
      })
      .parse(req.body);
    const result = await purchase(
      res.locals.user.id,
      data.character_id,
      data.item_id,
      data.quantity,
      data.idempotency_key,
      data.spell_id,
    );
    res.status(result.replayed ? 200 : 201).json(result);
  });
  app.get('/api/board', async (req, res) => {
    const filters = z
      .object({
        region_id: atlasId.optional(),
        location_id: atlasId.optional(),
      })
      .parse(req.query);
    const { rows } = await pool.query(
      `SELECT b.*,u.name AS author_name,CASE WHEN b.kind='mission' THEN v.public_id END AS vtt_personal_id,
      (SELECT count(*)::int FROM mission_participants p WHERE p.post_id=b.id) AS participants,
      COALESCE((SELECT json_agg(p.character_id) FROM mission_participants p JOIN characters c ON c.id=p.character_id WHERE p.post_id=b.id AND c.user_id=$1),'[]') AS my_characters,
      (SELECT title FROM board_posts source WHERE source.id=b.source_mission_id) AS source_mission_title,
      COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name) ORDER BY t.name) FROM mission_post_tags mt JOIN mission_tags t ON t.id=mt.tag_id WHERE mt.post_id=b.id),'[]') AS tags,
      COALESCE((SELECT json_agg(json_build_object('name',c.name,'experience',r.experience,'gold_cp',r.gold_cp,'progression_credit',r.progression_credit,'level_after',r.level_after,'rank_promoted',r.rank_promoted)) FROM mission_rewards r JOIN characters c ON c.id=r.character_id WHERE r.post_id=b.id AND (c.user_id=$1 OR b.author_id=$1)),'[]') AS rewards
      FROM board_posts b LEFT JOIN "user" u ON u.id=b.author_id LEFT JOIN vtt_personal_spaces v ON v.user_id=b.author_id
      WHERE b.deleted_at IS NULL AND ($2::text IS NULL OR b.region_id=$2) AND ($3::text IS NULL OR b.location_id=$3)
      ORDER BY b.created_at DESC`,
      [res.locals.user.id, filters.region_id || null, filters.location_id || null],
    );
    res.json(rows.map(row=>({...row,vtt_personal_url:row.vtt_personal_id?personalVttUrl(row.vtt_personal_id):null})));
  });
  app.post('/api/board', async (req, res) => {
    const data = postSchema.parse(req.body);
    if (data.kind === 'event' || data.event_source_id)
      await requireAreaAvailable('events', res.locals.user.id);
    if (data.kind !== 'mission' && data.tag_ids.length)
      throw new AppError(400, 'Somente missões concedem tags.');
    if (data.rank_test_level !== null && rankName(data.rank_test_level) !== data.mission_rank)
      throw new AppError(400, 'O teste deve pertencer à patente de origem da promoção.');
    if (data.rank_test_level !== null && data.kind !== 'mission')
      throw new AppError(400, 'Teste de patente deve ser uma missão.');
    if (data.kind === 'event' && !(await eventAdministration.has(res.locals.user.id)))
      throw new AppError(403, 'Somente administradores podem criar eventos.');
    if (data.kind === 'mission' && !data.starts_at)
      throw new AppError(400, 'Informe a data e a hora de início da missão.');
    if (data.starts_at && new Date(data.starts_at).getTime() <= Date.now())
      throw new AppError(400, 'Escolha uma data e hora futuras.');
    const post = await transaction(async (client) => {
      if (data.event_source_id) {
        if (data.kind !== 'mission')
          throw new AppError(400, 'Somente missões podem pertencer a um evento.');
        const event = await client.query(
          "SELECT id FROM board_posts WHERE id=$1 AND kind='event' AND status='active' AND deleted_at IS NULL FOR SHARE",
          [data.event_source_id],
        );
        if (!event.rowCount)
          throw new AppError(
            409,
            'Este evento não está ativo. O registro de missões de evento está bloqueado.',
          );
      }
      const personal = data.kind === 'mission' ? await ensurePersonalVtt(client,res.locals.user.id) : null;
      const location = await resolvePostLocation(client, data);
      const {
        rows: [created],
      } = await client.query(
        `INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,reward_cp,starts_at,region_id,location_id,paper_style,paper_summary,rank_test_level,mission_rank,event_source_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          res.locals.user.id,
          data.kind,
          data.title,
          data.description,
          location.location,
          data.difficulty,
          data.kind === 'mission' ? RANK_REWARD_CP[data.mission_rank] : data.reward_cp,
          data.starts_at || null,
          location.region_id,
          location.location_id,
          data.paper_style,
          data.paper_summary,
          data.rank_test_level,
          data.mission_rank,
          data.event_source_id || null,
        ],
      );
      if (data.kind === 'mission') await setMissionTags(client, created.id, data.tag_ids);
      return { ...created, vtt_personal_id: personal?.public_id || null };
    });
    res.status(201).json(post);
  });
  app.post('/api/board/:id/hook', async (req, res) => {
    res
      .status(201)
      .json(await publishMissionHook(uuid.parse(req.params.id), res.locals.user.id, req.body));
  });
  app.delete('/api/board/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await transaction(async (client) => {
      if (!(await boardAdministration.has(res.locals.user.id, client)) && !(await eventAdministration.has(res.locals.user.id, client)))
        throw new AppError(403, 'Esta conta não pode administrar o mural.');
      const { rows: [post] } = await client.query('SELECT kind FROM board_posts WHERE id=$1 FOR UPDATE', [id]);
      if (!post || !['mission', 'event'].includes(post.kind))
        throw new AppError(404, 'Missão ou evento não encontrado.');
      await (post.kind === 'event' ? eventAdministration : boardAdministration).require(res.locals.user.id, client);
      await client.query('UPDATE board_posts SET deleted_at=now(),deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL', [id, res.locals.user.id]);
    });
    res.json({ ok: true });
  });
  app.patch('/api/board/:id/paper', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const data = z
      .object({
        paper_x: z.number().finite().min(0).max(1),
        paper_y: z.number().finite().min(0).max(1),
        paper_style: z.enum(PAPER_STYLES),
      })
      .strict()
      .parse(req.body);
    const result = await pool.query(
      `UPDATE board_posts SET paper_x=$3,paper_y=$4,paper_style=$5
       WHERE id=$1 AND deleted_at IS NULL AND ((kind='event' AND ${eventAdministration.predicate(2)}) OR (kind<>'event' AND (author_id=$2 OR ${boardAdministration.predicate(2)}))) RETURNING id,paper_x,paper_y,paper_style`,
      [id, res.locals.user.id, data.paper_x, data.paper_y, data.paper_style],
    );
    if (!result.rowCount) throw new AppError(403, 'Somente o autor pode alterar este papel.');
    res.json(result.rows[0]);
  });
  app.post('/api/board/:id/join', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { character_id } = z.object({ character_id: uuid }).parse(req.body);
    await transaction(async (client) => {
      const {
        rows: [post],
      } = await client.query('SELECT * FROM board_posts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [id]);
      if (!post || post.kind !== 'mission' || post.status !== 'open')
        throw new AppError(409, 'Esta missão não está aberta para inscrições.');
      const {
        rows: [character],
      } = await client.query(
        'SELECT level,progression_missions FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [character_id, res.locals.user.id],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      if (rankName(character.level) !== post.mission_rank)
        throw new AppError(
          409,
          `Esta missão é exclusiva da patente ${rankLabel(post.mission_rank)}. Seu personagem é ${rankTitle(character.level)}; não pode se inscrever em patentes superiores ou inferiores.`,
        );
      if (
        post.rank_test_level !== null &&
        !testEligible(character.level, character.progression_missions, post.rank_test_level)
      )
        throw new AppError(409, 'Este personagem ainda não está apto a este teste de patente.');
      await client.query(
        'INSERT INTO mission_participants(post_id,character_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [id, character_id],
      );
      await client.query(
        "INSERT INTO achievements(character_id,code) VALUES($1,'first_mission') ON CONFLICT DO NOTHING",
        [character_id],
      );
    });
    res.json({ ok: true });
  });
  app.get('/api/board/:id/participants', async (req, res) => {
    const id = uuid.parse(req.params.id);
    if (
      !(
        await pool.query(
          "SELECT 1 FROM board_posts WHERE id=$1 AND author_id=$2 AND kind='mission' AND deleted_at IS NULL",
          [id, res.locals.user.id],
        )
      ).rowCount
    )
      throw new AppError(403, 'Somente o criador pode consultar os participantes para conclusão.');
    res.json(
      (
        await pool.query(
          'SELECT c.id,c.name,c.race,c.class,c.level,c.progression_missions FROM mission_participants p JOIN characters c ON c.id=p.character_id WHERE p.post_id=$1 ORDER BY c.name',
          [id],
        )
      ).rows,
    );
  });
  app.post('/api/board/:id/complete', async (req, res) => {
    res.json(
      await completeMission(
        uuid.parse(req.params.id),
        res.locals.user.id,
        completionSchema.parse(req.body),
      ),
    );
  });
  app.patch('/api/board/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(['active', 'completed', 'closed']) })
      .parse(req.body);
    const allowed =
      status === 'active' ? ['open'] : status === 'completed' ? ['active'] : ['open', 'active'];
    const {
      rows: [post],
    } = await pool.query(
      `UPDATE board_posts SET status=$1,event_revision=event_revision+CASE WHEN kind='event' THEN 1 ELSE 0 END,closed_at=CASE WHEN $1 IN ('completed','closed') THEN now() ELSE NULL END
      WHERE id=$2 AND deleted_at IS NULL AND (author_id=$3 OR (kind='mission' AND ${boardAdministration.predicate(3)}) OR (kind='event' AND ${eventAdministration.predicate(3)})) AND status=ANY($4::text[]) AND kind <> 'hook'
      AND NOT (kind='mission' AND $1='completed')
      AND (kind <> 'event' OR ${eventAdministration.predicate(3)}) RETURNING *`,
      [status, id, res.locals.user.id, allowed],
    );
    if (!post)
      throw new AppError(409, 'Somente o autor pode atualizar um registro em estado compatível.');
    res.json(post);
  });
  app.get('/api/world', async (_req, res) =>
    res.json((await pool.query('SELECT * FROM world_entries ORDER BY id')).rows),
  );
  app.use('/api', atlasPlacesRouter());
  app.use(
    ['/api/kingdom/editor-draft', '/api/kingdom/editor-background', '/api/kingdom/editor-view'],
    async (_req, res, next) => {
      await administrationFor('world').require(res.locals.user.id);
      next();
    },
  );
  app.get('/api/kingdom/editor-draft', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT revision,items FROM kingdom_editor_drafts WHERE user_id=$1',
      [res.locals.user.id],
    );
    res.json(rows[0] ?? { revision: 0, items: [] });
  });
  app.get('/api/kingdom/editor-background/meta', async (_req, res) => {
    const {
      rows: [background],
    } = await pool.query(
      'SELECT width,height,revision FROM kingdom_editor_backgrounds WHERE user_id=$1',
      [res.locals.user.id],
    );
    res.json(
      background
        ? {
            exists: true,
            width: background.width,
            height: background.height,
            revision: background.revision,
          }
        : {
            exists: false,
            width: KINGDOM_DEFAULT_WIDTH,
            height: KINGDOM_DEFAULT_HEIGHT,
            revision: 0,
          },
    );
  });
  app.get('/api/kingdom/editor-background/image', async (_req, res) => {
    const {
      rows: [background],
    } = await pool.query(
      'SELECT mime_type,image_data FROM kingdom_editor_backgrounds WHERE user_id=$1',
      [res.locals.user.id],
    );
    if (!background) throw new AppError(404, 'Fundo do mapa não encontrado.');
    res.type(background.mime_type).send(background.image_data);
  });
  app.put(
    '/api/kingdom/editor-background',
    express.raw({
      type: ['image/png', 'image/jpeg', 'image/webp'],
      limit: KINGDOM_BACKGROUND_MAX_BYTES,
    }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new AppError(400, 'Envie uma imagem PNG, JPEG ou WebP.');
      let metadata: { width?: number; height?: number; format?: string };
      try {
        metadata = await sharp(req.body, {
          limitInputPixels: KINGDOM_BACKGROUND_MAX_PIXELS,
        }).metadata();
      } catch {
        throw new AppError(400, 'A imagem enviada é inválida ou excede o limite de pixels.');
      }
      const { width, height, format } = metadata;
      const mime =
        format === 'png'
          ? 'image/png'
          : format === 'jpeg'
            ? 'image/jpeg'
            : format === 'webp'
              ? 'image/webp'
              : null;
      if (
        !mime ||
        !width ||
        !height ||
        width > KINGDOM_BACKGROUND_MAX_EDGE ||
        height > KINGDOM_BACKGROUND_MAX_EDGE ||
        width * height > KINGDOM_BACKGROUND_MAX_PIXELS
      )
        throw new AppError(
          400,
          'A imagem deve ter até 12.288 px por lado e 100 milhões de pixels.',
        );
      const {
        rows: [background],
      } = await pool.query(
        `INSERT INTO kingdom_editor_backgrounds(user_id,mime_type,image_data,width,height)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (user_id) DO UPDATE SET mime_type=EXCLUDED.mime_type,
           image_data=EXCLUDED.image_data,width=EXCLUDED.width,height=EXCLUDED.height,
           revision=kingdom_editor_backgrounds.revision+1,updated_at=now()
         RETURNING width,height,revision`,
        [res.locals.user.id, mime, req.body, width, height],
      );
      res.json({ exists: true, ...background });
    },
  );
  app.delete('/api/kingdom/editor-background', async (_req, res) => {
    await pool.query('DELETE FROM kingdom_editor_backgrounds WHERE user_id=$1', [
      res.locals.user.id,
    ]);
    res.json({
      exists: false,
      width: KINGDOM_DEFAULT_WIDTH,
      height: KINGDOM_DEFAULT_HEIGHT,
      revision: 0,
    });
  });
  app.get('/api/kingdom/editor-view', async (_req, res) => {
    const {
      rows: [view],
    } = await pool.query(
      `SELECT v.center_x AS x,v.center_y AS y,v.zoom,v.angle
       FROM kingdom_editor_views v
       LEFT JOIN kingdom_editor_backgrounds b ON b.user_id=v.user_id
       WHERE v.user_id=$1 AND v.background_updated_at IS NOT DISTINCT FROM b.updated_at`,
      [res.locals.user.id],
    );
    res.json(view ? { exists: true, ...view } : { exists: false, x: 0, y: 0, zoom: 1, angle: 0 });
  });
  app.put('/api/kingdom/editor-view', async (req, res) => {
    const view = kingdomViewSchema.parse(req.body);
    const {
      rows: [saved],
    } = await pool.query(
      `INSERT INTO kingdom_editor_views(user_id,background_updated_at,center_x,center_y,zoom,angle)
       VALUES($1,(SELECT updated_at FROM kingdom_editor_backgrounds WHERE user_id=$1),$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET background_updated_at=EXCLUDED.background_updated_at,
         center_x=EXCLUDED.center_x,center_y=EXCLUDED.center_y,zoom=EXCLUDED.zoom,
         angle=EXCLUDED.angle,updated_at=now()
       RETURNING center_x AS x,center_y AS y,zoom,angle`,
      [res.locals.user.id, view.x, view.y, view.zoom, view.angle],
    );
    res.json({ exists: true, ...saved });
  });
  app.delete('/api/kingdom/editor-view', async (_req, res) => {
    await pool.query('DELETE FROM kingdom_editor_views WHERE user_id=$1', [res.locals.user.id]);
    res.json({ exists: false, x: 0, y: 0, zoom: 1, angle: 0 });
  });
  app.put('/api/kingdom/editor-draft', async (req, res) => {
    const draft = kingdomDraftSchema.parse(req.body);
    const saved = await transaction(async (client) => {
      await client.query(
        `INSERT INTO kingdom_editor_drafts(user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [res.locals.user.id],
      );
      const result = await client.query(
        `UPDATE kingdom_editor_drafts
         SET items=$2::jsonb,revision=revision+1,updated_at=now()
         WHERE user_id=$1 AND revision=$3
         RETURNING revision,items`,
        [res.locals.user.id, JSON.stringify(draft.items), draft.revision],
      );
      if (!result.rowCount)
        throw new AppError(
          409,
          'Este rascunho foi alterado em outra janela. Recarregue antes de salvar.',
        );
      return result.rows[0];
    });
    res.json(saved);
  });
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'Rota não encontrada.')));
  if (existsSync(resolve('dist/client/index.html'))) {
    app.use(compressedBundle);
    app.use(optimizedPublicImages());
    app.use(
      express.static(resolve('dist/client'), {
        setHeaders: (res, file) => {
          const cache = staticAssetCacheControl(resolve('dist/client'), file);
          if (cache) res.setHeader('Cache-Control', cache);
        },
      }),
    );
    app.get('/{*splat}', (_req, res) =>
      res.set('Cache-Control', 'no-store').sendFile('index.html', { root: resolve('dist/client') }),
    );
  }
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Revise os campos informados.',
          details: error.issues.map((i) => i.message),
        });
        return;
      }
      if (error && typeof error === 'object' && 'constraint' in error && error.constraint === 'vtt_account_storage_limit') {
        res.status(413).json({error:'O limite de 100 MB de imagens externas desta conta foi atingido. Remova imagens não utilizadas antes de enviar outras.'});
        return;
      }
      if (error instanceof AppError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        error.type === 'entity.too.large'
      ) {
        res.status(413).json({
          error:
            _req.path === '/api/character-art'
              ? 'A referência deve ter no máximo 8 MB.'
              : 'O arquivo excede o tamanho permitido.',
        });
        return;
      }
      if (error instanceof SyntaxError && 'body' in error) {
        res.status(400).json({ error: 'Dados inválidos.' });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Não foi possível concluir a solicitação. Tente novamente.' });
    },
  );
  return app;
}
