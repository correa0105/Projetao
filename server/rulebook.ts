import express from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import type { Pool, PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import {
  INITIAL_RULEBOOK,
  RULEBOOK_EDITOR_EMAIL,
  RULEBOOK_MAX_IMAGE_BYTES,
  RULEBOOK_MAX_IMAGE_EDGE,
  RULEBOOK_MAX_IMAGE_PIXELS,
  RULEBOOK_MAX_IMAGES_PER_EDITOR,
  rulebookDocumentSchema,
  rulebookImageSources,
  rulebookImageUrl,
  type RulebookDocument,
} from '../shared/rulebook.js';

type Database = Pool | PoolClient;
const editorPredicate = `(
  EXISTS(SELECT 1 FROM "user" WHERE id=$1 AND lower(btrim(email))=$2)
  OR EXISTS(SELECT 1 FROM guild_staff WHERE user_id=$1 AND role IN ('staff','admin'))
)`;
const initialDocument = JSON.stringify(rulebookDocumentSchema.parse(INITIAL_RULEBOOK));
const writeSchema = z
  .object({
    revision: z.number().int().min(0).max(2_147_483_646),
    document: rulebookDocumentSchema,
  })
  .strict();
const uploadSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    data: z.string().max(Math.ceil(RULEBOOK_MAX_IMAGE_BYTES / 3) * 4 + 64),
  })
  .strict();
const uuid = z.string().uuid();
const historyRevision = z
  .string()
  .regex(/^(?:0|[1-9][0-9]{0,9})$/)
  .transform(Number)
  .pipe(z.number().int().max(2_147_483_647));

export async function canEditRulebook(userId: string, database: Database = pool): Promise<boolean> {
  const {
    rows: [permission],
  } = await database.query(`SELECT ${editorPredicate} AS allowed`, [userId, RULEBOOK_EDITOR_EMAIL]);
  return permission.allowed;
}

async function requireEditor(userId: string, database: Database = pool) {
  if (!(await canEditRulebook(userId, database)))
    throw new AppError(403, 'Esta conta não pode editar o livro de regras.');
}

// Safe for startup seeding and first read: never overwrite a published revision
// and never change the pre-existing world_entries rules.
export async function ensureInitialRulebook(database: Database = pool): Promise<void> {
  await database.query(
    'INSERT INTO rulebook_documents(id,document) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',
    [initialDocument],
  );
}

async function validateImageReferences(document: RulebookDocument, database: Database) {
  const ids = [
    ...new Set(
      rulebookImageSources(document).flatMap((src) => {
        const match = /^\/api\/rulebook\/images\/([0-9a-f-]+)$/.exec(src);
        return match ? [match[1]] : [];
      }),
    ),
  ];
  if (!ids.length) return;
  const { rowCount } = await database.query(
    'SELECT id FROM rulebook_images WHERE id=ANY($1::uuid[])',
    [ids],
  );
  if (rowCount !== ids.length)
    throw new AppError(
      400,
      'O livro contém um upload que não existe. Envie a imagem antes de salvar.',
    );
}

async function processImage(dataUrl: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new AppError(400, 'Envie uma imagem PNG, JPEG ou WebP em base64.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.toString('base64') !== match[2] || !buffer.length)
    throw new AppError(400, 'A imagem contém dados inválidos.');
  if (buffer.length > RULEBOOK_MAX_IMAGE_BYTES)
    throw new AppError(413, 'A imagem deve ter no máximo 8 MB.');
  try {
    const input = sharp(buffer, { limitInputPixels: RULEBOOK_MAX_IMAGE_PIXELS, failOn: 'error' });
    const metadata = await input.metadata();
    if (metadata.format !== match[1] || (metadata.pages ?? 1) !== 1)
      throw new AppError(400, 'Use uma imagem estática PNG, JPEG ou WebP com o tipo correto.');
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > RULEBOOK_MAX_IMAGE_EDGE ||
      metadata.height > RULEBOOK_MAX_IMAGE_EDGE ||
      metadata.width * metadata.height > RULEBOOK_MAX_IMAGE_PIXELS
    )
      throw new AppError(400, 'A imagem excede o limite de 8192 pixels por lado ou 32 megapixels.');
    const result = await input
      .rotate()
      .resize({
        width: 4096,
        height: 4096,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length > RULEBOOK_MAX_IMAGE_BYTES)
      throw new AppError(413, 'A imagem deve ter no máximo 8 MB.');
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      'Não foi possível ler esta imagem. Use um arquivo PNG, JPEG ou WebP válido.',
    );
  }
}

export function rulebookRouter() {
  const router = express.Router();
  router.get('/rulebook', async (_req, res) => {
    const userId = res.locals.user.id;
    await ensureInitialRulebook();
    const [
      {
        rows: [book],
      },
      canEdit,
    ] = await Promise.all([
      pool.query('SELECT document,revision FROM rulebook_documents WHERE id=1'),
      canEditRulebook(userId),
    ]);
    res.set('Cache-Control', 'no-store').json({ ...book, can_edit: canEdit });
  });

  router.put('/rulebook', async (req, res) => {
    const userId = res.locals.user.id;
    await requireEditor(userId);
    const input = writeSchema.parse(req.body);
    const saved = await transaction(async (client) => {
      await requireEditor(userId, client);
      await ensureInitialRulebook(client);
      const {
        rows: [book],
      } = await client.query(
        'SELECT document,revision,updated_at FROM rulebook_documents WHERE id=1 FOR UPDATE',
      );
      if (book.revision !== input.revision)
        throw new AppError(
          409,
          'O livro foi atualizado em outra janela. Seu rascunho foi preservado; recarregue a revisão antes de publicar.',
        );
      await validateImageReferences(input.document, client);
      await client.query(
        `INSERT INTO rulebook_versions(document_id,revision,snapshot,editor_id,document_updated_at)
         VALUES(1,$1,$2::jsonb,$3,$4)`,
        [book.revision, JSON.stringify(book.document), userId, book.updated_at],
      );
      const {
        rows: [updated],
      } = await client.query(
        `UPDATE rulebook_documents SET document=$1::jsonb,revision=revision+1,
         updated_by=$2,updated_at=now() WHERE id=1 RETURNING document,revision`,
        [JSON.stringify(input.document), userId],
      );
      return { ...updated, can_edit: true };
    });
    res.set('Cache-Control', 'no-store').json(saved);
  });

  router.get('/rulebook/history', async (_req, res) => {
    const userId = res.locals.user.id;
    await requireEditor(userId);
    await ensureInitialRulebook();
    const { rows } = await pool.query(
      `SELECT revision,document->>'title' AS title,updated_at FROM rulebook_documents WHERE id=1 AND ${editorPredicate}
       UNION ALL
       SELECT revision,snapshot->>'title' AS title,document_updated_at AS updated_at
       FROM rulebook_versions WHERE document_id=1 AND ${editorPredicate} ORDER BY revision DESC`,
      [userId, RULEBOOK_EDITOR_EMAIL],
    );
    res.set('Cache-Control', 'no-store').json({ revisions: rows });
  });

  router.get('/rulebook/history/:revision', async (req, res) => {
    const userId = res.locals.user.id;
    await requireEditor(userId);
    const revision = historyRevision.parse(req.params.revision);
    await ensureInitialRulebook();
    const {
      rows: [snapshot],
    } = await pool.query(
      `SELECT document,revision FROM rulebook_documents WHERE id=1 AND revision=$3 AND ${editorPredicate}
       UNION ALL SELECT snapshot AS document,revision FROM rulebook_versions
       WHERE document_id=1 AND revision=$3 AND ${editorPredicate}`,
      [userId, RULEBOOK_EDITOR_EMAIL, revision],
    );
    if (!snapshot) throw new AppError(404, 'Esta revisão do livro não existe.');
    res.set('Cache-Control', 'no-store').json(snapshot);
  });

  router.post('/rulebook/images', async (req, res) => {
    const userId = res.locals.user.id;
    await requireEditor(userId);
    const input = uploadSchema.parse(req.body);
    const processed = await processImage(input.data);
    const image = await transaction(async (client) => {
      await requireEditor(userId, client);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `rulebook-images:${userId}`,
      ]);
      const {
        rows: [count],
      } = await client.query(
        'SELECT count(*)::int AS total FROM rulebook_images WHERE uploaded_by=$1',
        [userId],
      );
      if (count.total >= RULEBOOK_MAX_IMAGES_PER_EDITOR)
        throw new AppError(409, 'Esta conta atingiu o limite de 500 imagens no livro de regras.');
      const {
        rows: [asset],
      } = await client.query(
        `INSERT INTO rulebook_images(uploaded_by,name,image_data,width,height)
         VALUES($1,$2,$3,$4,$5) RETURNING id,name,width,height`,
        [userId, input.name, processed.data, processed.info.width, processed.info.height],
      );
      return { ...asset, src: rulebookImageUrl(asset.id) };
    });
    res.status(201).set('Cache-Control', 'no-store').json(image);
  });

  router.get('/rulebook/images/:id', async (req, res) => {
    const userId = res.locals.user.id;
    const imageId = uuid.parse(req.params.id);
    // Unpublished images stay private to editors. Readers can access only
    // images used by the current published document; historic assets survive.
    const {
      rows: [image],
    } = await pool.query(
      `SELECT i.image_data,i.mime_type FROM rulebook_images i WHERE i.id=$3 AND (
        ${editorPredicate} OR EXISTS(
          SELECT 1 FROM rulebook_documents d WHERE d.id=1 AND (
            d.document->>'cover_image'='/api/rulebook/images/'||i.id
            OR jsonb_path_exists(d.document,
              '$.chapters[*].articles[*].blocks[*] ? (@.type == "image" && @.src == $src)',
              jsonb_build_object('src','/api/rulebook/images/'||i.id))
          )
        )
      )`,
      [userId, RULEBOOK_EDITOR_EMAIL, imageId],
    );
    if (!image) throw new AppError(404, 'Imagem não encontrada ou indisponível para esta conta.');
    res.set('Cache-Control', 'no-store').type(image.mime_type).send(image.image_data);
  });
  return router;
}
