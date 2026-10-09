import type { TokenEffect } from '../shared/vtt-effects';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
import { temporalField } from './vtt-effects-temporal';
import { elementalMaterial } from './vtt-elemental-materials';
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
      // The material sheds along the past curved trajectory. Broader changing
      // volumes taper into a fading tail, rather than a rigid flame stamp.
      for (let k = 6; k >= 0; k--) {
        const lag = k * 0.075,
          q = a - lag,
          p = { x: Math.cos(q) * r, y: Math.sin(q) * r },
          fade = (1 - k / 7) ** 1.45;
        elementalMaterial(
          c,
          'fire-volume',
          t * 1.27 - lag + i * 0.37,
          p.x,
          p.y,
          38 - k * 3,
          43 - k * 3,
          q,
          fade * 0.78 * strength,
          color,
        );
      }
      glow(c, x, y, 12, '#ffc583', 0.8);
      glow(c, x, y, 4, '#fff3d2', 1);
    }
  } else if (kind === 'blue-fire') {
    if (!front)
      elementalMaterial(c, 'fire-volume', t * 1.1, 0, 0, 340, 340, 0, 0.95 * strength, '#4cceff');
    if (front) fireVolumes(c, kind, t, random, '#4cceff', strength);
  } else if (front && kind !== 'inferno') {
    fireVolumes(c, kind, t, random, color, strength);
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

function fireVolumes(
  c: CanvasRenderingContext2D,
  kind: string,
  t: number,
  random: Random,
  color: string,
  strength: number,
) {
  for (let i = 0; i < 4; i++) {
    const birth = t * (kind === 'rage' ? 0.6 : 0.43) + random(i + 21),
      u = fract(birth),
      cycle = Math.floor(birth);
    const a = random(i + cycle * 13 + 91) * tau,
      radius = 72 + u * 34;
    const x = Math.cos(a) * radius + Math.sin(u * 4 + i) * 8,
      y = Math.sin(a) * radius - u * 9;
    // A puff lives briefly, expands, internally deforms and dissolves. Its
    // emission angle changes only after fading to zero, so no positional pop.
    elementalMaterial(
      c,
      'fire-volume',
      t * 1.37 + i * 0.41,
      x,
      y,
      59 + u * 33,
      62 + u * 29,
      a,
      Math.sin(u * Math.PI) ** 1.6 * 0.39 * strength,
      color,
    );
  }
}
