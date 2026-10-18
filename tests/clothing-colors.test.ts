import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupShopItems, getVariantLabel, matchShopGroup } from '../src/shop-variants.js';
import type { Item } from '../src/types.js';
const products = JSON.parse(readFileSync('data/shop-clothing-colors-20261018.json', 'utf8')).items.map((x: any) => ({ ...x, base_item: x.raw_data.base_item })) as Item[];
test('eight garments expose five distinct colors and preserve every real inventory ID', () => {
  const groups = groupShopItems(products);
  assert.equal(groups.length, 8);
  assert.equal(new Set(groups.flatMap(g => g.variants.map(x => x.id))).size, 40);
  for (const group of groups) {
    assert.equal(group.kind, 'clothing');
    assert.equal(group.models.length, 1);
    assert.equal(group.variants.length, 5);
    assert.equal(new Set(group.variants.map(x => getVariantLabel(x))).size, 5);
    assert.equal(new Set(group.variants.map(x => x.image_path)).size, 5);
    assert(group.variants.some(x => x.id === group.models[0].id), 'original inventory ID retained');
    assert.equal(new Set(group.variants.map(x => x.price_cp)).size, 1);
    const wine = matchShopGroup(group, 'vinho');
    assert.equal(wine.length, 1);
    assert.equal(getVariantLabel(wine[0]), 'Vinho');
    assert.deepEqual(groupShopItems([...products].reverse()).find(g => g.id === group.id)?.variants.map(x => x.id).sort(), group.variants.map(x => x.id).sort());
  }
});
