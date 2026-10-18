import test from 'node:test';
import assert from 'node:assert/strict';
import { house2InRenderWindow, house2RenderWindow } from '../src/house2-render-window';
import { house2CatalogPreview } from '../src/house2-catalog-preview';
import { house2Furniture } from '../shared/house-v2';
import { statSync } from 'node:fs';
test('render window covers the complete camera and its overscan at every zoom, including negative coordinates', () => {
  for (const x of [-50, -17.2, 0, 43.99, 132])
    for (const y of [-15, 0, 89.5, 170])
      for (const width of [4, 9, 25, 140])
        for (const height of [9, 25, 86]) {
          const view = { x, y, width, height },
            region = house2RenderWindow(view);
          assert(region.x <= x - 8);
          assert(region.y <= y - 8);
          assert(region.x + region.width >= x + width + 8);
          assert(region.y + region.height >= y + height + 8);
          assert(house2InRenderWindow(region, x, y, 0));
          assert(house2InRenderWindow(region, x + width, y + height, 0));
        }
});
test('objects with offscreen centers remain when their rotated artwork or shadow intersects the render band', () => {
  const region = { x: 0, y: 0, width: 30, height: 20 };
  assert(house2InRenderWindow(region, -8, 10, 8));
  assert(house2InRenderWindow(region, 38, 10, 8));
  assert(house2InRenderWindow(region, 15, -8, 8));
  assert(house2InRenderWindow(region, 15, 28, 8));
  assert(!house2InRenderWindow(region, 39, 10, 8));
  assert(!house2InRenderWindow(region, -9, 10, 8));
  assert(house2InRenderWindow(undefined, -999, 999, 0));
});
test('small camera moves in the same cells reuse the same render band', () => {
  assert.deepEqual(
    house2RenderWindow({ x: 1, y: 2, width: 24, height: 19 }),
    house2RenderWindow({ x: 2, y: 3, width: 24, height: 19 }),
  );
});
test('350 shared furniture cards use published thumbnails while the map keeps the full artwork', () => {
  for (const f of house2Furniture.slice(0, 350)) {
    const preview = house2CatalogPreview(f);
    assert.notEqual(preview, f.image, f.id);
    assert(statSync('public' + preview).size < statSync('public' + f.image).size, f.id);
  }
});
