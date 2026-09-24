import sharp from 'sharp';
import { resolve } from 'node:path';

const tileRoot = resolve('docs/references/kingdom-master-tiles');
const tileSize = 1254;
const core = 1080;
const overlap = (tileSize - core) / 2; // Margem de registro: 87 px por lado.
const blendHalf = 43; // Mistura efetiva de 86 px entre vizinhos: 8% do núcleo.
const size = core * 4;
const tiles = await Promise.all(Array.from({ length: 16 }, async (_, index) => {
  const row = Math.floor(index / 4) + 1;
  const column = index % 4 + 1;
  const path = resolve(tileRoot, `detail-r${row}-c${column}.png`);
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== tileSize || info.height !== tileSize || info.channels !== 3) {
    throw new Error(`${path}: esperado ${tileSize}×${tileSize} RGB.`);
  }
  return data;
}));

const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
function edgeWeight(position: number, index: number) {
  if (index > 0 && position < overlap + blendHalf)
    return smoothstep((position - overlap + blendHalf) / (blendHalf * 2));
  if (index < 3 && position > tileSize - overlap - blendHalf)
    return smoothstep((tileSize - overlap + blendHalf - position) / (blendHalf * 2));
  return 1;
}

const output = Buffer.alloc(size * size * 3);
for (let y = 0; y < size; y++) {
  const rows = [Math.floor(y / core)];
  if (y % core < overlap) rows.unshift(rows[0] - 1);
  if (y % core >= core - overlap) rows.push(rows[rows.length - 1] + 1);
  for (let x = 0; x < size; x++) {
    const columns = [Math.floor(x / core)];
    if (x % core < overlap) columns.unshift(columns[0] - 1);
    if (x % core >= core - overlap) columns.push(columns[columns.length - 1] + 1);
    let weightSum = 0, red = 0, green = 0, blue = 0;
    for (const row of rows) {
      if (row < 0 || row > 3) continue;
      const ty = y - row * core + overlap;
      if (ty < 0 || ty >= tileSize) continue;
      const wy = edgeWeight(ty, row);
      for (const column of columns) {
        if (column < 0 || column > 3) continue;
        const tx = x - column * core + overlap;
        if (tx < 0 || tx >= tileSize) continue;
        const weight = wy * edgeWeight(tx, column);
        const source = (ty * tileSize + tx) * 3;
        const tile = tiles[row * 4 + column];
        red += tile[source] * weight;
        green += tile[source + 1] * weight;
        blue += tile[source + 2] * weight;
        weightSum += weight;
      }
    }
    const target = (y * size + x) * 3;
    output[target] = Math.round(red / weightSum);
    output[target + 1] = Math.round(green / weightSum);
    output[target + 2] = Math.round(blue / weightSum);
  }
}
await sharp(output, { raw: { width: size, height: size, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve('public/kingdom/terrain-hires.png'));
console.log(`Montagem ${size}×${size} px com mistura efetiva de ${blendHalf * 2} px (${(blendHalf * 200 / core).toFixed(1)}%) entre vizinhos.`);
