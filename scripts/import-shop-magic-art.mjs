import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const arg = (k) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3);
const id = arg('id'),
  source = arg('source'),
  promptFile = arg('prompt');
assert(id && /^[a-z0-9][a-z0-9-]{0,120}$/.test(id), 'Safe original item ID required');
assert(
  source && path.isAbsolute(source) && promptFile,
  'Native generated source and prompt required',
);
const png = await fs.readFile(source),
  meta = await sharp(png).metadata();
assert(meta.hasAlpha, 'Native alpha required');
const stats = await sharp(png).stats(),
  a = stats.channels[3];
assert(
  a && a.min === 0 && a.max > 200 && a.mean > 5 && a.mean < 230,
  'Meaningful native alpha coverage required',
);
const nativeDir = '.local/shop-completion/native';
await fs.mkdir(nativeDir, { recursive: true });
await fs.copyFile(source, `${nativeDir}/${id}.png`);
const dest = `public/shop/magic-completion-20261009/${id}.webp`;
await fs.mkdir(path.dirname(dest), { recursive: true });
const image = await sharp(png)
  .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 94, effort: 6, alphaQuality: 100 })
  .toBuffer();
await fs.writeFile(dest, image);
const dir = 'data/shop-magic-completion-20261009',
  manifestFile = dir + '/art-manifest.json';
await fs.mkdir(dir, { recursive: true });
let manifest;
try {
  manifest = JSON.parse(await fs.readFile(manifestFile));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  manifest = { tool: 'image_gen.imagegen', assets: [] };
}
const hash = (b) => createHash('sha256').update(b).digest('hex');
assert(
  !manifest.assets.some((x) => x.id !== id && x.sha256 === hash(image)),
  'Duplicate generated image',
);
const asset = {
  id,
  path: dest.replace(/^public/, ''),
  native: `${nativeDir}/${id}.png`,
  native_sha256: hash(png),
  sha256: hash(image),
  width: (await sharp(image).metadata()).width,
  height: (await sharp(image).metadata()).height,
  prompt: await fs.readFile(promptFile, 'utf8'),
  review: 'pending visual review',
};
manifest.assets = manifest.assets.filter((x) => x.id !== id);
manifest.assets.push(asset);
await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log('Saved original native-alpha art:', id, asset.width, asset.height);
