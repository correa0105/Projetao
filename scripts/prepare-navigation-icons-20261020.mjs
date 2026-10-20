import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const inputs = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const partial = process.argv.includes('--partial');
if (!partial) assert.equal(inputs.length, 21);
assert.equal(new Set(inputs.map((i) => i.id)).size, inputs.length);
const directory = 'public/navigation/illustrated-20261020';
await fs.mkdir(directory, { recursive: true });
await fs.mkdir('.local/navigation-originals-20261020', { recursive: true });
const assets = [];
for (const input of inputs) {
  const native = await fs.readFile(input.source);
  assert((await sharp(native).metadata()).hasAlpha, input.id + ': native alpha required');
  const image = '/navigation/illustrated-20261020/' + input.id + '.webp';
  const bytes = await sharp(native)
    .trim({ background: '#00000000', threshold: 5 })
    .resize(224, 224, { fit: 'contain', background: '#00000000' })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
    .webp({ quality: 95, alphaQuality: 100 })
    .toBuffer();
  assert(!(await sharp(bytes).stats()).isOpaque, input.id + ': transparency required');
  await fs.writeFile('public' + image, bytes);
  await fs.writeFile('.local/navigation-originals-20261020/' + input.id + '.png', native);
  assets.push({
    id: input.id,
    image,
    source: path.basename(input.source),
    prompt: input.prompt,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourceSha256: createHash('sha256').update(native).digest('hex'),
  });
}
await fs.writeFile(
  'data/navigation-icons-20261020.json',
  JSON.stringify(
    {
      method: 'built-in image_gen; individual referenced illustrations; native alpha preserved',
      assets,
    },
    null,
    2,
  ) + '\n',
);
const rows = Math.ceil(assets.length / 7);
await sharp({ create: { width: 7 * 144, height: rows * 144, channels: 4, background: '#24221e' } })
  .composite(
    await Promise.all(
      assets.map(async (a, i) => ({
        input: await sharp('public' + a.image)
          .resize(128, 128)
          .png()
          .toBuffer(),
        left: (i % 7) * 144 + 8,
        top: Math.floor(i / 7) * 144 + 8,
      })),
    ),
  )
  .png()
  .toFile('.local/navigation-icons-review-20261020.png');
console.log('Prepared ' + assets.length + ' illustrated navigation icons.');
