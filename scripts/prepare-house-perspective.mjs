import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const ids = JSON.parse(await fs.readFile('data/house-refit-catalog.json', 'utf8')).map((x) => x.id);
const old = JSON.parse(
  await fs.readFile('public/house/items/house-refit-20261007/art-manifest.json', 'utf8'),
);
const baseSizes = JSON.parse(await fs.readFile('shared/house-view-sizes.json', 'utf8'));
const defaults = {
  rug: 0,
  sofa: 7,
  table: 0,
  chair: 1,
  bench: 1,
  chest: 1,
  books: 1,
  lantern: 1,
  plant: 1,
  statue: 1,
};
const output = 'public/house/items/house-perspective-20261007';
const partial = process.argv.includes('--partial'),
  check = process.argv.includes('--check');
const hash = (b) => createHash('sha256').update(b).digest('hex');
async function measure(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width,
    y0 = info.height,
    x1 = -1,
    y1 = -1,
    clear = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a === 0) clear++;
      if (a > 128) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  if (x1 < x0 || y1 < y0 || (clear / data.length) * 4 < 0.04)
    throw Error('Invalid transparent artwork ' + file);
  return {
    width: info.width,
    height: info.height,
    left: x0,
    top: y0,
    visible_width: x1 - x0 + 1,
    visible_height: y1 - y0 + 1,
  };
}
if (process.argv.includes('--verify-published')) {
  const saved = JSON.parse(await fs.readFile(output + '/art-manifest.json', 'utf8'));
  const calibration = JSON.parse(await fs.readFile('shared/house-intermediate-sizes.json', 'utf8'));
  if (!saved.complete || saved.assets.length !== 82) throw Error('Unfinished sixteen-view library');
  const identities = new Set(),
    hashes = new Set();
  for (const asset of saved.assets) {
    const key = asset.id + '/' + asset.facing;
    if (
      !ids.includes(asset.id) ||
      identities.has(key) ||
      hashes.has(asset.sha256) ||
      asset.path !== `${output}/${key}.webp` ||
      !asset.prompt ||
      !asset.source_sha256
    )
      throw Error('Invalid independent view ' + key);
    if (
      !(asset.facing >= 8 && asset.facing <= 15) &&
      !(['table', 'rug'].includes(asset.id) && asset.facing === 0)
    )
      throw Error('Invalid view ID');
    if (hash(await fs.readFile(asset.path)) !== asset.sha256)
      throw Error('Published hash changed ' + key);
    const bounds = await measure(asset.path);
    if (bounds.width !== asset.width || bounds.height !== asset.height)
      throw Error('Published dimensions changed ' + key);
    if (!(calibration[asset.id]?.[asset.facing] > 0.1))
      throw Error('Missing calibrated physical width ' + key);
    identities.add(key);
    hashes.add(asset.sha256);
  }
  for (const id of ids)
    for (let facing = 8; facing < 16; facing++)
      if (!identities.has(id + '/' + facing))
        throw Error('Missing intermediate ' + id + '/' + facing);
  for (const [file, sha] of Object.entries(old.protected_assets.files))
    if (hash(await fs.readFile(file)) !== sha)
      throw Error('Protected letter/frame changed ' + file);
  console.log(
    JSON.stringify({
      new_views: 82,
      movable_furniture_views: 160,
      letter_frame_views: 16,
      protected_files: 'unchanged',
    }),
  );
  process.exit(0);
}
let previous = { assets: [] };
try {
  previous = JSON.parse(await fs.readFile(output + '/art-manifest.json', 'utf8'));
} catch {}
const assets = [],
  sizes = {},
  missing = [];
for (const id of ids) {
  sizes[id] = [];
  const reference = old.assets.find((a) => a.id === id && a.facing === defaults[id]);
  for (const facing of [
    ...Array.from({ length: 8 }, (_, i) => i + 8),
    ...(['table', 'rug'].includes(id) ? [0] : []),
  ]) {
    const source = `.local/house-perspective-source/${id}/${facing}.png`;
    let record;
    try {
      record = JSON.parse(await fs.readFile(source.replace('.png', '.json'), 'utf8'));
    } catch {
      missing.push(id + '/' + facing);
      continue;
    }
    const bytes = await fs.readFile(source);
    if (hash(bytes) !== record.sha256) throw Error('Source hash changed ' + source);
    const info = await sharp(bytes).metadata();
    if (!info.hasAlpha) throw Error('Missing alpha ' + source);
    const bounds = await measure(source),
      file = `${output}/${id}/${facing}.webp`;
    const cached = previous.assets.find(
      (a) => a.id === id && a.facing === facing && a.source_sha256 === record.sha256,
    );
    let reusable = false;
    try {
      reusable = !!cached && hash(await fs.readFile(file)) === cached.sha256;
    } catch {}
    if (!check && !reusable) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      // Technical proportional normalization only; native render owns all geometry/light.
      await sharp(bytes)
        .trim({ background: '#00000000', threshold: 1 })
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .extend({
          top: 8,
          right: 8,
          bottom: 8,
          left: 8,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 95, alphaQuality: 100, effort: 6 })
        .toFile(file);
    }
    const result = await measure(file);
    const yaw = ((facing >= 8 ? facing - 8 + 0.5 : facing) * Math.PI) / 4,
      refYaw = (defaults[id] * Math.PI) / 4;
    const footprint = (a) => 3 * Math.abs(Math.cos(a)) + 2 * Math.abs(Math.sin(a));
    const factor =
      id === 'rug'
        ? (((result.width / result.visible_width) * footprint(yaw)) /
            ((reference.width / reference.visible_width) * footprint(refYaw))) *
          baseSizes[id][defaults[id]]
        : (result.width / result.visible_height / (reference.width / reference.visible_height)) *
          baseSizes[id][defaults[id]];
    if (!Number.isFinite(factor) || factor < 0.1 || factor > 5)
      throw Error('Invalid physical view calibration ' + file);
    sizes[id][facing] = Number(factor.toFixed(5));
    assets.push({
      ...record,
      path: file,
      source_sha256: record.sha256,
      sha256: hash(await fs.readFile(file)),
      ...result,
    });
  }
}
if (missing.length && !partial) throw Error('Missing real views: ' + missing.join(', '));
if (new Set(assets.map((a) => a.sha256)).size !== assets.length)
  throw Error('Duplicate view images');
const manifest = {
  version: 'house-perspective-20261007',
  complete: missing.length === 0,
  camera_reference: 'docs/references/house-perspective-empty-room.png',
  integration_reference: 'docs/references/house-perspective-furnished-room.png',
  legacy_views: 'IDs 0..7 preserved; new IDs 8..15 at 22.5-degree intervals, interleaved.',
  assets,
  missing,
};
if (!check) {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(output + '/art-manifest.json', JSON.stringify(manifest, null, 2));
  await fs.writeFile('shared/house-intermediate-sizes.json', JSON.stringify(sizes, null, 2));
} else {
  const saved = JSON.parse(await fs.readFile(output + '/art-manifest.json', 'utf8'));
  if (!saved.complete || saved.assets.length !== 82) throw Error('Unfinished published views');
  for (const a of assets)
    if (saved.assets.find((s) => s.id === a.id && s.facing === a.facing)?.sha256 !== a.sha256)
      throw Error('Published hash mismatch');
  const savedSizes = JSON.parse(await fs.readFile('shared/house-intermediate-sizes.json', 'utf8'));
  if (JSON.stringify(sizes) !== JSON.stringify(savedSizes))
    throw Error('Uncalibrated intermediate widths');
}
console.log(
  JSON.stringify({ views: assets.length, complete: manifest.complete, missing: missing.length }),
);
