import { deriveSheet, type SheetChoices } from './character-sheet.js';
import { modifier } from './rules.js';
import type { EquippedAttack } from './equipped-attacks.js';

export const UNARMED_ATTACK_ID = 'unarmed-strike';
export const UNARMED_ATTACK_IMAGE = '/sheet/icons-20261019/unarmed.webp';

// Use the same unarmed calculation already displayed on the character sheet.
// This is an innate action, never a purchased or equipped inventory item.
export function unarmedAttack(
  character: { race: string; class: string; stats: number[]; level?: number },
  choices?: SheetChoices | null,
): EquippedAttack {
  const level = character.level || 1;
  const derived = choices ? deriveSheet({ ...character, level }, choices) : null;
  const strength = modifier(character.stats[0]);
  const ability = derived?.martialDie ? Math.max(strength, modifier(character.stats[1])) : strength;
  return {
    itemId: UNARMED_ATTACK_ID,
    name: 'Soco',
    baseName: 'Desarmado',
    image_path: UNARMED_ATTACK_IMAGE,
    dice: derived?.martialDie ? `1d${derived.martialDie}` : '1',
    ability: derived?.martialDie ? ability : Math.max(-1, ability),
    attack: ability + (derived?.proficiency ?? 2 + Math.floor((level - 1) / 4)),
    type: 'Contundente · desarmado',
    trained: true,
    twoHanded: false,
    versatileDice: null,
    mastery: null,
  };
}
