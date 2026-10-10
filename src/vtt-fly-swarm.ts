import type { EffectFootprint } from './vtt-effect-footprint';
import { projectOverheadEffect } from './vtt-effect-projection';
import { alpha, tau, tint } from './vtt-effects-primitives';

// Independent, intersecting paths avoid a circular procession. The two lobes
// are translucent insect wings; the small segmented body stays easy to read.
export function flyPosition(
  f: EffectFootprint,
  t: number,
  i: number,
  random: (i: number) => number,
) {
  const seed = random(i + 3101) * tau;
  const speed = 0.9 + random(i + 3109) * 1.5;
  const angle = seed + Math.sin(t * speed + seed) * 1.8 + Math.cos(t * speed * 0.63 + i) * 1.1;
  const radius = 0.32 + random(i + 3119) * 0.8 + Math.sin(t * speed * 1.4 + i * 2.1) * 0.2;
  const height = 0.2 + (0.5 + Math.sin(t * speed * 0.75 + seed) * 0.5) * 0.75;
  const p = projectOverheadEffect(f.plane, radius, angle, height);
  return { ...p, height };
}
export function drawFlySwarm(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  t: number,
  random: (i: number) => number,
  front: boolean,
  detail: number,
  color: string,
) {
  const total = Math.round(64 * detail);
  for (let i = 0; i < total; i++) {
    const p = flyPosition(f, t, i, random);
    if (p.height > 0.52 !== front) continue;
    const next = flyPosition(f, t + 0.02, i, random);
    const size = (0.8 + random(i + 3127) * 0.6) * p.perspective;
    const flap = 0.35 + Math.abs(Math.sin(t * (75 + random(i + 3137) * 60) + i)) * 0.65;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(next.y - p.y, next.x - p.x) + Math.PI / 2);
    c.globalAlpha *= front ? 0.92 : 0.65;
    c.fillStyle = alpha(tint(color, 0.55, '#dbe3df'), 0.5);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(
        side * size * 0.95 * flap,
        -size * 0.2,
        size * 0.85 * flap,
        size * 1.1,
        side * 0.6,
        0,
        tau,
      );
      c.fill();
    }
    c.fillStyle = '#302a24';
    c.strokeStyle = '#c5b7a366';
    c.lineWidth = 0.25;
    c.beginPath();
    c.ellipse(0, size * 0.45, size * 0.48, size * 0.9, 0, 0, tau);
    c.fill();
    c.stroke();
    c.fillStyle = '#73775e';
    c.beginPath();
    c.ellipse(0, -size * 0.4, size * 0.5, size * 0.55, 0, 0, tau);
    c.fill();
    c.fillStyle = '#251f1b';
    c.beginPath();
    c.arc(0, -size * 0.9, size * 0.35, 0, tau);
    c.fill();
    c.restore();
  }
}
