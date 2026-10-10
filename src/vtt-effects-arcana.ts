import { arcanaEffects, type ArcanaEffectKind } from '../shared/vtt-effects-arcana';
import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { glow } from './vtt-effects-primitives';

const models = new Map(arcanaEffects.map((effect) => [effect.kind, effect]));
type Frames = {
  images: HTMLImageElement[];
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  time: number;
  ready: Promise<void>;
  loaded: boolean;
};
// At most twenty entries, shared by every token and thumbnail. Colors create no new atlases.
const fields = new Map<ArcanaEffectKind, Frames>();
const size = 192,
  tile = 196,
  frames = 32;
function field(kind: ArcanaEffectKind) {
  const cached = fields.get(kind);
  if (cached) return cached;
  const back = document.createElement('canvas'),
    front = document.createElement('canvas');
  back.width = back.height = front.width = front.height = size;
  const images = [new Image(), new Image()];
  const entry: Frames = { images, back, front, time: NaN, ready: Promise.resolve(), loaded: false };
  entry.ready = Promise.all(
    images.map(async (image, page) => {
      image.src = `/vtt/arcana-20261010/${kind}-${page}.webp`;
      await image.decode();
    }),
  )
    .then(() => {
      entry.loaded = true;
    })
    .catch(() => {});
  fields.set(kind, entry);
  return entry;
}
export async function warmArcanaEffects() {
  await Promise.all(arcanaEffects.map((effect) => field(effect.kind).ready));
  return [...fields.values()].filter((x) => x.loaded).length;
}
export function arcanaEffectReady(kind: string) {
  return models.has(kind as ArcanaEffectKind)
    ? field(kind as ArcanaEffectKind).ready
    : Promise.resolve();
}
export function arcanaCacheSize() {
  return fields.size;
}
function paintFrame(entry: Frames, t: number) {
  if (entry.time === t) return;
  entry.time = t;
  const ctx = entry.back.getContext('2d')!,
    age = (((t % 4) + 4) % 4) * 8,
    first = Math.floor(age),
    mix = age - first;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  for (const [frame, weight] of [
    [first, 1 - mix],
    [(first + 1) % frames, mix],
  ]) {
    const page = Math.floor(frame / 16),
      cell = frame % 16;
    ctx.globalAlpha = weight;
    ctx.drawImage(
      entry.images[page],
      (cell % 4) * tile + 2,
      Math.floor(cell / 4) * tile + 2,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    ctx.globalCompositeOperation = 'lighter';
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const overlay = entry.front.getContext('2d')!;
  overlay.clearRect(0, 0, size, size);
  overlay.globalCompositeOperation = 'source-over';
  overlay.drawImage(entry.back, 0, 0);
  overlay.globalCompositeOperation = 'destination-in';
  const depth = overlay.createLinearGradient(0, 0, 0, size);
  depth.addColorStop(0, '#fff0');
  depth.addColorStop(0.5, '#fff0');
  depth.addColorStop(0.82, '#ffffff88');
  depth.addColorStop(1, '#fff');
  overlay.fillStyle = depth;
  overlay.fillRect(0, 0, size, size);
  overlay.globalCompositeOperation = 'source-over';
}
function hue(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)),
    max = Math.max(r, g, b),
    d = max - Math.min(r, g, b);
  return d
    ? max === r
      ? 60 * ((g - b) / d)
      : max === g
        ? 60 * ((b - r) / d + 2)
        : 60 * ((r - g) / d + 4)
    : 0;
}
function customColorFilter(color: string, base: string) {
  const levels = (hex: string) => {
    const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
      max = Math.max(...values),
      min = Math.min(...values);
    return { saturation: max ? (max - min) / max : 0, value: max };
  };
  const target = levels(color),
    original = levels(base);
  return `hue-rotate(${hue(color) - hue(base)}deg) saturate(${target.saturation / Math.max(0.01, original.saturation)}) brightness(${target.value / Math.max(0.01, original.value)})`;
}
export function drawArcanaEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  _random: (i: number) => number,
  front: boolean,
  _detail: number,
) {
  const kind = e.kind as ArcanaEffectKind,
    model = models.get(kind);
  if (!model) return false;
  const entry = field(kind);
  c.save();
  try {
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    if (!entry.loaded) {
      if (!front) glow(c, 0, 0, 104, e.color, 0.06);
      return true;
    }
    paintFrame(entry, t);
    if (front) c.globalAlpha *= 0.42;
    if (e.color !== model.color) c.filter = customColorFilter(e.color, model.color);
    c.drawImage(front ? entry.front : entry.back, -118, -118, 236, 236);
  } finally {
    c.restore();
  }
  return true;
}
