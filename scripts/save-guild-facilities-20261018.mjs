import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const assets = JSON.parse(
  await fs.readFile(process.argv[2] || '.local/guild-facility-art-input.json', 'utf8'),
);
assert.equal(assets.length, 8);
await fs.mkdir('public/guild/facilities-20261018', { recursive: true });
const tiles = [];
for (let i = 0; i < assets.length; i++) {
  const entry = assets[i];
  assert(!(await sharp(entry.source).stats()).isOpaque);
  const bytes = await sharp(entry.source)
    .resize(768, 768, { fit: 'inside' })
    .webp({ quality: 95, alphaQuality: 100, effort: 6 })
    .toBuffer();
  entry.url = '/guild/facilities-20261018/' + entry.id + '.webp';
  await fs.writeFile('public' + entry.url, bytes);
  entry.sha256 = createHash('sha256').update(bytes).digest('hex');
  entry.nativeFile = path.basename(entry.source);
  delete entry.source;
  tiles.push({
    input: await sharp(bytes)
      .resize(270, 270, { fit: 'contain', background: '#241d17' })
      .png()
      .toBuffer(),
    left: (i % 4) * 280 + 5,
    top: Math.floor(i / 4) * 280 + 5,
  });
}
await fs.writeFile(
  'data/guild-facility-art-20261018.json',
  JSON.stringify({ method: 'built-in image_gen', assets }, null, 2) + '\n',
);
await sharp({ create: { width: 1120, height: 560, channels: 4, background: '#241d17' } })
  .composite(tiles)
  .png()
  .toFile('.local/guild-facilities-review.png');
console.log('Saved eight guild facilities with real alpha');
