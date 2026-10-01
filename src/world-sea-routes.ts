import { WORLD_ISLETS } from './world-offshore';

export type SeaPoint = { x: number; y: number };
const WIDTH = 36,
  HEIGHT = 20.25,
  COLS = 120,
  ROWS = 72;
/** Distance-to-coast field: every waypoint is navigable water with hull clearance. */
export function createSeaRoutes(sampleHeight: (u: number, v: number) => number) {
  const point = (i: number): SeaPoint => ({
    x: (((i % COLS) + 0.5) / COLS) * WIDTH - WIDTH / 2,
    y: HEIGHT / 2 - ((Math.floor(i / COLS) + 0.5) / ROWS) * HEIGHT,
  });
  const water = (x: number, y: number) =>
    sampleHeight(x / WIDTH + 0.5, 0.5 - y / HEIGHT) < -0.045 &&
    !WORLD_ISLETS.some(([cx, cy, r]) => Math.hypot(x - cx, (y - cy) / 0.8) < r * 1.18 + 0.25);
  const safe = (p: SeaPoint) =>
    water(p.x, p.y) &&
    [
      [0.22, 0],
      [-0.22, 0],
      [0, 0.22],
      [0, -0.22],
      [0.16, 0.16],
      [-0.16, -0.16],
      [0.16, -0.16],
      [-0.16, 0.16],
    ].every(([dx, dy]) => water(p.x + dx, p.y + dy));
  const count = COLS * ROWS,
    valid = new Uint8Array(count),
    distance = new Int32Array(count).fill(-1),
    next = new Int32Array(count).fill(-1);
  const neighbors = (i: number) =>
    [
      i % COLS > 0 ? i - 1 : -1,
      i % COLS < COLS - 1 ? i + 1 : -1,
      i >= COLS ? i - COLS : -1,
      i < count - COLS ? i + COLS : -1,
    ].filter((n) => n >= 0);
  for (let i = 0; i < count; i++) valid[i] = Number(safe(point(i)));
  const queue: number[] = [];
  for (let i = 0; i < count; i++)
    if (valid[i] && neighbors(i).some((n) => !valid[n] && !water(point(n).x, point(n).y))) {
      distance[i] = 0;
      queue.push(i);
    }
  for (let q = 0; q < queue.length; q++)
    for (const n of neighbors(queue[q]))
      if (valid[n] && distance[n] < 0) {
        distance[n] = distance[queue[q]] + 1;
        next[n] = queue[q];
        queue.push(n);
      }
  const starts = queue.filter((i) => distance[i] >= 10 && distance[i] < 55);
  function clear(a: SeaPoint, b: SeaPoint) {
    const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 0.08);
    for (let s = 0; s <= steps; s++)
      if (
        !safe({
          x: a.x + ((b.x - a.x) * s) / Math.max(1, steps),
          y: a.y + ((b.y - a.y) * s) / Math.max(1, steps),
        })
      )
        return false;
    return true;
  }
  return {
    safe,
    route(seed: number, preferred?: SeaPoint, avoid: SeaPoint[] = []): SeaPoint[] {
      if (!starts.length) return [];
      const spaced = starts.filter((i) =>
        avoid.every((p) => Math.hypot(point(i).x - p.x, point(i).y - p.y) > 1.5),
      );
      const pool = spaced.length ? spaced : starts;
      let i = preferred
        ? pool.reduce(
            (best, candidate) =>
              Math.hypot(point(candidate).x - preferred.x, point(candidate).y - preferred.y) <
              Math.hypot(point(best).x - preferred.x, point(best).y - preferred.y)
                ? candidate
                : best,
            pool[0],
          )
        : pool[((seed * 15485863) >>> 0) % pool.length];
      const path: SeaPoint[] = [];
      while (i >= 0) {
        path.push(point(i));
        i = next[i];
      }
      const smooth: SeaPoint[] = [];
      for (let p = 0; p < path.length - 1;) {
        smooth.push(path[p]);
        let end = path.length - 1;
        while (end > p + 1 && !clear(path[p], path[end])) end--;
        p = end;
      }
      if (path.length) smooth.push(path[path.length - 1]);
      return smooth;
    },
  };
}
