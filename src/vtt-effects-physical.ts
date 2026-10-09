import type { TokenEffect } from '../shared/vtt-effects';
import { footprintPoint, type EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, glow, seededRandom, tau, tint } from './vtt-effects-primitives';
import { materialSprite } from './vtt-effects-materials';
import { nativeFlowReady } from './vtt-effects-native-flow';
import { temporalFieldsReady } from './vtt-effects-temporal';
import { spectralPilgrimReady } from './vtt-spectral-pilgrim';

export type PhysicalProp =
  | 'rock'
  | 'rubble'
  | 'petal-rose'
  | 'petal-ivory'
  | 'feather'
  | 'mushrooms'
  | 'fireball'
  | 'plasma'
  | 'chain'
  | 'gear'
  | 'butterfly'
  | 'leaf'
  | 'ice'
  | 'droplet'
  | 'skull'
  | 'tendril';
const props = new Map<PhysicalProp, HTMLImageElement>();
const tinted = new Map<string, HTMLCanvasElement>();
const originalPhysicalPropsReady = Promise.all(
  (
    [
      'rock',
      'rubble',
      'petal-rose',
      'petal-ivory',
      'feather',
      'mushrooms',
      'fireball',
      'plasma',
      'chain',
      'gear',
      'butterfly',
      'leaf',
      'ice',
      'droplet',
      'skull',
      'tendril',
    ] as const
  ).map(async (name) => {
    if (typeof Image === 'undefined') return;
    const image = new Image();
    image.src = '/vtt/physical-20261009/' + name + '.webp';
    try {
      await image.decode();
      props.set(name, image);
    } catch {
      /* Physical shading fallback stays available. */
    }
  }),
);
export const physicalPropsReady = Promise.all([
  originalPhysicalPropsReady,
  nativeFlowReady,
  temporalFieldsReady,
  spectralPilgrimReady,
]);
export function physicalProp(
  c: CanvasRenderingContext2D,
  kind: PhysicalProp,
  x: number,
  y: number,
  size: number,
  angle = 0,
  opacity = 1,
  color?: string,
) {
  const source = props.get(kind);
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalAlpha *= opacity;
  if (source) {
    let art: CanvasImageSource = source;
    if (color) {
      const key = kind + color;
      let tile = tinted.get(key);
      if (!tile) {
        tile = document.createElement('canvas');
        tile.width = tile.height = 384;
        const g = tile.getContext('2d')!;
        g.drawImage(source, 0, 0, 384, 384);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = kind.startsWith('petal') ? 0.48 : 0.18;
        g.fillStyle = color;
        g.fillRect(0, 0, 384, 384);
        if (tinted.size >= 24) tinted.delete(tinted.keys().next().value!);
        tinted.set(key, tile);
      }
      art = tile;
    }
    c.drawImage(art, -size / 2, -size / 2, size, size);
  } else {
    // Rounded matter with shading instead of a flat placeholder polygon.
    const g = c.createRadialGradient(-size * 0.13, -size * 0.16, size * 0.01, 0, 0, size * 0.42);
    g.addColorStop(0, tint(color || '#a7a3a0', 0.4));
    g.addColorStop(1, tint(color || '#a7a3a0', 0.5, '#221d19'));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, size * 0.32, size * 0.39, 0, 0, tau);
    c.fill();
  }
  c.restore();
}

const stoneCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
function stoneSurface(source: HTMLImageElement, color: string, amount: number) {
  const step = Math.round(amount * 16),
    key = color + step;
  let tiles = stoneCache.get(source);
  if (!tiles) {
    tiles = new Map();
    stoneCache.set(source, tiles);
  }
  const cached = tiles.get(key);
  if (cached) return cached;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 192;
  const c = tile.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(source, 0, 0, 192, 192);
  try {
    const p = c.getImageData(0, 0, 192, 192),
      random = seededRandom('stone-grain'),
      rgb = [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16));
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 192; x++) {
        const at = (y * 192 + x) * 4,
          gray = p.data[at] * 0.2126 + p.data[at + 1] * 0.7152 + p.data[at + 2] * 0.0722;
        const grain = random(y * 192 + x),
          vein = Math.sin(x * 0.058 + Math.sin(y * 0.045) * 3.8);
        const shade =
          0.34 + (gray / 255) * 0.67 + (grain - 0.5) * 0.18 - (Math.abs(vein) < 0.029 ? 0.2 : 0);
        const growth =
          0.5 +
          0.24 * Math.sin(x * 0.056 + y * 0.061) +
          0.19 * Math.cos(y * 0.031 - x * 0.087) +
          (grain - 0.5) * 0.1;
        const cover = Math.max(0, Math.min(1, (step / 16 - growth) * 9 + 0.28));
        for (let k = 0; k < 3; k++) p.data[at + k] = (115 + rgb[k] * 0.24) * shade;
        p.data[at + 3] *= cover;
      }
    c.putImageData(p, 0, 0);
  } catch {
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, 192, 192);
  }
  if (tiles.size >= 32) tiles.delete(tiles.keys().next().value!);
  tiles.set(key, tile);
  return tile;
}
export function petrificationSurface(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  amount: number,
) {
  if (!f.source || amount <= 0) return;
  c.drawImage(stoneSurface(f.source, color, amount), -f.sx / 2, -f.sy / 2, f.sx, f.sy);
}

export function naturalEarth(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: (i: number) => number,
  front: boolean,
) {
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  if (!front) {
    // Grainy ground rubble, broken branching seams and low dust have different depth.
    physicalProp(c, 'rubble', 0, 0, 204, random(113) * tau, 0.72, e.color);
    for (let i = 0; i < 9; i++) {
      const a = random(i + 33) * tau;
      c.beginPath();
      for (let k = 0; k < 7; k++) {
        const r = 22 + k * 10,
          turn = a + Math.sin(k * 1.7 + i) * 0.09;
        const x = Math.cos(turn) * r,
          y = Math.sin(turn) * r;
        k ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.strokeStyle = alpha('#2d251b', 0.68);
      c.lineWidth = 1.7;
      c.stroke();
      c.strokeStyle = alpha(tint(e.color, 0.28), 0.68);
      c.lineWidth = 0.4;
      c.stroke();
    }
  }
  for (let i = 0; i < (front ? 5 : 11); i++) {
    const a = random(i + 151) * tau + t * 0.09,
      life = fract(t * 0.22 + random(i + 52)),
      radius = 72 + random(i + 75) * 15;
    const x = Math.cos(a) * radius,
      y = Math.sin(a) * radius,
      z = Math.sin(life * Math.PI) * 8;
    if (front) {
      glow(c, x + 4, y + 5, 10, '#1c1710', 0.28);
    }
    physicalProp(
      c,
      'rock',
      x,
      y - z,
      front ? 12 + random(i + 19) * 9 : 16 + random(i + 19) * 17,
      a + t * 0.13,
      0.8,
      e.color,
    );
    materialSprite(
      c,
      e.color,
      'vapor',
      x,
      y,
      28 + life * 33,
      a,
      t * 0.3 + i,
      Math.sin(life * Math.PI) * (front ? 0.16 : 0.28),
    );
  }
  c.restore();
}
export function curseFlow(
  c: CanvasRenderingContext2D,
  color: string,
  t: number,
  random: (i: number) => number,
  front: boolean,
) {
  for (let i = 0; i < (front ? 11 : 8); i++) {
    const life = fract(t * 0.38 + random(i)),
      a = random(i + 48) * tau + t * 0.1,
      r = 98 - life * 48;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    materialSprite(
      c,
      tint(color, 0.42, '#271229'),
      'vapor',
      x,
      y,
      39 + life * 22,
      a + 1.2,
      t * 0.63 + i,
      Math.sin(life * Math.PI) * (front ? 0.62 : 0.55),
    );
    materialSprite(
      c,
      color,
      'energy',
      x,
      y,
      21 + life * 18,
      a,
      t * 0.8 + i,
      Math.sin(life * Math.PI) * 0.32,
    );
    if (front && i % 2 === 0) glow(c, x, y, 2.4, color, Math.sin(life * Math.PI) * 0.6);
  }
}
