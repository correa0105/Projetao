import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetSpellHistory } from '../shared/sheet-spell-history.js';
import { deriveSheet } from '../shared/character-sheet.js';
import { originFixture, legalAdvance, advanceFixture } from './advancement-fixtures.js';

test('grimório mantém nível original; novas magias e multiclasse têm os dois níveis corretos', () => {
  const { character, choices } = originFixture('Mago');
  const initial = choices.spells[0];
  const next = legalAdvance(character, choices);
  const learned = next.newSpells[0];
  advanceFixture(character, choices, next);
  advanceFixture(character, choices, legalAdvance(character, choices, 'Clérigo'));
  const rows = sheetSpellHistory(character, choices);
  assert.equal(rows.find((s) => s.id === initial && s.source === 'Mago')?.characterLevel, 1);
  assert.equal(rows.find((s) => s.id === learned && s.source === 'Mago')?.characterLevel, 2);
  const cleric = rows.find((s) => s.source === 'Clérigo');
  assert(cleric);
  assert.equal(cleric.characterLevel, 3);
  assert.equal(cleric.classLevel, 1);
  const d = deriveSheet(character, choices);
  assert(
    !d.featureEntries.some((s) => ['Magias aprendidas', 'Truques aprendidos'].includes(s.title)),
  );
});
test('troca de truque remove o antigo e registra o nível da nova aquisição', () => {
  const { character, choices } = originFixture('Mago');
  const original = choices.cantrips[0];
  const next = legalAdvance(character, choices);
  next.retrain = [{ kind: 'cantrip', from: original, to: 'true-strike' }];
  advanceFixture(character, choices, next);
  const rows = sheetSpellHistory(character, choices);
  assert(!rows.some((s) => s.id === original && s.source === 'Mago'));
  assert.equal(rows.find((s) => s.id === 'true-strike' && s.source === 'Mago')?.characterLevel, 2);
});
test('preparação atual sem histórico não inventa um nível de aquisição', () => {
  const { character, choices } = originFixture('Clérigo');
  choices.advancement!.prepared = { Clérigo: ['zone-of-truth'] };
  const row = sheetSpellHistory(character, choices).find((s) => s.id === 'zone-of-truth');
  assert(row);
  assert.equal(row.characterLevel, null);
});
