import fs from 'node:fs/promises';
import sharp from 'sharp';
const { assets } = JSON.parse(
  await fs.readFile('data/vtt/cinematic-environment-native-20261009.json', 'utf8'),
);
for (const { id, source } of assets) {
  const m = await sharp(source).metadata();
  if (!m.hasAlpha) throw Error('Native alpha required: ' + id);
  await sharp(source)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 96, alphaQuality: 100 })
    .toFile('public/vtt/animated-assets-20261009/' + id + '.webp');
}
console.log('Eight original individual transparent environment cutouts converted.');
