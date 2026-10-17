import { house2Houses, type House2Plot } from '../shared/house-v2';
import { house2Contains, house2Local, type House2Token } from '../shared/house2-tokens';
import { pointBoxDistance } from '../shared/vtt-collision';

/** Check the real roof footprint in house coordinates, including rotated houses. */
export function house2RoofOccluded(plot: House2Plot, actors: House2Token[]) {
  const spec = house2Houses.find((h) => h.id === plot.house_id);
  if (!spec) return false;
  const b = spec.roofBounds;
  const box = {
    left: (b.left - 0.5) * spec.width,
    right: (b.right - 0.5) * spec.width,
    top: (b.top - 0.5) * spec.height,
    bottom: (b.bottom - 0.5) * spec.height,
  };
  return actors.some(
    (actor) =>
      actor.can_control &&
      !house2Contains(plot, actor) &&
      pointBoxDistance(house2Local(plot, actor), box) <= actor.size * 0.22,
  );
}
