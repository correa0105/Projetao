import { Router } from 'express';
import { z } from 'zod';
import sharp from 'sharp';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import {
  characterSchema,
  CHARACTER_LIMIT,
  ART_MAX_BYTES,
  ART_MONTHLY_LIMIT,
} from '../shared/character-art.js';
import { hitDice, modifier } from '../shared/rules.js';

const uuid = z.string().uuid();
const requestSchema = z
  .object({
    character_id: uuid.optional(),
    creation: characterSchema.optional(),
    reference: z
      .string()
      .min(1)
      .max(Math.ceil((ART_MAX_BYTES * 4) / 3) + 4),
    idempotency_key: uuid,
  })
  .refine((data) => Boolean(data.character_id) !== Boolean(data.creation));
const monthStart = "date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";

export async function normalizeArtImage(bytes: Buffer, cutout = false) {
  if (!bytes.length || bytes.length > (cutout ? 24 * 1024 * 1024 : ART_MAX_BYTES))
    throw new AppError(400, 'A referência deve ter no máximo 8 MB.');
  try {
    const input = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    const meta = await input.metadata();
    if (
      !['png', 'jpeg', 'webp'].includes(meta.format || '') ||
      !meta.width ||
      !meta.height ||
      (meta.pages || 1) > 1
    )
      throw new Error('format');
    if (cutout) {
      if (!meta.hasAlpha || meta.height < meta.width || meta.height < 512)
        throw new Error('cutout');
      const stats = await input.stats();
      if (stats.isOpaque) throw new Error('alpha');
    }
    return await input
      .rotate()
      .resize({
        width: cutout ? 1536 : 2048,
        height: cutout ? 2048 : 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      cutout
        ? 'A arte precisa ser vertical e ter fundo transparente.'
        : 'Envie uma imagem PNG, JPEG ou WebP válida (até 40 megapixels).',
    );
  }
}

export async function artWorkerAvailable() {
  const { rows } = await pool.query(
    "SELECT 1 FROM character_art_worker WHERE available AND heartbeat_at > now()-interval '45 seconds'",
  );
  return rows.length > 0;
}

export async function enqueueArt(userId: string, input: unknown) {
  const data = requestSchema.parse(input);
  // Normalize before taking locks; arbitrary base64 is never passed to the agent.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.reference)) throw new AppError(400, 'Imagem inválida.');
  const reference = await normalizeArtImage(Buffer.from(data.reference, 'base64'));
  return transaction(async (client) => {
    await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId]);
    const previous = await client.query(
      'SELECT id,status,character_id FROM character_art_jobs WHERE user_id=$1 AND idempotency_key=$2',
      [userId, data.idempotency_key],
    );
    if (previous.rowCount) return previous.rows[0];
    const worker = await client.query(
      "SELECT 1 FROM character_art_worker WHERE available AND heartbeat_at > now()-interval '45 seconds'",
    );
    if (!worker.rowCount)
      throw new AppError(
        503,
        'O ilustrador está offline. Tente novamente quando ele estiver disponível.',
      );
    if (data.character_id) {
      const owned = await client.query(
        'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [data.character_id, userId],
      );
      if (!owned.rowCount) throw new AppError(404, 'Personagem não encontrado.');
      const pending = await client.query(
        "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND status IN ('queued','running')",
        [data.character_id],
      );
      if (pending.rowCount)
        throw new AppError(409, 'Já há uma imagem em preparação para este personagem.');
      const count = await client.query(
        `SELECT count(*)::int AS used FROM character_art_jobs WHERE character_id=$1 AND status <> 'failed' AND created_at >= ${monthStart}`,
        [data.character_id],
      );
      if (count.rows[0].used >= ART_MONTHLY_LIMIT)
        throw new AppError(409, 'Este personagem já usou as duas imagens deste mês.');
    } else {
      const {
        rows: [counts],
      } = await client.query(
        `SELECT
        (SELECT count(*) FROM characters WHERE user_id=$1 AND deleted_at IS NULL) +
        (SELECT count(*) FROM character_art_jobs WHERE user_id=$1 AND character_id IS NULL AND status IN ('queued','running')) AS total`,
        [userId],
      );
      if (Number(counts.total) >= CHARACTER_LIMIT)
        throw new AppError(
          409,
          'Cada conta pode ter até dois personagens, incluindo os que estão em preparação.',
        );
    }
    const {
      rows: [job],
    } = await client.query(
      `INSERT INTO character_art_jobs(user_id,character_id,creation,reference,idempotency_key)
      VALUES($1,$2,$3,$4,$5) RETURNING id,status,character_id`,
      [
        userId,
        data.character_id || null,
        data.creation ? JSON.stringify(data.creation) : null,
        reference,
        data.idempotency_key,
      ],
    );
    return job;
  });
}

// Only the trusted local worker calls this function. No HTTP route can publish artwork.
export async function completeArt(jobId: string, output: Buffer) {
  const image = await normalizeArtImage(output, true);
  return transaction(async (client) => {
    const owner = await client.query('SELECT user_id FROM character_art_jobs WHERE id=$1', [jobId]);
    if (!owner.rowCount) throw new AppError(404, 'Pedido não encontrado.');
    await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [owner.rows[0].user_id]);
    const {
      rows: [job],
    } = await client.query('SELECT * FROM character_art_jobs WHERE id=$1 FOR UPDATE', [jobId]);
    if (job.status === 'completed') return job.character_id as string;
    if (job.status !== 'running') throw new AppError(409, 'Pedido não está em processamento.');
    let characterId = job.character_id;
    if (!characterId) {
      const {
        rows: [counts],
      } = await client.query(
        'SELECT count(*)::int AS total FROM characters WHERE user_id=$1 AND deleted_at IS NULL',
        [job.user_id],
      );
      if (counts.total >= CHARACTER_LIMIT)
        throw new AppError(409, 'Limite de personagens atingido.');
      const data = characterSchema.parse(job.creation);
      const {
        rows: [character],
      } = await client.query(
        `INSERT INTO characters(user_id,name,race,class,background,biography,stats,hp,armor_class)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          job.user_id,
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
      characterId = character.id;
      await client.query(
        "INSERT INTO achievements(character_id,code) VALUES($1,'first_character')",
        [characterId],
      );
    }
    await client.query(
      'INSERT INTO character_portraits(character_id,image) VALUES($1,$2) ON CONFLICT(character_id) DO UPDATE SET image=$2,updated_at=now()',
      [characterId, image],
    );
    await client.query(
      'UPDATE characters SET portrait_revision=portrait_revision+1 WHERE id=$1 AND user_id=$2',
      [characterId, job.user_id],
    );
    await client.query(
      "UPDATE character_art_jobs SET status='completed',character_id=$2,reference=NULL,completed_at=now() WHERE id=$1",
      [jobId, characterId],
    );
    return characterId as string;
  });
}

export function characterArtRouter() {
  const router = Router();
  router.delete('/characters/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const userId = res.locals.user.id;
    const { name } = z.object({ name: z.string().min(1).max(60) }).parse(req.body);
    await transaction(async (client) => {
      await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId]);
      const {
        rows: [character],
      } = await client.query(
        'SELECT name,deleted_at FROM characters WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, userId],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      if (character.name !== name)
        throw new AppError(400, 'Digite o nome do personagem para confirmar.');
      if (character.deleted_at) return;
      const pending = await client.query(
        "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND status IN ('queued','running')",
        [id],
      );
      if (pending.rowCount)
        throw new AppError(
          409,
          'Aguarde a geração da imagem terminar antes de excluir este personagem.',
        );
      await client.query('UPDATE characters SET deleted_at=now() WHERE id=$1 AND user_id=$2', [
        id,
        userId,
      ]);
      await client.query('DELETE FROM character_portraits WHERE character_id=$1', [id]);
      await client.query('UPDATE character_art_jobs SET reference=NULL WHERE character_id=$1', [
        id,
      ]);
    });
    res.json({ ok: true });
  });
  router.get('/character-art', async (_req, res) => {
    const { rows: jobs } = await pool.query(
      `SELECT j.id,j.character_id,j.status,j.error,j.created_at,
      COALESCE(c.name,j.creation->>'name') AS name FROM character_art_jobs j
      LEFT JOIN characters c ON c.id=j.character_id WHERE j.user_id=$1 AND (j.character_id IS NULL OR c.deleted_at IS NULL)
      ORDER BY j.created_at DESC LIMIT 30`,
      [res.locals.user.id],
    );
    res.json({
      available: await artWorkerAvailable(),
      jobs,
      pending_new: jobs.filter((j) => !j.character_id && ['queued', 'running'].includes(j.status))
        .length,
    });
  });
  router.post('/character-art', async (req, res) =>
    res.status(202).json(await enqueueArt(res.locals.user.id, req.body)),
  );
  router.get('/characters/:id/portrait', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT p.image FROM character_portraits p JOIN characters c ON c.id=p.character_id WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL',
      [uuid.parse(req.params.id), res.locals.user.id],
    );
    if (!rows.length) throw new AppError(404, 'Imagem não encontrada.');
    res.type('png').send(rows[0].image);
  });
  return router;
}

export const characterListSql = `SELECT c.*,
  (SELECT count(*)::int FROM character_art_jobs j WHERE j.character_id=c.id AND j.status <> 'failed' AND j.created_at >= ${monthStart}) AS art_used,
  EXISTS(SELECT 1 FROM character_art_jobs j WHERE j.character_id=c.id AND j.status IN ('queued','running')) AS art_pending
  FROM characters c WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at`;
