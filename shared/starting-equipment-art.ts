import images from './starting-equipment-art.json';

// Rules labels differ from shop names; only presentation is mapped here.
export function startingEquipmentImage(name: string): string | null {
  return (images as Record<string, string>)[name] || null;
}
