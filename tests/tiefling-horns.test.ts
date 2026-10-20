import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultChoices, deriveSheet, reconcileChoices, validateChoices, validateRestChoices } from '../shared/character-sheet';
import { tieflingHornIds } from '../shared/tiefling-horns';

test('os oito formatos de chifres persistem na origem e não mudam as regras da ficha', () => {
  assert.equal(tieflingHornIds.length, 8);
  const original = defaultChoices('Tiefling', 'Guerreiro');
  const hero = { race: 'Tiefling', class: 'Guerreiro', level: 1, stats: [14, 14, 14, 14, 14, 14] };
  for (const id of tieflingHornIds) {
    const choices = validateChoices('Tiefling', 'Guerreiro', JSON.parse(JSON.stringify({ ...original, tieflingHorns: id })));
    assert.equal(choices.tieflingHorns, id);
    assert.deepEqual(deriveSheet(hero, choices), deriveSheet(hero, original));
    const changed = reconcileChoices('Tiefling', 'Mago', choices, 'Sábio');
    assert.equal(changed.tieflingHorns, id);
    assert.doesNotThrow(() => validateChoices('Tiefling', 'Mago', changed));
    assert.equal(reconcileChoices('Humano', 'Guerreiro', choices).tieflingHorns, undefined);
  }
  assert.throws(() => validateChoices('Tiefling', 'Guerreiro', { ...original, tieflingHorns: 'invalido' }));
  assert.throws(() => validateChoices('Humano', 'Guerreiro', { ...defaultChoices('Humano', 'Guerreiro'), tieflingHorns: 'short' }));
  assert.throws(() => validateRestChoices('Tiefling', 'Guerreiro', original, { ...original, tieflingHorns: 'short' }));
});

test('fichas antigas de Tiefling sem formato escolhido continuam válidas e preservadas', () => {
  const legacy = defaultChoices('Tiefling', 'Guerreiro'); delete legacy.tieflingHorns;
  const parsed = validateChoices('Tiefling', 'Guerreiro', legacy);
  assert.equal(parsed.tieflingHorns, undefined);
  assert.doesNotThrow(() => validateRestChoices('Tiefling', 'Guerreiro', legacy, parsed));
});
