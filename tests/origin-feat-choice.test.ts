import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  choicesSchema,
  defaultChoices,
  deriveSheet,
  feats,
  originFeats,
  reconcileChoices,
  validateChoices,
} from '../shared/character-sheet';
test('o talento de origem escolhido independe do antecedente e conserva as regras de cada talento', () => {
  for (const race of ['Humano', 'Elfo'])
    for (const cls of ['Feiticeiro', 'Guerreiro', 'Bruxo'])
      for (const feat of originFeats) {
        const selected = reconcileChoices(race, cls, {
          ...defaultChoices(race, cls),
          backgroundFeat: feat,
        });
        const validated = validateChoices(race, cls, selected);
        assert.equal(feats(validated)[0], feat);
        const changed = reconcileChoices(race, cls, validated, 'Soldado');
        assert.equal(feats(changed)[0], feat);
        validateChoices(race, cls, changed);
      }
  const base = defaultChoices('Elfo', 'Guerreiro'),
    hero = { race: 'Elfo', class: 'Guerreiro', stats: [14, 14, 14, 10, 10, 10], level: 1 };
  const alert = reconcileChoices('Elfo', 'Guerreiro', { ...base, backgroundFeat: 'Alerta' }),
    tough = reconcileChoices('Elfo', 'Guerreiro', { ...base, backgroundFeat: 'Robusto' });
  const a = deriveSheet(hero, alert),
    b = deriveSheet(hero, tough);
  assert.equal(b.hp, a.hp + 2);
  assert.equal(a.initiative, b.initiative + 2);
  assert.equal(feats(base)[0], 'Iniciado em Magia: Clérigo');
  assert.equal(base.backgroundFeat, undefined);
  assert.equal(
    choicesSchema.safeParse({ ...base, backgroundFeat: 'Talento inventado' }).success,
    false,
  );
});
