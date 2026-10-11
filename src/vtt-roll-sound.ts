import type { VttMessage } from '../shared/vtt';

export const NATURAL_ONE_SOUND = '/audio/vtt-rolls-20261011/fahh-natural-one.mp3';

export function naturalOneOnD20(roll: VttMessage['roll']) {
  if (!roll) return false;
  // Raw throws identify the die even in mixed pools, rerolls and arithmetic.
  // Any d20 showing one triggers one cue per message, including discarded dice.
  if (roll.throws) return roll.throws.some((die) => die.sides === 20 && die.value === 1);
  // Older messages lacked face metadata. Only unambiguous d20 pools qualify.
  const formula = roll.formula.replace(/\[[^\[\]]*\]/g, '').replace(/\s/g, '');
  return /^\d*d20(?:(?:kh|kl|dh|dl|k|d)\d+)?(?:[+-]\d+)?$/i.test(formula) && roll.dice.includes(1);
}
