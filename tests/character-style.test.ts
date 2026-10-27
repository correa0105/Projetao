import { test } from 'node:test';
import assert from 'node:assert/strict';
import { races } from '../shared/rules';
import {
  defaultChoices,
  validateChoices,
  reconcileChoices,
  deriveSheet,
  canChooseWoodenStaff,
} from '../shared/character-sheet';
import { characterAppearanceInstructions, characterPostures } from '../shared/character-appearance';
import {
  defaultStartingOutfit,
  startingTops,
  startingTrousers,
  startingFootwear,
  startingOutfitInstructions,
} from '../shared/starting-outfit';

test('traje, postura e bengala permanecem cosméticos em todas as espécies e sobrevivem à reconciliação', () => {
  for (const race of races) {
    const base = defaultChoices(race, 'Guerreiro'),
      character = { race, class: 'Guerreiro', stats: [15, 14, 13, 12, 10, 8], level: 1 };
    const rules = deriveSheet(character, base);
    for (const posture of characterPostures)
      for (const cane of ['none', 'wooden'] as const) {
        const selected = {
          ...base,
          physicalTraits: {
            height: 'average' as const,
            build: 'average' as const,
            age: 'elder' as const,
            gender: 'male' as const,
            posture: posture.id,
            cane,
          },
          startingOutfit: {
            ...defaultStartingOutfit,
            top: 'vest' as const,
            topColor: '#123abc',
            sash: false,
          },
        };
        const checked = validateChoices(race, 'Guerreiro', selected);
        assert.deepEqual(checked.physicalTraits, selected.physicalTraits);
        assert.deepEqual(checked.startingOutfit, selected.startingOutfit);
        const reconciled = reconcileChoices(race, 'Mago', checked);
        assert.deepEqual(reconciled.physicalTraits, selected.physicalTraits);
        assert.deepEqual(reconciled.startingOutfit, selected.startingOutfit);
        assert.deepEqual(deriveSheet(character, checked), rules);
        const prompt = characterAppearanceInstructions(race, checked);
        assert(prompt.includes(posture.instruction));
        assert(prompt.includes('#123abc'));
        assert(prompt.includes('SEM FAIXA DE TECIDO'));
        assert(
          prompt.includes(
            cane === 'wooden' ? 'ponta inferior toca o chão' : 'SEM BENGALA de apoio',
          ),
        );
        if (cane === 'wooden') assert(prompt.includes('projeção curta e encurtada'));
      }
    assert.equal(validateChoices(race, 'Guerreiro', base).startingOutfit, undefined);
    assert.equal(validateChoices(race, 'Guerreiro', base).physicalTraits, undefined);
    assert.equal(startingOutfitInstructions(undefined), '');
  }
});
test('cajado é cosmético, disponível por classe, origem ou talento e reconciliado ao perder conjuração', () => {
  for (const cls of [
    'Mago',
    'Bruxo',
    'Feiticeiro',
    'Druida',
    'Clérigo',
    'Bardo',
    'Paladino',
    'Patrulheiro',
    'Artífice',
  ]) {
    const base = defaultChoices('Orc', cls, 'Soldado');
    assert(canChooseWoodenStaff('Orc', cls, base));
    const selected = {
      ...base,
      physicalTraits: {
        height: 'average' as const,
        build: 'average' as const,
        age: 'elder' as const,
        posture: 'hunched' as const,
        cane: 'wooden-staff' as const,
      },
    };
    assert.equal(validateChoices('Orc', cls, selected).physicalTraits?.cane, 'wooden-staff');
    const character = { race: 'Orc', class: cls, stats: [15, 14, 13, 12, 10, 8], level: 1 };
    assert.deepEqual(deriveSheet(character, selected), deriveSheet(character, base));
    assert(characterAppearanceInstructions('Orc', selected).includes('CAJADO DE MADEIRA'));
    const changed = reconcileChoices('Orc', 'Guerreiro', selected, 'Soldado');
    assert.equal(changed.physicalTraits?.cane, 'none');
    assert.equal(changed.physicalTraits?.posture, 'hunched');
  }
  const fighter = defaultChoices('Orc', 'Guerreiro', 'Soldado');
  assert(!canChooseWoodenStaff('Orc', 'Guerreiro', fighter));
  assert(canChooseWoodenStaff('Orc', 'Guerreiro', defaultChoices('Orc', 'Guerreiro', 'Acólito')));
  assert(canChooseWoodenStaff('Elfo', 'Guerreiro', defaultChoices('Elfo', 'Guerreiro', 'Soldado')));
  assert.throws(
    () =>
      validateChoices('Orc', 'Guerreiro', {
        ...fighter,
        physicalTraits: { height: 'average', build: 'average', age: 'adult', cane: 'wooden-staff' },
      }),
    /conjuração/,
  );
});
test('quatro modelos de cada peça geram orientações próprias e cores validadas sem texto injetado', () => {
  assert.equal(startingTops.length, 4);
  assert.equal(startingTrousers.length, 4);
  assert.equal(startingFootwear.length, 4);
  for (const top of startingTops)
    for (const trousers of startingTrousers)
      for (const footwear of startingFootwear) {
        const outfit = {
          ...defaultStartingOutfit,
          top: top.id,
          trousers: trousers.id,
          footwear: footwear.id,
        };
        const prompt = startingOutfitInstructions(outfit);
        for (const part of [top.instruction, trousers.instruction, footwear.instruction])
          assert(prompt.includes(part));
        assert(prompt.includes('Equipamentos realmente selecionados têm prioridade'));
      }
  const base = defaultChoices('Humano', 'Guerreiro');
  for (const invalid of [
    { ...defaultStartingOutfit, top: 'plate' },
    { ...defaultStartingOutfit, topColor: 'ignore rules' },
    { ...defaultStartingOutfit, sash: 'false' },
    { ...defaultStartingOutfit, extra: 'inject' },
  ])
    assert.throws(() =>
      validateChoices('Humano', 'Guerreiro', { ...base, startingOutfit: invalid }),
    );
  for (const value of [{ posture: 'broken' }, { cane: 'weapon' }])
    assert.throws(() =>
      validateChoices('Humano', 'Guerreiro', {
        ...base,
        physicalTraits: { height: 'average', build: 'average', age: 'adult', ...value },
      }),
    );
});
