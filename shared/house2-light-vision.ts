import type { House2Plot } from './house-v2';
import { house2HouseWorld, house2WallBoxes } from './house2-tokens';
type Point = { x: number; y: number };
/** Rays stop at the same walls and door leaf that block token movement. */
export function house2LightPolygon(at: Point, radius: number, plots: House2Plot[]) {
  const lines = plots
    .filter((p) => p.house_id && Math.hypot(p.house_x! - at.x, p.house_y! - at.y) < radius + 12)
    .flatMap((p) =>
      house2WallBoxes(p).flatMap((b) => {
        const v = [
          { x: b.left, y: b.top },
          { x: b.right, y: b.top },
          { x: b.right, y: b.bottom },
          { x: b.left, y: b.bottom },
        ].map((q) => house2HouseWorld(p, q));
        return v.map((a, i) => ({ a, b: v[(i + 1) % 4] }));
      }),
    );
  const angles = Array.from({ length: 96 }, (_, i) => (i * Math.PI * 2) / 96);
  for (const l of lines)
    for (const p of [l.a, l.b]) {
      const a = Math.atan2(p.y - at.y, p.x - at.x);
      angles.push(a - 0.0001, a, a + 0.0001);
    }
  const points = angles
    .sort((a, b) => a - b)
    .map((angle) => {
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      let distance = radius;
      for (const { a, b } of lines) {
        const sx = b.x - a.x,
          sy = b.y - a.y,
          den = dx * sy - dy * sx;
        if (Math.abs(den) < 1e-10) continue;
        const ax = a.x - at.x,
          ay = a.y - at.y,
          t = (ax * sy - ay * sx) / den,
          u = (ax * dy - ay * dx) / den;
        if (t >= 0 && t < distance && u >= 0 && u <= 1) distance = t;
      }
      return { x: at.x + dx * distance, y: at.y + dy * distance };
    });
  return 'M' + points.map((p) => `${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join('L') + 'Z';
}
