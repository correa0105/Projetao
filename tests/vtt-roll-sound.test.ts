import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollFormula } from '../shared/vtt-roll.js';
import { naturalOneOnD20 } from '../src/vtt-roll-sound.js';

function roll(formula: string, values: number[]) {
  return rollFormula(formula, () => {
    assert(values.length > 0, 'missing test throw');
    return values.shift()!;
  });
}
test('natural d20 one ignores bonuses and identifies faces inside mixed formulas', () => {
  assert(naturalOneOnD20(roll('1d20+8', [1])));
  assert(naturalOneOnD20(roll('1d20-2', [1])));
  assert(!naturalOneOnD20(roll('1d20-8', [9])));
  assert(!naturalOneOnD20(roll('1d6', [1])));
  assert(!naturalOneOnD20(roll('1d100', [1])));
  assert(!naturalOneOnD20(roll('1d20+1d6', [20, 1])));
  assert(naturalOneOnD20(roll('1d20+1d6', [1, 6])));
  assert(naturalOneOnD20(roll('1d(4*5)', [1])));
  assert(!naturalOneOnD20(null));
});
test('each message qualifies once when any actual d20 shows one, including advantage/rerolls', () => {
  assert(naturalOneOnD20(roll('2d20kh1+3', [1, 19])));
  assert(naturalOneOnD20(roll('2d20kl1+3', [18, 1])));
  assert(naturalOneOnD20(roll('2d20', [1, 1])));
  assert(naturalOneOnD20(roll('1d20ro1', [1, 12])));
  assert(!naturalOneOnD20(roll('2d20kl1', [2, 20])));
});
test('legacy fallback handles plain d20 pools without guessing mixed dice', () => {
  const old = { formula: '1d20 + 5 [ataque]', dice: [1], total: 6 };
  assert(naturalOneOnD20(old));
  assert(naturalOneOnD20({ ...old, formula: '2d20kh1', dice: [1, 19] }));
  assert(!naturalOneOnD20({ ...old, formula: '1d20+1d6' }));
  assert(!naturalOneOnD20({ ...old, formula: '1d200' }));
  assert(!naturalOneOnD20({ ...old, dice: [2], total: 1 }));
  assert(!naturalOneOnD20({ ...old, throws: [] }));
});
