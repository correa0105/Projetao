import { test } from 'node:test';
import assert from 'node:assert/strict';
import { races, classes } from '../shared/rules.js';
import {
  backgroundRules,
  defaultChoices,
  validateChoices,
  reconcileChoices,
  normalizeOptions,
  deriveSheet,
  feats,
} from '../shared/character-sheet.js';

test('criação: os 16 antecedentes produzem escolhas válidas em cada espécie/classe', () => {
  assert.equal(Object.keys(backgroundRules).length, 16);
  for (const race of races)
    for (const cls of classes)
      for (const background of Object.keys(backgroundRules)) {
        const c = defaultChoices(race, cls, background);
        assert.doesNotThrow(() => validateChoices(race, cls, c), `${race}/${cls}/${background}`);
      }
});

test('criação: mudar classe, espécie e antecedente conserva dados compatíveis', () => {
  const initial = defaultChoices('Humano', 'Guerreiro', 'Sábio');
  initial.alignment = 'Caótico e bom';
  initial.personality = 'Anota tudo que encontra.';
  initial.backgroundExtras = ['Dracônico', 'Gigante'];
  initial.options.featClass0 = ['Druida'];
  for (const race of races)
    for (const cls of classes) {
      const c = reconcileChoices(race, cls, initial);
      assert.equal(c.alignment, initial.alignment);
      assert.equal(c.personality, initial.personality);
      assert.equal(c.backgroundType, 'Sábio');
      assert.deepEqual(c.backgroundExtras, initial.backgroundExtras);
      assert.equal(feats(c)[0], 'Iniciado em Magia: Druida');
      assert.doesNotThrow(() => validateChoices(race, cls, c), `${race}/${cls}`);
    }
  for (const background of Object.keys(backgroundRules))
    assert.doesNotThrow(
      () =>
        validateChoices(
          'Humano',
          'Guerreiro',
          reconcileChoices('Humano', 'Guerreiro', initial, background),
        ),
      background,
    );
});

test('criação: Iniciado em Magia permite três listas e deriva o atributo no servidor', () => {
  const stats = [12, 12, 12, 16, 14, 10];
  for (const background of ['Acólito', 'Guia', 'Sábio'])
    for (const source of ['Clérigo', 'Druida', 'Mago']) {
      let c = defaultChoices('Orc', 'Guerreiro', background);
      c = normalizeOptions('Orc', 'Guerreiro', {
        ...c,
        options: { ...c.options, featClass0: [source] },
      });
      validateChoices('Orc', 'Guerreiro', c);
      assert.equal(
        deriveSheet({ race: 'Orc', class: 'Guerreiro', stats, level: 1 }, c).spellGrants[0].ability,
        source === 'Mago' ? 3 : 4,
      );
      const forged = { ...c, options: { ...c.options, featAbility0: ['Carisma'] } };
      assert.throws(() => validateChoices('Orc', 'Guerreiro', forged));
    }
  const legacy = defaultChoices('Orc', 'Guerreiro');
  delete legacy.originRules;
  delete legacy.options.featClass0;
  legacy.options.featAbility0 = ['Carisma'];
  assert.doesNotThrow(() => validateChoices('Orc', 'Guerreiro', legacy));
  assert.equal(
    deriveSheet({ race: 'Orc', class: 'Guerreiro', stats, level: 1 }, legacy).spellGrants[0]
      .ability,
    5,
  );
});

test('criação: Robusto concede exatamente dois PV por nível', () => {
  const c = defaultChoices('Orc', 'Guerreiro', 'Fazendeiro');
  for (const level of [1, 4, 12, 20]) {
    const base = deriveSheet(
      { race: 'Orc', class: 'Guerreiro', stats: [14, 12, 12, 10, 10, 10], level },
      defaultChoices('Orc', 'Guerreiro', 'Soldado'),
    );
    assert.equal(
      deriveSheet({ race: 'Orc', class: 'Guerreiro', stats: [14, 12, 12, 10, 10, 10], level }, c)
        .hp,
      base.hp + 2 * level,
    );
  }
});
