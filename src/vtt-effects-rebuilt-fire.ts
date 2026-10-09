import type { TokenEffect } from '../shared/vtt-effects';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
import { temporalField } from './vtt-effects-temporal';
type Random = (i: number) => number;
export const rebuiltFireKinds = new Set([
  'fire',
  'inferno',
  'blue-fire',
  'rage',
  'ember-comet',
  'fire-surge',
  'fire-geyser',
  'fire-spiral',
]);

export function drawRebuiltFire(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  const kind = e.kind,
    color = e.color,
    strength = 0.55 + (e.intensity ?? 0.8) * 0.45;
  if (!front) {
    const base =
      kind === 'inferno'
        ? 'ring'
        : kind === 'fire-surge'
          ? 'wave'
          : kind === 'fire-spiral'
            ? 'spiral'
            : 'geyser';
    if (kind !== 'ember-comet' && kind !== 'blue-fire') {
      temporalField(
        c,
        base,
        t * (kind === 'rage' ? 1.4 : 0.85),
        0,
        0,
        kind === 'inferno' || kind === 'fire-spiral' ? 346 : 310,
        kind === 'fire-surge' ? 282 : 310,
        kind === 'fire-spiral' ? t * 0.19 : 0,
        0.86 * strength,
        color,
      );
    }
    glow(c, 0, 0, 100, color, 0.14 * strength);
  }
  if (kind === 'ember-comet') {
    // Unequal inclinations, speeds and tails: three actual travelling ember heads.
    for (let i = 0; i < 3; i++) {
      const a = t * (0.73 + i * 0.13) + i * 2.3,
        r = 107 + i * 5;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (y > 0 !== front) continue;
      const vx = -Math.sin(a),
        vy = Math.cos(a);
      temporalField(
        c,
        'tongue',
        t * 1.2 + i * 0.51,
        x - vx * 32,
        y - vy * 32,
        42,
        125,
        a,
        0.91 * strength,
        color,
      );
      for (let k = 2; k > 0; k--) {
        const q = a - k * 0.18,
          p = { x: Math.cos(q) * r, y: Math.sin(q) * r };
        temporalField(
          c,
          'vapour',
          t * 0.9 + i * 0.37 + k * 0.2,
          p.x,
          p.y,
          36 - k * 5,
          27,
          q,
          0.14 * (1 - k / 3),
          color,
        );
      }
      glow(c, x, y, 12, '#ffc583', 0.8);
      glow(c, x, y, 4, '#fff3d2', 1);
    }
  } else if (kind === 'blue-fire') {
    for (let i = 0; i < 7; i++) {
      const a = (i * tau) / 7 + 0.17 * Math.sin(t * 0.8 + i),
        r = 88 + 11 * Math.sin(t * 1.1 + i * 1.9);
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (y > 0 !== front) continue;
      temporalField(
        c,
        'tongue',
        t * 1.1 + i * 0.41,
        x,
        y,
        53,
        87,
        a + Math.PI / 2,
        0.84 * strength,
        color,
      );
      glow(c, x, y, 16, color, 0.18);
    }
  } else if (front) {
    // Local convective tongues break off and dissipate around the edge; the
    // material evolves inside each tongue, independently of its trajectory.
    const count = kind === 'fire-geyser' ? 7 : kind === 'fire-surge' ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const u = fract(t * (kind === 'rage' ? 0.72 : 0.46) + random(i + 21));
      const a =
        kind === 'fire-surge' ? 0.15 + i * 0.82 : (i * tau) / count + 0.23 * Math.sin(t + i);
      const r = kind === 'inferno' ? 107 : 66 + u * 49;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      temporalField(
        c,
        'tongue',
        t * 1.15 + i * 0.39,
        x,
        y,
        34 + u * 19,
        57 + u * 43,
        a + Math.PI / 2,
        Math.sin(u * Math.PI) * 0.75 * strength,
        color,
      );
    }
  }
  if (front) {
    c.lineCap = 'round';
    const count = Math.round((kind === 'rage' ? 39 : 23) * detail);
    for (let i = 0; i < count; i++) {
      const u = fract(t * (0.45 + random(i) * 0.24) + random(i + 19));
      const a = random(i + 33) * tau + 0.16 * Math.sin(t * 0.5 + i),
        r = 61 + u * 66;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r,
        fade = Math.sin(u * Math.PI) ** 1.3;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - Math.cos(a) * (2 + random(i) * 4), y - Math.sin(a) * (2 + random(i) * 4));
      c.strokeStyle = alpha(tint(color, 0.7), fade * 0.85 * strength);
      c.lineWidth = 0.55 + random(i + 89);
      c.stroke();
    }
  }
}
