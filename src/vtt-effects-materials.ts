import { fract } from './vtt-effects-primitives';

export type EffectMaterial = 'vapor' | 'flame' | 'energy';
const TILE = 256;
const LIMIT = 24;
const atlases = new Map<string, HTMLCanvasElement>();
const nativeFields = new Map<EffectMaterial, Uint8ClampedArray>();
const FRAMES = 8;
// Decode the original assets once. The procedural atlas remains available on a
// failed request, during loading, and in Canvas-only browsers.
export const effectMaterialsReady = Promise.all(
  (['vapor', 'flame', 'energy'] as const).map(async (material) => {
    if (typeof Image === 'undefined') return;
    const image = new Image();
    image.src = '/vtt/materials-20261009/' + material + '-v1.webp';
    try {
      await image.decode();
      const source = document.createElement('canvas');
      source.width = source.height = TILE;
      const context = source.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, TILE, TILE);
      const pixels = context.getImageData(0, 0, TILE, TILE).data;
      const field = new Uint8ClampedArray(TILE * TILE * FRAMES * 2);
      // A periodic displacement field deforms the smoke instead of merely
      // rotating a flat picture. Shared luminance/alpha avoids repeated noise
      // synthesis for every color; all frame-time work is two drawImage calls.
      for (let frame = 0; frame < FRAMES; frame++) {
        const time = (frame * Math.PI * 2) / FRAMES;
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++) {
            const envelope =
              Math.sin((x / (TILE - 1)) * Math.PI) * Math.sin((y / (TILE - 1)) * Math.PI);
            const flow = material === 'flame' ? 8 : material === 'energy' ? 5 : 7;
            const sx = Math.round(x + Math.sin(y * 0.043 + time) * flow * envelope);
            const sy = Math.round(y + Math.cos(x * 0.039 - time) * flow * envelope);
            const from =
              (Math.max(0, Math.min(TILE - 1, sy)) * TILE + Math.max(0, Math.min(TILE - 1, sx))) *
              4;
            const to = (y * TILE * FRAMES + frame * TILE + x) * 2;
            field[to] =
              pixels[from] * 0.2126 + pixels[from + 1] * 0.7152 + pixels[from + 2] * 0.0722;
            field[to + 1] =
              x < 2 || y < 2 || x >= TILE - 2 || y >= TILE - 2 || pixels[from + 3] < 2
                ? 0
                : pixels[from + 3];
          }
      }
      nativeFields.set(material, field);
      for (const key of atlases.keys()) if (key.endsWith(material)) atlases.delete(key);
    } catch {
      // Keep the bounded local fallback; a missing texture never removes an effect.
    }
  }),
);
export const nativeMaterialCount = () => nativeFields.size;
let bakes = 0;
export const materialCacheSize = () => atlases.size;
export const materialBakeCount = () => bakes;
export const clearMaterialCache = () => {
  atlases.clear();
  bakes = 0;
};
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    u = fract(x),
    v = fract(y);
  const a = u * u * (3 - 2 * u),
    b = v * v * (3 - 2 * v);
  return (
    (hash(ix, iy) * (1 - a) + hash(ix + 1, iy) * a) * (1 - b) +
    (hash(ix, iy + 1) * (1 - a) + hash(ix + 1, iy + 1) * a) * b
  );
}
function turbulence(x: number, y: number) {
  return (
    noise(x, y) * 0.52 +
    noise(x * 2.13, y * 2.13) * 0.28 +
    noise(x * 4.31, y * 4.31) * 0.14 +
    noise(x * 8.71, y * 8.71) * 0.06
  );
}
// Original density/flow fields, baked into two transparent tiles per material.
// Rotation and crossfading animate them without frame-time pixel processing.
function atlas(color: string, material: EffectMaterial) {
  const key = color + material;
  const old = atlases.get(key);
  if (old) {
    atlases.delete(key);
    atlases.set(key, old);
    return old;
  }
  const canvas = document.createElement('canvas');
  const field = nativeFields.get(material);
  if (field) {
    canvas.width = TILE * FRAMES;
    canvas.height = TILE;
    const context = canvas.getContext('2d')!,
      pixels = context.createImageData(canvas.width, TILE);
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    for (let i = 0; i < field.length; i += 2) {
      const luminance = field[i] / 255;
      const hot =
        material === 'vapor'
          ? Math.max(0, luminance - 0.65) * 0.3
          : Math.pow(Math.max(0, (luminance - 0.45) / 0.55), 1.8);
      const shade = material === 'vapor' ? 0.18 + luminance * 0.93 : 0.12 + luminance * 1.05;
      for (let k = 0; k < 3; k++)
        pixels.data[i * 2 + k] =
          rgb[k] * shade * (1 - hot) +
          (material === 'flame' ? [255, 245, 210][k] : [245, 252, 255][k]) * hot;
      pixels.data[i * 2 + 3] = field[i + 1] * (material === 'vapor' ? 0.76 : 0.92);
    }
    context.putImageData(pixels, 0, 0);
    bakes++;
    if (atlases.size >= LIMIT) atlases.delete(atlases.keys().next().value!);
    atlases.set(key, canvas);
    return canvas;
  }
  canvas.width = TILE * 2;
  canvas.height = TILE;
  const c = canvas.getContext('2d')!,
    pixels = c.createImageData(TILE * 2, TILE);
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let variant = 0; variant < 2; variant++)
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const px = (x / (TILE - 1)) * 2 - 1,
          py = (y / (TILE - 1)) * 2 - 1;
        const r = Math.hypot(px, py),
          angle = Math.atan2(py, px),
          offset = variant * 17.3;
        const wx = px * 3.2 + noise(px * 2 + offset, py * 2) * 1.7;
        const wy = py * 3.2 + noise(px * 2, py * 2 + offset) * 1.7;
        const n = turbulence(wx + offset, wy),
          edge = Math.max(0, 1 - r * r);
        let density: number, light: number;
        if (material === 'energy') {
          const flow = Math.sin(angle * 4 + r * 17 + n * 6 + variant * 2);
          const filament = Math.pow(Math.max(0, flow), 7);
          density = Math.pow(edge, 1.6) * (filament * 0.85 + Math.max(0, n - 0.38) * 0.55);
          light = filament * 0.6 + n * 0.25;
        } else if (material === 'flame') {
          const fingers = 0.55 + 0.45 * Math.sin(angle * 7 + n * 7 + r * 8);
          density = Math.pow(edge, 1.3) * Math.max(0, n * 1.65 - 0.5) * (1 + fingers * 0.8);
          light = Math.min(0.72, density * 1.1 + Math.max(0, 0.18 - r * 0.2));
        } else {
          density = Math.pow(edge, 1.4) * Math.max(0, n * 1.75 - 0.45);
          const slope = turbulence(wx - 0.05 + offset, wy - 0.06) - n;
          light = Math.max(0.06, Math.min(0.75, 0.26 + slope * 5 + density * 0.4));
        }
        const index = (y * TILE * 2 + variant * TILE + x) * 4;
        const hot = material === 'flame' ? [255, 238, 158] : [242, 250, 246];
        for (let k = 0; k < 3; k++) {
          const shade = material === 'vapor' ? 0.48 + light * 0.9 : 0.72;
          pixels.data[index + k] = rgb[k] * shade * (1 - light) + hot[k] * light;
        }
        pixels.data[index + 3] = Math.min(255, density * (material === 'vapor' ? 310 : 370));
      }
  c.putImageData(pixels, 0, 0);
  bakes++;
  if (atlases.size >= LIMIT) atlases.delete(atlases.keys().next().value!);
  atlases.set(key, canvas);
  return canvas;
}
export function materialSprite(
  c: CanvasRenderingContext2D,
  color: string,
  material: EffectMaterial,
  x: number,
  y: number,
  size: number,
  angle: number,
  phase: number,
  opacity: number,
) {
  const texture = atlas(color, material),
    frames = texture.width / TILE;
  const position = fract(phase * (frames > 2 ? 1 : 0.5)) * frames;
  const first = Math.floor(position),
    blend = position - first;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  for (let tile = 0; tile < 2; tile++) {
    c.save();
    c.globalAlpha *= opacity * (tile ? blend : 1 - blend);
    c.drawImage(
      texture,
      ((first + tile) % frames) * TILE,
      0,
      TILE,
      TILE,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    c.restore();
  }
  c.restore();
}
