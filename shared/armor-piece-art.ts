import images from './armor-piece-images.json';
import type { ArmorPieceSlot } from './armor-bundles';
import { thematicEquipmentImage } from './thematic-equipment-art';

const artwork: Readonly<Record<string, string>> = images;
export function armorPieceImage(parentId: string, slot: ArmorPieceSlot) {
  return thematicEquipmentImage(slot === 'armor' ? parentId : `${parentId}--${slot}`) || artwork[`${parentId}:${slot}`];
}
