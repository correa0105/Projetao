import express from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { requireAdministrator, isAdministrator, administratorPredicate } from './administrators.js';
import { AppError } from './services.js';
import {
  defaultEventScene,
  eventSceneSchema,
  eventInputSchema,
  type EventScene,
} from '../shared/events.js';
const uuid = z.string().uuid();
async function checkImages(paths: string[]) {
  const ids = [
    ...new Set(
      paths
        .filter((p) => p.startsWith('/api/event-images/'))
        .map((p) => uuid.parse(p.split('/').at(-1))),
    ),
  ];
  if (
    ids.length &&
    (await pool.query('SELECT id FROM event_images WHERE id=ANY($1::uuid[])', [ids])).rowCount !==
      ids.length
  )
    throw new AppError(400, 'Uma das imagens não está disponível.');
}
export function eventsRouter() {
  const router = express.Router();
  router.use(['/events', '/events-scene', '/event-images'], async (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      await requireAdministrator(res.locals.user.id);
    next();
  });
  router.get('/events', async (_req, res) =>
    res.json({
      can_edit: await isAdministrator(res.locals.user.id),
      items: (
        await pool.query(
          'SELECT b.id,b.title,b.description,b.starts_at,b.location,b.status,b.created_at,b.event_revision,b.event_presentation AS presentation,u.name AS author_name FROM board_posts b LEFT JOIN "user" u ON u.id=b.author_id WHERE b.kind=\'event\' ORDER BY b.starts_at NULLS LAST,b.created_at DESC',
        )
      ).rows,
    }),
  );
  router.get('/events-scene', async (_req, res) => {
    await pool.query('INSERT INTO event_scene(id,document)VALUES(1,$1) ON CONFLICT DO NOTHING', [
      JSON.stringify(defaultEventScene),
    ]);
    res.json({
      ...(await pool.query('SELECT document,revision FROM event_scene WHERE id=1')).rows[0],
      can_edit: await isAdministrator(res.locals.user.id),
    });
  });
  router.put('/events-scene', async (req, res) => {
    const input = z
      .object({ document: eventSceneSchema, revision: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    await checkImages([input.document.background, ...input.document.layers.map((l) => l.path)]);
    const r = await pool.query(
      `UPDATE event_scene SET document=$1,revision=revision+1,updated_by=$2,updated_at=now() WHERE id=1 AND revision=$3 AND ${administratorPredicate(2)} RETURNING document,revision`,
      [JSON.stringify(input.document), res.locals.user.id, input.revision],
    );
    if (!r.rowCount) {
      await requireAdministrator(res.locals.user.id);
      throw new AppError(409, 'O cenário mudou. Reabra o editor para carregar a versão atual.');
    }
    res.json({ ...r.rows[0], can_edit: true });
  });
  router.post('/events', async (req, res) => {
    const d = eventInputSchema.parse(req.body);
    await checkImages([d.presentation.image]);
    const r = await pool.query(
      `INSERT INTO board_posts(author_id,kind,title,description,starts_at,location,difficulty,reward_cp,status,event_presentation) SELECT $1,'event',$2,$3,$4,$5,'Tranquila',0,$6,$7 WHERE ${administratorPredicate()} RETURNING id`,
      [
        res.locals.user.id,
        d.title,
        d.description,
        d.starts_at,
        d.location,
        d.status,
        JSON.stringify(d.presentation),
      ],
    );
    if (!r.rowCount) throw new AppError(403, 'Somente administradores podem criar eventos.');
    res.status(201).json(r.rows[0]);
  });
  router.put('/events/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      { revision, ...raw } = z
        .object({ revision: z.number().int().min(1) })
        .passthrough()
        .parse(req.body),
      d = eventInputSchema.parse(raw);
    await checkImages([d.presentation.image]);
    const r = await pool.query(
      `UPDATE board_posts SET title=$1,description=$2,starts_at=$3,location=$4,status=$5,event_presentation=$6,event_revision=event_revision+1,closed_at=CASE WHEN $5 IN ('completed','closed') THEN now() ELSE NULL END WHERE id=$7 AND kind='event' AND event_revision=$8 AND ${administratorPredicate(9)} RETURNING id,event_revision`,
      [
        d.title,
        d.description,
        d.starts_at,
        d.location,
        d.status,
        JSON.stringify(d.presentation),
        id,
        revision,
        res.locals.user.id,
      ],
    );
    if (!r.rowCount) {
      await requireAdministrator(res.locals.user.id);
      throw new AppError(409, 'Este evento mudou ou foi excluído. Reabra a versão atual.');
    }
    res.json(r.rows[0]);
  });
  router.delete('/events/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      revision = z.number().int().min(1).parse(req.body?.revision);
    const r = await pool.query(
      `DELETE FROM board_posts WHERE id=$1 AND kind='event' AND event_revision=$2 AND ${administratorPredicate(3)} RETURNING id`,
      [id, revision, res.locals.user.id],
    );
    if (!r.rowCount)
      throw new AppError(409, 'Este evento mudou ou foi excluído. Reabra a versão atual.');
    res.json({ ok: true });
  });
  router.post(
    '/event-images',
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'], limit: '12mb' }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new AppError(400, 'Envie uma imagem PNG, JPEG, WebP ou AVIF.');
      let bytes: Buffer;
      try {
        bytes = await sharp(req.body, { limitInputPixels: 40000000 })
          .rotate()
          .resize({ width: 3200, height: 3200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 91 })
          .toBuffer();
      } catch {
        throw new AppError(400, 'Imagem inválida ou maior que 40 megapixels.');
      }
      const r = await pool.query(
        'INSERT INTO event_images(author_id,bytes)VALUES($1,$2)RETURNING id',
        [res.locals.user.id, bytes],
      );
      res.status(201).json({ path: '/api/event-images/' + r.rows[0].id });
    },
  );
  router.get('/event-images/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const r = await pool.query(
      `SELECT bytes FROM event_images i WHERE id=$1 AND (${administratorPredicate(2)} OR EXISTS(SELECT 1 FROM event_scene WHERE document->>'background'='/api/event-images/'||i.id::text OR EXISTS(SELECT 1 FROM jsonb_array_elements(document->'layers') l WHERE l->>'path'='/api/event-images/'||i.id::text)) OR EXISTS(SELECT 1 FROM guild_calendar WHERE document->>'background'='/api/event-images/'||i.id::text) OR EXISTS(SELECT 1 FROM board_posts b WHERE kind='event' AND event_presentation->>'image'='/api/event-images/'||i.id::text))`,
      [id, res.locals.user.id],
    );
    if (!r.rowCount) throw new AppError(404, 'Imagem não encontrada.');
    res.type('webp').send(r.rows[0].bytes);
  });
  return router;
}
