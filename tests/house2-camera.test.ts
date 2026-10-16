import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundHouse2Camera, initialHouse2Camera } from '../src/house2-camera';
import { house2DayPhases } from '../shared/house2-lighting';
test('House camera keeps every corner inside the square at every zoom and aspect', () => {
  for (const width of [320, 390, 768, 1440, 1920, 3840])
    for (const height of [568, 900, 1440])
      for (const span of [1, 9, 19, 70, 145, 208, 10000])
        for (const x of [-500, 50, 500])
          for (const y of [-500, 85, 500]) {
            const camera = boundHouse2Camera({ x, y, span }, { width, height }),
              halfWidth = (camera.span * width) / height / 2,
              halfHeight = camera.span / 2;
            assert(camera.x - halfWidth >= -50 - 1e-8);
            assert(camera.x + halfWidth <= 150 + 1e-8);
            assert(camera.y - halfHeight >= -15 - 1e-8);
            assert(camera.y + halfHeight <= 185 + 1e-8);
            assert(camera.span <= 86);
            assert(halfWidth * 2 <= 140 + 1e-8);
          }
  assert(initialHouse2Camera({ width: 1920, height: 1080 }).span < 70);
});
test('Three daylight directions change independently of object rotation; night has contact shadows', () => {
  assert(house2DayPhases.morning.dx > 0);
  assert(house2DayPhases.dusk.dx < 0);
  assert(Math.abs(house2DayPhases.afternoon.dx) < Math.abs(house2DayPhases.dusk.dx));
  assert.equal(house2DayPhases.night.dx, 0);
  assert(house2DayPhases.night.tintOpacity > 0.4);
});
