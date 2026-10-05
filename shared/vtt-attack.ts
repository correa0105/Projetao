import type { VttMessage } from './vtt.js';
export type AttackRequest = { actorId: string; name: string; attack: string; damage: string[] };
export type AttackMode = 'normal' | 'advantage' | 'disadvantage';
export function attackFormula(formula: string, mode: AttackMode) {
  const match = formula.replace(/\s/g, '').match(/^(?:1d20|2d20(?:kh1|kl1))([+-]\d+)?$/i);
  if (!match) throw Error('Este ataque não informa uma rolagem de d20 válida.');
  return (
    (mode === 'advantage' ? '2d20kh1' : mode === 'disadvantage' ? '2d20kl1' : '1d20') +
    (match[1] || '')
  );
}
export function criticalDamage(formula: string) {
  const match = formula.replace(/\s/g, '').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return [formula];
  const count = Number(match[1]) * 2;
  return count <= 100
    ? [count + 'd' + match[2] + (match[3] || '')]
    : [match[1] + 'd' + match[2] + (match[3] || ''), match[1] + 'd' + match[2]];
}
export function attackOutcome(roll: NonNullable<VttMessage['roll']>, ac: number) {
  const d20 = /^\d+d20(?:kh1|kl1)?(?:[+-]\d+)?$/i.test(roll.formula.replace(/\s/g, ''));
  const natural = !d20
    ? null
    : /kh1/i.test(roll.formula)
      ? Math.max(...roll.dice)
      : /kl1/i.test(roll.formula)
        ? Math.min(...roll.dice)
        : roll.dice[0];
  return {
    hit: natural === 20 || (natural !== 1 && roll.total >= ac),
    critical: natural === 20,
    natural,
  };
}
