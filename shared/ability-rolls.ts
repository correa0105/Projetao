export const ABILITY_ROLL_MIN_TOTAL = 72;
export const ABILITY_ROLL_MAX_TOTAL = 90;
export const abilityRollTotal = (rolls: readonly (readonly number[])[]) => rolls.reduce((total, dice) => total + dice.reduce((sum, die) => sum + die, 0) - Math.min(...dice), 0);
