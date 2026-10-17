export type VillagePoint = { x: number; y: number };
type Curve = readonly [number, number, number, number, number, number];
type Lane = { start: VillagePoint; curves: Curve[] };
const main: Lane = {
  start: { x: 50, y: 185 },
  curves: [
    [46, 162, 49, 142, 44, 118],
    [40, 101, 26, 88, 25, 69],
    [23, 58, 34, 52, 52, 57],
    [70, 61, 80, 73, 97, 81],
    [109, 92, 102, 110, 110, 132],
    [113, 140, 116, 147, 119, 155],
  ],
};
function sample(lane: Lane) {
  let a = lane.start;
  const points = [a];
  for (const c of lane.curves) {
    for (let n = 1; n <= 100; n++) {
      const t = n / 100,
        s = 1 - t;
      points.push({
        x: s ** 3 * a.x + 3 * s * s * t * c[0] + 3 * s * t * t * c[2] + t ** 3 * c[4],
        y: s ** 3 * a.y + 3 * s * s * t * c[1] + 3 * s * t * t * c[3] + t ** 3 * c[5],
      });
    }
    a = { x: c[4], y: c[5] };
  }
  return points;
}
function closest(point: VillagePoint, lanes: Lane[]) {
  let best = { x: 0, y: 0 },
    distance = Infinity;
  for (const lane of lanes) {
    const points = sample(lane);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      const p = { x: a.x + t * dx, y: a.y + t * dy },
        d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < distance) {
        distance = d;
        best = p;
      }
    }
  }
  return best;
}
const crossStart = closest({ x: 32, y: 99 }, [main]),
  crossEnd = closest({ x: 107, y: 106 }, [main]);
export const villageLanes: Lane[] = [
  main,
  {
    start: crossStart,
    curves: [
      [46, 99, 50, 109, 65, 112],
      [81, 114, 95, 114, crossEnd.x, crossEnd.y],
    ],
  },
  { start: { x: 44, y: 118 }, curves: [[61, 114, 67, 117, 71, 128]] },
  { start: { x: 52, y: 57 }, curves: [[57, 67, 62, 67, 65, 77]] },
];
export const villageLanePaths = villageLanes.map(
  (lane) =>
    `M ${lane.start.x} ${lane.start.y} ` + lane.curves.map((c) => 'C ' + c.join(' ')).join(' '),
);
export const nearestVillageLane = (point: VillagePoint) => closest(point, villageLanes);
export const villageLaneSamples = villageLanes.flatMap(sample);
export const villageWell = { x: 60, y: 78 };
export function villageConnection(point: VillagePoint) {
  const start = nearestVillageLane(point);
  return `M ${start.x} ${start.y} Q ${(start.x + point.x) / 2 + 0.3} ${(start.y + point.y) / 2 - 0.5} ${point.x} ${point.y}`;
}
