import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unarmedAttack, UNARMED_ATTACK_ID } from '../shared/unarmed-attack.js';
import { defaultChoices } from '../shared/character-sheet.js';
import { rollFormula } from '../shared/vtt-roll.js';
import { criticalDamage } from '../shared/vtt-attack.js';
import { weaponStyle, weaponVisual } from '../shared/vtt-attack-visual.js';

test('soco usa Força, proficiência e dano fixo, sem rolar ou dobrar dado inexistente', () => {
  const punch = unarmedAttack({
    race: 'Humano',
    class: 'Guerreiro',
    stats: [14, 16, 12, 10, 10, 10],
  });
  assert.equal(punch.itemId, UNARMED_ATTACK_ID);
  assert.equal(punch.attack, 4);
  assert.equal(punch.dice, '1');
  assert.equal(punch.ability, 2);
  const formula = punch.dice + '+' + punch.ability;
  const roll = rollFormula(formula, () => {
    throw Error('Soco comum não rola dado de dano.');
  });
  assert.equal(roll.total, 3);
  assert.deepEqual(criticalDamage(formula), [formula]);
  assert.equal(weaponStyle(punch.name), 'slam');
  assert.equal(weaponVisual(punch.name), 'natural');
});
test('Força baixa não gera dano negativo e ficha sem origem também tem Soco', () => {
  const punch = unarmedAttack(
    { race: 'Humano', class: 'Mago', stats: [3, 16, 12, 10, 10, 10], level: 5 },
    null,
  );
  assert.equal(punch.attack, -1);
  assert.equal(rollFormula(punch.dice + punch.ability, () => 1).total, 0);
});
test('monge conserva o dado marcial e usa Destreza quando melhor', () => {
  const punch = unarmedAttack(
    { race: 'Humano', class: 'Monge', stats: [8, 16, 12, 10, 14, 10], level: 1 },
    defaultChoices('Humano', 'Monge'),
  );
  assert.equal(punch.attack, 5);
  assert.equal(punch.dice, '1d6');
  assert.equal(punch.ability, 3);
  assert.deepEqual(criticalDamage('1d6+3'), ['2d6+3']);
});
