import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { flowSprite, chainLoop } from './vtt-effects-native-flow';
import { physicalProp } from './vtt-effects-physical';
import { fract, glow, tau } from './vtt-effects-primitives';

const kinds = new Set([
  'vines',
  'leaves',
  'thorn-cage',
  'spectral-chains',
  'fear',
  'fire',
  'soul-flames',
]);
export function drawOrganicEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: (i: number) => number,
  front: boolean,
  detail: number,
) {
  if (!kinds.has(e.kind)) return false;
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  if (e.kind === 'vines' || e.kind === 'thorn-cage') {
    const thorn = e.kind === 'thorn-cage';
    for (let i = 0; i < 7; i++) {
      const a = (i * tau) / 7 + random(11) * 0.7;
      if (Math.sin(a) > 0.2 !== front) continue;
      const grow = Math.min(1, 0.45 + t * 0.38),
        r = thorn ? 69 : 73;
      c.save();
      c.translate(Math.cos(a) * r, Math.sin(a) * r);
      c.rotate(a + Math.sin(t * 1.6 + i) * 0.045);
      if (i % 2) c.scale(1, -1);
      flowSprite(
        c,
        thorn ? 'thorn-vine' : 'leafy-vine',
        0,
        0,
        (thorn ? 139 : 126) * grow,
        thorn ? 80 : 78,
        thorn ? Math.PI / 2 : -0.2,
        t + i,
        front ? 0.91 : 1,
        e.color,
      );
      c.restore();
    }
  } else if (e.kind === 'leaves') {
    const count = Math.max(9, Math.round(20 * detail));
    for (let i = 0; i < count; i++) {
      const u = fract(t * 0.27 + random(i)),
        a = random(i + 35) * tau + t * 0.36 + u * 0.4;
      if (Math.sin(a) > 0 !== front) continue;
      const r = 64 + u * 38;
      c.save();
      c.translate(Math.cos(a) * r, Math.sin(a) * r);
      c.rotate(a + t * 0.7 + i);
      c.scale(0.35 + Math.abs(Math.cos(t * 2.2 + i)) * 0.65, 1);
      physicalProp(
        c,
        'leaf',
        0,
        0,
        23 + random(i + 49) * 14,
        0,
        Math.sin(u * Math.PI) * 0.96,
        e.color,
      );
      c.restore();
    }
  } else if (e.kind === 'spectral-chains') {
    chainLoop(c, 87, t, e.color, front);
    for (let i = 0; i < 7; i++) {
      const a = (i * tau) / 7 + Math.sin(t * 0.7) * 0.055;
      if (Math.sin(a) > 0 !== front) continue;
      const r = 85 + Math.sin(t * 1.4 + i) * 1.2;
      if (!front)
        flowSprite(
          c,
          'cloud-wisp',
          Math.cos(a) * r,
          Math.sin(a) * r,
          87,
          61,
          a,
          t,
          0.21,
          '#93c8dd',
        );
    }
  } else if (e.kind === 'fear' || e.kind === 'soul-flames') {
    const fear = e.kind === 'fear';
    for (let i = 0; i < (fear ? 6 : 5); i++) {
      const u = fract(t * 0.27 + i / 6),
        a = (i * tau) / (fear ? 6 : 5) + t * 0.19,
        r = 78 + Math.sin(t + i) * 9;
      if (Math.sin(a) > 0 !== front) continue;
      flowSprite(
        c,
        fear ? 'ghost-wisp' : 'light-stream',
        Math.cos(a) * r,
        Math.sin(a) * r,
        fear ? 75 : 102,
        fear ? 75 : 88,
        a + t * 0.13,
        t + i,
        0.65 + Math.sin(u * Math.PI) * 0.25,
        e.color,
      );
      glow(c, Math.cos(a) * r, Math.sin(a) * r, 13, e.color, 0.15);
    }
  } else {
    const count = Math.max(8, Math.round(14 * detail));
    for (let i = 0; i < count; i++) {
      const u = fract(t * 0.75 + random(i)),
        a = (i * tau) / count,
        r = 62 + u * 17;
      if (Math.sin(a) > 0 !== front) continue;
      flowSprite(
        c,
        'flame-tongue',
        Math.cos(a) * r,
        Math.sin(a) * r,
        61 + u * 18,
        72 + u * 22,
        a + Math.PI / 2,
        t * 2 + i,
        Math.sin(u * Math.PI) * 0.97,
        e.color,
      );
      glow(c, Math.cos(a) * r, Math.sin(a) * r, 11, '#ffbc55', Math.sin(u * Math.PI) * 0.25);
    }
  }
  c.restore();
  return true;
}
