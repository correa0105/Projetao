import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classes, races } from '../shared/rules.js';
import { eberronSpecies } from '../shared/eberron-species.js';
import {
  backgroundRules,
  defaultChoices,
  deriveSheet,
  normalizeOptions,
  validateChoices,
  validateRestChoices,
  proficientSkills,
} from '../shared/character-sheet.js';
import { characterHeightScale } from '../shared/character-stature.js';

test('Eberron: criação válida em todas as classes e antecedentes sem duplicar edições', () => {
  for (const race of Object.keys(eberronSpecies)) {
    assert.equal(races.filter((r) => r === race).length, 1);
    for (const cls of classes)
      for (const background of Object.keys(backgroundRules))
        assert.doesNotThrow(
          () => validateChoices(race, cls, defaultChoices(race, cls, background)),
          `${race}, ${cls}, ${background}`,
        );
  }
});

test('Warforged: CA integrada com e sem armadura; sem duplicação ao derivar', () => {
  for (const cls of ['Mago', 'Monge', 'Guerreiro']) {
    const stats = [14, 14, 14, 14, 14, 14];
    const sheet = (race: string) =>
      deriveSheet({ race, class: cls, stats, level: 1 }, defaultChoices(race, cls));
    assert.equal(sheet('Warforged').armorClass, sheet('Kalashtar').armorClass + 1);
    assert.equal(sheet('Warforged').unarmored, sheet('Kalashtar').unarmored + 1);
  }
});

test('Khoravar: truque e treinamento trocam no descanso; atributo permanece fixo', () => {
  const c = defaultChoices('Khoravar', 'Guerreiro');
  assert.deepEqual(
    deriveSheet(
      { race: 'Khoravar', class: 'Guerreiro', stats: [14, 14, 14, 14, 14, 14], level: 1 },
      c,
    ).spellGrants[0].cantrips,
    ['friends'],
  );
  const next = normalizeOptions('Khoravar', 'Guerreiro', {
    ...c,
    options: { ...c.options, racialCantrip: ['guidance'], versatileTraining: ['Kit de disfarce'] },
  });
  assert.doesNotThrow(() => validateRestChoices('Khoravar', 'Guerreiro', c, next));
  assert.ok(
    deriveSheet(
      { race: 'Khoravar', class: 'Guerreiro', stats: [14, 14, 14, 14, 14, 14], level: 1 },
      next,
    ).proficiencies.includes('Kit de disfarce'),
  );
  assert.throws(() =>
    validateRestChoices('Khoravar', 'Guerreiro', c, {
      ...next,
      options: { ...next.options, speciesAbility: ['Carisma'] },
    }),
  );
});

test('Kalashtar: perícia temporária substituível no descanso', () => {
  const c = defaultChoices('Kalashtar', 'Guerreiro');
  const next = normalizeOptions('Kalashtar', 'Guerreiro', {
    ...c,
    options: { ...c.options, dreamSkill: ['Enganação'] },
  });
  const saved = validateRestChoices('Kalashtar', 'Guerreiro', c, next);
  assert.ok(proficientSkills('Kalashtar', saved).includes('Enganação'));
  assert.ok(!proficientSkills('Kalashtar', saved).includes(c.options.dreamSkill[0]));
});

test('Shifter: benefícios condicionais não alteram CA ou velocidade permanentemente', () => {
  for (const subrace of eberronSpecies.Shifter.variants) {
    const c = { ...defaultChoices('Shifter', 'Mago'), subrace };
    validateChoices('Shifter', 'Mago', c);
    const d = deriveSheet(
      { race: 'Shifter', class: 'Mago', stats: [14, 14, 14, 14, 14, 14], level: 1 },
      c,
    );
    assert.equal(d.armorClass, 12);
    assert.equal(d.speed, 9);
    assert.ok(d.featureGroups.race.some((f) => f.startsWith(subrace + ':')));
  }
  assert.ok(
    characterHeightScale('Warforged', 'Pequeno') < characterHeightScale('Warforged', 'Médio'),
  );
});
