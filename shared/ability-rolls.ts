export const ABILITY_ROLL_MIN_TOTAL = 72;
export const ABILITY_ROLL_MAX_TOTAL = 90;
export const ABILITY_ROLL_MIN_SCORE = 8;
export const abilityRollRaw = (dice: readonly number[]) =>
  dice.reduce((sum, die) => sum + die, 0) - Math.min(...dice);
export const abilityRollResult = (dice: readonly number[], minimum = ABILITY_ROLL_MIN_SCORE) =>
  Math.max(minimum, abilityRollRaw(dice));
export const abilityRollTotal = (
  rolls: readonly (readonly number[])[],
  minimum = ABILITY_ROLL_MIN_SCORE,
) => rolls.reduce((total, dice) => total + abilityRollResult(dice, minimum), 0);
