import { sheetAttacks, weaponData, type SheetChoices } from './character-sheet.js';
import aliases from './catalog-weapon-names.json';
export type CombatItem = {
  id: string;
  name: string;
  image_path?: string | null;
  quantity: number;
  equipped: string[];
  raw_data?: Record<string, unknown> | null;
};
export type EquippedAttack = ReturnType<typeof sheetAttacks>[number] & {
  itemId: string;
  image_path: string | null;
  baseName: string;
  twoHanded: boolean;
};
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export function equippedAttacks(
  character: { race: string; class: string; stats: number[] },
  choices: SheetChoices | null | undefined,
  items: readonly CombatItem[],
): EquippedAttack[] {
  if (!choices) return [];
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (
      item.quantity <= 0 ||
      !item.equipped.some((s) => s === 'main_hand' || s === 'off_hand') ||
      seen.has(item.id)
    )
      return [];
    if (item.raw_data?.equipment_target && item.raw_data.equipment_target !== 'human') return [];
    const baseId = typeof item.raw_data?.base_item === 'string' ? item.raw_data.base_item : item.id;
    const name =
      (aliases as Record<string, string>)[baseId] ||
      Object.keys(weaponData).find((n) => normalize(n) === normalize(item.name));
    if (!name) return [];
    seen.add(item.id);
    return sheetAttacks(character.race, character.class, character.stats, choices, [name]).map(
      (attack) => ({
        ...attack,
        name: item.name,
        itemId: item.id,
        image_path: item.image_path || null,
        baseName: name,
        twoHanded: !!weaponData[name].two,
      }),
    );
  });
}
