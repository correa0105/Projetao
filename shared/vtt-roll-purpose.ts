/** Attack/check d20s are never HP amounts. Explicit damage rolls may use d20s. */
export function isAttackCheck(message: {
  roll?: { formula: string } | null;
  damage?: unknown;
  attackVisual?: unknown;
  attack_visual?: unknown;
  text?: string;
}) {
  if (!message.roll) return false;
  return !!message.attackVisual || !!message.attack_visual ||
    (/\s·\sataque$/i.test(message.text || '') && !message.damage) ||
    (!message.damage && /^(?:1d20|2d20(?:kh1|kl1))(?:[+-]\d+)?$/i.test(message.roll.formula.replace(/\s/g, '')));
}
