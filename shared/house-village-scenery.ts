import trees from './vtt-tree-catalog.json';
import rocks from './vtt-rock-catalog.json';
import plants from './vtt-plants-catalog.json';
import { house2DoorPoint, house2HousePlacement, type House2Plot } from './house-v2';
import { house2DefaultGrassImage, referenceGrassTextures } from './reference-grass';
import { nearestVillageLane, villageLaneSamples, villageWell } from './house-village-paths';

export const villageTextures = {
  grass: house2DefaultGrassImage,
  earth: '/vtt/terrain-expansion-20261015/packed-earth.webp',
  water: '/vtt/terrain-water-20261013/water.webp',
  stone: '/vtt/terrain-v3-20261013/stone.webp',
};
export const villageGrassVariants = [
  house2DefaultGrassImage,
  referenceGrassTextures[2].image,
  referenceGrassTextures[1].image,
];
export const villageRiver =
  'M 140 -25 C 124 5 145 20 133 48 C 125 66 141 81 132 104 C 120 130 140 151 127 190';
export const villageLanePoints = [
  [50, 180],
  [47, 160],
  [48, 143],
  [45, 127],
  [44, 118],
  [40, 105],
  [32, 92],
  [27, 80],
  [25, 69],
  [27, 60],
  [35, 54],
  [45, 55],
  [52, 57],
  [60, 61],
  [70, 67],
  [80, 73],
  [89, 78],
  [97, 81],
  [104, 90],
  [105, 100],
  [105, 110],
  [110, 132],
  [32, 99],
  [45, 100],
  [57, 110],
  [65, 112],
  [80, 114],
  [95, 113],
  [107, 106],
];
export const villageTreeStyleIds = ['oak-young', 'spruce', 'birch'] as const;
const crowns = trees.filter((t) => villageTreeStyleIds.some((id) => id === t.id));
const stones = rocks.slice(0, 4);
const shrubs = plants.filter((t) =>
  ['plant-001', 'plant-010', 'plant-011', 'plant-009'].includes(t.id),
);
const noise = (i: number, salt = 0) => {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
// Irregular overlapping areas replace a visible matrix of repeated grass tiles.
export const villageGrassPatches = Array.from({ length: 110 }, (_, i) => {
  const x = -55 + (i % 11) * 20 + (noise(i, 12) - 0.5) * 17,
    y = -22 + Math.floor(i / 11) * 22 + (noise(i, 13) - 0.5) * 17;
  const rx = 15 + noise(i, 14) * 12,
    ry = 12 + noise(i, 15) * 12;
  return {
    id: i,
    variant: Math.floor(noise(i, 16) * 3),
    x,
    y,
    rx,
    ry,
    rotation: noise(i, 17) * 180,
  };
});
type SceneryPlot = Pick<House2Plot, 'x' | 'y' | 'width' | 'height'> &
  Partial<Pick<House2Plot, 'village_slot' | 'house_id' | 'house_x' | 'house_y' | 'house_rotation'>>;
function accessSamples(point: { x: number; y: number }, door = point) {
  const start = nearestVillageLane(point),
    control = { x: (start.x + point.x) / 2 + 0.3, y: (start.y + point.y) / 2 - 0.5 };
  return Array.from({ length: 41 }, (_, i) => {
    const t = i / 40,
      s = 1 - t;
    return {
      x: s * s * start.x + 2 * s * t * control.x + t * t * point.x,
      y: s * s * start.y + 2 * s * t * control.y + t * t * point.y,
    };
  }).concat(
    Array.from({ length: 13 }, (_, i) => ({
      x: point.x + ((door.x - point.x) * i) / 12,
      y: point.y + ((door.y - point.y) * i) / 12,
    })),
  );
}
export function villageScenery(plots: SceneryPlot[]) {
  const clearPaths = [
    ...villageLaneSamples,
    ...accessSamples(villageWell),
    ...plots.flatMap((p, i) => {
      const placement =
        p.house_id && p.house_x != null && p.house_y != null
          ? { x: p.house_x, y: p.house_y, rotation: p.house_rotation ?? 0 }
          : house2HousePlacement({ ...p, village_slot: p.village_slot ?? (i % 12) + 1 });
      const door = house2DoorPoint(placement.x, placement.y, placement.rotation),
        angle = (placement.rotation * Math.PI) / 180;
      return accessSamples(
        { x: door.x - Math.sin(angle) * 3, y: door.y + Math.cos(angle) * 3 },
        door,
      );
    }),
  ];
  const pieces: {
    id: number;
    x: number;
    y: number;
    size: number;
    rotation: number;
    image: string;
    kind: 'tree' | 'rock' | 'plant';
    zone: 'woodland' | 'field';
  }[] = [];
  for (let row = 0; row < 29; row++)
    for (let col = 0; col < 29; col++) {
      const id = row * 29 + col,
        x = -46 + col * 6.8 + (noise(id) - 0.5) * 5,
        y = -11 + row * 6.8 + (noise(id, 1) - 0.5) * 5;
      const woodland =
        x < -5 + Math.sin(y * 0.045) * 10 || y < 20 || y > 150 + Math.sin(x * 0.06) * 7 || x > 114;
      const tree = noise(id, 2) > (woodland ? 0.24 : 0.36);
      // Scatter only trees in the inhabited field; rocks and ornamental plants stay at the edges.
      if (!woodland && !tree) continue;
      if (!tree && x >= -5 && x <= 114 && y >= 20 && y <= 158) continue;
      const rock = !tree && noise(id, 3) > 0.68;
      if (rock && noise(id, 3) <= 0.96) continue;
      const source = tree ? crowns : rock ? stones : shrubs;
      const asset = source[Math.floor(noise(id, 4) * source.length)];
      const size = tree
        ? woodland
          ? 6 + noise(id, 5) * 3.5
          : 5 + noise(id, 5) * 3
        : rock
          ? 2 + noise(id, 5) * 2
          : 1.6 + noise(id, 5) * 1.8;
      // Common scenery never covers purchased land, previews, doors or shared lanes.
      if (
        plots.some(
          (p) =>
            x + size / 2 > p.x - 5 &&
            x - size / 2 < p.x + p.width + 5 &&
            y + size / 2 > p.y - 5 &&
            y - size / 2 < p.y + p.height + 5,
        )
      )
        continue;
      if (clearPaths.some((p) => Math.hypot(p.x - x, p.y - y) < size / 2 + 4)) continue;
      if (Math.hypot(villageWell.x - x, villageWell.y - y) < size / 2 + 4) continue;
      if (
        !woodland &&
        pieces.some(
          (p) => p.kind === 'tree' && Math.hypot(p.x - x, p.y - y) < (p.size + size) / 2 + 3,
        )
      )
        continue;
      if (x > 126 && x < 141) continue;
      pieces.push({
        id,
        x,
        y,
        size,
        rotation: Math.floor(noise(id, 6) * 360),
        image: asset.image,
        kind: tree ? 'tree' : rock ? 'rock' : 'plant',
        zone: woodland ? 'woodland' : 'field',
      });
    }
  return pieces;
}
