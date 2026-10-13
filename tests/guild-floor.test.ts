import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guildFloorScale,
  guildFloorDragPosition,
  guildFurnitureWidth,
} from '../shared/guild-floor';
import { houseFloorScale, houseViewWidth } from '../shared/house-perspective';
import { guildRooms, guildDecor } from '../shared/guilds';
test('todas as salas reduzem a peça ao fundo, com escala de referência na frente', () => {
  for (const room of guildRooms) {
    assert.equal(guildFloorScale(0.84, room.id), 1);
    assert(guildFloorScale(0.55, room.id) < guildFloorScale(0.7, room.id));
    assert(guildFloorScale(0.7, room.id) < guildFloorScale(0.84, room.id));
    assert(guildFloorScale(0.98, room.id) > 1);
  }
  assert.equal(guildFloorScale(0.72, 'library'), houseFloorScale(0.72, 'hall-library'));
  for (const catalog of guildDecor)
    assert.equal(
      guildFurnitureWidth({
        catalog: catalog.id,
        room: 'main',
        facing: 0,
        scale: catalog.default_scale,
        y: 0.84,
      }),
      catalog.default_scale * houseViewWidth(catalog.id, 0),
    );
});
test('arrastar pela parte alta mantém o ponto sob o cursor quando a escala muda', () => {
  const bounds = { width: 1100, height: 620 },
    grab = { x: -70, y: -190 };
  for (const room of guildRooms)
    for (const y of [0.2, 0.55, 0.65, 0.8, 0.94]) {
      const x = 0.5,
        k = guildFloorScale(y, room.id),
        cursor = { x: x * bounds.width + grab.x * k, y: y * bounds.height + grab.y * k };
      const p = guildFloorDragPosition(cursor, grab, bounds, 0.84, room.id);
      assert(Math.abs(p.x - x) < 1e-8, room.id);
      assert(Math.abs(p.y - y) < 1e-8, room.id);
    }
});
