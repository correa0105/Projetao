import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const args = process.argv.slice(2),
  id = args[args.indexOf('--id') + 1],
  source = args[args.indexOf('--source') + 1];
const root = 'data/vtt/residents-25-20261018',
  plan = JSON.parse(await fs.readFile(root + '/prompts.json')),
  row = plan.find((r) => r.id === id);
if (!row || !source) throw Error('Known id and source required');
const bytes = await fs.readFile(source),
  meta = await sharp(bytes).metadata(),
  stats = await sharp(bytes).stats();
if (!meta.hasAlpha || stats.channels[3].min !== 0 || stats.channels[3].max !== 255)
  throw Error('Real transparent alpha required');
await fs.mkdir('.local/residents-25-sources-20261018', { recursive: true });
await fs.mkdir('public/vtt/residents-25-20261018', { recursive: true });
await fs.mkdir('public/vtt/residents-25-thumbs-20261018', { recursive: true });
const localSource =
  '.local/residents-25-sources-20261018/' + row.image.split('/').at(-1).replace('.webp', '.png');
await fs.copyFile(source, localSource);
const trimmed = await sharp(bytes)
  .trim({ threshold: 1 })
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
const image = await sharp(trimmed)
  .resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 96, alphaQuality: 100, effort: 5 })
  .toBuffer();
await fs.writeFile('public' + row.image, image);
await sharp(image)
  .resize(192, 192)
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile('public' + row.thumbnail);
const sha = (b) => createHash('sha256').update(b).digest('hex');
await fs.writeFile(
  root + '/completed/' + id + '.json',
  JSON.stringify(
    {
      ...row,
      source,
      localSource,
      generator: 'built-in image_gen',
      generatedAt: new Date().toISOString(),
      sourceSha256: sha(bytes),
      sha256: sha(image),
      width: 768,
      height: 768,
      alpha: true,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ id, saved: true }));
