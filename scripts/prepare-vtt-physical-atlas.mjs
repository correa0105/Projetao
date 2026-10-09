import fs from 'node:fs/promises';
import sharp from 'sharp';
const source = process.argv[2];
if (!source) throw Error('Pass the original generated atlas path.');
const meta = await sharp(source).metadata();
if (!meta.hasAlpha) throw Error('The original atlas must have native transparency.');
const names = process.argv[3]?.split(',') || [
  'rock',
  'rubble',
  'petal-rose',
  'petal-ivory',
  'feather',
  'mushrooms',
  'fireball',
  'plasma',
];
const folder = process.argv[4] || 'public/vtt/physical-20261009';
if (names.length !== 8 || names.some((n) => !/^[a-z-]+$/.test(n)))
  throw Error('Eight safe asset names required');
await fs.mkdir(folder, { recursive: true });
for (let i = 0; i < names.length; i++) {
  const left = Math.round(((i % 4) * meta.width) / 4),
    top = Math.round((Math.floor(i / 4) * meta.height) / 2);
  const right = Math.round((((i % 4) + 1) * meta.width) / 4),
    bottom = Math.round(((Math.floor(i / 4) + 1) * meta.height) / 2);
  await sharp(source)
    .extract({ left, top, width: right - left, height: bottom - top })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 96, alphaQuality: 100 })
    .toFile(folder + '/' + names[i] + '.webp');
}
console.log('Eight original native-alpha props cropped and converted without redrawing.');
