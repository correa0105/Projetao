import express from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { pool } from './db.js';
import { AppError } from './services.js';
import { homeUpdateSchema } from '../shared/home-updates.js';
const idSchema = z.string().uuid();
const fields = [
  'title',
  'body',
  'kind',
  'layout',
  'image_path',
  'image_side',
  'image_fit',
  'link',
  'starts_at',
  'location',
  'text_align',
  'text_size',
  'position',
] as const;
const permitted = `(author_id=$2 OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$2))`;
export function homeUpdatesRouter() {
  const router = express.Router();
  router.get('/home-updates', async (_req, res) => {
    res.json(
      (
        await pool.query(
          `SELECT h.*,u.name AS author_name,(h.author_id=$1 OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$1)) AS can_edit FROM home_updates h JOIN "user" u ON u.id=h.author_id ORDER BY h.position,h.created_at DESC LIMIT 100`,
          [res.locals.user.id],
        )
      ).rows,
    );
  });
  router.post('/home-updates', async (req, res) => {
    const input = homeUpdateSchema.parse(req.body);
    await checkImage(input.image_path, res.locals.user.id);
    const values = fields.map((f) => input[f]);
    const {
      rows: [row],
    } = await pool.query(
      `INSERT INTO home_updates(author_id,${fields.join(',')}) VALUES($1,${fields.map((_, i) => '$' + (i + 2)).join(',')}) RETURNING *`,
      [res.locals.user.id, ...values],
    );
    res.status(201).json(row);
  });
  router.put('/home-updates/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id),
      input = homeUpdateSchema.parse(req.body);
    if (!input.revision) throw new AppError(400, 'Atualize a página antes de editar.');
    const owned = await pool.query(`SELECT id FROM home_updates WHERE id=$1 AND ${permitted}`, [
      id,
      res.locals.user.id,
    ]);
    if (!owned.rowCount) throw new AppError(404, 'Publicação não encontrada.');
    await checkImage(input.image_path, res.locals.user.id, id);
    const values = fields.map((f) => input[f]);
    const result = await pool.query(
      `UPDATE home_updates SET ${fields.map((f, i) => f + '=$' + (i + 3)).join(',')},revision=revision+1,updated_at=now() WHERE id=$1 AND ${permitted} AND revision=$${fields.length + 3} RETURNING *`,
      [id, res.locals.user.id, ...values, input.revision],
    );
    if (!result.rowCount)
      throw new AppError(409, 'Essa publicação foi alterada. Reabra para editar a versão atual.');
    res.json(result.rows[0]);
  });
  router.delete('/home-updates/:id', async (req, res) => {
    const result = await pool.query(
      `DELETE FROM home_updates WHERE id=$1 AND ${permitted} RETURNING id`,
      [idSchema.parse(req.params.id), res.locals.user.id],
    );
    if (!result.rowCount) throw new AppError(404, 'Publicação não encontrada.');
    res.json({ ok: true });
  });
  router.post(
    '/home-images',
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'], limit: '8mb' }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new AppError(400, 'Envie uma imagem PNG, JPEG, WebP ou AVIF.');
      let bytes: Buffer;
      try {
        const image = sharp(req.body, { limitInputPixels: 20000000 });
        const meta = await image.metadata();
        if (!['png', 'jpeg', 'webp', 'avif', 'heif'].includes(meta.format || '')) throw new Error();
        bytes = await image
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer();
      } catch {
        throw new AppError(400, 'Imagem inválida ou grande demais (limite: 20 megapixels).');
      }
      const {
        rows: [row],
      } = await pool.query('INSERT INTO home_images(author_id,bytes) VALUES($1,$2) RETURNING id', [
        res.locals.user.id,
        bytes,
      ]);
      res.status(201).json({ path: '/api/home-images/' + row.id });
    },
  );
  router.get('/home-images/:id', async (req, res) => {
    // Authenticated readers see published images; unpublished uploads remain private.
    const {
      rows: [row],
    } = await pool.query(
      `SELECT bytes FROM home_images i WHERE i.id=$1 AND (i.author_id=$2 OR EXISTS(SELECT 1 FROM home_updates h WHERE h.image_path='/api/home-images/'||i.id::text))`,
      [idSchema.parse(req.params.id), res.locals.user.id],
    );
    if (!row) throw new AppError(404, 'Imagem não encontrada.');
    res.type('webp').send(row.bytes);
  });
  return router;
}
async function checkImage(path: string, user: string, article?: string) {
  if (!path.startsWith('/api/home-images/')) return;
  const result = await pool.query(
    `SELECT id FROM home_images WHERE id=$1 AND (author_id=$2 OR EXISTS(SELECT 1 FROM home_updates WHERE id=$3 AND image_path=$4 AND (author_id=$2 OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$2))))`,
    [path.split('/').pop(), user, article || null, path],
  );
  if (!result.rowCount) throw new AppError(400, 'Use uma imagem enviada por você.');
}
