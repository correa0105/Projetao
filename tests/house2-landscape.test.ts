import test from 'node:test';
import assert from 'node:assert/strict';
import { villageScenery, villageTextures } from '../shared/house-village-scenery';
import {
  villageLanes,
  nearestVillageLane,
  villageConnection,
  villageWell,
} from '../shared/house-village-paths';
import {
  house2VillagePlots,
  house2HousePlacement,
  house2DoorPoint,
  house2GroundStrokeSchema,
} from '../shared/house-v2';
import { referenceGrassTextures, house2DefaultGrassImage } from '../shared/reference-grass';
import { isGrassTexture } from '../shared/vtt-terrain';

test('clearing and five-unit home buffers have no automatic plants or rocks, with only a few edge rocks', () => {
  const plots = house2VillagePlots.map((p, i) => ({
    ...p,
    width: 11,
    height: 11,
    village_slot: i + 1,
  }));
  const scenery = villageScenery(plots);
  assert(scenery.filter((s) => s.kind === 'rock').length <= 8);
  for (const s of scenery) {
    if (s.kind !== 'tree')
      assert(s.x < -5 || s.x > 114 || s.y < 20 || s.y > 158, `${s.kind} in inhabited clearing`);
    for (const p of plots)
      assert(
        s.x + s.size / 2 <= p.x - 5 ||
          s.x - s.size / 2 >= p.x + p.width + 5 ||
          s.y + s.size / 2 <= p.y - 5 ||
          s.y - s.size / 2 >= p.y + p.height + 5,
        `${s.kind} near home`,
      );
  }
});

test('every branch joins a real lane and all twelve home paths and the well connect to its centerline', () => {
  for (const lane of villageLanes.slice(1))
    assert(
      Math.hypot(
        lane.start.x - nearestVillageLane(lane.start).x,
        lane.start.y - nearestVillageLane(lane.start).y,
      ) < 0.02,
    );
  const points = house2VillagePlots.map((p, i) => {
    const house = house2HousePlacement({ ...p, width: 11, height: 11, village_slot: i + 1 });
    return house2DoorPoint(house.x, house.y, house.rotation);
  });
  for (const point of [...points, villageWell]) {
    const path = villageConnection(point),
      match = /^M ([\d.e+-]+) ([\d.e+-]+)/.exec(path)!;
    const start = { x: +match[1], y: +match[2] },
      nearest = nearestVillageLane(start);
    assert(Math.hypot(start.x - nearest.x, start.y - nearest.y) < 0.02);
    assert(path.endsWith(`${point.x} ${point.y}`));
  }
});

test('all four grasses are accepted by both editors and the sparse reference is the village default', () => {
  assert.equal(villageTextures.grass, house2DefaultGrassImage);
  for (const t of referenceGrassTextures) {
    assert(isGrassTexture(t.id));
    assert(
      house2GroundStrokeSchema.safeParse({ material: t.id, width: 1, points: [{ x: 10, y: 10 }] })
        .success,
    );
  }
});
