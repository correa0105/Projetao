import sharp from 'sharp';

// The red/brown stroke in the user's sketch is the coastline: sea to the left,
// land to the right. The blue marks lie entirely inside the sea and are not
// copied into the final art. Keep this script to rebuild the master exactly.
const outline = 'docs/references/kingdom-coast-outline.png';
const grass = 'docs/references/kingdom-coast-grass-source.png';
const water = 'docs/references/kingdom-coast-water-source.png';
const master = 'docs/references/kingdom-coast-master.png';
const output = 'public/kingdom/ground-coast.webp';
const preview = 'docs/references/kingdom-coast-master-preview.png';
const width = 4096;
const height = 2078;

const { data, info } = await sharp(outline)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const sourceWidth = info.width;
const sourceHeight = info.height;
const size = sourceWidth * sourceHeight;
const barrier = new Uint8Array(size);

for (let y = 55; y < sourceHeight; y++) {
  for (let x = 0; x < sourceWidth; x++) {
    const pixel = (y * sourceWidth + x) * 4;
    const red = data[pixel];
    const green = data[pixel + 1];
    const blue = data[pixel + 2];
    if (red > 65 && red < 185 && green < 75 && red > green * 1.8 && red > blue * 1.25)
      barrier[y * sourceWidth + x] = 1;
  }
}

// The stroke starts at the bottom edge of Paint's toolbar. Close that gap at
// the top, then join antialiased pixels so the flood fill cannot cross it.
for (let y = 0; y < 56; y++) for (let x = 488; x <= 495; x++) barrier[y * sourceWidth + x] = 1;
const closed = new Uint8Array(size);
for (let y = 0; y < sourceHeight; y++) {
  for (let x = 0; x < sourceWidth; x++) {
    if (!barrier[y * sourceWidth + x]) continue;
    for (let dy = -2; dy <= 2; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= sourceHeight) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < sourceWidth) closed[yy * sourceWidth + xx] = 1;
      }
    }
  }
}

// Fill from the right. A scanline-independent flood fill retains horizontal
// ledges and coves from the sketch instead of flattening them into x(y).
const land = new Uint8Array(size);
const queue = new Int32Array(size);
let head = 0;
let tail = 0;
for (let y = 0; y < sourceHeight; y++) {
  const index = y * sourceWidth + sourceWidth - 1;
  if (!closed[index]) {
    land[index] = 1;
    queue[tail++] = index;
  }
}
while (head < tail) {
  const index = queue[head++];
  const x = index % sourceWidth;
  const y = (index - x) / sourceWidth;
  const neighbours = [
    x > 0 ? index - 1 : -1,
    x + 1 < sourceWidth ? index + 1 : -1,
    y > 0 ? index - sourceWidth : -1,
    y + 1 < sourceHeight ? index + sourceWidth : -1,
  ];
  for (const next of neighbours) {
    if (next < 0 || closed[next] || land[next]) continue;
    land[next] = 1;
    queue[tail++] = next;
  }
}
const landShare = tail / size;
if (landShare < 0.45 || landShare > 0.85)
  throw new Error(`Contorno aberto ou invertido: ${(landShare * 100).toFixed(1)}% de terra`);

const mask = Buffer.alloc(size);
for (let i = 0; i < size; i++) mask[i] = land[i] ? 255 : 0;
const landMask = await sharp(mask, {
  raw: { width: sourceWidth, height: sourceHeight, channels: 1 },
})
  .resize(width, height, { kernel: 'lanczos3' })
  .png()
  .toBuffer();
await sharp(landMask).resize(1698, 861).png().toFile('docs/references/kingdom-coast-land-mask.png');
await sharp(landMask).resize(1698, 861).png().toFile('public/kingdom/coast-mask.png');
const grassLayer = await sharp(grass).resize(width, height, { fit: 'fill' }).png().toBuffer();
const waterLayer = await sharp(water).resize(width, height, { fit: 'fill' }).png().toBuffer();
const maskRaw = await sharp(landMask).extractChannel(0).raw().toBuffer();
const grassRaw = await sharp(grassLayer).removeAlpha().raw().toBuffer();
const grassWithAlpha = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  grassWithAlpha[i * 4] = grassRaw[i * 3];
  grassWithAlpha[i * 4 + 1] = grassRaw[i * 3 + 1];
  grassWithAlpha[i * 4 + 2] = grassRaw[i * 3 + 2];
  grassWithAlpha[i * 4 + 3] = maskRaw[i];
}
const clippedGrass = await sharp(grassWithAlpha, {
  raw: { width, height, channels: 4 },
})
  .png()
  .toBuffer();

// The land texture supplies the detail; blue water stays a separate texture.
// The small warm foreshore follows the exact mask and avoids a painted wave
// direction, so the coastline remains natural in all eight camera angles.
const base = await sharp(waterLayer)
  .composite([{ input: clippedGrass }])
  .png()
  .toBuffer();
const shore = Buffer.alloc(width * height * 4);
const radius = 26;
const distance = new Float32Array(width * height);
for (let i = 0; i < distance.length; i++) distance[i] = maskRaw[i] > 100 ? 1000 : 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (y) distance[i] = Math.min(distance[i], distance[i - width] + 1);
    if (x && y) distance[i] = Math.min(distance[i], distance[i - width - 1] + 1.414);
    if (x + 1 < width && y) distance[i] = Math.min(distance[i], distance[i - width + 1] + 1.414);
  }
}
for (let y = height - 1; y >= 0; y--) {
  for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width] + 1);
    if (x + 1 < width && y + 1 < height)
      distance[i] = Math.min(distance[i], distance[i + width + 1] + 1.414);
    if (x && y + 1 < height) distance[i] = Math.min(distance[i], distance[i + width - 1] + 1.414);
  }
}
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (maskRaw[index] < 160 || distance[index] > radius) continue;
    const outputIndex = index * 4;
    shore[outputIndex] = 185;
    shore[outputIndex + 1] = 161;
    shore[outputIndex + 2] = 109;
    shore[outputIndex + 3] = Math.round(115 * (1 - distance[index] / radius));
  }
}
const shoreLayer = await sharp(shore, { raw: { width, height, channels: 4 } })
  .png()
  .toBuffer();
await sharp(base)
  .composite([{ input: shoreLayer }])
  .png({ compressionLevel: 9, palette: false })
  .toFile(master);
await sharp(master).webp({ quality: 89, effort: 6 }).toFile(output);
await sharp(master).resize(1698, 861).png({ compressionLevel: 9 }).toFile(preview);
console.log(`${master}: ${width} × ${height}, ${(landShare * 100).toFixed(1)}% de terra`);
console.log(`Versão de jogo: ${output}`);
console.log(`Prévia: ${preview}`);
