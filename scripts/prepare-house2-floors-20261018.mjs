import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = 'data/house2/floors-20261018';
const plan = JSON.parse(await fs.readFile(root + '/prompts.json', 'utf8'));
const catalog = [],
  tiles = [];
await fs.mkdir('public/house2/floors-20261018', { recursive: true });
await fs.mkdir('public/house2/floor-thumbs-20261018', { recursive: true });
for (const [index, row] of plan.entries()) {
  const metadataPath = `${root}/completed/${row.id}.json`;
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const source = await fs.readFile(metadata.localSource);
  const output = await sharp(source)
    .resize(1280, 1280, { fit: 'cover' })
    .removeAlpha()
    .webp({ quality: 94, effort: 5 })
    .toBuffer();
  const thumbnail = `/house2/floor-thumbs-20261018/${row.id}.webp`;
  await fs.writeFile('public' + row.image, output);
  await sharp(output)
    .resize(192, 192)
    .webp({ quality: 88 })
    .toFile('public' + thumbnail);
  const sha256 = createHash('sha256').update(output).digest('hex');
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        ...metadata,
        thumbnail,
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        sha256,
        width: 1280,
        height: 1280,
        opaque: true,
      },
      null,
      2,
    ) + '\n',
  );
  catalog.push({
    id: row.id,
    name: row.name,
    kind: 'floor',
    price: row.price,
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
if (new Set(catalog.map((row) => row.id)).size !== 20)
  throw Error('Expected twenty distinct floors');
await fs.writeFile(
  'shared/house2-floor-finishes-20261018.json',
  JSON.stringify(catalog, null, 2) + '\n',
);
await sharp({ create: { width: 1120, height: 1024, channels: 3, background: '#191b17' } })
  .composite(tiles)
  .png()
  .toFile(root + '/review.png');
console.log('Prepared twenty floor materials, thumbnails, provenance and contact sheet');
