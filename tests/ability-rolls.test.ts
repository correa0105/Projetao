import test from 'node:test';
import assert from 'node:assert/strict';
import { rollCharacterAbilities } from '../server/ability-rolls';
import { abilityRollTotal, abilityRollRaw, abilityRollResult } from '../shared/ability-rolls';

test('a rolagem refaz todo o conjunto abaixo de 72 ou acima de 90, mantendo os limites inclusivos', () => {
  const queue = [
    Array(24).fill(1),
    Array(24).fill(6),
    Array.from({ length: 6 }, () => [4, 4, 4, 1]).flat(),
  ].flat();
  let used = 0;
  const rolls = rollCharacterAbilities(() => queue[used++]);
  assert.equal(used, 72);
  assert.equal(abilityRollTotal(rolls), 72);
  assert.deepEqual(
    rolls,
    Array.from({ length: 6 }, () => [4, 4, 4, 1]),
  );
  assert.equal(abilityRollTotal(rollCharacterAbilities(() => 5)), 90);
});

test('novas rolagens usam dados d6 inteiros e só devolvem conjuntos entre 72 e 90', () => {
  for (let i = 0; i < 1000; i++) {
    const rolls = rollCharacterAbilities();
    assert.equal(rolls.length, 6);
    assert.ok(
      rolls.every(
        (dice) =>
          dice.length === 4 && dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6),
      ),
    );
    assert.ok(abilityRollTotal(rolls) >= 72 && abilityRollTotal(rolls) <= 90);
  }
});

test('mínimo de 8 altera o resultado, preserva dados reais e entra na soma antes dos bônus', () => {
  const low = [3, 1, 2, 1],
    before = [...low];
  assert.equal(abilityRollRaw(low), 6);
  assert.equal(abilityRollResult(low), 8);
  assert.equal(abilityRollResult(low, 0), 6);
  assert.deepEqual(low, before);
  assert.equal(abilityRollResult([1, 1, 1, 1]), 8);
  assert.equal(abilityRollResult([1, 2, 2, 3]), 8);
  assert.equal(abilityRollResult([1, 2, 3, 3]), 8);
  assert.equal(abilityRollResult([6, 6, 6, 6]), 18);
  const accepted = [
    [3, 1, 2, 1],
    [6, 6, 5, 1],
    [5, 5, 4, 1],
    [4, 4, 4, 1],
    [4, 4, 3, 1],
    [4, 3, 3, 1],
  ];
  assert.equal(abilityRollTotal(accepted), 72);
  assert.equal(abilityRollTotal(accepted, 0), 70);
  let i = 0;
  assert.deepEqual(
    rollCharacterAbilities(() => accepted.flat()[i++]),
    accepted,
  );
});
