import { test } from 'node:test';
import assert from 'node:assert/strict';
import furniture from '../shared/vtt-medieval-furniture-catalog.json';
import { medievalTerrainTextures } from '../shared/medieval-terrain';
import { house2Furniture, house2LayoutSchema } from '../shared/house-v2';
import { natureAssets } from '../shared/vtt-nature-assets';
import { terrainTextures } from '../shared/vtt-terrain';
test('250 móveis adicionais aparecem com a mesma identidade e dimensões nas duas bibliotecas', () => {
  assert.equal(furniture.length, 250);
  assert.equal(house2Furniture.length, 352);
  assert.equal(new Set(house2Furniture.map((q) => q.id)).size, 352);
  assert.equal(new Set(house2Furniture.map((q) => q.name)).size, 352);
  for (const category of ['Mobílias', 'Mobílias externas', 'Cidade medieval'])
    assert.equal(
      furniture.filter((q) => q.category === category).length,
      category === 'Mobílias' ? 150 : 50,
    );
  for (const q of furniture) {
    const h = house2Furniture.find((h) => h.id === q.id),
      v = natureAssets.find((v) => v.id === q.id);
    assert(h && v, q.id);
    assert.deepEqual([h.image, h.width, h.height], [v.image, v.width, v.height], q.id);
    assert(h.price > 0 && Number.isInteger(h.price));
  }
});
test('20 pincéis novos preservam os anteriores e são aceitos na pintura da House 2.0', () => {
  assert.equal(terrainTextures.length, 42);
  assert.equal(medievalTerrainTextures.filter((t) => t.group === 'grass').length, 10);
  assert.equal(medievalTerrainTextures.filter((t) => t.group === 'earth').length, 5);
  assert.equal(medievalTerrainTextures.filter((t) => t.group === 'stone').length, 5);
  for (const t of medievalTerrainTextures)
    assert(
      house2LayoutSchema.safeParse({
        revision: 0,
        house: null,
        items: [],
        ground: [{ material: t.id, width: 1, points: [{ x: 10, y: 10 }] }],
      }).success,
      t.id,
    );
  assert(
    !house2LayoutSchema.safeParse({
      revision: 0,
      house: null,
      items: [],
      ground: [{ material: 'inventado', width: 1, points: [{ x: 10, y: 10 }] }],
    }).success,
  );
});
