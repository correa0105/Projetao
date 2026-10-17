import test from 'node:test';
import assert from 'node:assert/strict';
import { house2Houses, type House2Plot } from '../shared/house-v2';
import { house2HouseWorld, type House2Token } from '../shared/house2-tokens';
import { house2RoofOccluded } from '../src/house2-roof-visibility';

const plot: House2Plot = {
  id: 'home',
  neighborhood_id: 'village',
  number: 1,
  x: 10,
  y: 20,
  width: 18,
  height: 18,
  price: 1200,
  character_id: 'owner',
  owner_name: 'Owner',
  player_name: 'Owner',
  can_edit: true,
  house_id: house2Houses[0].id,
  house_x: 19,
  house_y: 29,
  house_rotation: 0,
  revision: 0,
  village_slot: 1,
};
function token(p: House2Plot, x: number, y: number, size = 1): House2Token {
  return {
    id: 'actor',
    source_id: 'hero',
    kind: 'character',
    name: 'Hero',
    character_id: 'hero',
    character_name: 'Hero',
    image_url: '/hero.png',
    top_down: true,
    rotation: 0,
    size,
    revision: 0,
    can_control: true,
    ...house2HouseWorld(p, { x, y }),
  };
}

test('all house models detect the body under the eaves and restore the roof when it leaves, at any rotation', () => {
  for (const spec of house2Houses)
    for (const angle of [0, 90, 180, 270, 37]) {
      const p = { ...plot, house_id: spec.id, house_rotation: angle },
        side = (spec.roofBounds.right - 0.5) * spec.width,
        bottom = (spec.roofBounds.bottom - 0.5) * spec.height;
      assert(house2RoofOccluded(p, [token(p, side + 0.1, 0)]), spec.id + ' side ' + angle);
      assert(house2RoofOccluded(p, [token(p, 0, bottom + 0.1)]), spec.id + ' front ' + angle);
      assert(!house2RoofOccluded(p, [token(p, side + 0.5, 0)]), spec.id + ' away ' + angle);
      assert(
        !house2RoofOccluded(p, [token(p, side + 0.2, bottom + 0.2)]),
        spec.id + ' diagonal ' + angle,
      );
      assert(
        house2RoofOccluded(p, [token(p, side + 0.2, bottom + 0.2, 2)]),
        spec.id + ' large token ' + angle,
      );
    }
});

test('only owned exterior characters and pets reveal eaves, without opening rooms or preview roofs', () => {
  const actor = token(plot, 3.6, 0);
  assert(house2RoofOccluded(plot, [actor]));
  assert(house2RoofOccluded(plot, [{ ...actor, kind: 'pet' }]));
  assert(!house2RoofOccluded(plot, [{ ...actor, can_control: false }]));
  assert(!house2RoofOccluded(plot, [token(plot, 0, 0)]));
  assert(!house2RoofOccluded({ ...plot, house_id: null }, [actor]));
  assert(!house2RoofOccluded(plot, []));
});
