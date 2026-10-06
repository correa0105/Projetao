import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { normalizeArtImage, artWorkerAvailable } from './character-art.js';
import { allocatedCopies, companionAllocated } from './companion-inventory.js';
import { ART_MONTHLY_LIMIT } from '../shared/character-art.js';
import {
  COMPANION_SLOTS,
  companionSlots,
  compatibleCompanionSlots,
  type CompanionKind,
} from '../shared/companion-equipment.js';
import { stableGear } from '../shared/stable-gear.js';
import { petArtwork } from '../shared/pet-art.js';

type DB = Pick<PoolClient, 'query'>;
const uuid = z.string().uuid(),
  kindSchema = z.enum(['mount', 'pet']);
const monthStart = "date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";
export const companionQuotaSql = `(SELECT count(*) FROM companion_art_jobs WHERE character_id=$1 AND status NOT IN('failed','stale') AND created_at>=${monthStart})`;
const equipSchema = z
  .object({
    kind: kindSchema,
    companion_id: uuid,
    slot: z.enum(COMPANION_SLOTS),
    item_id: z.string().min(1).max(100).nullable(),
  })
  .strict();
const artSchema = z
  .object({ kind: kindSchema, companion_id: uuid, idempotency_key: uuid })
  .strict();
const table = (kind: CompanionKind) => (kind === 'mount' ? 'character_mounts' : 'character_pets');
async function workerAvailable(db: DB) {
  return !!(
    await db.query(
      "SELECT 1 FROM character_art_worker WHERE available AND heartbeat_at>now()-interval '45 seconds'",
    )
  ).rowCount;
}
async function lockOwner(db: DB, userId: string, characterId: string) {
  await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId]);
  if (
    !(
      await db.query(
        'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [characterId, userId],
      )
    ).rowCount
  )
    throw new AppError(404, 'Personagem não encontrado.');
}
async function companion(db: DB, characterId: string, kind: CompanionKind, id: string) {
  const {
    rows: [animal],
  } = await db.query(`SELECT * FROM ${table(kind)} WHERE id=$1 AND character_id=$2 FOR UPDATE`, [
    id,
    characterId,
  ]);
  if (!animal) throw new AppError(404, 'Este companheiro não pertence a este personagem.');
  return {
    ...animal,
    kind,
    species_id: kind === 'mount' ? animal.mount_id : animal.pet_id,
    appearance: kind === 'mount' ? animal.coat : animal.appearance,
  };
}
async function ensureWardrobe(db: DB, animal: any) {
  const created = await db.query(
    'INSERT INTO companion_wardrobes(id,character_id,kind,mount_id,pet_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id',
    [
      animal.id,
      animal.character_id,
      animal.kind,
      animal.kind === 'mount' ? animal.id : null,
      animal.kind === 'pet' ? animal.id : null,
    ],
  );
  if (created.rowCount && animal.kind === 'mount') {
    for (const id of animal.equipment || []) {
      const gear = stableGear.find((item) => item.id === id);
      if (gear && (gear.slot === 'armor' || gear.slot === 'saddle'))
        await db.query(
          'INSERT INTO companion_equipment(wardrobe_id,character_id,slot,legacy_id) VALUES($1,$2,$3,$4)',
          [animal.id, animal.character_id, gear.slot, id],
        );
    }
  }
  return (await db.query('SELECT * FROM companion_wardrobes WHERE id=$1 FOR UPDATE', [animal.id]))
    .rows[0];
}
function legacyOptions(animal: any) {
  return (animal.kind === 'mount' ? animal.equipment || [] : []).flatMap((id: string) => {
    const gear = stableGear.find((item) => item.id === id);
    return gear && (gear.slot === 'armor' || gear.slot === 'saddle')
      ? [
          {
            id: `legacy:${id}`,
            item_id: `legacy:${id}`,
            name: gear.name,
            category: 'Equipamento de montaria',
            source: 'legacy',
            slot: gear.slot,
            image_path: `/stable/gear/${id}.png`,
            description: gear.description,
          },
        ]
      : [];
  });
}
async function equipment(db: DB, animal: any) {
  const { rows } = await db.query(
    'SELECT e.slot,e.item_id,e.legacy_id,c.* FROM companion_equipment e LEFT JOIN catalog_items c ON c.id=e.item_id WHERE e.wardrobe_id=$1 ORDER BY e.slot',
    [animal.id],
  );
  return rows.map((item) =>
    item.legacy_id
      ? {
          ...legacyOptions(animal).find((option: any) => option.id === `legacy:${item.legacy_id}`),
          slot: item.slot,
          legacy_id: item.legacy_id,
        }
      : { ...item, source: 'inventory', item_id: item.id },
  );
}
export async function trustedCompanionBase(animal: {
  kind: CompanionKind;
  species_id: string;
  appearance: string;
}) {
  if (animal.kind === 'mount')
    return normalizeArtImage(
      await localImage(
        `/stable/${animal.species_id}${animal.appearance === 'alternate' ? '-alternate' : ''}.png`,
      ),
    );
  const art = petArtwork(animal.species_id, animal.appearance),
    [left, top, width, height] = art.frame;
  return sharp(await localImage(art.source))
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}
async function localImage(path: string) {
  if (!/^\/[a-zA-Z0-9/_-]+\.(png|webp|jpg|jpeg)$/.test(path))
    throw new AppError(400, 'Imagem de referência indisponível.');
  try {
    return await readFile(resolve('public', path.slice(1)));
  } catch {
    try {
      return await readFile(resolve('dist/client', path.slice(1)));
    } catch {
      throw new AppError(400, 'Imagem de referência indisponível.');
    }
  }
}
async function quota(db: DB, userId: string, characterId: string) {
  const {
    rows: [row],
  } = await db.query(
    `SELECT
    EXISTS(SELECT 1 FROM character_art_allowances WHERE user_id=$2 AND unlimited) AS unlimited,
    (SELECT count(*) FROM character_art_jobs WHERE character_id=$1 AND status<>'failed' AND created_at>=${monthStart}) + ${companionQuotaSql} AS used`,
    [characterId, userId],
  );
  return { used: Number(row.used), limit: row.unlimited ? null : ART_MONTHLY_LIMIT };
}
async function state(db: DB, userId: string, characterId: string) {
  const animals = [
    ...(
      await db.query(
        "SELECT *, 'mount' AS kind,mount_id AS species_id,coat AS appearance FROM character_mounts WHERE character_id=$1 ORDER BY created_at,id",
        [characterId],
      )
    ).rows,
    ...(
      await db.query(
        "SELECT *, 'pet' AS kind,pet_id AS species_id FROM character_pets WHERE character_id=$1 ORDER BY created_at,id",
        [characterId],
      )
    ).rows,
  ];
  const budget = await quota(db, userId, characterId),
    companions = [];
  for (const animal of animals) {
    const wardrobe = await ensureWardrobe(db, animal),
      art = (
        await db.query('SELECT equipment_revision FROM companion_artworks WHERE wardrobe_id=$1', [
          animal.id,
        ])
      ).rows[0];
    const imageCurrent = !!art;
    companions.push({
      id: animal.id,
      kind: animal.kind,
      name: animal.name,
      species_id: animal.species_id,
      appearance: animal.appearance,
      base_image: `/api/companions/${characterId}/${animal.kind}/${animal.id}/base-image`,
      image_url: imageCurrent
        ? `/api/companions/${characterId}/${animal.kind}/${animal.id}/image?v=${wardrobe.image_revision}`
        : null,
      image_revision: imageCurrent ? wardrobe.image_revision : 0,
      equipment_revision: wardrobe.revision,
      art_equipment_revision: art?.equipment_revision ?? null,
      art_pending: !!(
        await db.query(
          "SELECT 1 FROM companion_art_jobs WHERE wardrobe_id=$1 AND status IN('queued','running')",
          [animal.id],
        )
      ).rowCount,
      art_used: budget.used,
      art_limit: budget.limit,
      quota_scope: 'character',
      legacy_equipment: animal.equipment || [],
      legacy_options: legacyOptions(animal),
      equipped: await equipment(db, animal),
      slots: companionSlots(animal.kind, animal.species_id),
    });
  }
  const used = await companionAllocated(db, characterId),
    human = (
      await db.query(
        'SELECT item_id,count(*)::int AS quantity FROM character_equipment WHERE character_id=$1 GROUP BY item_id',
        [characterId],
      )
    ).rows;
  for (const row of human) used[row.item_id] = (used[row.item_id] || 0) + row.quantity;
  const inventory = (
    await db.query(
      'SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 ORDER BY c.name',
      [characterId],
    )
  ).rows.map((item) => ({
    ...item,
    allocated: used[item.id] || 0,
    available: Math.max(0, item.quantity - (used[item.id] || 0)),
  }));
  return { companions, inventory, worker_available: await workerAvailable(db) };
}
export async function enqueueCompanionArt(userId: string, characterId: string, input: unknown) {
  const data = artSchema.parse(input);
  return transaction(async (db) => {
    await lockOwner(db, userId, characterId);
    const previous = (
      await db.query(
        'SELECT id,status,wardrobe_id AS companion_id,kind,equipment_revision,character_id FROM companion_art_jobs WHERE user_id=$1 AND idempotency_key=$2',
        [userId, data.idempotency_key],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.character_id !== characterId ||
        previous.companion_id !== data.companion_id ||
        previous.kind !== data.kind
      )
        throw new AppError(409, 'Este pedido já corresponde a outro companheiro.');
      return previous;
    }
    const animal = await companion(db, characterId, data.kind, data.companion_id),
      wardrobe = await ensureWardrobe(db, animal);
    if (!(await workerAvailable(db)))
      throw new AppError(
        503,
        'O ilustrador está offline. Tente novamente quando ele estiver disponível.',
      );
    if (
      (
        await db.query(
          "SELECT 1 FROM companion_art_jobs WHERE wardrobe_id=$1 AND status IN('queued','running')",
          [animal.id],
        )
      ).rowCount
    )
      throw new AppError(409, 'Já há uma arte em preparação para este companheiro.');
    const budget = await quota(db, userId, characterId);
    if (budget.limit !== null && budget.used >= budget.limit)
      throw new AppError(
        409,
        'Este personagem já usou as duas imagens deste mês, incluindo seus companheiros.',
      );
    const reference = await trustedCompanionBase(animal),
      equipped = await equipment(db, animal),
      refs = [];
    for (const item of equipped)
      refs.push({ ...item, image: await normalizeArtImage(await localImage(item.image_path)) });
    const {
      rows: [job],
    } = await db.query(
      'INSERT INTO companion_art_jobs(user_id,character_id,wardrobe_id,kind,species_id,appearance,name,equipment_revision,reference,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status,wardrobe_id AS companion_id,kind,equipment_revision',
      [
        userId,
        characterId,
        animal.id,
        animal.kind,
        animal.species_id,
        animal.appearance,
        animal.name,
        wardrobe.revision,
        reference,
        data.idempotency_key,
      ],
    );
    for (const item of refs)
      await db.query(
        'INSERT INTO companion_art_equipment(job_id,slot,item_id,name,image) VALUES($1,$2,$3,$4,$5)',
        [job.id, item.slot, item.item_id, item.name, item.image],
      );
    return job;
  });
}
export async function normalizeCompanionArt(output: Buffer) {
  if (!output.length || output.length > 24 * 1024 * 1024)
    throw new AppError(400, 'Imagem de companheiro inválida.');
  try {
    const input = sharp(output, { limitInputPixels: 40_000_000, animated: false }),
      meta = await input.metadata();
    if (
      !['png', 'webp'].includes(meta.format || '') ||
      !meta.hasAlpha ||
      (meta.pages || 1) > 1 ||
      Math.max(meta.width || 0, meta.height || 0) < 512 ||
      (await input.stats()).isOpaque
    )
      throw Error();
    return await input
      .rotate()
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new AppError(400, 'A arte precisa mostrar o animal inteiro e ter fundo transparente.');
  }
}
export async function completeCompanionArt(jobId: string, output: Buffer) {
  const image = await normalizeCompanionArt(output);
  return transaction(async (db) => {
    const owner = (
      await db.query('SELECT user_id,character_id FROM companion_art_jobs WHERE id=$1', [jobId])
    ).rows[0];
    if (!owner) throw new AppError(404, 'Pedido não encontrado.');
    await lockOwner(db, owner.user_id, owner.character_id);
    const job = (await db.query('SELECT * FROM companion_art_jobs WHERE id=$1 FOR UPDATE', [jobId]))
      .rows[0];
    if (job.status === 'completed' || job.status === 'stale')
      return { companion_id: job.wardrobe_id, status: job.status };
    if (job.status !== 'running') throw new AppError(409, 'Pedido não está em processamento.');
    const wardrobe = (
      await db.query('SELECT * FROM companion_wardrobes WHERE id=$1 FOR UPDATE', [job.wardrobe_id])
    ).rows[0];
    if (wardrobe.revision !== job.equipment_revision) {
      await db.query(
        "UPDATE companion_art_jobs SET status='stale',reference=NULL,error='O equipamento mudou durante a geração. Esta tentativa não consumiu a cota.',completed_at=now() WHERE id=$1",
        [jobId],
      );
      await db.query('DELETE FROM companion_art_equipment WHERE job_id=$1', [jobId]);
      return { companion_id: job.wardrobe_id, status: 'stale' };
    }
    await db.query(
      'INSERT INTO companion_artworks(wardrobe_id,equipment_revision,image) VALUES($1,$2,$3) ON CONFLICT(wardrobe_id) DO UPDATE SET equipment_revision=EXCLUDED.equipment_revision,image=EXCLUDED.image,updated_at=now()',
      [wardrobe.id, wardrobe.revision, image],
    );
    await db.query('UPDATE companion_wardrobes SET image_revision=image_revision+1 WHERE id=$1', [
      wardrobe.id,
    ]);
    await db.query(
      "UPDATE companion_art_jobs SET status='completed',reference=NULL,completed_at=now() WHERE id=$1",
      [jobId],
    );
    await db.query('DELETE FROM companion_art_equipment WHERE job_id=$1', [jobId]);
    return { companion_id: wardrobe.id, status: 'completed' };
  });
}
export function companionEquipmentRouter() {
  const router = Router();
  router.get('/companions/:characterId/equipment', async (req, res) => {
    const characterId = uuid.parse(req.params.characterId),
      userId = res.locals.user.id;
    res.json(
      await transaction(async (db) => {
        await lockOwner(db, userId, characterId);
        return state(db, userId, characterId);
      }),
    );
  });
  router.put('/companions/:characterId/equipment', async (req, res) => {
    const characterId = uuid.parse(req.params.characterId),
      userId = res.locals.user.id,
      data = equipSchema.parse(req.body);
    res.json(
      await transaction(async (db) => {
        await lockOwner(db, userId, characterId);
        const animal = await companion(db, characterId, data.kind, data.companion_id),
          wardrobe = await ensureWardrobe(db, animal);
        if (!companionSlots(data.kind, animal.species_id).includes(data.slot))
          throw new AppError(400, 'Esta posição não existe na anatomia deste animal.');
        const current = (
          await db.query(
            'SELECT item_id,legacy_id FROM companion_equipment WHERE wardrobe_id=$1 AND slot=$2',
            [wardrobe.id, data.slot],
          )
        ).rows[0];
        let itemId: string | null = null,
          legacyId: string | null = null;
        if (data.item_id?.startsWith('legacy:')) {
          const legacy = legacyOptions(animal).find(
            (option: any) => option.id === data.item_id && option.slot === data.slot,
          );
          if (!legacy)
            throw new AppError(409, 'Este equipamento não foi comprado para este animal.');
          legacyId = data.item_id.slice(7);
        } else if (data.item_id) {
          const item = (
            await db.query(
              'SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=$2 FOR UPDATE OF i',
              [characterId, data.item_id],
            )
          ).rows[0];
          if (!item) throw new AppError(409, 'Este item não está na mochila deste personagem.');
          if (!compatibleCompanionSlots(item, data.kind, animal.species_id).includes(data.slot))
            throw new AppError(400, 'Este item não é compatível com essa posição do animal.');
          if (
            (await allocatedCopies(db, characterId, data.item_id, {
              wardrobeId: wardrobe.id,
              companionSlot: data.slot,
            })) >= item.quantity
          )
            throw new AppError(
              409,
              'Todas as unidades deste item já estão equipadas no personagem ou em seus animais.',
            );
          itemId = data.item_id;
        }
        if ((current?.item_id || null) !== itemId || (current?.legacy_id || null) !== legacyId) {
          if (itemId || legacyId)
            await db.query(
              'INSERT INTO companion_equipment(wardrobe_id,character_id,slot,item_id,legacy_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(wardrobe_id,slot) DO UPDATE SET item_id=EXCLUDED.item_id,legacy_id=EXCLUDED.legacy_id,equipped_at=now()',
              [wardrobe.id, characterId, data.slot, itemId, legacyId],
            );
          else
            await db.query('DELETE FROM companion_equipment WHERE wardrobe_id=$1 AND slot=$2', [
              wardrobe.id,
              data.slot,
            ]);
          await db.query('UPDATE companion_wardrobes SET revision=revision+1 WHERE id=$1', [
            wardrobe.id,
          ]);
        }
        return state(db, userId, characterId);
      }),
    );
  });
  router.post('/companions/:characterId/art', async (req, res) =>
    res
      .status(202)
      .json(
        await enqueueCompanionArt(res.locals.user.id, uuid.parse(req.params.characterId), req.body),
      ),
  );
  router.get('/companions/:characterId/art/jobs', async (req, res) => {
    const characterId = uuid.parse(req.params.characterId),
      userId = res.locals.user.id;
    const jobs = await transaction(async (db) => {
      await lockOwner(db, userId, characterId);
      return (
        await db.query(
          'SELECT id,status,wardrobe_id AS companion_id,kind,equipment_revision,error,created_at,completed_at FROM companion_art_jobs WHERE character_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 30',
          [characterId, userId],
        )
      ).rows;
    });
    res.json({ jobs, available: await artWorkerAvailable() });
  });
  router.get('/companions/:characterId/:kind/:companionId/base-image', async (req, res) => {
    const characterId = uuid.parse(req.params.characterId),
      kind = kindSchema.parse(req.params.kind),
      companionId = uuid.parse(req.params.companionId);
    const bytes = await transaction(async (db) => {
      await lockOwner(db, res.locals.user.id, characterId);
      return trustedCompanionBase(await companion(db, characterId, kind, companionId));
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('png').send(bytes);
  });
  router.get('/companions/:characterId/:kind/:companionId/image', async (req, res) => {
    const characterId = uuid.parse(req.params.characterId),
      kind = kindSchema.parse(req.params.kind),
      companionId = uuid.parse(req.params.companionId),
      userId = res.locals.user.id;
    const {
      rows: [art],
    } = await pool.query(
      `SELECT a.image FROM companion_artworks a JOIN companion_wardrobes w ON w.id=a.wardrobe_id JOIN characters c ON c.id=w.character_id WHERE w.id=$1 AND w.character_id=$2 AND w.kind=$3 AND c.deleted_at IS NULL AND (c.user_id=$4 OR EXISTS(SELECT 1 FROM house_homes h JOIN house_invites i ON i.home_id=h.id WHERE h.character_id=c.id AND i.user_id=$4 AND i.status='accepted' AND jsonb_path_exists(h.rooms,'$[*].placements[*] ? (@.ref == $id)',jsonb_build_object('id',w.id::text)) AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE(b.blocker_id=$4 AND b.blocked_id=c.user_id)OR(b.blocker_id=c.user_id AND b.blocked_id=$4))))`,
      [companionId, characterId, kind, userId],
    );
    if (!art) throw new AppError(404, 'Imagem não encontrada.');
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('png').send(art.image);
  });
  return router;
}
