import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = 'data/house2/walls-20261018';
const plan = JSON.parse(await fs.readFile(root + '/prompts.json', 'utf8'));
const catalog = [],
  tiles = [],
  hashes = new Set();
await fs.mkdir('public/house2/walls-20261018', { recursive: true });
await fs.mkdir('public/house2/wall-thumbs-20261018', { recursive: true });
for (const [index, row] of plan.entries()) {
  const metadataPath = `${root}/completed/${row.id}.json`,
    metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const source = await fs.readFile(metadata.localSource);
  const output = await sharp(source)
    .resize(768, 768, { fit: 'cover' })
    .removeAlpha()
    .webp({ quality: 94, effort: 5 })
    .toBuffer();
  const thumbnail = `/house2/wall-thumbs-20261018/${row.id}.webp`;
  await fs.writeFile('public' + row.image, output);
  await sharp(output)
    .resize(192, 192)
    .webp({ quality: 88 })
    .toFile('public' + thumbnail);
  const sha256 = createHash('sha256').update(output).digest('hex');
  hashes.add(sha256);
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        ...metadata,
        thumbnail,
        sha256,
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        width: 768,
        height: 768,
        opaque: true,
      },
      null,
      2,
    ) + '\n',
  );
  catalog.push({
    id: row.id,
    name: row.name,
    price: row.price,
    kind: 'walls',
    image: row.image,
    thumbnail,
  });
  const label = Buffer.from(
    `<svg width="224" height="32"><text x="6" y="21" fill="#e8dec6" font-family="sans-serif" font-size="12">${index + 1}. ${row.name}</text></svg>`,
  );
  const tile = await sharp({
    create: { width: 224, height: 256, channels: 3, background: '#191b17' },
  })
    .composite([
      { input: await sharp(output).resize(220, 220).toBuffer(), left: 2, top: 0 },
      { input: label, left: 0, top: 222 },
    ])
    .png()
    .toBuffer();
  tiles.push({ input: tile, left: (index % 5) * 224, top: Math.floor(index / 5) * 256 });
}
if (hashes.size !== 22) throw Error('Expected 22 distinct materials');
await fs.writeFile(
  'shared/house2-wall-finishes-20261018.json',
  JSON.stringify(catalog, null, 2) + '\n',
);
await sharp({ create: { width: 1120, height: 1280, channels: 3, background: '#191b17' } })
  .composite(tiles)
  .png()
  .toFile(root + '/review.png');
console.log('Prepared 22 wall materials and thumbnails');
