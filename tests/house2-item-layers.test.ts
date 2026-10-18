import { test } from 'node:test';
import assert from 'node:assert/strict';
import { house2ItemLayers } from '../shared/house2-item-layers';
import type { House2Item } from '../shared/house-v2';
test('tabletop lamps remain above supports bought later, without rewriting stored order', () => {
  const lamp = { id: 'lamp', catalog_id: 'furniture-031' } as House2Item;
  const table = { id: 'table', catalog_id: 'furniture-006' } as House2Item;
  const candle = { id: 'candle', catalog_id: 'h2-candle' } as House2Item;
  const chair = { id: 'chair', catalog_id: 'furniture-001' } as House2Item;
  const items = [lamp, table, candle, chair];
  assert.deepEqual(house2ItemLayers(items), [table, chair, lamp, candle]);
  assert.deepEqual(items, [lamp, table, candle, chair]);
});
