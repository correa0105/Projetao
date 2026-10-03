import express from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { lorePageInput, LORE_MAX_IMAGE_BYTES } from '../shared/lore.js';

const uuid = z.string().uuid();
const visible = `(p.published OR p.author_id=$1 OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$1))`;
const editable = `(COALESCE(p.author_id=$1,false) OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$1))`;
const summary = `p.id,p.region_id,p.folder_id,p.title,p.subtitle,p.published,p.revision,
  ${editable} AS can_edit,
  (SELECT '/api/lore/images/' || (b->>'asset_id') FROM jsonb_array_elements(p.blocks) b
    WHERE b->>'type'='image' LIMIT 1) AS thumbnail`;

// Preserve existing SQL chronicles; seed may run on a newly created database.
export async function seedLore() {
  await pool.query(`INSERT INTO lore_pages(region_id,folder_id,legacy_id,title,subtitle,published,blocks)
    SELECT f.region_id,f.id,w.id,w.title,w.subtitle,true,
      jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'type','text','title','',
        'text',w.body,'style','prose','alignment','left'))
    FROM world_entries w JOIN lore_folders f ON f.region_id='reino-do-norte' AND f.name='História' AND f.parent_id IS NULL
    WHERE w.section='lore' ON CONFLICT(legacy_id) DO NOTHING`);
}

async function getPage(id: string, userId: string, edit = false) {
  const {
    rows: [page],
  } = await pool.query(
    `SELECT ${summary},p.blocks FROM lore_pages p WHERE p.id=$2 AND ${edit ? editable : visible}`,
    [userId, id],
  );
  if (!page) throw new AppError(404, 'Crônica não encontrada ou indisponível para esta conta.');
  return page;
}

export function loreRouter() {
  const router = express.Router();
  router.get('/lore', async (_req, res) => {
    const userId = res.locals.user.id;
    const [regions, folders, pages] = await Promise.all([
      pool.query('SELECT id,name,description FROM world_regions ORDER BY available DESC,name'),
      pool.query('SELECT id,region_id,parent_id,name FROM lore_folders ORDER BY name'),
      pool.query(
        `SELECT ${summary} FROM lore_pages p WHERE ${visible} ORDER BY p.created_at,p.id`,
        [userId],
      ),
    ]);
    res.json({ regions: regions.rows, folders: folders.rows, pages: pages.rows });
  });
  router.post('/lore/folders', async (req, res) => {
    const data = z
      .object({
        region_id: z.string().max(100),
        parent_id: uuid.nullable(),
        name: z.string().trim().min(2).max(80),
      })
      .strict()
      .parse(req.body);
    const region = await pool.query('SELECT 1 FROM world_regions WHERE id=$1', [data.region_id]);
    if (!region.rowCount) throw new AppError(400, 'Escolha uma região do mapa.');
    if (data.parent_id) {
      const {
        rows: [parent],
      } = await pool.query(
        `WITH RECURSIVE lineage AS (
          SELECT id,parent_id,region_id,1 AS depth FROM lore_folders WHERE id=$1
          UNION ALL SELECT f.id,f.parent_id,f.region_id,l.depth+1 FROM lore_folders f JOIN lineage l ON f.id=l.parent_id
        ) SELECT max(depth)::int AS depth,min(region_id) AS region_id FROM lineage`,
        [data.parent_id],
      );
      if (parent?.region_id !== data.region_id)
        throw new AppError(400, 'A subpasta deve pertencer à mesma região.');
      if (parent.depth >= 4) throw new AppError(400, 'Use no máximo quatro níveis de pastas.');
    }
    try {
      const {
        rows: [folder],
      } = await pool.query(
        'INSERT INTO lore_folders(region_id,parent_id,name,created_by) VALUES($1,$2,$3,$4) RETURNING id,region_id,parent_id,name',
        [data.region_id, data.parent_id, data.name, res.locals.user.id],
      );
      res.status(201).json(folder);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
        throw new AppError(409, 'Esta pasta já existe neste local.');
      throw error;
    }
  });
  router.get('/lore/pages/:id', async (req, res) =>
    res.json(await getPage(uuid.parse(req.params.id), res.locals.user.id)),
  );
  router.post('/lore/pages', async (req, res) => {
    const data = lorePageInput.parse(req.body);
    if (data.blocks.some((block) => block.type === 'image'))
      throw new AppError(400, 'Crie a crônica antes de enviar suas imagens.');
    if (
      !(
        await pool.query('SELECT 1 FROM lore_folders WHERE id=$1 AND region_id=$2', [
          data.folder_id,
          data.region_id,
        ])
      ).rowCount
    )
      throw new AppError(400, 'A pasta deve pertencer à região escolhida.');
    const {
      rows: [page],
    } = await pool.query(
      `INSERT INTO lore_pages(region_id,folder_id,author_id,title,subtitle,published,blocks)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        data.region_id,
        data.folder_id,
        res.locals.user.id,
        data.title,
        data.subtitle,
        data.published,
        JSON.stringify(data.blocks),
      ],
    );
    res.status(201).json(await getPage(page.id, res.locals.user.id));
  });
  router.put('/lore/pages/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = res.locals.user.id;
    const { revision, ...data } = lorePageInput
      .extend({ revision: z.number().int().min(0) })
      .parse(req.body);
    await transaction(async (client) => {
      const {
        rows: [page],
      } = await client.query(
        `SELECT p.* FROM lore_pages p WHERE p.id=$2 AND ${editable} FOR UPDATE`,
        [userId, id],
      );
      if (!page) throw new AppError(404, 'Crônica não encontrada ou indisponível para edição.');
      if (page.revision !== revision)
        throw new AppError(409, 'Esta crônica mudou em outra janela. Recarregue antes de salvar.');
      if (
        !(
          await client.query('SELECT 1 FROM lore_folders WHERE id=$1 AND region_id=$2', [
            data.folder_id,
            data.region_id,
          ])
        ).rowCount
      )
        throw new AppError(400, 'A pasta deve pertencer à região escolhida.');
      const assets = data.blocks.flatMap((block) =>
        block.type === 'image' ? [block.asset_id] : [],
      );
      if (assets.length) {
        const { rows } = await client.query(
          'SELECT id FROM lore_images WHERE page_id=$1 AND id=ANY($2::uuid[])',
          [id, assets],
        );
        if (new Set(rows.map((image) => image.id)).size !== new Set(assets).size)
          throw new AppError(400, 'Use somente imagens enviadas para esta crônica.');
      }
      await client.query(
        'INSERT INTO lore_page_versions(page_id,revision,editor_id,snapshot) VALUES($1,$2,$3,$4)',
        [id, revision, userId, JSON.stringify(page)],
      );
      await client.query(
        `UPDATE lore_pages SET region_id=$2,folder_id=$3,title=$4,subtitle=$5,published=$6,blocks=$7,revision=revision+1,updated_at=now() WHERE id=$1`,
        [
          id,
          data.region_id,
          data.folder_id,
          data.title,
          data.subtitle,
          data.published,
          JSON.stringify(data.blocks),
        ],
      );
    });
    res.json(await getPage(id, userId));
  });
  router.post(
    '/lore/pages/:id/images',
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: LORE_MAX_IMAGE_BYTES }),
    async (req, res) => {
      const pageId = uuid.parse(req.params.id);
      await getPage(pageId, res.locals.user.id, true);
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        throw new AppError(400, 'Envie uma imagem PNG, JPEG ou WebP.');
      const count = await pool.query(
        'SELECT count(*)::int AS count FROM lore_images WHERE page_id=$1',
        [pageId],
      );
      if (count.rows[0].count >= 100)
        throw new AppError(400, 'Esta crônica já possui 100 imagens.');
      let output: Buffer, width: number, height: number;
      try {
        const source = sharp(req.body, { limitInputPixels: 40_000_000 });
        const meta = await source.metadata();
        if (!['png', 'jpeg', 'webp'].includes(meta.format || '') || (meta.pages || 1) > 1)
          throw new Error('format');
        const result = await source
          .rotate()
          .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer({ resolveWithObject: true });
        output = result.data;
        width = result.info.width;
        height = result.info.height;
      } catch {
        throw new AppError(
          400,
          'Imagem inválida. Use PNG, JPEG ou WebP estático de até 12 MB e 40 megapixels.',
        );
      }
      const id = randomUUID();
      await pool.query(
        'INSERT INTO lore_images(id,page_id,image_data,width,height) VALUES($1,$2,$3,$4,$5)',
        [id, pageId, output, width, height],
      );
      res.status(201).json({ id, width, height });
    },
  );
  router.get('/lore/images/:id', async (req, res) => {
    const {
      rows: [image],
    } = await pool.query(
      `SELECT i.image_data,i.mime_type FROM lore_images i JOIN lore_pages p ON p.id=i.page_id WHERE i.id=$2 AND ${visible}`,
      [res.locals.user.id, uuid.parse(req.params.id)],
    );
    if (!image) throw new AppError(404, 'Imagem não encontrada.');
    res.type(image.mime_type).send(image.image_data);
  });
  return router;
}
