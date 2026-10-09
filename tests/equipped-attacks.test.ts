import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equippedAttacks, type CombatItem } from '../shared/equipped-attacks';
import { defaultChoices } from '../shared/character-sheet';
import { weaponData } from '../shared/character-sheet';
import { rollFormula } from '../shared/vtt-roll';
import { criticalDamage } from '../shared/vtt-attack';
const character = { race: 'Elfo', class: 'Guerreiro', stats: [14, 12, 14, 10, 10, 10] },
  choices = defaultChoices(character.race, character.class);
const item = (id: string, name: string, extra: Partial<CombatItem> = {}): CombatItem => ({
  id,
  name,
  quantity: 1,
  equipped: ['main_hand'],
  image_path: '/shop/items/' + id + '.png',
  ...extra,
});
test('weapon attacks follow owned equipment rather than creation choices', () => {
  assert.deepEqual(equippedAttacks(character, choices, []), []);
  assert.deepEqual(
    equippedAttacks(character, choices, [item('flail', 'Mangual', { equipped: [] })]),
    [],
  );
  assert.deepEqual(
    equippedAttacks(character, choices, [item('flail', 'Mangual', { quantity: 0 })]),
    [],
  );
  const actual = equippedAttacks(character, choices, [
    item('dagger', 'Adaga', { equipped: ['off_hand'] }),
  ]);
  assert.equal(actual.length, 1);
  assert.equal(actual[0].itemId, 'dagger');
  assert.equal(actual[0].image_path, '/shop/items/dagger.png');
  assert.equal(actual[0].attack, 4);
});
test('every weapon sends numeric dice, with versatile damage kept separately', () => {
  for (const name of Object.keys(weaponData)) {
    const attack = equippedAttacks(character, choices, [item('fixture-' + name, name)])[0];
    assert.ok(attack, name);
    const formulas = [attack.dice, attack.versatileDice].filter(
      (s): s is string => !!s && s !== '—',
    );
    for (const dice of formulas) {
      assert.match(dice, /^(?:\d+d\d+|\d+)$/);
      assert.ok(Number.isFinite(rollFormula(dice + '+2', (min) => min).total));
      for (const critical of criticalDamage(dice + '+2'))
        assert.ok(Number.isFinite(rollFormula(critical, (min) => min).total));
    }
  }
  const sword = equippedAttacks(character, choices, [item('longsword', 'Espada longa')])[0];
  assert.equal(sword.dice, '1d8');
  assert.equal(sword.versatileDice, '1d10');
  assert.equal(sword.twoHanded, false);
});
test('catalog variants use base weapon mechanics and retain their own art', () => {
  const actual = equippedAttacks(character, choices, [
    item('magic-greatsword-test', 'Espada encantada', { raw_data: { base_item: 'greatsword' } }),
  ]);
  assert.equal(actual.length, 1);
  assert.equal(actual[0].name, 'Espada encantada');
  assert.equal(actual[0].baseName, 'Espada grande');
  assert.equal(actual[0].dice, '2d6');
  assert.equal(actual[0].twoHanded, true);
  assert.deepEqual(
    equippedAttacks(character, choices, [
      item('leather-armor', 'Armadura de couro'),
      item('dog-flail', 'Mangual', { raw_data: { equipment_target: 'dog' } }),
    ]),
    [],
  );
  assert.equal(
    equippedAttacks(character, choices, [
      item('flail', 'Mangual'),
      item('flail', 'Mangual', { equipped: ['off_hand'] }),
    ]).length,
    1,
  );
});
