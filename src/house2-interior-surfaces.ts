import type { house2Houses } from '../shared/house-v2';

/** The art's inside edge is slightly inward from the collision centerline. */
export function house2InteriorSurfaces(
  house: (typeof house2Houses)[number],
  width: number,
  height: number,
) {
  const f = house.footprint;
  return {
    left: (f.left + 0.014 - 0.5) * width,
    right: (f.right - 0.014 - 0.5) * width,
    top: (f.top + 0.022 - 0.5) * height,
    bottom: (f.bottom - 0.022 - 0.5) * height,
  };
}
