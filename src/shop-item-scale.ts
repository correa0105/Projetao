import { shopFootprints } from './shop-presentation';
import type { Item } from './types';

// Projected size of the packed illustration, not weight, price or equipment rules.
const footprints: Record<string, number> = {
  ...shopFootprints,
  'ball-bearings': 12,
  dagger: 36,
  'cosmetic-cape': 48,
  'cosmetic-necklace': 22,
  'cosmetic-tiara': 24,
  'cosmetic-gloves': 34,
  'cosmetic-boots': 45,
  cigar: 14,
};

const categoryFootprints: Record<string, number> = {
  Armas: 70,
  Armaduras: 65,
  Poções: 28,
  Cosméticos: 40,
};

/** Compress real size differences while keeping even the smallest token legible. */
export function shopItemScale(item?: Pick<Item, 'id' | 'category'>): number {
  if (!item) return 1;
  const footprint = Object.hasOwn(footprints, item.id)
    ? footprints[item.id]
    : Object.hasOwn(categoryFootprints, item.category)
      ? categoryFootprints[item.category]
      : 50;
  return Math.max(0.55, Math.min(1.7, Math.sqrt(footprint / 50)));
}
