import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { z } from 'zod';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { auth, origins } from './auth.js';
import { pool, transaction } from './db.js';
import { AppError, purchase } from './services.js';
import { completeMission, completionSchema } from './missions.js';
import { atlasId, resolvePostLocation } from './atlas.js';
import { races, classes, hitDice, modifier } from '../shared/rules.js';
import {
  KINGDOM_BACKGROUND_MAX_BYTES,
  KINGDOM_BACKGROUND_MAX_EDGE,
  KINGDOM_BACKGROUND_MAX_PIXELS,
  KINGDOM_DEFAULT_WIDTH,
  KINGDOM_DEFAULT_HEIGHT,
  KINGDOM_EDITOR_CATALOG,
} from '../shared/kingdom-editor.js';

const uuid = z.string().uuid();
const characterSchema = z.object({
  name: z.string().trim().min(2).max(60),
  race: z.enum(races),
  class: z.enum(classes),
  background: z.string().trim().min(2).max(40).default('Aventureiro'),
  biography: z.string().trim().max(2000).default(''),
  stats: z
    .array(z.number().int())
    .length(6)
    .refine(
      (values) => [...values].sort((a, b) => a - b).join() === '8,10,12,13,14,15',
      'Distribua a matriz padrão sem repetir valores.',
    ),
});
const postSchema = z.object({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(15).max(3000),
  kind: z.enum(['mission', 'event']),
  starts_at: z.string().datetime({ offset: true }).optional(),
  location: z.string().trim().min(2).max(100).optional(),
  location_id: atlasId.optional(),
  difficulty: z.enum(['Tranquila', 'Moderada', 'Perigosa']),
  reward_cp: z.number().int().min(0).max(10000000).default(0),
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
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? { directives: { 'upgrade-insecure-requests': null } }
          : false,
    }),
  );
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.all(
    '/api/auth/*splat',
    (req, res, next) => {
      // Never accept a caller-supplied forwarded IP for authentication limits.
      req.headers['x-guild-client-ip'] = req.socket.remoteAddress || '127.0.0.1';
      next();
    },
    toNodeHandler(auth),
  );
  app.use(express.json({ limit: '128kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Muitas solicitações. Tente novamente em um minuto.' },
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
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new AppError(401, 'Entre na sua conta para continuar.');
    res.locals.user = session.user;
    next();
  });
  app.get('/api/me', async (_req, res) => {
    const {
      rows: [staff],
    } = await pool.query('SELECT role FROM guild_staff WHERE user_id=$1', [res.locals.user.id]);
    res.json({ ...res.locals.user, role: staff?.role || 'player' });
  });
  app.get('/api/characters', async (_req, res) => {
    res.json(
      (
        await pool.query('SELECT * FROM characters WHERE user_id=$1 ORDER BY created_at', [
          res.locals.user.id,
        ])
      ).rows,
    );
  });
  app.post('/api/characters', async (req, res) => {
    const data = characterSchema.parse(req.body);
    const character = await transaction(async (client) => {
      const {
        rows: [character],
      } = await client.query(
        `INSERT INTO characters(user_id,name,race,class,background,biography,stats,hp,armor_class)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          res.locals.user.id,
          data.name,
          data.race,
          data.class,
          data.background,
          data.biography,
          JSON.stringify(data.stats),
          hitDice[data.class] + modifier(data.stats[2]),
          10 + modifier(data.stats[1]),
        ],
      );
      await client.query(
        "INSERT INTO achievements(character_id,code) VALUES($1,'first_character')",
        [character.id],
      );
      return character;
    });
    res.status(201).json(character);
  });
  app.get('/api/characters/:id/details', async (req, res) => {
    const id = uuid.parse(req.params.id);
    if (
      !(
        await pool.query('SELECT 1 FROM characters WHERE id=$1 AND user_id=$2', [
          id,
          res.locals.user.id,
        ])
      ).rowCount
    )
      throw new AppError(404, 'Personagem não encontrado.');
    const [inventory, achievements, history] = await Promise.all([
      pool.query(
        'SELECT i.quantity,c.* FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 ORDER BY c.name',
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
    res.json({ inventory: inventory.rows, achievements: achievements.rows, history: history.rows });
  });
  app.get('/api/catalog', async (_req, res) =>
    res.json(
      (
        await pool.query(
          'SELECT id,name,original_name,category,description,price_cp,weight_lb,source,source_url FROM catalog_items WHERE active=true ORDER BY category,name',
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
      })
      .parse(req.body);
    const result = await purchase(
      res.locals.user.id,
      data.character_id,
      data.item_id,
      data.quantity,
      data.idempotency_key,
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
      `SELECT b.*,u.name AS author_name,
      (SELECT count(*)::int FROM mission_participants p WHERE p.post_id=b.id) AS participants,
      COALESCE((SELECT json_agg(p.character_id) FROM mission_participants p JOIN characters c ON c.id=p.character_id WHERE p.post_id=b.id AND c.user_id=$1),'[]') AS my_characters,
      (SELECT title FROM board_posts source WHERE source.id=b.source_mission_id) AS source_mission_title,
      COALESCE((SELECT json_agg(json_build_object('name',c.name,'experience',r.experience)) FROM mission_rewards r JOIN characters c ON c.id=r.character_id WHERE r.post_id=b.id AND (c.user_id=$1 OR b.author_id=$1)),'[]') AS rewards
      FROM board_posts b LEFT JOIN "user" u ON u.id=b.author_id
      WHERE ($2::text IS NULL OR b.region_id=$2) AND ($3::text IS NULL OR b.location_id=$3)
      ORDER BY b.created_at DESC`,
      [res.locals.user.id, filters.region_id || null, filters.location_id || null],
    );
    res.json(rows);
  });
  app.post('/api/board', async (req, res) => {
    const data = postSchema.parse(req.body);
    if (
      data.kind === 'event' &&
      !(await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [res.locals.user.id]))
        .rowCount
    )
      throw new AppError(403, 'Somente a staff pode criar eventos.');
    if (data.kind === 'mission' && !data.starts_at)
      throw new AppError(400, 'Informe a data e a hora de início da missão.');
    if (data.starts_at && new Date(data.starts_at).getTime() <= Date.now())
      throw new AppError(400, 'Escolha uma data e hora futuras.');
    const post = await transaction(async (client) => {
      const location = await resolvePostLocation(client, data);
      const {
        rows: [created],
      } = await client.query(
        `INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,reward_cp,starts_at,region_id,location_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          res.locals.user.id,
          data.kind,
          data.title,
          data.description,
          location.location,
          data.difficulty,
          data.reward_cp,
          data.starts_at || null,
          location.region_id,
          location.location_id,
        ],
      );
      return created;
    });
    res.status(201).json(post);
  });
  app.post('/api/board/:id/join', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { character_id } = z.object({ character_id: uuid }).parse(req.body);
    await transaction(async (client) => {
      const {
        rows: [post],
      } = await client.query('SELECT * FROM board_posts WHERE id=$1 FOR UPDATE', [id]);
      if (!post || post.kind !== 'mission' || post.status !== 'open')
        throw new AppError(409, 'Esta missão não está aberta para inscrições.');
      if (
        !(
          await client.query('SELECT 1 FROM characters WHERE id=$1 AND user_id=$2', [
            character_id,
            res.locals.user.id,
          ])
        ).rowCount
      )
        throw new AppError(404, 'Personagem não encontrado.');
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
          "SELECT 1 FROM board_posts WHERE id=$1 AND author_id=$2 AND kind='mission'",
          [id, res.locals.user.id],
        )
      ).rowCount
    )
      throw new AppError(403, 'Somente o criador pode consultar os participantes para conclusão.');
    res.json(
      (
        await pool.query(
          'SELECT c.id,c.name,c.race,c.class FROM mission_participants p JOIN characters c ON c.id=p.character_id WHERE p.post_id=$1 ORDER BY c.name',
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
      `UPDATE board_posts SET status=$1,closed_at=CASE WHEN $1 IN ('completed','closed') THEN now() ELSE NULL END
      WHERE id=$2 AND author_id=$3 AND status=ANY($4::text[]) AND kind <> 'hook'
      AND NOT (kind='mission' AND $1='completed')
      AND (kind <> 'event' OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$3)) RETURNING *`,
      [status, id, res.locals.user.id, allowed],
    );
    if (!post)
      throw new AppError(409, 'Somente o autor pode atualizar um registro em estado compatível.');
    res.json(post);
  });
  app.get('/api/world', async (_req, res) =>
    res.json((await pool.query('SELECT * FROM world_entries ORDER BY id')).rows),
  );
  app.get('/api/atlas', async (_req, res) => {
    const [regions, locations] = await Promise.all([
      pool.query(
        'SELECT id,name,description,available FROM world_regions ORDER BY available DESC,name',
      ),
      pool.query(
        'SELECT id,region_id,name,description,map_x,map_y FROM world_locations ORDER BY name',
      ),
    ]);
    res.json({ regions: regions.rows, locations: locations.rows });
  });
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
    app.use(express.static(resolve('dist/client')));
    app.get('/{*splat}', (_req, res) => res.sendFile(resolve('dist/client/index.html')));
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
        res.status(413).json({ error: 'O fundo deve ter no máximo 128 MB.' });
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
