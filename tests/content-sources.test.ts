import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../shared/character-rules-2024.json';
import bindings from '../shared/shop-spell-options.json';
import { permittedSource } from '../shared/content-sources.js';
import { withdrawnBookOffer } from '../shared/shop-availability.js';
import { validateAdvance } from '../shared/character-advancement.js';
import { originFixture, legalAdvance, advanceFixture } from './advancement-fixtures.js';

test('Arcana Unleashed não volta aos seletores; Tasha continua permitido', () => {
  assert.equal(permittedSource('AU'), false);
  assert.equal(permittedSource('TCE'), true);
  for (const rows of [catalog.books, catalog.subclasses, catalog.spells, catalog.artificer.plans, bindings.items])
    assert.ok(rows.every((row) => permittedSource('source' in row ? row.source : row.id)));
  assert.ok(bindings.items.some((row) => row.source === 'TCE'));
  for (const raw_data of [
    { upstream_source: 'AU' },
    { upstream_facts: { source: 'AU' } },
    { source_book: 'Arcana Unleashed' },
  ]) assert.equal(withdrawnBookOffer({ raw_data }), true);
  assert.equal(withdrawnBookOffer({ source: 'D&D · Arcana Unleashed' }), true);
  assert.equal(withdrawnBookOffer({ raw_data: { upstream_source: 'TCE' } }), false);
});

test('servidor recusa uma subclasse retirada enviada diretamente pelo cliente', () => {
  const a = originFixture('Mago');
  advanceFixture(a.character, a.choices, legalAdvance(a.character, a.choices));
  const next = legalAdvance(a.character, a.choices, 'Mago', 'evoker');
  assert.throws(() => validateAdvance(a.character, a.choices, { ...next, subclass: 'necromancer' }));
});
