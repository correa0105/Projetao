import { professionWork } from '../shared/profession-production';
export type WorkPoint = { x: number; y: number };
// Coordinates in the 960 × 640 artwork; rendering and hit testing share the same shape.
export function professionSurface(id: string) {
  const surfaces: Record<string, number[]> = {
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
  const custom: Record<string, number[]> = {
    luthiery: [500, 275, 285, 32],
    games: [490, 265, 155, 95],
    weaving: [440, 310, 180, 65],
    cobbling: [440, 380, 235, 26],
    disguise: [480, 325, 170, 65],
    brewing: [478, 238, 208, 52],
    tinkering: [680, 195, 45, 28],
    'thieves-tools': [775, 255, 50, 40],
    glassblowing: [775, 238, 48, 35],
  };
  const bench = professionWork(id).bench,
    [x, y, rx, ry] = custom[id] ?? surfaces[bench];
  return {
    x,
    y,
    rx,
    ry,
    angle: id === 'cobbling' ? -9 : 0,
    liquid: bench === 'mixture' || bench === 'cooking',
    holes:
      id === 'disguise'
        ? [
            { x: 395, y: 285, rx: 48, ry: 20 },
            { x: 560, y: 285, rx: 48, ry: 20 },
            { x: 480, y: 380, rx: 45, ry: 28 },
          ]
        : [],
  };
}
function surfaceRadius(p: WorkPoint, s: ReturnType<typeof professionSurface>) {
  const a = (-s.angle * Math.PI) / 180,
    dx = p.x - s.x,
    dy = p.y - s.y;
  return Math.hypot(
    (dx * Math.cos(a) - dy * Math.sin(a)) / s.rx,
    (dx * Math.sin(a) + dy * Math.cos(a)) / s.ry,
  );
}
export function insideSurface(p: WorkPoint, s: ReturnType<typeof professionSurface>) {
  return (
    surfaceRadius(p, s) <= 1 &&
    !s.holes.some((h) => ((p.x - h.x) / h.rx) ** 2 + ((p.y - h.y) / h.ry) ** 2 <= 1)
  );
}
export function projectOnSurface(p: WorkPoint, s: ReturnType<typeof professionSurface>) {
  const r = surfaceRadius(p, s);
  let point =
    r <= 0.92 ? p : { x: s.x + ((p.x - s.x) * 0.92) / r, y: s.y + ((p.y - s.y) * 0.92) / r };
  if (!insideSurface(point, s)) {
    const candidates = s.holes
      .flatMap((h) => [
        { x: h.x - h.rx - 2, y: point.y },
        { x: h.x + h.rx + 2, y: point.y },
        { x: point.x, y: h.y - h.ry - 2 },
        { x: point.x, y: h.y + h.ry + 2 },
      ])
      .filter((p) => insideSurface(p, s));
    candidates.sort(
      (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
    );
    point = candidates[0] ?? { x: s.x, y: s.y };
  }
  return point;
}
export function professionView(id: string): [number, number, number, number] {
  if (id === 'jewelry') return [100, -40, 560, 374];
  if (['tinkering', 'thieves-tools', 'glassblowing'].includes(id)) return [400, 30, 560, 374];
  if (['alchemy', 'herbalism', 'poison', 'cooking'].includes(id)) return [160, 45, 680, 453];
  return [80, 15, 800, 533];
}
