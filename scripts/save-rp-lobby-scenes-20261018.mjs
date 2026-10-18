import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const assets = JSON.parse(
  await fs.readFile(process.argv[2] || '.local/lobby-scene-input.json', 'utf8'),
);
await fs.mkdir('public/rp-lobby/20261018', { recursive: true });
for (const entry of assets) {
  const bytes = await sharp(entry.source)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 92, effort: 6 })
    .toBuffer();
  entry.url = '/rp-lobby/20261018/' + entry.id + '.webp';
  await fs.writeFile('public' + entry.url, bytes);
  entry.sha256 = createHash('sha256').update(bytes).digest('hex');
  entry.nativeFile = path.basename(entry.source);
  delete entry.source;
}
await fs.writeFile(
  'data/rp-lobby-scenes-20261018.json',
  JSON.stringify({ method: 'built-in image_gen', assets }, null, 2) + '\n',
);
