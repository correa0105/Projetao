import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roughenTerrainMargin, terrainContactSoftness } from '../src/vtt-terrain-edge';
test('Contact transitions keep opaque centres and empty space unchanged, and vary only edge alpha', () => {
  const data = new Uint8ClampedArray(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      data[i] = 100;
      data[i + 1] = 80;
      data[i + 2] = 40;
      data[i + 3] = x < 8 ? 0 : x > 55 ? 255 : 128;
    }
  const original = data.slice();
  roughenTerrainMargin(data, 64, 64, 0, 0, 1);
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i], 100);
    assert.equal(data[i + 1], 80);
    assert.equal(data[i + 2], 40);
    if (original[i + 3] === 0 || original[i + 3] === 255)
      assert.equal(data[i + 3], original[i + 3]);
    else if (data[i + 3] !== 128) changed++;
  }
  assert(changed > 2000);
  const again = original.slice();
  roughenTerrainMargin(again, 64, 64, 0, 0, 1);
  assert.deepEqual(again, data);
});
test('World-space edges match across tile boundaries and hard paints retain a contact transition', () => {
  const all = new Uint8ClampedArray(64 * 32 * 4),
    tile = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 3; i < all.length; i += 4) all[i] = 128;
  for (let i = 3; i < tile.length; i += 4) tile[i] = 128;
  roughenTerrainMargin(all, 64, 32, 0, 0, 1);
  roughenTerrainMargin(tile, 32, 32, 32, 0, 1);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      assert.equal(tile[(y * 32 + x) * 4 + 3], all[(y * 64 + x + 32) * 4 + 3]);
  assert(terrainContactSoftness({ softness: 0, radius: 60, erase: false }) > 0);
  assert.equal(terrainContactSoftness({ softness: 0, radius: 60, erase: true }), 0);
});
