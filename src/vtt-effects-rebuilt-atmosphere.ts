import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
import { spectralPilgrim } from './vtt-spectral-pilgrim';
import { temporalField } from './vtt-effects-temporal';
type Random = (i: number) => number;
export const rebuiltAtmosphereKinds = new Set([
  'poison-breath',
  'wind-shear',
  'soul-vortex',
  'spirit-procession',
  'ghost-wake',
]);
function spirit(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  a: number,
  t: number,
  fade: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.globalAlpha *= fade;
  // Dissolving trailing shrouds and an illustrated pilgrim have real depth; no repeated
  // rigid ghost-wisp silhouette or rotating radial lightning/smoke brush.
  temporalField(c, 'vapour', t * 0.51, 0, size * 0.37, size * 0.72, size * 1.75, 0.12, 0.78, color);
  temporalField(
    c,
    'vapour',
    t * 0.41 + 0.71,
    -size * 0.15,
    size * 0.42,
    size * 0.46,
    size * 1.65,
    -0.17,
    0.48,
    color,
  );
  spectralPilgrim(c, size, t, 0.8);
  glow(c, 0, -size * 0.16, size * 0.24, color, 0.15);
  c.restore();
}
export function drawRebuiltAtmosphere(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  const kind = e.kind,
    color = e.color;
  if (kind === 'poison-breath') {
    // A succession of exhalations, widening with distance. Each puff shears into
    // smaller curls as it cools, instead of sliding a line across the token.
    for (let i = 0; i < 10; i++) {
      const u = fract(t * 0.23 + i / 10),
        fade = Math.sin(u * Math.PI) ** 1.6;
      const x = 26 + u * 101,
        y = -17 + Math.sin(u * 3.9 + i * 0.4) * (12 + u * 21);
      if ((i % 3 === 0) !== front) continue;
      temporalField(
        c,
        'vapour',
        t * 0.66 + i * 0.37,
        x,
        y,
        30 + u * 77,
        24 + u * 56,
        u * 0.63,
        fade * 0.6,
        color,
      );
      if (front && i % 2 === 0) {
        glow(c, x, y, 5, '#cff08c', fade * 0.12);
      }
    }
    if (front)
      for (let i = 0; i < Math.round(16 * detail); i++) {
        const u = fract(t * 0.3 + random(i + 11)),
          x = 35 + u * 91,
          y = (random(i + 33) - 0.5) * (12 + u * 66);
        c.fillStyle = alpha(tint(color, 0.6), Math.sin(u * Math.PI) * 0.45);
        c.fillRect(x, y, 0.8 + random(i) * 1.2, 1.2);
      }
  } else if (kind === 'wind-shear') {
    for (let stream = 0; stream < 2; stream++) {
      if ((stream === 0) !== front) continue;
      const direction = stream ? -0.67 : 0.72;
      c.save();
      c.rotate(direction);
      for (let i = 0; i < 5; i++) {
        const u = fract(t * 0.31 + i / 5),
          x = -121 + u * 242,
          y = Math.sin(u * 5 + stream) * 23 + (stream ? 24 : -24);
        temporalField(
          c,
          'vapour',
          t * 0.43 + i * 0.26,
          x,
          y,
          79,
          23 + u * 15,
          Math.sin(u * 4) * 0.17,
          Math.sin(u * Math.PI) * 0.36,
          color,
        );
      }
      for (let i = 0; i < 24; i++) {
        const u = fract(t * 0.43 + random(i + stream * 77)),
          x = -125 + u * 250,
          y = (random(i + 41) - 0.5) * 65;
        c.beginPath();
        c.moveTo(x - 6, y);
        c.quadraticCurveTo(x - 3, y - 2, x, y);
        c.strokeStyle = alpha(tint(color, 0.42), Math.sin(u * Math.PI) * 0.26);
        c.lineWidth = 0.45;
        c.stroke();
      }
      c.restore();
    }
  } else if (kind === 'soul-vortex') {
    if (!front) {
      temporalField(c, 'vapour', t * 0.3, 0, 0, 250, 250, -t * 0.23, 0.48, '#342650');
      glow(c, 0, 0, 35, color, 0.1);
    }
    for (let i = 0; i < 7; i++) {
      const u = fract(t * 0.13 + i / 7),
        a = i * 1.9 + u * 4.8,
        r = 120 - u * 76;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (y > 0 !== front) continue;
      spirit(
        c,
        x,
        y,
        43 - u * 17,
        a + Math.PI / 2,
        t + i * 0.29,
        Math.sin(u * Math.PI) * 0.78,
        color,
      );
    }
  } else if (kind === 'spirit-procession') {
    // A slow single-file procession follows an oval, with individual body
    // sizes and long robes. The open center keeps the character readable.
    for (let i = 0; i < 6; i++) {
      const a = t * 0.17 + (i * tau) / 6,
        x = Math.cos(a) * 101,
        y = Math.sin(a) * 87;
      if (y > 0 !== front) continue;
      spirit(c, x, y, 37 + random(i + 19) * 10, a + Math.PI / 2, t * 0.8 + i * 0.57, 0.72, color);
    }
  } else if (kind === 'ghost-wake') {
    if (!front && f.source) {
      // Actual fading body echoes identify this as a wake, distinct from souls
      // or skulls. One reusable clip pass, no image-data reads or cached tokens.
      for (let i = 4; i >= 1; i--) {
        const u = fract(t * 0.18 + i * 0.16),
          offset = 23 + i * 18 + u * 9;
        c.save();
        c.globalAlpha *= Math.sin(u * Math.PI) * (0.21 - i * 0.031);
        c.translate(-offset, 22 + i * 8);
        c.filter = 'grayscale(1) sepia(.35) hue-rotate(185deg)';
        c.drawImage(f.source, -f.sx * 0.41, -f.sy * 0.41, f.sx * 0.82, f.sy * 0.82);
        c.restore();
      }
    }
    for (let i = 0; i < 8; i++) {
      if ((i % 3 === 0) !== front) continue;
      const u = fract(t * 0.24 + i / 8),
        x = -32 - u * 100,
        y = 23 + u * 34 + Math.sin(u * 6 + i) * 12;
      temporalField(
        c,
        'vapour',
        t * 0.36 + i * 0.33,
        x,
        y,
        38 + u * 49,
        28 + u * 24,
        -0.35,
        Math.sin(u * Math.PI) * 0.38,
        color,
      );
    }
  }
}
