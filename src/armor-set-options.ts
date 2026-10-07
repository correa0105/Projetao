import { armorBundle, type ArmorPieceSlot } from '../shared/armor-bundles';
import { equipmentTarget, type EquipmentTarget } from '../shared/equipment-target';
import type { EquipmentItem } from '../shared/equipment';

export type ArmorSetOption = { id: string; name: string; available: boolean; pieceCount: number };

/** Use inventory metadata and the shared catalog, never item-name guesses. */
export function armorSetOptions<T extends EquipmentItem>(
  items: T[],
  target: EquipmentTarget,
  slots: readonly string[],
  available: (item: T, slot: ArmorPieceSlot) => number,
): ArmorSetOption[] {
  const parents = new Set(items.map((item) => item.raw_data?.armor_bundle_parent || item.id));
  return [...parents]
    .flatMap((id) => {
      const bundle = armorBundle(id);
      if (!bundle || bundle.target !== target) return [];
      const pieces = bundle.pieces.filter((piece) => slots.includes(piece.slot));
      if (!pieces.length) return [];
      const parent = items.find((item) => item.id === id);
      const child = items.find((item) => item.raw_data?.armor_bundle_parent === id);
      const metadataName = (parent || child)?.raw_data?.armor_bundle_name;
      const name =
        typeof metadataName === 'string'
          ? metadataName
          : (parent?.name || child?.name || '').split(' — ').slice(1).join(' — ') ||
            parent?.name ||
            id;
      return [
        {
          id,
          name,
          pieceCount: pieces.length,
          available: pieces.every((piece) => {
            const item = items.find((item) => item.id === piece.id);
            return !!item && equipmentTarget(item) === target && available(item, piece.slot) > 0;
          }),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function inventoryPieceName(item: EquipmentItem) {
  return item.raw_data?.armor_piece_name || item.name;
}
