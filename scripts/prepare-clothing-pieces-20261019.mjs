import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const inputs = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const assets = [];
await fs.mkdir('public/shop/clothing-pieces-20261019', { recursive: true });
for (const input of inputs) {
  const bytes = await fs.readFile(input.source);
  const output = await sharp(bytes)
    .trim({ background: '#00000000', threshold: 1 })
    .resize(600, 600, { fit: 'contain', background: '#00000000' })
    .webp({ quality: 92 })
    .toBuffer();
  const stats = await sharp(output).stats();
  if (stats.isOpaque) throw Error('Missing transparency: ' + input.id);
  await fs.writeFile('public' + input.url, output);
  assets.push({
    ...input,
    source: path.basename(input.source),
    nativeSha256: createHash('sha256').update(bytes).digest('hex'),
    sha256: createHash('sha256').update(output).digest('hex'),
  });
}
await fs.writeFile(
  'data/clothing-pieces-art-20261019.json',
  JSON.stringify({ generator: 'built-in image_gen', assets }, null, 2) + '\n',
);
await sharp({ create: { width: 1200, height: 600, channels: 4, background: '#201b17' } })
  .composite(
    await Promise.all(
      assets.map(async (asset, i) => ({
        input: await sharp('public' + asset.url)
          .resize(280, 280)
          .png()
          .toBuffer(),
        left: (i % 4) * 300 + 10,
        top: Math.floor(i / 4) * 300 + 10,
      })),
    ),
  )
  .png()
  .toFile('.local/clothing-pieces-review.png');
console.log('Prepared ' + assets.length + ' transparent individual garment icons.');
