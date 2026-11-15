import { professionWork } from '../shared/profession-production';
// Coordinates in the actual 960 × 640 artwork: hit testing and effects use the same surface.
export type WorkPoint = { x: number; y: number };
export function professionSurface(id: string) {
  const bench = professionWork(id).bench;
  const surfaces = {
    forge: [510, 181, 190, 13],
    mixture: [514, 279, 132, 31],
    writing: [510, 285, 185, 83],
    wood: [430, 205, 138, 65],
    textile: [430, 300, 112, 95],
    precision: [300, 125, 25, 30],
    stone: [455, 245, 150, 105],
    kiln: [490, 273, 95, 59],
    cooking: [510, 201, 133, 43],
  };
  const [x, y, rx, ry] =
    id === 'brewing'
      ? [478, 238, 208, 52]
      : ['weaving', 'disguise'].includes(id)
        ? [620, 300, 75, 100]
        : ['tinkering', 'thieves-tools'].includes(id)
          ? [704, 275, 75, 58]
          : id === 'glassblowing'
            ? [775, 238, 48, 35]
            : surfaces[bench];
  return { x, y, rx, ry, liquid: bench === 'mixture' || bench === 'cooking' };
}
export function insideSurface(p: WorkPoint, s: ReturnType<typeof professionSurface>) {
  return ((p.x - s.x) / s.rx) ** 2 + ((p.y - s.y) / s.ry) ** 2 <= 1;
}
