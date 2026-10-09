import type { TokenEffect } from '../shared/vtt-effects';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
import { temporalField } from './vtt-effects-temporal';
type Point = { x: number; y: number };
type Random = (i: number) => number;
const polar = (r: number, a: number): Point => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
export const rebuiltLightningKinds = new Set([
  'thunderstorm',
  'electric-cage',
  'ball-lightning',
  'storm-vortex',
  'static-corona',
]);

// Multiscale dielectric breakdown, with narrow hot channels, tapered forks and
// uneven segment brightness. A discharge's topology stays fixed while it dies.
function channel(a: Point, b: Point, random: Random, seed: number, roughness: number): Point[] {
  let points = [a, b];
  for (let level = 0; level < 5; level++) {
    const next: Point[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i],
        q = points[i + 1],
        dx = q.x - p.x,
        dy = q.y - p.y,
        len = Math.hypot(dx, dy) || 1;
      const offset = (random(seed + level * 73 + i * 11) - 0.5) * len * roughness;
      next.push(
        { x: (p.x + q.x) / 2 - (dy / len) * offset, y: (p.y + q.y) / 2 + (dx / len) * offset },
        q,
      );
    }
    points = next;
  }
  return points;
}
function strokeChannel(
  c: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  power: number,
  width: number,
) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.strokeStyle = alpha(color, power * 0.1);
  c.lineWidth = width * 7;
  c.stroke();
  c.strokeStyle = alpha(tint(color, 0.24), power * 0.5);
  c.lineWidth = width * 2.4;
  c.stroke();
  // Vary the core itself; a single uniformly jagged white contour looks drawn.
  for (let i = 1; i < points.length; i++) {
    c.beginPath();
    c.moveTo(points[i - 1].x, points[i - 1].y);
    c.lineTo(points[i].x, points[i].y);
    c.strokeStyle = alpha('#eff9ff', power * (0.7 + 0.3 * Math.sin(i * 2.3) ** 2));
    c.lineWidth = width * (0.4 + 0.28 * Math.sin(i * 1.7) ** 2);
    c.stroke();
  }
}
function flash(
  c: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  t: number,
  random: Random,
  seed: number,
  color: string,
  width = 1.25,
) {
  const phase = t * 2.8 + random(seed) * 2,
    tick = Math.floor(phase),
    age = fract(phase);
  const power = age < 0.08 ? age / 0.08 : Math.exp(-(age - 0.08) * 7);
  const path = channel(a, b, random, seed + tick * 131, 0.65);
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  strokeChannel(c, path, color, power, width);
  for (let i = 5; i < path.length - 3; i += 7) {
    const p = path[i],
      end = path[Math.min(i + 8, path.length - 1)];
    const sign = random(seed + i + tick * 19) > 0.5 ? 1 : -1,
      dx = end.x - p.x,
      dy = end.y - p.y;
    const q = { x: p.x + dx * 0.5 - dy * sign * 0.9, y: p.y + dy * 0.5 + dx * sign * 0.9 };
    strokeChannel(
      c,
      channel(p, q, random, seed + tick * 177 + i, 0.75),
      color,
      power * 0.65,
      width * 0.53,
    );
  }
  c.restore();
}
export function drawRebuiltLightning(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  t: number,
  random: Random,
  front: boolean,
) {
  const kind = e.kind,
    color = e.color;
  if (!front) {
    glow(c, 0, 0, 117, color, 0.1);
    if (kind === 'thunderstorm' || kind === 'storm-vortex') {
      temporalField(
        c,
        kind === 'storm-vortex' ? 'vortex' : 'vapour',
        t * 0.43,
        0,
        0,
        267,
        267,
        kind === 'storm-vortex' ? -t * 0.26 : 0,
        0.75,
        '#1c2638',
      );
    }
  }
  if (kind === 'ball-lightning') {
    for (let i = 0; i < 4; i++) {
      const a = t * (0.37 + i * 0.037) + (i * tau) / 4,
        p = polar(92, a);
      if (p.y > 0 !== front) continue;
      glow(c, p.x, p.y, 23, color, 0.35);
      glow(c, p.x, p.y, 9, tint(color, 0.72), 0.8);
      temporalField(c, 'vapour', t * 1.2 + i * 0.29, p.x, p.y, 35, 35, t * 0.5 + i, 0.66, color);
      for (let k = 0; k < 5; k++) {
        const q = polar(17 + (k % 2) * 9, (k * tau) / 5 + t * 0.36);
        flash(
          c,
          { x: p.x + q.x * 0.13, y: p.y + q.y * 0.13 },
          { x: p.x + q.x, y: p.y + q.y },
          t * 1.35,
          random,
          i * 67 + k * 17,
          color,
          0.8,
        );
      }
      glow(c, p.x, p.y, 3.8, '#f1fbff', 0.95);
      if (i % 2 === 0) {
        const q = polar(92, a + 0.83);
        flash(c, p, q, t * 0.74, random, i + 611, color, 0.9);
      }
    }
    return;
  }
  const count =
    kind === 'static-corona' ? 13 : kind === 'thunderstorm' ? 5 : kind === 'electric-cage' ? 7 : 6;
  for (let i = 0; i < count; i++) {
    let a = (i * tau) / count + (kind === 'storm-vortex' ? t * 0.35 : 0);
    const tick = Math.floor(t * 1.2 + random(i + 41));
    a += (random(i + tick * 13) - 0.5) * 0.23;
    let p = polar(kind === 'static-corona' ? 80 : 101, a),
      q: Point;
    if (kind === 'static-corona')
      q = polar(111 + random(i + 55) * 13, a + (random(i + 9) - 0.5) * 0.37);
    else if (kind === 'thunderstorm') {
      p = polar(123, a);
      q = polar(43 + random(i + tick * 37) * 25, a + 0.21);
    } else if (kind === 'electric-cage') q = polar(77, a + (tau / count) * 0.76);
    else q = polar(68, a + 0.72);
    if (p.y + q.y > 0 !== front) continue;
    flash(
      c,
      p,
      q,
      t * (kind === 'thunderstorm' ? 0.63 : 1),
      random,
      i * 97 + 123,
      color,
      kind === 'thunderstorm' ? 1.8 : 1.2,
    );
    if (front) glow(c, q.x, q.y, 6, color, 0.08 + 0.13 * Math.sin(t * 4 + i) ** 2);
  }
}
