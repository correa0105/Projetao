import { test } from 'node:test';
import assert from 'node:assert/strict';
import { softenTerrainMask } from '../src/vtt-terrain-blur';
test('feathering conserves coverage, symmetry and transparent margins', () => {
  const width = 61, data = new Uint8ClampedArray(width * width * 4);
  for (let y = 24; y <= 36; y++) for (let x = 24; x <= 36; x++) data[(y * width + x) * 4 + 3] = 255;
  softenTerrainMask(data, width, width, 3, new Float32Array(width * width), new Float32Array(width * width));
  let mass = 0;
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const value = data[(y * width + x) * 4 + 3]; mass += value;
    assert.equal(value, data[(y * width + width - x - 1) * 4 + 3]);
    assert.equal(value, data[((width - y - 1) * width + x) * 4 + 3]);
  }
  assert(Math.abs(mass - 169 * 255) < 169 * 255 * .01);
  assert.equal(data[3], 0);
  const centre = data[(30 * width + 30) * 4 + 3], edge = data[(30 * width + 36) * 4 + 3], outside = data[(30 * width + 40) * 4 + 3];
  assert(centre > edge && edge > outside && outside > 0);
});
