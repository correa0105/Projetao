import images from './thematic-equipment-images.json';

/** Only visually reviewed native designs enter this small runtime map. */
export function thematicEquipmentImage(id: string) {
  return (images as Record<string, string>)[id];
}

export function approvedThematicEquipmentImages(): Readonly<Record<string, string>> {
  return images;
}
