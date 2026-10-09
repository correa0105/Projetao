// Original offline density simulation: 48 evolving frames per field, seamless
// two-second period. Frame interpolation is premultiplied on a reusable canvas.
// No per-frame pixel reads, video players or scene-dependent cache entries.
export type TemporalField = 'ring' | 'wave' | 'geyser' | 'spiral' | 'tongue' | 'vapour' | 'vortex';
const kinds: TemporalField[] = ['ring', 'wave', 'geyser', 'spiral', 'tongue', 'vapour', 'vortex'];
const pages = new Map<string, HTMLImageElement>();
export const temporalFieldsReady = Promise.all(
  kinds.flatMap((kind) =>
    [0, 1, 2].map(async (page) => {
      if (typeof Image === 'undefined') return;
      const image = new Image();
      image.src = `/vtt/temporal-20261009/${kind}-${page}.webp`;
      try {
        await image.decode();
        pages.set(`${kind}-${page}`, image);
      } catch {
        /* optional art */
      }
    }),
  ),
);
export const temporalPageCount = () => pages.size;
const tiles = new Map<TemporalField, HTMLCanvasElement>();
export const temporalTileCount = () => tiles.size;
function frame(c: CanvasRenderingContext2D, kind: TemporalField, frame: number) {
  const index = ((frame % 48) + 48) % 48,
    page = Math.floor(index / 16),
    cell = index % 16;
  const image = pages.get(`${kind}-${page}`);
  if (image)
    c.drawImage(
      image,
      (cell % 4) * 260 + 2,
      Math.floor(cell / 4) * 260 + 2,
      256,
      256,
      0,
      0,
      256,
      256,
    );
}
export function temporalField(
  c: CanvasRenderingContext2D,
  kind: TemporalField,
  t: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
  opacity = 1,
  color?: string,
) {
  let tile = tiles.get(kind);
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    tiles.set(kind, tile);
  }
  const paint = tile.getContext('2d')!,
    age = t * 24,
    mix = age - Math.floor(age);
  paint.clearRect(0, 0, 256, 256);
  paint.globalCompositeOperation = 'source-over';
  paint.globalAlpha = 1 - mix;
  frame(paint, kind, Math.floor(age));
  // Add premultiplied frames: source-over would darken interpolated alpha edges.
  paint.globalCompositeOperation = 'lighter';
  paint.globalAlpha = mix;
  frame(paint, kind, Math.floor(age) + 1);
  paint.globalAlpha = 1;
  if (color && (kind === 'vapour' || kind === 'vortex')) {
    paint.globalCompositeOperation = 'source-atop';
    paint.fillStyle = color;
    paint.globalAlpha = 0.55;
    paint.fillRect(0, 0, 256, 256);
    paint.globalAlpha = 1;
  }
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.globalAlpha *= opacity;
  if (color && kind !== 'vapour' && kind !== 'vortex') {
    const r = parseInt(color.slice(1, 3), 16),
      g = parseInt(color.slice(3, 5), 16),
      b = parseInt(color.slice(5, 7), 16);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      delta = max - min;
    const hue = !delta
      ? 0
      : max === r
        ? 60 * ((g - b) / delta)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
    // Hue only preserves the ivory cores and red/amber temperature shading.
    c.filter = `hue-rotate(${hue - 25}deg)`;
  }
  c.drawImage(tile, -w / 2, -h / 2, w, h);
  c.restore();
}
