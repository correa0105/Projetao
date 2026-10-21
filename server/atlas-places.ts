import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { atlasId } from './atlas.js';
import { isAdministrator, requireAdministrator } from './administrators.js';
const pinInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1500).default(''),
    map_x: z.number().finite().min(0).max(1),
    map_y: z.number().finite().min(0).max(1),
    pin_visible: z.boolean().default(true),
  })
  .strict();
export function atlasPlacesRouter() {
  const router = Router();
  router.use('/atlas', async (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      await requireAdministrator(res.locals.user.id);
    next();
  });
  router.get('/atlas', async (_req, res) => {
    const admin = await isAdministrator(res.locals.user.id);
    const visibility = 'p.deleted_at IS NULL AND (p.published OR $1)';
    const [regions, locations] = await Promise.all([
      pool.query(
        `SELECT r.id,r.name,r.description,r.available,CASE WHEN ${visibility} THEN p.id END AS history_page_id FROM world_regions r LEFT JOIN lore_pages p ON p.id=r.history_page_id ORDER BY r.available DESC,r.name`,
        [admin],
      ),
      pool.query(
        `SELECT l.id,l.region_id,l.name,l.description,l.map_x,l.map_y,l.pin_visible,l.revision,CASE WHEN ${visibility} THEN p.id END AS history_page_id,CASE WHEN ${visibility} THEN (SELECT coalesce(jsonb_agg(b),'[]'::jsonb) FROM (SELECT value AS b FROM jsonb_array_elements(p.blocks) WITH ORDINALITY WHERE value->>'type'='image' ORDER BY ordinality LIMIT 3) previews) ELSE '[]'::jsonb END AS history_preview FROM world_locations l LEFT JOIN lore_pages p ON p.id=l.history_page_id ORDER BY l.name`,
        [admin],
      ),
    ]);
    res.json({ regions: regions.rows, locations: locations.rows, can_manage_pins: admin });
  });
  router.post('/atlas/locations', async (req, res) => {
    const data = pinInput.extend({ region_id: atlasId }).parse(req.body);
    const id = 'local-' + randomUUID();
    await transaction(async (db) => {
      const region = (
        await db.query('SELECT available FROM world_regions WHERE id=$1 FOR SHARE', [
          data.region_id,
        ])
      ).rows[0];
      if (!region?.available) throw new AppError(400, 'Escolha um reino disponível.');
      await db.query(
        'INSERT INTO world_locations(id,region_id,name,description,map_x,map_y,pin_visible) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [id, data.region_id, data.name, data.description, data.map_x, data.map_y, data.pin_visible],
      );
    });
    res.status(201).json({ id });
  });
  router.put('/atlas/locations/:id', async (req, res) => {
    const id = atlasId.parse(req.params.id),
      data = pinInput.extend({ revision: z.number().int().min(0) }).parse(req.body);
    const updated = await pool.query(
      'UPDATE world_locations SET name=$2,description=$3,map_x=$4,map_y=$5,pin_visible=$6,revision=revision+1 WHERE id=$1 AND revision=$7 RETURNING id,revision',
      [id, data.name, data.description, data.map_x, data.map_y, data.pin_visible, data.revision],
    );
    if (!updated.rowCount)
      throw new AppError(409, 'Este local mudou em outra janela. Recarregue antes de salvar.');
    res.json(updated.rows[0]);
  });
  router.delete('/atlas/locations/:id/pin', async (req, res) => {
    const id = atlasId.parse(req.params.id);
    const { revision } = z
      .object({ revision: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    const removed = await pool.query(
      'UPDATE world_locations SET pin_visible=false,revision=revision+1 WHERE id=$1 AND revision=$2 RETURNING id,revision',
      [id, revision],
    );
    if (!removed.rowCount)
      throw new AppError(409, 'Este pin mudou em outra janela. Recarregue antes de excluir.');
    res.json(removed.rows[0]);
  });
  router.post('/atlas/history', async (req, res) => {
    const data = z
      .object({ region_id: atlasId, location_id: atlasId.optional() })
      .strict()
      .parse(req.body);
    const pageId = await transaction(async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(74261925)');
      const target = data.location_id
        ? (
            await db.query(
              'SELECT id,region_id,name,history_page_id FROM world_locations WHERE id=$1 AND region_id=$2 FOR UPDATE',
              [data.location_id, data.region_id],
            )
          ).rows[0]
        : (
            await db.query(
              'SELECT id,id AS region_id,name,history_page_id FROM world_regions WHERE id=$1 FOR UPDATE',
              [data.region_id],
            )
          ).rows[0];
      if (!target) throw new AppError(404, 'Local não encontrado neste reino.');
      if (
        target.history_page_id &&
        (
          await db.query('SELECT 1 FROM lore_pages WHERE id=$1 AND deleted_at IS NULL', [
            target.history_page_id,
          ])
        ).rowCount
      )
        return target.history_page_id;
      let folder = (
        await db.query(
          "SELECT id FROM lore_folders WHERE region_id=$1 AND name='História' AND parent_id IS NULL AND deleted_at IS NULL ORDER BY id LIMIT 1",
          [data.region_id],
        )
      ).rows[0];
      if (!folder)
        folder = (
          await db.query(
            "INSERT INTO lore_folders(region_id,name) VALUES($1,'História') RETURNING id",
            [data.region_id],
          )
        ).rows[0];
      const page = (
        await db.query(
          "INSERT INTO lore_pages(region_id,folder_id,author_id,title,subtitle,published,blocks) VALUES($1,$2,$3,$4,'',false,'[]') RETURNING id",
          [data.region_id, folder.id, res.locals.user.id, target.name],
        )
      ).rows[0];
      if (data.location_id)
        await db.query('UPDATE world_locations SET history_page_id=$2 WHERE id=$1', [
          target.id,
          page.id,
        ]);
      else
        await db.query('UPDATE world_regions SET history_page_id=$2 WHERE id=$1', [
          target.id,
          page.id,
        ]);
      return page.id;
    });
    res.json({ page_id: pageId });
  });
  router.use((error: any, _req: any, _res: any, next: any) => {
    if (error?.code === '23505')
      next(
        new AppError(
          409,
          'Este local já existe neste reino. Escolha o local existente ao posicionar o pin.',
        ),
      );
    else next(error);
  });
  return router;
}
