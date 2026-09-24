import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const master = resolve('docs/references/kingdom-master-6x6-v4-4320.png');
const output = resolve('docs/references/kingdom-master-6x6-tiles');
const columns = 6;
const rows = 6;
const core = 720;
const bleed = 29; // Vizinhos compartilham 58 px: 8,06% do núcleo.
const guide = core + bleed * 2;

const metadata = await sharp(master).metadata();
if (metadata.width !== columns * core || metadata.height !== rows * core) {
  throw new Error('O master 6 × 6 deve medir exatamente 4320 × 4320 px.');
}
await mkdir(output, { recursive: true });
const padded = await sharp(master)
  .extend({ top: bleed, bottom: bleed, left: bleed, right: bleed, extendWith: 'mirror' })
  .png()
  .toBuffer();

const tiles: Buffer[][] = [];
for (let row = 0; row < rows; row++) {
  tiles[row] = [];
  for (let column = 0; column < columns; column++) {
    const path = resolve(output, `guide-r${row + 1}-c${column + 1}.png`);
    await sharp(padded)
      .extract({ left: column * core, top: row * core, width: guide, height: guide })
      .png({ compressionLevel: 9 })
      .toFile(path);
    tiles[row][column] = await sharp(path).removeAlpha().raw().toBuffer();
  }
}

// Os pixels comuns são idênticos, inclusive nos cruzamentos de quatro guias.
for (let row = 0; row < rows; row++) {
  for (let column = 0; column < columns; column++) {
    const current = tiles[row][column];
    if (column + 1 < columns) {
      const next = tiles[row][column + 1];
      for (let y = 0; y < guide; y++) {
        const currentStrip = current.subarray((y * guide + core) * 3, (y * guide + guide) * 3);
        const nextStrip = next.subarray(y * guide * 3, (y * guide + bleed * 2) * 3);
        if (!currentStrip.equals(nextStrip)) throw new Error(`Emenda horizontal falhou em r${row + 1} c${column + 1}.`);
      }
    }
    if (row + 1 < rows) {
      const next = tiles[row + 1][column];
      const currentStrip = current.subarray(core * guide * 3);
      const nextStrip = next.subarray(0, bleed * 2 * guide * 3);
      if (!currentStrip.equals(nextStrip)) throw new Error(`Emenda vertical falhou em r${row + 1} c${column + 1}.`);
    }
  }
}
const previewSize = 1254;
const previewCell = previewSize / columns;
const grid = `<svg width="${previewSize}" height="${previewSize}" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#f5e6c7" stroke-opacity=".8" stroke-width="2">
    ${Array.from({ length: columns - 1 }, (_, i) => `<path d="M ${(i + 1) * previewCell} 0 V ${previewSize}"/>`).join('')}
    ${Array.from({ length: rows - 1 }, (_, i) => `<path d="M 0 ${(i + 1) * previewCell} H ${previewSize}"/>`).join('')}
  </g>
  ${Array.from({ length: rows * columns }, (_, i) => `<text x="${(i % columns) * previewCell + 11}" y="${Math.floor(i / columns) * previewCell + 27}" fill="#fff4df" stroke="#17202a" stroke-width="3" paint-order="stroke" font-family="sans-serif" font-size="19" font-weight="bold">${Math.floor(i / columns) + 1},${(i % columns) + 1}</text>`).join('')}
</svg>`;
await sharp(master)
  .resize(previewSize, previewSize)
  .composite([{ input: Buffer.from(grid) }])
  .png()
  .toFile(resolve('docs/references/kingdom-master-6x6-v4-grid.png'));
console.log(`${rows * columns} guias ${guide}×${guide} px; núcleo ${core} px; sobreposição efetiva ${bleed * 2} px (8,06%). Todas as bordas comuns coincidem.`);
