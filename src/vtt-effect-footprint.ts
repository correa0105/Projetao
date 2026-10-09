export type EffectPoint = { x: number; y: number; nx: number; ny: number };
type Sample = {
  body: EffectPoint[];
  edge: EffectPoint[];
  aspect: number;
  mask?: HTMLCanvasElement;
  source?: HTMLImageElement;
};
export type EffectFootprint = Sample & {
  sx: number;
  sy: number;
  plane: { rx: number; ry: number };
};
const samples = new WeakMap<HTMLImageElement, Sample>();
const fallback: Sample = {
  aspect: 1,
  body: [
    { x: 0, y: -0.2, nx: 0, ny: -1 },
    { x: -0.22, y: 0, nx: -1, ny: 0 },
    { x: 0.22, y: 0, nx: 1, ny: 0 },
    { x: 0, y: 0.2, nx: 0, ny: 1 },
  ],
  edge: [
    { x: -0.3, y: -0.15, nx: -1, ny: -1 },
    { x: 0.3, y: -0.15, nx: 1, ny: -1 },
    { x: -0.22, y: 0.28, nx: -1, ny: 1 },
    { x: 0.22, y: 0.28, nx: 1, ny: 1 },
  ],
};
function compact(points: EffectPoint[], limit: number) {
  return points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / limit)) === 0);
}
// Read alpha once when an image loads. Animation never reads pixels. Weak keys
// let room images and their sampled masks be collected when the room closes.
function sample(image?: HTMLImageElement): Sample {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return fallback;
  const old = samples.get(image);
  if (old) return old;
  const aspect = image.naturalWidth / image.naturalHeight;
  try {
    const mask = document.createElement('canvas');
    mask.width = 64;
    mask.height = 64;
    const c = mask.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(image, 0, 0, 64, 64);
    const pixels = c.getImageData(0, 0, 64, 64).data;
    const solid = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < 64 && y < 64 && pixels[(y * 64 + x) * 4 + 3] > 100;
    const body: EffectPoint[] = [],
      edge: EffectPoint[] = [];
    for (let y = 1; y < 63; y++)
      for (let x = 1; x < 63; x++) {
        if (!solid(x, y)) continue;
        const nx = Number(solid(x - 1, y)) - Number(solid(x + 1, y));
        const ny = Number(solid(x, y - 1)) - Number(solid(x, y + 1));
        const length = Math.hypot(nx, ny) || 1;
        const p = {
          x: (x + 0.5) / 64 - 0.5,
          y: (y + 0.5) / 64 - 0.5,
          nx: nx / length,
          ny: ny / length,
        };
        body.push(p);
        if (nx || ny || !solid(x - 1, y - 1) || !solid(x + 1, y + 1)) edge.push(p);
      }
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 64, 64);
    const result =
      body.length && edge.length
        ? { body: compact(body, 120), edge: compact(edge, 100), aspect, mask, source: image }
        : { ...fallback, aspect };
    samples.set(image, result);
    return result;
  } catch {
    // A cross-origin custom image can be tainted; rendering remains available.
    const result = { ...fallback, aspect };
    samples.set(image, result);
    return result;
  }
}
export function effectFootprint(
  width: number,
  height: number,
  rx: number,
  ry: number,
  image?: HTMLImageElement,
): EffectFootprint {
  const s = sample(image),
    fit = Math.min(width / s.aspect, height);
  const radius = Math.max(fit * s.aspect, fit) * 0.43;
  return {
    ...s,
    sx: ((fit * s.aspect) / rx) * 100,
    sy: (fit / ry) * 100,
    plane: { rx: (radius / rx) * 100, ry: (radius / ry) * 100 },
  };
}
export function footprintPoint(f: EffectFootprint, index: number, edge = false) {
  const points = edge ? f.edge : f.body,
    p = points[((index % points.length) + points.length) % points.length];
  return { x: p.x * f.sx, y: p.y * f.sy, nx: p.nx, ny: p.ny };
}
const tints = new Map<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
// A small LRU for tinted alpha masks, with no frame-time image-data processing.
export function paintFootprint(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  opacity: number,
) {
  if (!f.mask) return;
  let colors = tints.get(f.mask);
  if (!colors) {
    if (tints.size >= 24) tints.delete(tints.keys().next().value!);
    colors = new Map();
    tints.set(f.mask, colors);
  }
  let mask = colors.get(color);
  if (!mask) {
    if (colors.size >= 4) colors.delete(colors.keys().next().value!);
    mask = document.createElement('canvas');
    mask.width = mask.height = 64;
    const ctx = mask.getContext('2d')!;
    ctx.drawImage(f.mask, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    colors.set(color, mask);
  }
  c.save();
  c.globalAlpha *= opacity;
  c.drawImage(mask, -f.sx / 2, -f.sy / 2, f.sx, f.sy);
  c.restore();
}
