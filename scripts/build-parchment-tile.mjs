// Mirror the existing texture in SVG; preserve every source pixel and its scale.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = await readFile(new URL('../public/character-parchment-v2.png', import.meta.url));
const { width, height } = await sharp(source).metadata();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width * 2} ${height * 2}">
<defs><image id="paper" width="${width}" height="${height}" xlink:href="data:image/png;base64,${source.toString('base64')}"/></defs>
<use xlink:href="#paper"/>
<use xlink:href="#paper" transform="translate(${width * 2} 0) scale(-1 1)"/>
<use xlink:href="#paper" transform="translate(0 ${height * 2}) scale(1 -1)"/>
<use xlink:href="#paper" transform="translate(${width * 2} ${height * 2}) scale(-1 -1)"/>
</svg>`;
await writeFile(new URL('../public/character-parchment-mirrored.svg', import.meta.url), svg);
