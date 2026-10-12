import images from './armor-piece-images.json';
import type { ArmorPieceSlot } from './armor-bundles';

const artwork: Readonly<Record<string, string>> = images;
export function armorPieceImage(parentId: string, slot: ArmorPieceSlot) {
  return artwork[`${parentId}:${slot}`];
}
