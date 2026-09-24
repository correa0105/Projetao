import sharp from 'sharp';
import { resolve } from 'node:path';

// Legado do mosaico 3×4. Para o terreno ativo 4×4, use stitch-kingdom-master.ts.
// Executar este script substitui terrain-hires.png pela versão antiga.

const root = resolve('public/kingdom');
const columns = 3;
const rows = 4;
// The two original rows remain in the middle. New paintings extend the same
// geography to the north and south instead of replacing it with one image.
const tiles = [
  'north-far-nw', 'north-nw', 'north-ne',
  'far-nw', 'nw', 'ne',
  'far-sw', 'sw', 'se',
  'south-far-sw', 'south-sw', 'south-se',
] as const;
const images = await Promise.all(tiles.map((id) => sharp(resolve(root, `terrain-hires-${id}.png`)).png().toBuffer()));
const dimensions = await Promise.all(images.map((image) => sharp(image).metadata()));
const width = dimensions[0].width!;
const height = dimensions[0].height!;
if (dimensions.some((item) => item.width !== width || item.height !== height)) {
  throw new Error('As doze pinturas devem ter as mesmas dimensões.');
}
const rawTiles = await Promise.all(images.map((image) => sharp(image).removeAlpha().raw().toBuffer()));
const canvasWidth = width * columns;
const canvasHeight = height * rows;
const canvas = Buffer.alloc(canvasWidth * canvasHeight * 3);
for (let index = 0; index < rawTiles.length; index++) {
  const originX = (index % columns) * width;
  const originY = Math.floor(index / columns) * height;
  for (let y = 0; y < height; y++) {
    rawTiles[index].copy(canvas, ((originY + y) * canvasWidth + originX) * 3, y * width * 3, (y + 1) * width * 3);
  }
}
// Correct only a 24 px strip on each side. The original terrain remains sharp;
// the small colour transition conceals exposure changes without blurring paths.
function softenSeam(vertical: boolean, boundary: number) {
  const length = vertical ? canvasHeight : canvasWidth;
  const radius = 24;
  const stride = vertical ? 1 : canvasWidth;
  for (let position = 0; position < length; position++) {
    const origin = vertical ? position * canvasWidth + boundary : boundary * canvasWidth + position;
    const left = (origin - stride) * 3;
    const right = origin * 3;
    for (let channel = 0; channel < 3; channel++) {
      const difference = canvas[left + channel] - canvas[right + channel];
      for (let distance = 0; distance < radius; distance++) {
        const influence = (1 - distance / radius) ** 2 * 0.5;
        const leftIndex = (origin - (distance + 1) * stride) * 3 + channel;
        const rightIndex = (origin + distance * stride) * 3 + channel;
        canvas[leftIndex] = Math.max(0, Math.min(255, Math.round(canvas[leftIndex] - difference * influence)));
        canvas[rightIndex] = Math.max(0, Math.min(255, Math.round(canvas[rightIndex] + difference * influence)));
      }
    }
  }
}
for (let column = 1; column < columns; column++) softenSeam(true, column * width);
for (let row = 1; row < rows; row++) softenSeam(false, row * height);
const smoothstep = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
// Repaint the join between newly generated north/south rows and the preserved
// middle. Edges of each correction dissolve into the unchanged source tiles.
for (const [label, offsetY] of [['north', 512], ['south', 2560]] as const) {
  for (let column = 0; column < columns; column++) {
    const repair = await sharp(resolve(root, `terrain-seam-${label}-${column}.png`))
      .resize(width, height, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    for (let y = 0; y < height; y++) {
      const vertical = 1 - smoothstep((Math.abs(y - height / 2) - 230) / 210);
      if (vertical <= 0) continue;
      for (let x = 0; x < width; x++) {
        const horizontal = smoothstep(Math.min(x, width - 1 - x) / 120);
        const weight = vertical * horizontal;
        if (weight <= 0) continue;
        const target = ((offsetY + y) * canvasWidth + column * width + x) * 3;
        const source = (y * width + x) * 3;
        for (let channel = 0; channel < 3; channel++)
          canvas[target + channel] = Math.round(canvas[target + channel] * (1 - weight) + repair[source + channel] * weight);
      }
    }
  }
}
// The old western join repeated an entire forest clearing and buried a road
// beneath trees. A separately repainted square restores a single connected
// route. Fade only its perimeter into the approved neighboring terrain.
const forestRepair = await sharp(resolve(root, 'terrain-seam-forest.png'))
  .resize(1024, 1024, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
const repairX = 1024, repairY = 1900, repairSize = 1024, feather = 110;
for (let y = 0; y < repairSize; y++) {
  for (let x = 0; x < repairSize; x++) {
    const edge = Math.min(x, y, repairSize - 1 - x, repairSize - 1 - y);
    const weight = smoothstep(edge / feather);
    const target = ((repairY + y) * canvasWidth + repairX + x) * 3;
    const source = (y * repairSize + x) * 3;
    for (let channel = 0; channel < 3; channel++)
      canvas[target + channel] = Math.round(canvas[target + channel] * (1 - weight) + forestRepair[source + channel] * weight);
  }
}
await sharp(canvas, { raw: { width: canvasWidth, height: canvasHeight, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(root, 'terrain-hires.png'));
console.log(`Terreno: ${canvasWidth} × ${canvasHeight} px`);
