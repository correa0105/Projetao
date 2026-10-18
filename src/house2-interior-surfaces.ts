import type { house2Houses } from '../shared/house-v2';

// World units keep the boards proportional to furniture in houses of every size.
export const house2WoodFloorTileSizes: Readonly<Record<string, number>> = {
  'floor-wood': 3.6,
  'floor-dark': 3.6,
  'floor-pine-planks': 3.6,
  'floor-cedar-planks': 4,
  'floor-ash-white': 4,
  'floor-parquet-oak': 5.4,
  'floor-walnut-weave': 5.4,
  'floor-endgrain': 5.4,
};

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
