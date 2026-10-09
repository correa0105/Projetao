import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const manifest = JSON.parse(await fs.readFile('data/vtt/refined-flow-2124-20261009.json', 'utf8'));
for (const asset of manifest.assets) {
  await fs.mkdir(path.dirname(asset.file), { recursive: true });
  await sharp(asset.source)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toFile(asset.file);
  const { data, info } = await sharp(asset.file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let edge = 0,
    solid = 0,
    clear = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > 10) solid++;
      else clear++;
      if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && a > 10) edge++;
    }
  if (edge || !solid || clear < solid * 0.15)
    throw Error('Inspect native transparency: ' + asset.id);
  console.log(asset.id + ': native alpha, clear outer edge, ' + solid + ' material pixels');
}
