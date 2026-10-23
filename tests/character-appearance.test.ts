import { test } from 'node:test';
import assert from 'node:assert/strict';
import { races } from '../shared/rules.js';
import {
  defaultChoices,
  validateChoices,
  reconcileChoices,
  deriveSheet,
} from '../shared/character-sheet.js';
import {
  validateCreationAppearance,
  characterAppearanceInstructions,
  characterHeights,
  characterBuilds,
  characterAges,
  characterGenders,
} from '../shared/character-appearance.js';
import { characterHeightScale, characterArtAnatomy } from '../shared/character-stature.js';

test('todas as espécies exigem personalização na criação; escolhas são cosméticas e legados continuam válidos', () => {
  for (const race of races) {
    const legacy = defaultChoices(race, 'Guerreiro');
    assert.doesNotThrow(() => validateChoices(race, 'Guerreiro', legacy));
    assert.throws(() => validateCreationAppearance(race, legacy), /altura/);
    const character = { race, class: 'Guerreiro', stats: [15, 14, 13, 12, 10, 8], level: 1 };
    const rules = deriveSheet(character, legacy);
    for (const height of characterHeights)
      for (const build of characterBuilds)
        for (const age of characterAges)
          for (const gender of characterGenders) {
            const choices = {
              ...legacy,
              physicalTraits: {
                height: height.id,
                build: build.id,
                age: age.id,
                gender: gender.id,
              },
            };
            assert.doesNotThrow(() => validateCreationAppearance(race, choices));
            assert.deepEqual(
              validateChoices(race, 'Guerreiro', choices).physicalTraits,
              choices.physicalTraits,
            );
            assert.deepEqual(
              reconcileChoices(race, 'Guerreiro', choices, 'Soldado').physicalTraits,
              choices.physicalTraits,
            );
            assert.deepEqual(deriveSheet(character, choices), rules);
            const instructions = characterAppearanceInstructions(race, choices);
            for (const part of [
              height.instruction,
              build.instruction,
              age.instruction,
              gender.instruction,
            ])
              assert(instructions.includes(part));
          }
    assert.doesNotMatch(
      characterArtAnatomy(race, { age: 'young', build: 'slim' }),
      /Adulto|adulta|robusto|robusta/,
    );
    assert(characterHeightScale(race, undefined, { height: 'short' }) < characterHeightScale(race));
    assert(characterHeightScale(race, undefined, { height: 'tall' }) > characterHeightScale(race));
  }
  const base = defaultChoices('Warforged', 'Guerreiro');
  const reference = {
    ...base,
    warforgedArtMode: 'reference' as const,
    warforgedAppearance: undefined,
    physicalTraits: {
      height: 'short' as const,
      build: 'slim' as const,
      age: 'old' as const,
      gender: 'female' as const,
    },
  };
  assert.throws(() => validateCreationAppearance('Warforged', reference), /estrutura/);
  const selected = { ...reference, warforgedBody: 'long-legs' as const };
  assert.doesNotThrow(() => validateCreationAppearance('Warforged', selected));
  assert.equal(validateChoices('Warforged', 'Guerreiro', selected).warforgedBody, 'long-legs');
  assert.equal(reconcileChoices('Warforged', 'Mago', selected).warforgedBody, 'long-legs');
  const human = reconcileChoices('Humano', 'Guerreiro', selected);
  assert.equal(human.warforgedBody, undefined);
  assert.deepEqual(human.physicalTraits, selected.physicalTraits);
  assert.throws(() =>
    validateChoices('Humano', 'Guerreiro', { ...human, warforgedBody: 'balanced' }),
  );
  for (const physicalTraits of [
    { height: 'tall' },
    { height: 'unknown', build: 'slim', age: 'adult' },
    { ...selected.physicalTraits, extra: 'injected' },
    { ...selected.physicalTraits, gender: 'invalid' },
  ])
    assert.throws(() => validateChoices('Warforged', 'Guerreiro', { ...selected, physicalTraits }));
});

test('fichas e jobs da versão anterior não recebem gênero automático; novas criações exigem a escolha', () => {
  const legacy = {
    ...defaultChoices('Humano', 'Guerreiro'),
    physicalTraits: { height: 'tall' as const, build: 'slim' as const, age: 'old' as const },
  };
  assert.equal(validateChoices('Humano', 'Guerreiro', legacy).physicalTraits?.gender, undefined);
  assert.throws(() => validateCreationAppearance('Humano', legacy), /homem ou mulher/);
  const prompt = characterAppearanceInstructions('Humano', legacy);
  assert(!prompt.includes('Personagem homem'));
  assert(!prompt.includes('Personagem mulher'));
  assert(prompt.includes(characterHeights[2].instruction));
});
