import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { elementalMaterial } from './vtt-elemental-materials';
import { physicalProp } from './vtt-effects-physical';
import { temporalField } from './vtt-effects-temporal';
import { lavaMaterial } from './vtt-lava-material';
import { alpha, fract, glow, star, tau, tint } from './vtt-effects-primitives';
type Random = (i: number) => number;
export const elementalEffectKinds = new Set([
  'chain-lightning',
  'lava',
  'bless',
  'sonic',
  'acid-splash',
  'water-geyser',
  'tidal-wave',
  'sand-veil',
  'dimensional-rift',
  'prism-pulse',
]);
const envelope = (u: number) => Math.sin(u * Math.PI) ** 1.3;
function droplets(
  c: CanvasRenderingContext2D,
  t: number,
  r: Random,
  front: boolean,
  color: string,
  acid: boolean,
  geyser = false,
) {
  for (let i = 0; i < (geyser ? 30 : 22); i++) {
    const u = fract(t * (0.42 + r(i) * 0.23) + r(i + 31)),
      a = r(i + 47) * tau;
    const distance = 48 + u * (geyser ? 77 : 62),
      z = Math.sin(u * Math.PI) * (geyser ? 35 : 18);
    const x = Math.cos(a) * distance,
      y = Math.sin(a) * distance - z;
    if (Math.sin(a) > 0 !== front) continue;
    physicalProp(
      c,
      'droplet',
      x,
      y,
      (acid ? 4 : 5) + r(i + 93) * 5,
      a + Math.PI / 2,
      envelope(u) * 0.9,
      color,
    );
    if (u > 0.76) {
      const spread = (u - 0.76) / 0.24;
      elementalMaterial(
        c,
        acid ? 'acid' : 'water',
        t + i * 0.17,
        x,
        Math.sin(a) * distance,
        18 + spread * 31,
        12 + spread * 20,
        0,
        (1 - spread) * 0.42,
        color,
      );
    }
  }
}
function electric(
  c: CanvasRenderingContext2D,
  t: number,
  random: Random,
  front: boolean,
  color: string,
) {
  // Five staggered links close the circuit. Each keeps its textured discharge,
  // including the final connection from the fifth emitter back to the first.
  c.save();
  c.scale(1.32, 1.32);
  const nodes = Array.from({ length: 5 }, (_, i) => {
    const a = (i * tau) / 5 + 0.4,
      r = 92 + random(i + 17) * 19;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i],
      b = nodes[(i + 1) % nodes.length],
      u = fract(t * 1.35 - i * 0.16),
      power = Math.exp(-u * 7);
    if (a.y + b.y > 0 !== front) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    elementalMaterial(
      c,
      'electric',
      t * 1.6 + i * 0.29,
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      length * 1.08,
      60 + power * 12,
      Math.atan2(b.y - a.y, b.x - a.x),
      Math.min(1, 0.42 + power * 0.58),
      color,
    );
    glow(c, b.x, b.y, 7 + power * 10, color, power * 0.4);
    glow(c, b.x, b.y, 2 + power * 2, '#effaff', power * 0.95);
  }
  c.restore();
}
export function drawElementalEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  if (!elementalEffectKinds.has(e.kind)) return false;
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  const kind = e.kind,
    color = e.color;
  if (kind === 'chain-lightning') electric(c, t, random, front, color);
  else if (kind === 'lava') {
    if (!front) {
      c.save();
      c.rotate(random(27) * tau);
      c.globalAlpha *= 0.94;
      lavaMaterial(c, t, 274);
      c.restore();
    }
  } else if (kind === 'bless') {
    if (!front) {
      elementalMaterial(c, 'blessing', t * 0.63, 0, 0, 292, 292, 0, 1);
      glow(c, 0, 0, 118, '#ffd583', 0.12);
    }
    for (let i = 0; i < Math.round(22 * detail); i++) {
      const u = fract(t * 0.19 + random(i)),
        a = random(i + 31) * tau + 0.12 * Math.sin(t * 0.6 + i),
        r = 70 + u * 47;
      if (Math.sin(a) > 0 !== front) continue;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r - u * 8;
      c.save();
      c.globalAlpha *= envelope(u) * 0.82;
      c.fillStyle = '#fff4cb';
      star(c, x, y, 1.1 + random(i + 41) * 1.7);
      c.fill();
      c.restore();
      glow(c, x, y, 4, '#ffe1a2', envelope(u) * 0.24);
    }
  } else if (kind === 'sonic') {
    if (!front) elementalMaterial(c, 'resonance', t * 0.72, 0, 0, 310, 310, 0, 0.85, color);
    else
      for (let i = 0; i < 18; i++) {
        const u = fract(t * 0.52 + random(i)),
          a = random(i + 42) * tau,
          r = 39 + u * 91;
        c.fillStyle = alpha(tint(color, 0.68), envelope(u) * 0.43);
        c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.2, 1.2);
      }
  } else if (kind === 'acid-splash') {
    if (!front) elementalMaterial(c, 'acid', t * 0.65, 0, 0, 252, 230, 0, 0.94);
    droplets(c, t, random, front, '#a3ca59', true);
    if (front)
      for (let i = 0; i < 3; i++) {
        const u = fract(t * 0.25 + i / 3),
          a = random(i + 3) * tau;
        temporalField(
          c,
          'vapour',
          t * 0.48 + i,
          Math.cos(a) * 85,
          Math.sin(a) * 70 - u * 12,
          29 + u * 35,
          22 + u * 30,
          a,
          envelope(u) * 0.13,
          '#88b754',
        );
      }
  } else if (kind === 'water-geyser' || kind === 'tidal-wave') {
    if (!front)
      elementalMaterial(
        c,
        'water',
        t * (kind === 'water-geyser' ? 0.8 : 0.47),
        0,
        0,
        kind === 'water-geyser' ? 250 : 312,
        kind === 'water-geyser' ? 245 : 282,
        0,
        0.92,
      );
    // Keep the approved animated water surface without the rigid jet overlays.
    if (kind === 'tidal-wave') droplets(c, t, random, front, '#a9deec', false);
  } else if (kind === 'sand-veil') {
    for (let i = 0; i < 6; i++) {
      const u = fract(t * 0.16 + i / 6),
        x = -135 + u * 270,
        y = (random(i + 21) - 0.5) * 130 + Math.sin(u * 4 + i) * 12;
      if ((i % 3 === 0) !== front) continue;
      temporalField(
        c,
        'vapour',
        t * 0.42 + i * 0.43,
        x,
        y,
        73 + u * 69,
        48 + u * 32,
        0.13 * Math.sin(t * 0.6 + i),
        envelope(u) * (front ? 0.2 : 0.38),
        '#c6a174',
      );
    }
    for (let i = 0; i < Math.round(72 * detail); i++) {
      if ((i % 3 === 0) !== front) continue;
      const u = fract(t * (0.23 + random(i) * 0.13) + random(i + 13));
      c.fillStyle = alpha(i % 3 ? '#c6ae8b' : '#eee0c5', envelope(u) * 0.65);
      c.fillRect(
        -125 + u * 250,
        (random(i + 41) - 0.5) * 173 + Math.sin(u * 6 + i) * 13,
        0.65 + random(i) * 0.6,
        0.8,
      );
    }
  } else if (kind === 'dimensional-rift') {
    if (!front) {
      elementalMaterial(c, 'rift', t * 0.65, 0, 0, 236, 294, 0.07 * Math.sin(t * 0.31), 1);
      glow(c, 0, 0, 86, '#7b69d4', 0.09);
    } else
      for (let i = 0; i < 10; i++) {
        const u = fract(t * 0.16 + random(i)),
          side = i % 2 ? 1 : -1;
        glow(
          c,
          side * (29 + u * 17),
          (random(i + 31) - 0.5) * 167,
          1.4,
          '#d8d7ff',
          envelope(u) * 0.64,
        );
      }
  } else if (kind === 'prism-pulse') {
    if (!front) elementalMaterial(c, 'prism', t * 0.78, 0, 0, 308, 308, 0, 0.94);
    else
      for (let i = 0; i < 16; i++) {
        const u = fract(t * 0.3 + random(i)),
          a = random(i + 33) * tau,
          r = 70 + u * 58;
        glow(
          c,
          Math.cos(a) * r,
          Math.sin(a) * r,
          1.6 + random(i + 54) * 1.4,
          ['#ffb6d7', '#9be7ff', '#e8d99b'][i % 3],
          envelope(u) * 0.8,
        );
      }
  }
  c.restore();
  return true;
}
