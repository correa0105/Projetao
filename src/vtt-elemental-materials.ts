// Original offline materials. Ten fixed frame canvases and 21 decoded media;
// no scene/token cache entries and no pixel reads in the animation loop.
export type ElementalMaterial =
  | 'lava'
  | 'blessing'
  | 'resonance'
  | 'acid'
  | 'electric'
  | 'water'
  | 'rift'
  | 'prism'
  | 'fire-volume'
  | 'water-jet';
const kinds: ElementalMaterial[] = [
  'lava',
  'blessing',
  'resonance',
  'acid',
  'electric',
  'water',
  'rift',
  'prism',
  'fire-volume',
  'water-jet',
];
const pages = new Map<string, HTMLImageElement>();
const tiles = new Map<ElementalMaterial, HTMLCanvasElement>();
export const elementalMaterialsReady = Promise.all(
  [...kinds.flatMap((kind) => [0, 1].map((page) => `${kind}-${page}`)), 'earth-fracture'].map(
    async (key) => {
      if (typeof Image === 'undefined') return;
      const img = new Image();
      img.src = `/vtt/elemental-20261009/${key}.webp`;
      try {
        await img.decode();
        pages.set(key, img);
      } catch {
        /* Optional cosmetic media. */
      }
    },
  ),
);
export const elementalMediaCount = () => pages.size;
export const elementalTileCount = () => tiles.size;
function hue(color: string) {
  const r = parseInt(color.slice(1, 3), 16),
    g = parseInt(color.slice(3, 5), 16),
    b = parseInt(color.slice(5, 7), 16);
  const max = Math.max(r, g, b),
    delta = max - Math.min(r, g, b);
  return !delta
    ? 0
    : max === r
      ? 60 * ((g - b) / delta)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);
}
export function elementalMaterial(
  c: CanvasRenderingContext2D,
  kind: ElementalMaterial,
  t: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
  opacity = 1,
  color?: string,
) {
  const sw = kind === 'electric' ? 480 : 256,
    sh = kind === 'electric' ? 128 : 256;
  let tile = tiles.get(kind);
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = sw;
    tile.height = sh;
    tiles.set(kind, tile);
  }
  const g = tile.getContext('2d')!,
    age = t * 24,
    mix = age - Math.floor(age);
  g.clearRect(0, 0, sw, sh);
  for (let next = 0; next < 2; next++) {
    const i = (((Math.floor(age) + next) % 32) + 32) % 32,
      cell = i % 16,
      img = pages.get(`${kind}-${Math.floor(i / 16)}`);
    g.globalCompositeOperation = next ? 'lighter' : 'source-over';
    g.globalAlpha = next ? mix : 1 - mix;
    if (img)
      g.drawImage(
        img,
        (cell % 4) * (sw + 4) + 2,
        Math.floor(cell / 4) * (sh + 4) + 2,
        sw,
        sh,
        0,
        0,
        sw,
        sh,
      );
  }
  g.globalAlpha = 1;
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  c.globalAlpha *= opacity;
  const nativeHue = {
    lava: 30,
    blessing: 42,
    resonance: 210,
    acid: 100,
    electric: 210,
    water: 192,
    rift: 260,
    prism: 0,
    'fire-volume': 25,
    'water-jet': 192,
  }[kind];
  if (color && kind !== 'prism') c.filter = `hue-rotate(${hue(color) - nativeHue}deg)`;
  c.drawImage(tile, -w / 2, -h / 2, w, h);
  c.restore();
}
export function earthFracture(c: CanvasRenderingContext2D, rotation: number) {
  const img = pages.get('earth-fracture');
  if (!img) return;
  c.save();
  c.rotate(rotation);
  c.drawImage(img, -109, -109, 218, 218);
  c.restore();
}
