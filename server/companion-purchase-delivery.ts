import type { PoolClient } from 'pg';
import { equipmentTarget, type TargetedItem } from '../shared/equipment-target.js';
import { ensureWardrobe } from './companion-equipment.js';
import { AppError } from './services.js';

export async function purchaseCompanionBag(
  client: PoolClient,
  characterId: string,
  item: TargetedItem,
  companionId?: string,
) {
  const kind = equipmentTarget(item);
  if (kind === 'human') {
    if (companionId) throw new AppError(400, 'Este item é destinado ao personagem.');
    return undefined;
  }
  const table = kind === 'mount' ? 'character_mounts' : 'character_pets';
  const { rows: [animal] } = await client.query(
    `SELECT * FROM ${table} WHERE character_id=$1 AND ($2::uuid IS NULL OR id=$2)
     ORDER BY displayed DESC,created_at,id LIMIT 1 FOR UPDATE`,
    [characterId, companionId || null],
  );
  if (!animal) {
    if (companionId) throw new AppError(404, 'O animal escolhido não pertence a este personagem ou não corresponde ao item.');
    return undefined;
  }
  await ensureWardrobe(client, { ...animal, kind });
  return animal.id as string;
}
