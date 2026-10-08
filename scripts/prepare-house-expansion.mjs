import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const version = 'house-expansion-20261008',
  root = `public/house/items/${version}`;
const catalog = JSON.parse(await fs.readFile('data/house-expansion-20261008.json', 'utf8'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const sameFiles = (a, b) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const partial = process.argv.includes('--partial'),
  check = process.argv.includes('--check');
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const exists = async (file) =>
  fs.access(file).then(
    () => true,
    () => false,
  );
async function protectedAssets() {
  const files = {};
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.posix.join(dir, entry.name);
      if (file === root) continue;
      if (entry.isDirectory()) await visit(file);
      else files[file] = hash(await fs.readFile(file));
    }
  }
  await visit('public/house/items');
  for (const file of [
    'data/house-refit-catalog.json',
    'shared/house-view-sizes.json',
    'shared/house-intermediate-sizes.json',
    'shared/house-frame-quads.json',
  ])
    files[file] = hash(await fs.readFile(file));
  return files;
}
async function bounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1,
    clear = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a < 8) clear++;
      if (a > 1) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left) throw Error('Empty asset ' + file);
  return {
    width: info.width,
    height: info.height,
    left,
    top,
    visibleWidth: right - left + 1,
    visibleHeight: bottom - top + 1,
    clearFraction: clear / (info.width * info.height),
  };
}
const baseline = '.local/house-expansion-source/protected.json';
const preserved = await protectedAssets();
if (process.argv.includes('--verify-published')) {
  const m = await readJson(root + '/art-manifest.json'),
    widths = await readJson('shared/house-expansion-sizes.json');
  if (
    !m.complete ||
    !m.calibrated ||
    m.assets.length !== 320 ||
    !sameFiles(m.protected_assets, preserved)
  )
    throw Error('Unfinished or modified House collection.');
  const identities = new Set(),
    hashes = new Set();
  for (const a of m.assets) {
    const key = a.id + '/' + a.facing;
    if (
      !catalog.some((c) => c.id === a.id) ||
      !Number.isInteger(a.facing) ||
      a.facing < 0 ||
      a.facing > 7 ||
      a.path !== root + '/' + key + '.webp' ||
      identities.has(key)
    )
      throw Error('Invalid identity ' + key);
    const b = await bounds(a.path);
    if (
      hash(await fs.readFile(a.path)) !== a.sha256 ||
      b.width !== a.width ||
      b.height !== a.height ||
      b.clearFraction < 0.04 ||
      !a.prompt ||
      !a.source_sha256
    )
      throw Error('Invalid art ' + key);
    identities.add(key);
    hashes.add(a.sha256);
  }
  for (const c of catalog)
    if (
      widths[c.id]?.length !== 8 ||
      widths[c.id].some((v) => !Number.isFinite(v) || v <= 0) ||
      widths[c.id][1] !== 1
    )
      throw Error('Missing calibration ' + c.id);
  if (hashes.size !== 320) throw Error('Repeated view');
  console.log(
    JSON.stringify({
      verified_models: 40,
      verified_views: 320,
      unique_views: hashes.size,
      protected_files: Object.keys(preserved).length,
    }),
  );
  process.exit(0);
}
if (await exists(baseline)) {
  if (!sameFiles(await readJson(baseline), preserved))
    throw Error('Existing House art or calibration changed.');
} else if (!check) {
  await fs.mkdir(path.dirname(baseline), { recursive: true });
  await fs.writeFile(baseline, JSON.stringify(preserved, null, 2) + '\n');
}
const old = (await exists(root + '/art-manifest.json'))
  ? await readJson(root + '/art-manifest.json')
  : { assets: [] };
const assets = [],
  missing = [],
  sizes = {};
for (const item of catalog) {
  sizes[item.id] = [];
  for (let facing = 0; facing < 8; facing++) {
    const recordPath = `.local/house-expansion-source/${item.id}/${facing}.json`;
    if (!(await exists(recordPath))) {
      missing.push(`${item.id}/${facing}`);
      continue;
    }
    const record = await readJson(recordPath),
      out = `${root}/${item.id}/${facing}.webp`;
    if (
      record.id !== item.id ||
      record.facing !== facing ||
      !record.prompt ||
      !record.references?.length
    )
      throw Error('Invalid provenance ' + recordPath);
    const bytes = await fs.readFile(record.source),
      sourceHash = hash(bytes),
      cached = old.assets.find(
        (a) => a.id === item.id && a.facing === facing && a.source_sha256 === sourceHash,
      );
    if (!check && cached && (await exists(out)) && hash(await fs.readFile(out)) === cached.sha256) {
      sizes[item.id][facing] = {
        width: cached.width,
        height: cached.height,
        visibleWidth: cached.visible_width,
        visibleHeight: cached.visible_height,
      };
      assets.push({
        ...cached,
        original_source: record.source,
        prompt: record.prompt,
        references: record.references,
      });
      continue;
    }
    const meta = await sharp(bytes).metadata(),
      b = await bounds(bytes);
    if (!meta.hasAlpha || b.clearFraction < 0.04)
      throw Error('Transparent full object required ' + recordPath);
    if (
      !check &&
      (!cached || !(await exists(out)) || hash(await fs.readFile(out)) !== cached.sha256)
    ) {
      await fs.mkdir(path.dirname(out), { recursive: true });
      await sharp(bytes)
        .extract({ left: b.left, top: b.top, width: b.visibleWidth, height: b.visibleHeight })
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .extend({
          top: 8,
          right: 8,
          bottom: 8,
          left: 8,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 95, alphaQuality: 100, effort: 6 })
        .toFile(out);
    }
    const normalized = await bounds(out);
    sizes[item.id][facing] = normalized;
    assets.push({
      id: item.id,
      facing,
      path: out,
      sha256: hash(await fs.readFile(out)),
      source_sha256: sourceHash,
      original_source: record.source,
      width: normalized.width,
      height: normalized.height,
      visible_width: normalized.visibleWidth,
      visible_height: normalized.visibleHeight,
      prompt: record.prompt,
      references: record.references,
      generator: 'built-in image_gen',
      normalization:
        'Alpha-bound crop, proportional inside1600, 8px clear margin, WebP95 alpha100; no mirroring, rotation or warp.',
    });
  }
}
if (new Set(assets.map((a) => a.sha256)).size !== assets.length)
  throw Error('Repeated artwork across directions.');
if (missing.length && !partial)
  throw Error(`Incomplete: ${assets.length}/320; ${missing.join(', ')}`);
if (!missing.length) {
  const calibration = {},
    flat = { 'bread-board': [2, 1], 'scroll-bundle': [1.5, 1], 'open-codex': [1.4, 1] };
  for (const item of catalog) {
    const ref = sizes[item.id][item.default_facing];
    const footprint = (a) =>
      flat[item.id][0] * Math.abs(Math.cos(a)) + flat[item.id][1] * Math.abs(Math.sin(a));
    calibration[item.id] = sizes[item.id].map((b, f) =>
      Number(
        (flat[item.id]
          ? ((b.width / b.visibleWidth) * footprint((f * Math.PI) / 4)) /
            ((ref.width / ref.visibleWidth) * footprint((item.default_facing * Math.PI) / 4))
          : b.width / b.visibleHeight / (ref.width / ref.visibleHeight)
        ).toFixed(5),
      ),
    );
    if (calibration[item.id].some((v) => v < 0.1 || v > 5 || !Number.isFinite(v)))
      throw Error('Unusable view scale ' + item.id);
  }
  if (check) {
    if (
      JSON.stringify(await readJson('shared/house-expansion-sizes.json')) !==
      JSON.stringify(calibration)
    )
      throw Error('Calibration mismatch.');
  } else
    await fs.writeFile(
      'shared/house-expansion-sizes.json',
      JSON.stringify(calibration, null, 2) + '\n',
    );
}
const manifest = {
  version,
  created_at: '2026-10-08',
  models: 40,
  expected_views: 320,
  complete: missing.length === 0,
  calibrated: missing.length === 0,
  protected_assets: preserved,
  missing,
  assets,
};
if (check) {
  const published = await readJson(root + '/art-manifest.json');
  if (!published.complete || !published.calibrated || published.assets.length !== 320)
    throw Error('Unfinished published collection.');
  for (const asset of assets)
    if (
      published.assets.find((a) => a.id === asset.id && a.facing === asset.facing)?.sha256 !==
      asset.sha256
    )
      throw Error('Published hash mismatch ' + asset.path);
} else {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(root + '/art-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
}
console.log(
  JSON.stringify({
    models: 40,
    views: assets.length,
    complete: !missing.length,
    protected_files: Object.keys(preserved).length,
  }),
);
