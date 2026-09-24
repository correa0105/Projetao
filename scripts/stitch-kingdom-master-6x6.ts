import sharp from 'sharp';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Each painted tile has a 960 px core and 39 px of registration on every side.
// The source guides overlap by 8.06%; this output keeps an 8.13% overlap.
const count = 6;
const core = 960;
const bleed = 39;
const tileSize = core + bleed * 2;
const size = core * count;
const root = resolve('docs/references/kingdom-master-6x6-tiles');
const outputPath = resolve('docs/references/kingdom-master-6x6-stitched-5760.png');
const previewPath = resolve('docs/references/kingdom-master-6x6-stitched-preview.png');
const masterPath = resolve('docs/references/kingdom-master-6x6-v4-4320.png');

const master = await sharp(masterPath)
  .resize(size, size, { kernel: 'lanczos3' })
  .removeAlpha()
  .raw()
  .toBuffer();
const residuals: Int16Array[] = [];
for (let row = 1; row <= count; row++) {
  for (let column = 1; column <= count; column++) {
    const path = resolve(root, `detail-r${row}-c${column}.png`);
    const metadata = await sharp(path).metadata();
    if (metadata.width !== 1254 || metadata.height !== 1254)
      throw new Error(`${path}: pintura esperada de 1254 × 1254 px.`);
    const image = sharp(path).resize(tileSize, tileSize, { kernel: 'lanczos3' }).removeAlpha();
    const [paint, blur] = await Promise.all([
      image.clone().raw().toBuffer(),
      image.clone().blur(18).raw().toBuffer(),
    ]);
    const residual = new Int16Array(paint.length);
    for (let i = 0; i < paint.length; i++) residual[i] = paint[i] - blur[i];
    residuals.push(residual);
  }
  console.log(`Detalhe de ${row * count}/${count * count} regiões preparado.`);
}

const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
function edgeWeight(position: number, index: number) {
  if (index > 0 && position < bleed * 2) return smoothstep(position / (bleed * 2));
  if (index < count - 1 && position > tileSize - bleed * 2)
    return smoothstep((tileSize - position) / (bleed * 2));
  return 1;
}
const result = Buffer.alloc(master.length);
for (let y = 0; y < size; y++) {
  const homeRow = Math.floor(y / core);
  const rows = [homeRow];
  if (y % core < bleed) rows.unshift(homeRow - 1);
  if (y % core >= core - bleed) rows.push(homeRow + 1);
  for (let x = 0; x < size; x++) {
    const homeColumn = Math.floor(x / core);
    const columns = [homeColumn];
    if (x % core < bleed) columns.unshift(homeColumn - 1);
    if (x % core >= core - bleed) columns.push(homeColumn + 1);
    const detail = [0, 0, 0];
    let weightSum = 0;
    for (const row of rows) {
      if (row < 0 || row >= count) continue;
      const ty = y - row * core + bleed;
      if (ty < 0 || ty >= tileSize) continue;
      const wy = edgeWeight(ty, row);
      for (const column of columns) {
        if (column < 0 || column >= count) continue;
        const tx = x - column * core + bleed;
        if (tx < 0 || tx >= tileSize) continue;
        const weight = wy * edgeWeight(tx, column);
        const source = (ty * tileSize + tx) * 3;
        const residual = residuals[row * count + column];
        for (let channel = 0; channel < 3; channel++)
          detail[channel] += residual[source + channel] * weight;
        weightSum += weight;
      }
    }
    const target = (y * size + x) * 3;
    for (let channel = 0; channel < 3; channel++)
      result[target + channel] = Math.max(
        0,
        Math.min(255, Math.round(master[target + channel] + (0.95 * detail[channel]) / weightSum)),
      );
  }
  if (y % core === core - 1) console.log(`Linha ${Math.floor(y / core) + 1}/${count} montada.`);
}

await sharp(result, { raw: { width: size, height: size, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);
await sharp(outputPath).resize(1440, 1440).png().toFile(previewPath);
if (process.argv.includes('--install')) {
  await copyFile(outputPath, resolve('public/kingdom/terrain-hires.png'));
  console.log('Terreno instalado em public/kingdom/terrain-hires.png.');
}
console.log(`Mosaico ${size}×${size} px salvo em ${outputPath}.`);
