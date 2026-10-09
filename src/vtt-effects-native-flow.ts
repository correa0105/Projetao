import { materialSprite } from './vtt-effects-materials';

export const flowArtIds = [
  'leafy-vine',
  'thorn-vine',
  'chain-strip',
  'ghost-wisp',
  'flame-tongue',
  'water-curl',
  'cloud-wisp',
  'light-stream',
  'boat-foam',
] as const;
export type FlowArt = (typeof flowArtIds)[number];
const images = new Map<FlowArt, HTMLImageElement>();
const colors = new Map<string, HTMLCanvasElement>();
const arcs = new Map<string, HTMLCanvasElement>();
export const nativeArcCacheSize = () => arcs.size;
type InkProfile = { first: number; last: number; centers: number[]; height: number };
const inkProfiles = new Map<FlowArt, InkProfile>();
export const nativeFlowReady = Promise.all(
  flowArtIds.map(async (id) => {
    if (typeof Image === 'undefined') return;
    const image = new Image();
    image.src = '/vtt/refined-2124-20261009/' + id + '.webp';
    try {
      await image.decode();
      images.set(id, image);
      if (['chain-strip', 'water-curl', 'cloud-wisp', 'light-stream'].includes(id)) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const c = canvas.getContext('2d', { willReadFrequently: true })!;
        c.drawImage(image, 0, 0, 512, 512);
        const data = c.getImageData(0, 0, 512, 512).data,
          centers = Array<number>(512).fill(256);
        let first = 512,
          last = 0,
          height = 1;
        for (let x = 0; x < 512; x++) {
          let weight = 0,
            sum = 0,
            top = 512,
            bottom = 0;
          for (let y = 0; y < 512; y++) {
            const a = data[(y * 512 + x) * 4 + 3];
            if (a > 75) {
              weight += a;
              sum += y * a;
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
          if (weight > 450) {
            first = Math.min(first, x);
            last = x;
            centers[x] = sum / weight;
            height = Math.max(height, bottom - top + 20);
          }
        }
        if (last > first) inkProfiles.set(id, { first, last, centers, height });
      }
    } catch {
      /* Local material fallback remains visible. */
    }
  }),
);
export const nativeFlowCount = () => images.size;
export const nativeFlowCacheSize = () => colors.size;
function hue(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d < 0.001) return 0;
  return (
    ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360
  );
}

export function chainLoop(
  c: CanvasRenderingContext2D,
  radius: number,
  t: number,
  color: string,
  front: boolean,
) {
  const art = texture('chain-strip', color),
    profile = inkProfiles.get('chain-strip');
  if (!art || !profile) {
    flowSprite(c, 'chain-strip', 0, radius, 130, 70, 0, t, 0.9, color);
    return;
  }
  const samples = 108,
    repeats = 3,
    sourceWidth = profile.last - profile.first;
  const take = (sourceWidth * repeats) / samples;
  const extent = (radius * Math.PI * 2) / samples;
  // Recenter each native strip on its ink center, then bend it continuously
  // around the collar. Interlocked shaded links retain their original texture.
  for (let i = 0; i < samples; i++) {
    const a = (i * Math.PI * 2) / samples + Math.sin(t * 0.6) * 0.055;
    if (Math.sin(a) > 0 !== front) continue;
    const sx = profile.first + (i % (samples / repeats)) * take;
    const center = profile.centers[Math.min(511, Math.round(sx + take * 0.5))];
    const r = radius + Math.sin(a * 3 + t) * 1.2;
    const height = ((profile.height * extent) / take) * 0.78;
    c.save();
    c.translate(Math.cos(a) * r, Math.sin(a) * r);
    c.rotate(a + Math.PI / 2);
    c.drawImage(
      art,
      sx,
      center - profile.height * 0.5,
      Math.min(take + 1, 512 - sx),
      profile.height,
      -extent * 0.5,
      -height * 0.5,
      extent + extent / take,
      height,
    );
    c.restore();
  }
}

// Keep the source shading and alpha. A small color glaze never replaces the
// detail with a flat silhouette; caching also avoids frame-time pixel reads.
function texture(id: FlowArt, color?: string): CanvasImageSource | undefined {
  const image = images.get(id);
  if (!image || !color) return image;
  const key = id + color,
    old = colors.get(key);
  if (old) return old;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  const originalHue: Partial<Record<FlowArt, number>> = {
    'flame-tongue': 31,
    'water-curl': 190,
    'ghost-wisp': 201,
    'light-stream': 43,
  };
  if (originalHue[id] !== undefined)
    c.filter = 'hue-rotate(' + (hue(color) - originalHue[id]!) + 'deg)';
  c.drawImage(image, 0, 0, 512, 512);
  c.filter = 'none';
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = id === 'cloud-wisp' ? 0.55 : 0.18;
  c.fillStyle = color;
  c.fillRect(0, 0, 512, 512);
  if (colors.size >= 32) colors.delete(colors.keys().next().value!);
  colors.set(key, canvas);
  return canvas;
}

export function flowSprite(
  c: CanvasRenderingContext2D,
  id: FlowArt,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  phase: number,
  opacity: number,
  color?: string,
) {
  if (opacity <= 0.001) return;
  const art = texture(id, color);
  if (!art) {
    materialSprite(
      c,
      color || '#cadce5',
      id === 'flame-tongue' ? 'flame' : 'vapor',
      x,
      y,
      Math.max(width, height),
      angle,
      phase,
      opacity,
    );
    return;
  }
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalAlpha *= opacity;
  const source = art as HTMLImageElement | HTMLCanvasElement;
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const slices = id === 'chain-strip' ? 12 : 10;
  // Overlap the source sampling by one pixel to avoid seams as a strand bends.
  for (let i = 0; i < slices; i++) {
    const u = (i + 0.5) / slices,
      sx = (i * sw) / slices;
    const take = Math.min(sw - sx, sw / slices + 1);
    const sway =
      Math.sin(u * 6 - phase * 2) *
      Math.sin(u * Math.PI) *
      height *
      (id === 'chain-strip' ? 0.012 : 0.038);
    c.drawImage(
      art,
      sx,
      0,
      take,
      sh,
      -width / 2 + (i * width) / slices,
      -height / 2 + sway,
      (width * take) / sw,
      height,
    );
  }
  c.restore();
}

export function flowArc(
  c: CanvasRenderingContext2D,
  id: FlowArt,
  radius: number,
  start: number,
  sweep: number,
  t: number,
  opacity: number,
  color: string | undefined,
  front: boolean | undefined,
  drift = 0,
  thickness = 0.48,
) {
  const art = texture(id, color),
    profile = inkProfiles.get(id);
  if (!art || !profile) return;
  const key = [id, color, radius, sweep, drift, thickness].join(':'),
    tile = 320,
    frames = 4;
  let atlas = arcs.get(key);
  if (!atlas) {
    const source = document.createElement('canvas');
    source.width = source.height = 512;
    const g = source.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(art, 0, 0, 512, 512);
    const input = g.getImageData(0, 0, 512, 512).data;
    atlas = document.createElement('canvas');
    atlas.width = tile * frames;
    atlas.height = tile;
    const target = atlas.getContext('2d')!,
      output = target.createImageData(tile * frames, tile);
    const sourceWidth = profile.last - profile.first;
    // Bake continuous polar UVs once. Rectangular strips never reach the final
    // water/air field, and frame-time work is only two cached drawImage calls.
    for (let frame = 0; frame < frames; frame++)
      for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
          const px = ((x + 0.5) / tile) * 384 - 192,
            py = ((y + 0.5) / tile) * 384 - 192;
          const angle = (Math.atan2(py, px) + Math.PI * 2) % (Math.PI * 2),
            u = angle / sweep;
          if (u >= 1) continue;
          const phase = (frame * Math.PI * 2) / frames,
            r = radius + (u - 0.5) * drift + Math.sin(u * 7 + phase) * 2.2;
          const sx = profile.first + u * sourceWidth;
          const sy =
            profile.centers[Math.round(sx)] +
            ((Math.hypot(px, py) - r) * sourceWidth) / (radius * sweep * thickness) +
            Math.sin(u * 17 - phase) * 2;
          if (sx < 0 || sy < 0 || sx >= 511 || sy >= 511) continue;
          const ix = Math.floor(sx),
            iy = Math.floor(sy),
            fx = sx - ix,
            fy = sy - iy;
          const offsets = [
            (iy * 512 + ix) * 4,
            (iy * 512 + ix + 1) * 4,
            ((iy + 1) * 512 + ix) * 4,
            ((iy + 1) * 512 + ix + 1) * 4,
          ];
          const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
          const alpha = offsets.reduce((sum, p, i) => sum + input[p + 3] * weights[i], 0);
          if (alpha < 1) continue;
          const out = (y * tile * frames + frame * tile + x) * 4;
          for (let channel = 0; channel < 3; channel++)
            output.data[out + channel] =
              offsets.reduce(
                (sum, p, i) => sum + input[p + channel] * input[p + 3] * weights[i],
                0,
              ) / alpha;
          const margin = Math.max(0, Math.min(1, (192 - Math.hypot(px, py)) / 25));
          output.data[out + 3] =
            alpha * Math.sin(u * Math.PI) ** 0.5 * margin * margin * (3 - 2 * margin);
        }
    target.putImageData(output, 0, 0);
    if (arcs.size >= 16) arcs.delete(arcs.keys().next().value!);
    arcs.set(key, atlas);
  }
  const position = ((((t * 0.7) % 1) + 1) % 1) * frames,
    first = Math.floor(position),
    blend = position - first;
  c.save();
  if (front !== undefined) {
    c.beginPath();
    c.rect(-192, front ? 0 : -192, 384, 192);
    c.clip();
  }
  c.rotate(start);
  for (let i = 0; i < 2; i++) {
    c.save();
    c.globalAlpha *= opacity * (i ? blend : 1 - blend);
    c.drawImage(atlas, ((first + i) % frames) * tile, 0, tile, tile, -192, -192, 384, 384);
    c.restore();
  }
  c.restore();
}

export function boatWake(c: CanvasRenderingContext2D, t: number, power: number) {
  // Two broken foam trails advect aft, widen and dissolve. No looping strokes.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const age = (((t * 0.34 + i / 3) % 1) + 1) % 1;
      const fade = Math.sin(age * Math.PI) ** 1.4;
      const extent = 48 + age * 28;
      flowSprite(
        c,
        'boat-foam',
        side * (32 + age * 13),
        66 + age * 48,
        extent,
        extent,
        Math.PI * 0.75 + side * 0.1,
        t + i,
        power * fade * 0.47,
      );
    }
}
