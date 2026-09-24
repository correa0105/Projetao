import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const master = resolve('docs/references/kingdom-master-2880.png');
const output = resolve('docs/references/kingdom-master-tiles');
const size = 2880;
const core = size / 4;
const overlap = 58; // 8.1% de cada lado de um núcleo de 720 px.
const guide = core + overlap * 2;

await mkdir(output, { recursive: true });
const padded = await sharp(master)
  .extend({ top: overlap, bottom: overlap, left: overlap, right: overlap, extendWith: 'mirror' })
  .png()
  .toBuffer();
for (let row = 0; row < 4; row++) {
  for (let column = 0; column < 4; column++) {
    await sharp(padded)
      .extract({ left: column * core, top: row * core, width: guide, height: guide })
      .png({ compressionLevel: 9 })
      .toFile(resolve(output, `guide-r${row + 1}-c${column + 1}.png`));
  }
}
console.log(`16 guias ${guide}×${guide} px, núcleo ${core} px, sobreposição ${overlap} px por lado.`);
