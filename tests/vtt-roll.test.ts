import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollFormula } from '../shared/vtt-roll.js';
function evaluate(formula: string, sequence: number[] = []) {
  let at = 0;
  return rollFormula(formula, () => {
    assert.ok(at < sequence.length, 'Unexpected additional die: ' + formula);
    return sequence[at++];
  });
}
test('Pools retain/drop, count equality and inclusive bounds, then subtract failures', () => {
  assert.equal(evaluate('4d6kh3+2', [1, 6, 3, 5]).total, 16);
  assert.equal(evaluate('4d6kl2', [1, 6, 3, 5]).total, 4);
  assert.equal(evaluate('4d6dh1', [1, 6, 3, 5]).total, 9);
  assert.equal(evaluate('4d6d1', [1, 6, 3, 5]).total, 14);
  assert.equal(evaluate('4d6k2', [1, 6, 3, 5]).total, 11);
  assert.equal(evaluate('4d6>3f1', [1, 6, 3, 2]).total, 1);
  assert.equal(evaluate('4d6=1', [1, 6, 1, 2]).total, 2);
  assert.equal(evaluate('4d6<2', [1, 6, 1, 2]).total, 3);
});
test('Additional throws: independent, accumulated, penetrating and custom thresholds', () => {
  assert.equal(evaluate('1d6!', [6, 6, 3]).total, 15);
  assert.equal(evaluate('{2d6!!}>8', [6, 3, 5]).total, 1);
  assert.equal(evaluate('1d6!p', [6, 6, 3]).total, 13);
  assert.equal(evaluate('1d6!3', [3, 2]).total, 5);
  assert.equal(evaluate('1d6!>4', [4, 6, 2]).total, 12);
});
test('Repeat rolls ignore originals, one-time repeats stop, combined conditions repeat', () => {
  assert.equal(evaluate('1d6r<3', [1, 2, 3, 4]).total, 4);
  assert.equal(evaluate('1d6ro<3', [1, 2]).total, 2);
  assert.equal(evaluate('1d6!ro1', [1, 6, 1, 2]).total, 8);
  assert.equal(evaluate('1d6r1r3', [3, 1, 5]).total, 5);
  assert.equal(evaluate('4dF+1', [-1, 0, 1, 0]).total, 1);
});
test('Groups, computed dice, arithmetic functions, powers and precedence', () => {
  assert.equal(evaluate('{3d6+1}<3', [1, 2, 4]).total, 2);
  assert.equal(evaluate('{2d6+2d8}kh2', [1, 4, 2, 8]).total, 12);
  assert.equal(evaluate('{3d20+5}>21f<10', [17, 4, 13]).total, 0);
  assert.equal(evaluate('0d0+5').total, 5);
  assert.equal(evaluate('{2d6,1d8}kh1', [1, 4, 7]).total, 7);
  assert.equal(evaluate('{4d6kh3}', [1, 6, 3, 5]).total, 14);
  assert.equal(evaluate('(1+1)d(3+3)+1', [2, 4]).total, 7);
  assert.equal(evaluate('floor(9/2)+ceil(9/2)+round(4.5)+abs(-3)').total, 17);
  assert.equal(evaluate('2+3*4**2').total, 50);
  assert.equal(evaluate('2**3**2').total, 512);
  assert.equal(evaluate('-2**2+7%3').total, -3);
  assert.equal(evaluate('2d6[Chamas]+1d8[Frio]', [2, 3, 4]).total, 9);
});
test('Result annotations, matches and sort never invent contributions', () => {
  const r = evaluate('3d6sa', [6, 1, 3]);
  assert.deepEqual(r.dice, [1, 3, 6]);
  assert.deepEqual(evaluate('3d6sd+3', [1, 6, 3]).dice, [6, 3, 1]);
  assert.deepEqual(evaluate('1d8+3d6sa', [4, 6, 1, 3]).dice, [4, 1, 3, 6]);
  assert.deepEqual(evaluate('{1d8+3d6}sd+3', [4, 6, 1, 3]).dice, [6, 4, 3, 1]);
  assert.equal(r.total, 10);
  assert.equal(evaluate('6d6mt', [1, 1, 4, 4, 6, 6]).total, 3);
  assert.equal(evaluate('6d6mt3>4', [4, 4, 4, 2, 2, 2]).total, 1);
  assert.equal(evaluate('2d6m', [4, 4]).total, 8);
  const critical = evaluate('2d20cs>18cf<2', [20, 1]);
  assert.equal(critical.total, 21);
  assert.deepEqual(critical.highlights, [
    { value: 20, kind: 'surge' },
    { value: 1, kind: 'mishap' },
  ]);
});
test('Invalid code, recursion, division, endless rolls and excessive pools are rejected', () => {
  for (const f of [
    'alert(1)',
    'globalThis.secret',
    '1d6/0',
    '1d6!>1',
    '1d6r<6',
    '101d6',
    '1d1001',
    '1d6f1',
    '{2d6',
    '1d6+',
  ])
    assert.throws(() => rollFormula(f, () => 1), f);
  assert.throws(() => rollFormula('1d6!', () => 6), /500/);
  assert.equal(evaluate('0d6+5').total, 5);
  assert.equal(evaluate('1d1', [1]).total, 1);
});
