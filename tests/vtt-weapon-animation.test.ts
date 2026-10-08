import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { attackVisualSchema, weaponStyle, weaponVisual } from '../shared/vtt-attack-visual';
test('a arma define a animação e o nome do personagem não interfere', () => {
  for (const name of [
    'Espada longa',
    'Arco · Espada longa',
    'Besta · Machado de batalha',
    'Tridente',
    'Mão · Adaga',
  ])
    assert.equal(weaponVisual(name), 'sword', name);
  for (const name of [
    'Espada · Arco longo',
    'Besta pesada',
    'Longbow',
    'Cavaleiro · Heavy Crossbow',
  ])
    assert.equal(weaponVisual(name), 'arrow', name);
  assert.equal(weaponStyle('Machado +1'), 'axe');
  assert.equal(weaponStyle('Maça'), 'mace');
  assert.equal(weaponStyle('Azagaia'), 'spear');
  assert.equal(weaponStyle('Punhal'), 'dagger');
  assert.equal(weaponStyle('Besta de mão'), 'crossbow');
});
test('eventos legados continuam válidos e modelos incompatíveis são recusados', () => {
  const base = { actor_id: randomUUID(), target_id: randomUUID() };
  assert.ok(attackVisualSchema.safeParse({ ...base, kind: 'sword' }).success);
  assert.ok(attackVisualSchema.safeParse({ ...base, kind: 'arrow' }).success);
  for (const weapon of ['sword', 'axe', 'mace', 'spear', 'dagger']) {
    assert.ok(attackVisualSchema.safeParse({ ...base, kind: 'sword', weapon }).success);
    assert.equal(attackVisualSchema.safeParse({ ...base, kind: 'arrow', weapon }).success, false);
  }
  for (const weapon of ['bow', 'crossbow']) {
    assert.ok(attackVisualSchema.safeParse({ ...base, kind: 'arrow', weapon }).success);
    assert.equal(attackVisualSchema.safeParse({ ...base, kind: 'sword', weapon }).success, false);
  }
  assert.equal(
    attackVisualSchema.safeParse({ ...base, kind: 'arrow', weapon: 'unknown' }).success,
    false,
  );
});
