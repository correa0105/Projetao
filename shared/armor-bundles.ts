import catalog from './armor-bundle-catalog.json';
import type { EquipmentTarget } from './equipment-target.js';
export const PLATE_PIECES = [
  'plate-helmet',
  'plate-bracers',
  'plate-leggings',
  'plate-boots',
  'plate-pauldrons',
] as const;
export const ARMOR_PIECE_SLOTS = ['armor', 'head', 'bracers', 'legs', 'feet', 'shoulders'] as const;
export type ArmorPieceSlot = (typeof ARMOR_PIECE_SLOTS)[number];
export type ArmorBundle = {
  id: string;
  weight_lb: number;
  target: EquipmentTarget;
  pieces: { id: string; slot: ArmorPieceSlot; weight_lb: number }[];
};
const bundles = new Map<string, ArmorBundle>(
  catalog.map(([parentId, totalWeight, target]) => {
    const id = String(parentId),
      total = Number(totalWeight);
    const parts = [27, 8, 6, 12, 8, 4].map(
      (weight) => Math.round(((total * weight) / 65) * 100) / 100,
    );
    parts[0] =
      Math.round((total - parts.slice(1).reduce((sum, weight) => sum + weight, 0)) * 100) / 100;
    const oldIds = [
      'plate-armor',
      'plate-helmet',
      'plate-bracers',
      'plate-leggings',
      'plate-boots',
      'plate-pauldrons',
    ];
    const pieces = ARMOR_PIECE_SLOTS.map((slot, index) => ({
      id: slot === 'armor' ? id : id === 'plate-armor' ? oldIds[index] : `${id}--${slot}`,
      slot,
      weight_lb: parts[index],
    }));
    if (pieces.some((piece) => piece.id.length > 100))
      throw Error('ID de peça de armadura longo demais: ' + id);
    return [id, { id, weight_lb: total, target: target as EquipmentTarget, pieces }];
  }),
);
export function armorBundle(parentId: string) {
  return bundles.get(parentId);
}
export function armorBundles() {
  return [...bundles.values()];
}
export function purchaseContents(itemId: string) {
  return armorBundle(itemId)?.pieces.map((piece) => piece.id) || [itemId];
}
export function shopWeight(item: { id: string; weight_lb: string | number }) {
  return armorBundle(item.id)?.weight_lb ?? Number(item.weight_lb);
}
export const ARMOR_PIECE_NAMES: Record<ArmorPieceSlot, string> = {
  armor: 'Peitoral',
  head: 'Proteção da cabeça',
  bracers: 'Proteção dos braços',
  legs: 'Proteção das pernas',
  feet: 'Proteção dos pés',
  shoulders: 'Ombreiras',
};
export const ANIMAL_PIECE_NAMES: Record<ArmorPieceSlot, string> = {
  armor: 'Proteção do tronco',
  head: 'Proteção da cabeça',
  bracers: 'Proteção das patas dianteiras',
  legs: 'Proteção das patas traseiras',
  feet: 'Proteção das patas',
  shoulders: 'Proteção dos ombros',
};
