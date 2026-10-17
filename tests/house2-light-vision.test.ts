import { test } from 'node:test';
import assert from 'node:assert/strict';
import { house2LightPolygon } from '../shared/house2-light-vision';
import { house2Floor, house2HouseWorld } from '../shared/house2-tokens';
import type { House2Plot } from '../shared/house-v2';
test('luz respeita paredes, porta aberta/fechada e rotação da casa', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const p = {
        id: 'test',
        house_id: 'house-empty-001',
        house_x: 30,
        house_y: 30,
        house_rotation: rotation,
        door_open: false,
      } as House2Plot,
      f = house2Floor(p)!,
      at = house2HouseWorld(p, { x: (f.doorStart + f.doorEnd) / 2, y: f.bottom - 1 }),
      vertices = (open: boolean) =>
        house2LightPolygon(at, 6, [{ ...p, door_open: open }])
          .slice(1, -1)
          .split('L')
          .map((v) => v.split(' ').map(Number));
    const reach = (open: boolean) =>
      Math.max(
        ...vertices(open).map(([x, y]) =>
          rotation === 0 ? y : rotation === 90 ? -x : rotation === 180 ? -y : x,
        ),
      );
    assert(
      reach(true) > reach(false) + 1,
      'A luz deve atravessar somente a abertura real da porta.',
    );
  }
});
