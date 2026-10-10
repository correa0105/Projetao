import type { TokenEffect } from '../shared/vtt-effects';
import {
  cinematicPhenomena,
  type CinematicEffectKind,
  type Phenomenon,
} from '../shared/vtt-effects-cinematic';
import type { EffectFootprint } from './vtt-effect-footprint';
import { physicalProp, type PhysicalProp } from './vtt-effects-physical';
import { materialSprite } from './vtt-effects-materials';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
import { discharge } from './vtt-effects-overhead-magic';
import { drawFluidPhenomenon } from './vtt-effects-fluid';
import { groundRupture } from './vtt-ground-rupture';

export function continuousPhenomenon(
  c: CanvasRenderingContext2D,
  model: Phenomenon,
  color: string,
  t: number,
  random: (n: number) => number,
  front: boolean,
  detail: number,
) {
  if (drawFluidPhenomenon(c, model, color, t, random, front, detail)) return;
  const { family, layout, speed, spread } = model,
    total = Math.max(4, Math.round(model.count * detail));
  const material =
    family === 'fire'
      ? 'flame'
      : ['air', 'acid', 'water', 'soul'].includes(family)
        ? 'vapor'
        : 'energy';
  const prop: PhysicalProp | undefined =
    family === 'earth'
      ? 'rock'
      : family === 'ice'
        ? 'ice'
        : family === 'nature'
          ? /folhas/i.test(model.name)
            ? 'leaf'
            : 'petal-rose'
          : family === 'soul' && /almas|procissão/i.test(model.name)
            ? 'skull'
            : undefined;
  for (let i = 0; i < total; i++) {
    if ((i % 2 === 0) !== front) continue;
    const u = fract(t * speed + random(i)),
      a = random(i + 31) * tau,
      fade = Math.sin(u * Math.PI);
    let x = 0,
      y = 0,
      r = 80,
      angle = a + t * 0.23;
    if (layout === 'spiral' || layout === 'orbit' || layout === 'comet') {
      r = (layout === 'orbit' ? 72 : layout === 'comet' ? 78 : 32 + u * 63) * spread;
      angle = a + t * speed * 0.75 + (layout === 'spiral' ? u * tau * 1.2 : 0);
      x = Math.cos(angle) * r;
      y = Math.sin(angle) * r;
    } else if (layout === 'surge' || layout === 'rain') {
      x =
        (random(i + 35) - 0.5) * 170 * spread +
        (layout === 'surge' ? u * 80 - 40 : Math.sin(t + i) * 8);
      y = (u - 0.5) * 185 * spread;
      angle = layout === 'surge' ? -0.5 : Math.PI * 0.5;
    } else if (layout === 'jet' || layout === 'burst') {
      r = (layout === 'jet' ? 20 + u * 65 : 18 + u * 94) * spread;
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
      angle = a;
      if (layout === 'jet') y -= Math.sin(u * Math.PI) * 19;
    } else if (layout === 'wave') {
      angle = (i / total) * tau;
      r = (32 + u * 65) * spread;
      x = Math.cos(angle) * r;
      y = Math.sin(angle) * r;
    } else if (layout === 'rift') {
      y = (random(i + 11) - 0.5) * 160;
      x = Math.sin(y * 0.025 + t * 1.3) * 13 + (u - 0.5) * 23;
      angle = t * 0.22 + i;
    } else {
      angle = (i / total) * tau + (layout === 'cage' ? t * 0.25 : 0.05 * Math.sin(t + i));
      r = (layout === 'bloom' ? 55 + u * 34 : 80 + Math.sin(t + i) * 4) * spread;
      x = Math.cos(angle) * r;
      y = Math.sin(angle) * r;
    }
    const size =
      family === 'fire'
        ? 37 + u * 23
        : family === 'air' || family === 'acid'
          ? 43 + u * 36
          : family === 'soul'
            ? 48
            : family === 'water'
              ? 31
              : 26;
    if (prop) {
      const extent =
        family === 'ice'
          ? /neve/i.test(model.name)
            ? 3 + random(i) * 4
            : 18 + u * 25
          : family === 'earth'
            ? 17 + random(i + 19) * 20
            : family === 'nature'
              ? /sementes/i.test(model.name)
                ? 6
                : 17 + random(i + 44) * 9
              : 24;
      if (family === 'earth') glow(c, x + 3, y + 5, 12, '#29231b', 0.28);
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      if (family === 'nature') c.scale(0.45 + Math.abs(Math.cos(t * 1.4 + i)) * 0.55, 1);
      physicalProp(c, prop, 0, 0, extent, 0, fade * (front ? 0.96 : 0.72), color);
      c.restore();
      if (family === 'ice')
        materialSprite(c, '#e0f0f7', 'vapor', x, y, 40, angle, t * 0.45 + i, fade * 0.23);
    } else if (family === 'electric') {
      if (layout === 'orbit')
        physicalProp(c, 'plasma', x, y, 46 + fade * 11, t * 0.4 + i, fade * 0.8);
      else {
        c.save();
        const pulse = fract(t * speed + i * 0.11);
        c.globalAlpha *= Math.max(0.06, 1 - pulse * 1.6);
        discharge(
          c,
          { x: x * 0.72, y: y * 0.72 },
          { x: x + Math.cos(angle + 0.6) * 23, y: y + Math.sin(angle + 0.6) * 23 },
          random,
          Math.floor(t * speed) * 113 + i * 39,
          color,
          1.1,
        );
        c.restore();
      }
    } else {
      if (layout === 'comet')
        for (let k = 1; k < 5; k++) {
          const q = angle - k * 0.09;
          materialSprite(
            c,
            color,
            material,
            Math.cos(q) * r,
            Math.sin(q) * r,
            size * (1 - k * 0.13),
            q,
            t * speed + i,
            fade * (1 - k / 5) * 0.5,
          );
        }
      materialSprite(
        c,
        color,
        material,
        x,
        y,
        size,
        angle,
        t * speed * 1.8 + i,
        fade * (front ? 0.62 : 0.52),
      );
      if (family === 'water' && front)
        physicalProp(c, 'droplet', x, y, 8 + random(i + 17) * 10, 0, fade * 0.64);
      if (family === 'acid' && front)
        physicalProp(c, 'droplet', x, y, 5 + random(i + 17) * 7, 0, fade * 0.6, color);
      if (family === 'fire' && front && i % 3 === 0)
        physicalProp(c, 'fireball', x, y, 14 + fade * 13, angle, fade * 0.6);
    }
    if (family === 'light' || family === 'fire' || family === 'ice') {
      glow(c, x, y, 1.2, color, fade * 0.72);
    }
  }
  if (layout === 'wave' && front)
    for (let k = 0; k < 3; k++) {
      const u = fract(t * speed + k / 3);
      c.beginPath();
      c.arc(0, 0, (24 + u * 78) * spread, 0, tau);
      c.strokeStyle = alpha(tint(color, 0.6), Math.sin(u * Math.PI) * 0.23);
      c.lineWidth = 1.2;
      c.stroke();
    }
}
export function drawCinematicTokenEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: (n: number) => number,
  front: boolean,
  detail: number,
) {
  const model = cinematicPhenomena[e.kind as CinematicEffectKind];
  if (!model) return false;
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  if (e.kind === 'ground-rupture') groundRupture(c, e.color, t, random, front, detail);
  else continuousPhenomenon(c, model, e.color, t, random, front, detail);
  c.restore();
  return true;
}
