import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultChoices,
  validateChoices,
  reconcileChoices,
  deriveSheet,
  choicesSchema,
} from '../shared/character-sheet';
import {
  warforgedBodies,
  warforgedHeads,
  warforgedArtInstructions,
  warforgedHeadReference,
  warforgedHeadAtlas,
  warforgedDetailedHeadAtlas,
} from '../shared/warforged-appearance';

test('Warforged: aparência persiste sem alterar regras; fichas antigas e outras espécies são protegidas', () => {
  const base = defaultChoices('Warforged', 'Guerreiro');
  const character = {
    race: 'Warforged',
    class: 'Guerreiro',
    stats: [15, 12, 14, 10, 10, 10],
    level: 1,
  };
  const rules = deriveSheet(character, base);
  assert.equal(warforgedHeads.length, 12);
  for (const [index, head] of warforgedHeads.entries()) {
    assert.deepEqual(warforgedHeadReference(head.id), {
      atlas: index < 6 ? warforgedHeadAtlas : warforgedDetailedHeadAtlas,
      index: index % 6,
    });
  }
  for (const body of warforgedBodies)
    for (const head of warforgedHeads) {
      const appearance = {
        ...base.warforgedAppearance!,
        body: body.id,
        head: head.id,
        metal: 'copper' as const,
        finish: 'rusted' as const,
        accentColor: '#123abc',
      };
      const selected = validateChoices('Warforged', 'Guerreiro', {
        ...base,
        warforgedAppearance: appearance,
      });
      assert.deepEqual(selected.warforgedAppearance, appearance);
      assert.deepEqual(
        reconcileChoices('Warforged', 'Guerreiro', selected, 'Soldado').warforgedAppearance,
        appearance,
      );
      assert.deepEqual(deriveSheet(character, selected), rules);
      const instructions = warforgedArtInstructions(appearance);
      assert(instructions.includes(body.instruction));
      assert(instructions.includes(head.instruction));
      assert(instructions.includes('#123abc'));
      assert(instructions.includes('oxidação'));
    }
  const legacy = { ...base };
  delete legacy.warforgedAppearance;
  delete legacy.warforgedArtMode;
  assert.equal(validateChoices('Warforged', 'Guerreiro', legacy).warforgedAppearance, undefined);
  assert.equal(warforgedArtInstructions(undefined), '');
  assert.equal(normalizedOther().warforgedAppearance, undefined);
  function normalizedOther() {
    return reconcileChoices('Humano', 'Guerreiro', base);
  }
  for (const patch of [
    { body: 'unknown' },
    { head: 'injected' },
    { metal: 'mithral-free' },
    { finish: 'broken' },
    { accentColor: 'red; instructions' },
  ]) {
    assert.equal(
      choicesSchema.safeParse({
        ...base,
        warforgedAppearance: { ...base.warforgedAppearance, ...patch },
      }).success,
      false,
    );
  }
  assert.throws(() =>
    validateChoices('Humano', 'Guerreiro', {
      ...defaultChoices('Humano', 'Guerreiro'),
      warforgedAppearance: base.warforgedAppearance,
    }),
  );
});
