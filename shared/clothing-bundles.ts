import colors from './clothing-colors.json';
import type { EquipmentMetadata } from './equipment-target.js';

export const CLOTHING_PIECE_SLOTS = ['armor', 'belt', 'legs', 'feet'] as const;
export type ClothingPieceSlot = (typeof CLOTHING_PIECE_SLOTS)[number];
const names = {
  armor: 'Túnica de viajante',
  belt: 'Cinto de viajante',
  legs: 'Calça de viajante',
  feet: 'Botas de viajante',
};
const weights = { armor: 2, belt: 0.5, legs: 1, feet: 1.5 };
const bundles = Object.entries(colors)
  .filter(([, value]) => value.model === 'cosmetic-outfit-traveler')
  .map(([id, color]) => ({
    id,
    weight_lb: 5,
    pieces: CLOTHING_PIECE_SLOTS.map((slot) => ({
      id: slot === 'armor' ? id : `${id}--${slot}`,
      slot,
      name: `${names[slot]} (${slot === 'armor' ? color.label : 'Castanho'})`,
      weight_lb: weights[slot],
      image_path: `/shop/clothing-pieces-20261019/${slot === 'armor' ? 'tunic-' + color.color : { belt: 'belt', legs: 'trousers', feet: 'boots' }[slot]}.webp`,
    })),
  }));
export function clothingBundles() {
  return bundles;
}
export function clothingBundle(id: string) {
  return bundles.find((bundle) => bundle.id === id);
}

/** Shop keeps the complete outfit preview; owned items use the individual garment. */
export function clothingPieceAppearance<
  T extends {
    name: string;
    image_path?: string | null;
    description?: string;
    raw_data?: EquipmentMetadata | null;
  },
>(item: T): T {
  const raw = item.raw_data;
  return {
    ...item,
    ...(raw?.clothing_piece_name ? { name: raw.clothing_piece_name } : {}),
    ...(raw?.clothing_piece_image ? { image_path: raw.clothing_piece_image } : {}),
    ...(raw?.clothing_piece_description ? { description: raw.clothing_piece_description } : {}),
  };
}
