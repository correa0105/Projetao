import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { projectOverheadEffect } from './vtt-effect-projection';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
import { materialSprite } from './vtt-effects-materials';

export const fireHeatKinds = new Set<string>([
  'fire',
  'explosion',
  'rage',
  'embers',
  'lava',
  'inferno',
  'blue-fire',
  'soul-flames',
  'ember-comet',
  'fire-surge',
  'fire-geyser',
  'fire-spiral',
]);

export function drawFireHeat(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: (i: number) => number,
  pass: 'behind' | 'front',
  detail: number,
) {
  if (!fireHeatKinds.has(e.kind)) return;
  const intense = e.kind === 'lava' || e.kind === 'inferno' || e.kind === 'fire-geyser';
  const density = 0.45 + (e.intensity ?? 0.85) * 0.55;
  c.save();
  c.globalAlpha *= density;
  if (pass === 'behind') {
    // Rising vapor approaches a nadir camera: expanding and drifting across
    // the plane rather than climbing vertically toward the top of the screen.
    for (let i = 0; i < Math.max(3, Math.round(7 * detail)); i++) {
      const age = fract(t * 0.27 + random(i + 1703));
      const angle = random(i + 1801) * tau + Math.sin(age * 4 + i) * 0.16;
      const p = projectOverheadEffect(f.plane, 0.62 + age * 0.65, angle, age * 0.88);
      const envelope = Math.sin(age * Math.PI) ** 1.4;
      const size = (22 + age * 45) * p.perspective;
      c.save();
      c.scale(f.plane.rx / 70, f.plane.ry / 70);
      materialSprite(
        c,
        tint(e.color, 0.72, '#c4bfbb'),
        'vapor',
        (p.x * 70) / f.plane.rx,
        (p.y * 70) / f.plane.ry,
        size,
        angle + age * 0.8,
        t * 0.18 + i * 0.19,
        envelope * (intense ? 0.22 : 0.15),
      );
      c.restore();
    }
  } else {
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < Math.max(5, Math.round((intense ? 22 : 15) * detail)); i++) {
      const speed = 0.36 + random(i + 2001) * 0.32;
      const age = fract(t * speed + random(i + 2017));
      const angle = random(i + 2029) * tau + Math.sin(age * 5 + i) * 0.09;
      const radius = 0.45 + random(i + 2039) * 0.48 + age * 0.31;
      const p = projectOverheadEffect(f.plane, radius, angle, age);
      const q = projectOverheadEffect(
        f.plane,
        radius - 0.012,
        angle - 0.008,
        Math.max(0, age - 0.045),
      );
      const envelope = Math.sin(age * Math.PI) ** 0.8 * (1 - age * 0.5);
      const size = (0.35 + random(i + 2051) * 0.7) * p.perspective;
      const hot = tint(e.color, 0.65);
      c.strokeStyle = alpha(e.color, envelope * 0.65);
      c.lineWidth = size * 0.9;
      c.beginPath();
      c.moveTo(q.x, q.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      glow(c, p.x, p.y, size * 4, e.color, envelope * 0.38);
      c.fillStyle = alpha(hot, envelope * 0.95);
      c.beginPath();
      c.ellipse(p.x, p.y, size * 0.65, size, angle, 0, tau);
      c.fill();
    }
  }
  c.restore();
}
