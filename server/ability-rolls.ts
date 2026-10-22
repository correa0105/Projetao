import { randomInt } from 'node:crypto';
import {
  ABILITY_ROLL_MIN_TOTAL,
  ABILITY_ROLL_MAX_TOTAL,
  abilityRollTotal,
} from '../shared/ability-rolls.js';

/** Keep the original dice; apply the score floor before checking the whole set. */
export function rollCharacterAbilities(die: () => number = () => randomInt(1, 7)) {
  for (let attempt = 0; attempt < 10000; attempt++) {
    const rolls = Array.from({ length: 6 }, () => Array.from({ length: 4 }, die));
    const total = abilityRollTotal(rolls);
    if (total >= ABILITY_ROLL_MIN_TOTAL && total <= ABILITY_ROLL_MAX_TOTAL) return rolls;
  }
  throw new Error('Não foi possível obter uma rolagem válida. Tente novamente.');
}
