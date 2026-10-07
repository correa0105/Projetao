import type { PoolClient } from 'pg';
import { armorBundle } from '../shared/armor-bundles.js';
import { equipmentTarget, type EquipmentTarget } from '../shared/equipment-target.js';
import { allocatedCopies } from './companion-inventory.js';
import { AppError } from './services.js';

export async function armorSetPieces(
  db: PoolClient,
  characterId: string,
  parentId: string,
  target: EquipmentTarget,
  slots: readonly string[],
  wardrobeId?: string,
) {
  const bundle = armorBundle(parentId);
  if (!bundle || bundle.target !== target)
    throw new AppError(400, 'Este conjunto não é compatível com esse personagem ou animal.');
  const wanted = bundle.pieces.filter((piece) => slots.includes(piece.slot));
  const { rows: items } = await db.query(
    `SELECT c.*,i.quantity FROM catalog_items c LEFT JOIN inventory i ON i.item_id=c.id AND i.character_id=$1
     WHERE c.id=ANY($2::text[]) ORDER BY c.id`,
    [characterId, wanted.map((piece) => piece.id)],
  );
  if (items.length !== wanted.length)
    throw new AppError(409, 'O catálogo deste conjunto está incompleto.');
  for (const piece of wanted) {
    const item = items.find((item) => item.id === piece.id);
    if (
      equipmentTarget(item) !== target ||
      item.raw_data?.armor_bundle_parent !== parentId ||
      item.raw_data?.piece_slot !== piece.slot
    )
      throw new AppError(
        400,
        'Uma peça deste conjunto não é compatível com esse personagem ou animal.',
      );
    if (!item.quantity)
      throw new AppError(
        409,
        'O conjunto está incompleto na mochila. Traga todas as peças do cofre antes de equipar.',
      );
    const used = await allocatedCopies(
      db,
      characterId,
      piece.id,
      wardrobeId ? { wardrobeId, companionSlot: piece.slot } : { humanSlot: piece.slot },
    );
    if (used >= item.quantity)
      throw new AppError(
        409,
        'Uma peça do conjunto já está reservada em outro personagem ou animal.',
      );
  }
  return wanted.map((piece) => ({
    ...items.find((item) => item.id === piece.id),
    slot: piece.slot,
  }));
}
