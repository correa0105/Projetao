import { Router } from 'express';
import { grantBetaStartingGold } from './beta-accounts.js';
import type { CharacterArtPair } from './character-token-illustrator.js';
import { normalizeCharacterToken, syncCharacterTokenArt } from './character-token-art.js';
import {
  equipmentArtReference,
  trustedEquipmentPath,
  rasterizeEquipmentArt,
} from './equipment-art-reference.js';
import { z } from 'zod';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EQUIPMENT_SLOTS, isHelmet } from '../shared/equipment.js';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import {
  characterSchema,
  canConstructWithoutReference,
  ART_MAX_BYTES,
  ART_MONTHLY_LIMIT,
} from '../shared/character-art.js';
import { hitDice, modifier } from '../shared/rules.js';
import { isAdministrator } from './administrators.js';
import { characterLimit } from '../shared/character-art.js';
import { characterAccountArtUsedSql } from './art-quota.js';
import { warforgedArtMode } from '../shared/warforged-appearance.js';

const uuid = z.string().uuid();
const requestSchema = z
  .object({
    character_id: uuid.optional(),
    creation: characterSchema.optional(),
    reference: z
      .string()
      .min(1)
      .max(Math.ceil((ART_MAX_BYTES * 4) / 3) + 4)
      .optional(),
    idempotency_key: uuid,
    helmet_mode: z.enum(['open', 'closed']).default('closed'),
    equipment_slots: z
      .array(z.enum(EQUIPMENT_SLOTS))
      .max(EQUIPMENT_SLOTS.length)
      .default([])
      .refine(
        (slots) => new Set(slots).size === slots.length,
        'Não repita posições de equipamento.',
      ),
  })
  .refine((data) => Boolean(data.character_id) !== Boolean(data.creation))
  .refine((data) => !canConstructWithoutReference(data.creation) || !data.reference, {
    path: ['reference'],
    message: 'Desative as opções de montagem para usar uma imagem de referência.',
  })
  .refine(
    (data) =>
      Boolean(data.reference) ||
      Boolean(data.character_id) ||
      canConstructWithoutReference(data.creation),
    {
      path: ['reference'],
      message:
        'Envie uma imagem de referência. Para criar um Warforged sem imagem, escolha sua aparência.',
    },
  );

async function requestReference(reference: string | undefined) {
  if (reference === undefined) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(reference)) throw new AppError(400, 'Imagem inválida.');
  return normalizeArtImage(Buffer.from(reference, 'base64'));
}

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
  if (data.creation && !data.creation.choices)
    throw new AppError(400, 'Complete as escolhas da ficha antes de gerar o personagem.');
  if (data.creation && data.equipment_slots.length)
    throw new AppError(400, 'Equipe os itens após criar o personagem.');
  // Normalize before taking locks; arbitrary base64 is never passed to the agent.
  let reference = await requestReference(data.reference);
  let referenceMode: 'construction' | 'reference' = canConstructWithoutReference(data.creation)
    ? 'construction'
    : 'reference';
  if (referenceMode === 'construction' && reference)
    throw new AppError(400, 'Desative as opções de montagem para usar uma imagem de referência.');
  return transaction(async (client) => {
    const {
      rows: [account],
    } = await client.query('SELECT u.id,u.administrador FROM "user" u WHERE u.id=$1 FOR UPDATE', [
      userId,
    ]);
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
        'SELECT c.id,c.race,s.choices,p.image,p.construction_base FROM characters c LEFT JOIN character_sheets s ON s.character_id=c.id LEFT JOIN character_portraits p ON p.character_id=c.id WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL FOR UPDATE OF c',
        [data.character_id, userId],
      );
      if (!owned.rowCount) throw new AppError(404, 'Personagem não encontrado.');
      const subject = owned.rows[0];
      referenceMode =
        subject.race === 'Warforged' ? warforgedArtMode(subject.choices) : 'reference';
      if (referenceMode === 'construction') {
        if (reference)
          throw new AppError(
            400,
            'Este Warforged foi montado. Vestir usa a identidade salva e não aceita upload de referência.',
          );
        reference = subject.construction_base || subject.image;
        if (!reference) throw new AppError(409, 'Aguarde a arte inicial da montagem ficar pronta.');
        if (!subject.construction_base)
          await client.query(
            'UPDATE character_portraits SET construction_base=image WHERE character_id=$1 AND construction_base IS NULL',
            [data.character_id],
          );
      } else if (!reference)
        throw new AppError(400, 'Envie a imagem de referência deste personagem.');
      const pending = await client.query(
        "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND status IN ('queued','running')",
        [data.character_id],
      );
      if (pending.rowCount)
        throw new AppError(409, 'Já há uma imagem em preparação para este personagem.');
      const count = await client.query(`SELECT ${characterAccountArtUsedSql('$1')} AS used`, [
        userId,
      ]);
      if (account?.administrador !== 1 && count.rows[0].used >= ART_MONTHLY_LIMIT)
        throw new AppError(
          409,
          `Esta conta já usou as ${ART_MONTHLY_LIMIT} gerações de personagens deste mês. A cota é compartilhada entre seus personagens e renova no dia 1 (00h UTC).`,
        );
    } else {
      const {
        rows: [counts],
      } = await client.query(
        `SELECT
        (SELECT count(*) FROM characters WHERE user_id=$1 AND deleted_at IS NULL) +
        (SELECT count(*) FROM character_art_jobs WHERE user_id=$1 AND character_id IS NULL AND status IN ('queued','running')) AS total`,
        [userId],
      );
      if (Number(counts.total) >= characterLimit(account.administrador === 1))
        throw new AppError(
          409,
          `Esta conta pode ter até ${characterLimit(account.administrador === 1)} personagens, incluindo os que estão em preparação.`,
        );
    }
    const equipment: { slot: string; item_id: string; name: string; image: Buffer }[] = [];
    if (data.character_id && data.equipment_slots.length) {
      const { rows } = await client.query(
        `SELECT e.slot,c.id AS item_id,COALESCE(c.raw_data->>'armor_piece_name',c.name) AS name,c.image_path,
        COALESCE(p.raw_data,'{}'::jsonb)||COALESCE(c.raw_data,'{}'::jsonb) AS raw_data FROM character_equipment e
        JOIN inventory i ON i.character_id=e.character_id AND i.item_id=e.item_id JOIN catalog_items c ON c.id=e.item_id
        LEFT JOIN catalog_items p ON p.id=c.raw_data->>'armor_bundle_parent'
        WHERE e.character_id=$1 AND e.slot=ANY($2::text[])`,
        [data.character_id, data.equipment_slots],
      );
      if (rows.length !== data.equipment_slots.length)
        throw new AppError(409, 'O equipamento mudou. Atualize as opções antes de gerar.');
      for (const item of rows) {
        // Catalog-owned local assets only. No remote URLs or client paths reach the worker.
        const reference = equipmentArtReference(item);
        if (!trustedEquipmentPath(reference.path))
          throw new AppError(400, `O item ${item.name} ainda não possui imagem de referência.`);
        const path = reference.path.slice(1);
        let bytes: Buffer;
        try {
          bytes = await readFile(resolve('public', path));
        } catch {
          try {
            bytes = await readFile(resolve('dist/client', path));
          } catch {
            throw new AppError(400, `A imagem de ${item.name} não está disponível.`);
          }
        }
        equipment.push({
          ...item,
          name: reference.name,
          image: await normalizeArtImage(await rasterizeEquipmentArt(bytes, reference.path)),
        });
      }
    }
    if (
      data.helmet_mode === 'open' &&
      !equipment.some((item) => item.slot === 'head' && isHelmet(item))
    )
      throw new AppError(400, 'Selecione um capacete equipado para escolher a viseira aberta.');
    const {
      rows: [job],
    } = await client.query(
      `INSERT INTO character_art_jobs(user_id,character_id,creation,reference,idempotency_key,helmet_mode,reference_mode)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status,character_id`,
      [
        userId,
        data.character_id || null,
        data.creation ? JSON.stringify(data.creation) : null,
        reference,
        data.idempotency_key,
        data.helmet_mode,
        referenceMode,
      ],
    );
    for (const item of equipment)
      await client.query(
        'INSERT INTO character_art_equipment(job_id,slot,item_id,name,image) VALUES($1,$2,$3,$4,$5)',
        [job.id, item.slot, item.item_id, item.name, item.image],
      );
    return job;
  });
}

// Only the trusted local worker calls this function. No HTTP route can publish artwork.
export async function completeArt(jobId: string, output: { portrait: Buffer; token?: Buffer }) {
  const [image, tokenImage] = await Promise.all([
    normalizeArtImage(output.portrait, true),
    output.token ? normalizeCharacterToken(output.token) : Promise.resolve(null),
  ]);
  return transaction(async (client) => {
    const owner = await client.query('SELECT user_id FROM character_art_jobs WHERE id=$1', [jobId]);
    if (!owner.rowCount) throw new AppError(404, 'Pedido não encontrado.');
    const {
      rows: [account],
    } = await client.query('SELECT id,administrador FROM "user" WHERE id=$1 FOR UPDATE', [
      owner.rows[0].user_id,
    ]);
    const {
      rows: [job],
    } = await client.query('SELECT * FROM character_art_jobs WHERE id=$1 FOR UPDATE', [jobId]);
    if (job.status === 'completed') return job.character_id as string;
    if (job.status !== 'running' && !(job.status === 'failed' && !tokenImage))
      throw new AppError(409, 'Pedido não está em processamento.');
    let characterId = job.character_id;
    if (!characterId) {
      const {
        rows: [counts],
      } = await client.query(
        'SELECT count(*)::int AS total FROM characters WHERE user_id=$1 AND deleted_at IS NULL',
        [job.user_id],
      );
      if (counts.total >= characterLimit(account.administrador === 1))
        throw new AppError(409, 'Limite de personagens atingido.');
      const data = characterSchema.parse(job.creation);
      const {
        rows: [character],
      } = await client.query(
        `INSERT INTO characters(user_id,name,race,class,background,biography,stats,hp,armor_class,gold_cp,starting_wealth_granted)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0,false) RETURNING id`,
        [
          job.user_id,
          data.name,
          data.race,
          data.class,
          data.choices?.backgroundType || data.background,
          data.biography,
          JSON.stringify(data.stats),
          hitDice[data.class] + modifier(data.stats[2]),
          10 + modifier(data.stats[1]),
        ],
      );
      characterId = character.id;
      await grantBetaStartingGold(client, job.user_id, character.id);
      if (data.choices) {
        await client.query('INSERT INTO character_sheets(character_id,choices) VALUES($1,$2)', [
          characterId,
          JSON.stringify(data.choices),
        ]);
      }
      await client.query(
        "INSERT INTO achievements(character_id,code) VALUES($1,'first_character')",
        [characterId],
      );
    }
    await client.query(
      'INSERT INTO character_portraits(character_id,image,construction_base) VALUES($1,$2,$3) ON CONFLICT(character_id) DO UPDATE SET image=$2,construction_base=COALESCE(character_portraits.construction_base,$3),updated_at=now()',
      [characterId, image, job.reference_mode === 'construction' && job.creation ? image : null],
    );
    if (tokenImage) {
      await client.query(
        'INSERT INTO character_tokens(character_id,image) VALUES($1,$2) ON CONFLICT(character_id) DO UPDATE SET image=$2,updated_at=now()',
        [characterId, tokenImage],
      );
      await syncCharacterTokenArt(client, characterId, job.user_id, tokenImage);
    }
    await client.query(
      'UPDATE characters SET portrait_revision=portrait_revision+1 WHERE id=$1 AND user_id=$2',
      [characterId, job.user_id],
    );
    if (tokenImage) {
      await client.query(
        "UPDATE character_art_jobs SET status='completed',character_id=$2,reference=NULL,approved_portrait=NULL,error=NULL,completed_at=now() WHERE id=$1",
        [jobId, characterId],
      );
    } else {
      await client.query(
        'UPDATE character_art_jobs SET character_id=$2,approved_portrait=$3 WHERE id=$1',
        [jobId, characterId, image],
      );
    }
    return characterId as string;
  });
}

export function characterArtRouter() {
  const router = Router();
  router.get('/character-art/:id/draft', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT creation,reference FROM character_art_jobs WHERE id=$1 AND user_id=$2 AND character_id IS NULL',
      [uuid.parse(req.params.id), res.locals.user.id],
    );
    if (!rows.length) throw new AppError(404, 'Criação não encontrada.');
    res.json({
      creation: rows[0].creation,
      reference: rows[0].reference?.toString('base64') || '',
    });
  });
  router.post('/character-art/:id/retry', async (req, res) => {
    const id = uuid.parse(req.params.id),
      user = res.locals.user.id;
    const replacement = req.body?.creation
      ? requestSchema.parse({ ...req.body, idempotency_key: id })
      : null;
    if (
      replacement &&
      (!replacement.creation?.choices ||
        replacement.character_id ||
        replacement.equipment_slots.length)
    )
      throw new AppError(400, 'Complete os dados da criação.');
    const reference = replacement ? await requestReference(replacement.reference) : null;
    const result = await transaction(async (client) => {
      await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user]);
      const {
        rows: [job],
      } = await client.query(
        'SELECT id,status,character_id,creation,reference IS NOT NULL OR approved_portrait IS NOT NULL AS recoverable FROM character_art_jobs WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, user],
      );
      if (!job) throw new AppError(404, 'Criação não encontrada.');
      if (job.status !== 'failed') return { id: job.id, status: job.status };
      if (!job.creation || (job.character_id && (!job.recoverable || replacement)))
        throw new AppError(409, 'Este pedido não é uma criação pendente.');
      if (job.character_id) {
        const existing = await client.query(
          'SELECT 1 FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
          [job.character_id, user],
        );
        if (!existing.rowCount) throw new AppError(404, 'Personagem não encontrado.');
        const pending = await client.query(
          "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND status IN('queued','running')",
          [job.character_id],
        );
        if (pending.rowCount)
          throw new AppError(409, 'Já há uma imagem em preparação para este personagem.');
      }
      if (!job.recoverable && !replacement && !canConstructWithoutReference(job.creation))
        throw new AppError(
          409,
          'Os dados estão salvos. Use Retomar preenchimento para reenviar a referência.',
        );
      if (!(await artWorkerAvailable()))
        throw new AppError(503, 'O ilustrador está offline. Sua criação continua salva.');
      const {
        rows: [count],
      } = await client.query(
        "SELECT (SELECT count(*) FROM characters WHERE user_id=$1 AND deleted_at IS NULL)+(SELECT count(*) FROM character_art_jobs WHERE user_id=$1 AND character_id IS NULL AND status IN('queued','running')) AS total",
        [user],
      );
      if (!job.character_id && Number(count.total) >= characterLimit(false))
        throw new AppError(409, 'Limite de personagens atingido. Sua criação continua salva.');
      characterSchema.parse(replacement?.creation || job.creation);
      const retryMode = canConstructWithoutReference(replacement?.creation || job.creation)
        ? 'construction'
        : 'reference';
      await client.query(
        "UPDATE character_art_jobs SET status='queued',error=NULL,started_at=NULL,completed_at=NULL,reference=CASE WHEN $3::jsonb IS NULL THEN CASE WHEN $4='construction' AND reference_mode='reference' AND character_id IS NULL THEN NULL ELSE reference END ELSE $2::bytea END,creation=COALESCE($3::jsonb,creation),approved_portrait=CASE WHEN $3::jsonb IS NULL THEN approved_portrait ELSE NULL END,reference_mode=$4 WHERE id=$1",
        [id, reference, replacement ? JSON.stringify(replacement.creation) : null, retryMode],
      );
      return { id, status: 'queued' };
    });
    res.status(202).json(result);
  });
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
        "SELECT 1 FROM character_art_jobs WHERE character_id=$1 AND status IN ('queued','running') UNION ALL SELECT 1 FROM companion_art_jobs WHERE character_id=$1 AND status IN('queued','running')",
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
      await client.query('DELETE FROM character_tokens WHERE character_id=$1', [id]);
      await client.query('UPDATE character_art_jobs SET reference=NULL WHERE character_id=$1', [
        id,
      ]);
      await client.query(
        'DELETE FROM companion_artworks WHERE wardrobe_id IN(SELECT id FROM companion_wardrobes WHERE character_id=$1)',
        [id],
      );
      await client.query(
        'DELETE FROM companion_art_equipment WHERE job_id IN(SELECT id FROM companion_art_jobs WHERE character_id=$1)',
        [id],
      );
      await client.query('UPDATE companion_art_jobs SET reference=NULL WHERE character_id=$1', [
        id,
      ]);
    });
    res.json({ ok: true });
  });
  router.get('/character-art', async (_req, res) => {
    const { rows: quotas } = await pool.query(
      `SELECT c.id,${characterAccountArtUsedSql('c.user_id')} AS used,
        CASE WHEN EXISTS(SELECT 1 FROM "user" u WHERE u.id=c.user_id AND u.administrador=1)
          THEN NULL ELSE ${ART_MONTHLY_LIMIT} END AS limit
       FROM characters c WHERE c.user_id=$1 AND c.deleted_at IS NULL`,
      [res.locals.user.id],
    );
    const { rows: jobs } = await pool.query(
      `SELECT j.id,j.character_id,j.status,j.error,j.created_at,
      (j.status='failed' AND j.creation IS NOT NULL AND (j.reference IS NOT NULL OR j.approved_portrait IS NOT NULL)) AS can_retry,
      j.creation AS saved_creation,
      COALESCE(c.name,j.creation->>'name') AS name FROM character_art_jobs j
      LEFT JOIN characters c ON c.id=j.character_id WHERE j.user_id=$1 AND (j.character_id IS NULL OR c.deleted_at IS NULL)
      ORDER BY j.created_at DESC LIMIT 30`,
      [res.locals.user.id],
    );
    res.json({
      available: await artWorkerAvailable(),
      character_limit: characterLimit(await isAdministrator(res.locals.user.id)),
      jobs: jobs.map(({ saved_creation, ...job }) => ({
        ...job,
        can_retry:
          job.can_retry ||
          (job.status === 'failed' &&
            !job.character_id &&
            canConstructWithoutReference(saved_creation)),
      })),
      quotas: Object.fromEntries(quotas.map(({ id, used, limit }) => [id, { used, limit }])),
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
  router.get('/characters/:id/token', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${req.query.preview === '1' ? 't.image' : 'COALESCE(t.image,p.image)'} AS image FROM characters c
      LEFT JOIN character_tokens t ON t.character_id=c.id
      LEFT JOIN character_portraits p ON p.character_id=c.id
      WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL`,
      [uuid.parse(req.params.id), res.locals.user.id],
    );
    if (!rows[0]?.image) throw new AppError(404, 'Imagem não encontrada.');
    res.set('Cache-Control', 'private, max-age=300').type('png').send(rows[0].image);
  });
  return router;
}

export const characterListSql = `SELECT c.*,
  EXISTS(SELECT 1 FROM character_tokens t WHERE t.character_id=c.id) AS token_available,
  CASE WHEN c.race='Warforged' THEN COALESCE((SELECT s.choices->>'warforgedArtMode' FROM character_sheets s WHERE s.character_id=c.id),CASE WHEN EXISTS(SELECT 1 FROM character_sheets s WHERE s.character_id=c.id AND s.choices->'warforgedAppearance' IS NOT NULL) THEN 'construction' ELSE 'reference' END) ELSE 'reference' END AS art_reference_mode,
  EXISTS(SELECT 1 FROM "user" u WHERE u.id=c.user_id AND u.administrador=1) AS gold_unlimited,
  EXISTS(SELECT 1 FROM "user" u WHERE u.id=c.user_id AND u.administrador=1) AS art_unlimited,
  (SELECT s.choices->'options'->'size'->>0 FROM character_sheets s WHERE s.character_id=c.id) AS species_size,
  ${characterAccountArtUsedSql('c.user_id')} AS art_used,
  EXISTS(SELECT 1 FROM character_art_jobs j WHERE j.character_id=c.id AND j.status IN ('queued','running')) AS art_pending
  FROM characters c WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at`;
