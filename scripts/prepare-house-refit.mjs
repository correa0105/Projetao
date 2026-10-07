import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const version = 'house-refit-20261007';
const ids = [
  'sofa',
  'table',
  'chair',
  'bench',
  'chest',
  'books',
  'lantern',
  'plant',
  'rug',
  'statue',
];
const defaults = {
  sofa: 7,
  table: 0,
  chair: 1,
  bench: 1,
  chest: 1,
  books: 1,
  lantern: 1,
  plant: 1,
  rug: 0,
  statue: 1,
};
const sourceRoot = '.local/house-refit-source';
const outputRoot = `public/house/items/${version}`;
const partial = process.argv.includes('--partial');
const checkOnly = process.argv.includes('--check');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = async (file) =>
  fs.access(file).then(
    () => true,
    () => false,
  );
const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

// Preserve all sixteen real views, their base/reader images and the frame's
// image planes. Refit normalization never processes these protected assets.
const protectedFiles = [
  'shared/house-frame-quads.json',
  'public/house/items/letter.webp',
  'public/house/items/frame.webp',
  'public/house/items/letter-open.webp',
];
for (const id of ['letter', 'frame'])
  for (let facing = 0; facing < 8; facing++)
    protectedFiles.push(`public/house/items/views/${id}/${facing}.webp`);
const calibration = await json('shared/house-view-sizes.json');
const preservation = {
  files: {},
  widths: { letter: calibration.letter, frame: calibration.frame },
};
for (const file of protectedFiles) preservation.files[file] = hash(await fs.readFile(file));
if (process.argv.includes('--verify-published')) {
  const published = await json(outputRoot + '/art-manifest.json');
  if (!published.complete || !published.calibrated || published.assets.length !== 80)
    throw Error('Unfinished refit manifest.');
  if (JSON.stringify(published.protected_assets) !== JSON.stringify(preservation))
    throw Error('Protected letter/frame assets changed.');
  const identities = new Set(),
    hashes = new Set();
  for (const asset of published.assets) {
    if (
      !ids.includes(asset.id) ||
      !Number.isInteger(asset.facing) ||
      asset.facing < 0 ||
      asset.facing > 7 ||
      asset.path !== outputRoot + '/' + asset.id + '/' + asset.facing + '.webp'
    )
      throw Error('Invalid published view identity.');
    const identity = asset.id + '/' + asset.facing;
    if (identities.has(identity) || hashes.has(asset.sha256))
      throw Error('Duplicate published view.');
    identities.add(identity);
    hashes.add(asset.sha256);
    if (
      hash(await fs.readFile(asset.path)) !== asset.sha256 ||
      !asset.prompt ||
      !asset.source_sha256
    )
      throw Error('Artwork provenance/hash mismatch: ' + identity);
    const bounds = await measure(asset.path);
    if (
      bounds.width !== asset.width ||
      bounds.height !== asset.height ||
      bounds.clearFraction < 0.04
    )
      throw Error('Invalid published alpha/dimensions: ' + identity);
  }
  for (const id of ids)
    if (
      !calibration[id] ||
      calibration[id].length !== 8 ||
      calibration[id].some((value) => !Number.isFinite(value) || value <= 0)
    )
      throw Error('Missing calibrated widths: ' + id);
  console.log(
    JSON.stringify({ verified_views: 80, protected_views: 16, unique_views: hashes.size }),
  );
  process.exit(0);
}
const preservationFile = `${sourceRoot}/preserved-letter-frame.json`;
if (await exists(preservationFile)) {
  const saved = await json(preservationFile);
  if (JSON.stringify(saved) !== JSON.stringify(preservation))
    throw Error('A protected letter/frame asset or calibration changed.');
} else if (!checkOnly) {
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.writeFile(preservationFile, JSON.stringify(preservation, null, 2) + '\n');
} else throw Error('Missing preservation baseline. Run --partial before final integration.');

async function measure(file, threshold = 128) {
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
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < 8) clear++;
      if (alpha > threshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left || bottom < top) throw Error(`Empty artwork: ${file}`);
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

const previous = (await exists(`${outputRoot}/art-manifest.json`))
  ? await json(`${outputRoot}/art-manifest.json`)
  : { assets: [] };
const missing = [],
  assets = [],
  sizes = {};
for (const id of ids) {
  const manifestFile = `${sourceRoot}/${id}/manifest.json`;
  const sourceManifest = (await exists(manifestFile)) ? await json(manifestFile) : {};
  const entries = sourceManifest.views || sourceManifest.assets || [];
  sizes[id] = [];
  for (let facing = 0; facing < 8; facing++) {
    const file = `${sourceRoot}/${id}/${facing}.png`;
    const entry = entries.find((entry) => (entry.facing ?? entry.view) === facing);
    if (!(await exists(file)) || !entry?.prompt) {
      missing.push(`${id}/${facing}`);
      continue;
    }
    const source = await fs.readFile(file);
    const sourceHash = hash(source);
    if (entry.sha256 && entry.sha256 !== sourceHash) throw Error(`Source hash mismatch: ${file}`);
    const sourceInfo = await sharp(source).metadata();
    if (!sourceInfo.hasAlpha) throw Error(`Real alpha required: ${file}`);
    const bounds = await measure(file, 1);
    if (bounds.clearFraction < 0.04) throw Error(`Opaque background or cropped object: ${file}`);
    const outputFile = `${outputRoot}/${id}/${facing}.webp`;
    const cached = previous.assets.find(
      (asset) => asset.id === id && asset.facing === facing && asset.source_sha256 === sourceHash,
    );
    const cachedOutput =
      cached && (await exists(outputFile)) && hash(await fs.readFile(outputFile)) === cached.sha256;
    if (!checkOnly && !cachedOutput) {
      await fs.mkdir(path.dirname(outputFile), { recursive: true });
      // Technical crop/resize only: keep the actual rotated model, proportions,
      // self-shadow and alpha. No mirroring, projection or geometry warping.
      await sharp(source)
        .extract({
          left: bounds.left,
          top: bounds.top,
          width: bounds.visibleWidth,
          height: bounds.visibleHeight,
        })
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .extend({
          top: 8,
          right: 8,
          bottom: 8,
          left: 8,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 95, alphaQuality: 100, effort: 6 })
        .toFile(outputFile);
    }
    if (!(await exists(outputFile))) throw Error(`Missing normalized art: ${outputFile}`);
    const result = await measure(outputFile);
    sizes[id][facing] = result;
    assets.push({
      id,
      facing,
      path: outputFile,
      source: file,
      original_source: entry.original_path || entry.source_path || entry.path,
      source_sha256: sourceHash,
      sha256: hash(await fs.readFile(outputFile)),
      width: result.width,
      height: result.height,
      visible_width: result.visibleWidth,
      visible_height: result.visibleHeight,
      prompt: entry.prompt,
      generator:
        entry.mode || sourceManifest.generator || sourceManifest.mode || 'built-in image_gen',
      camera: sourceManifest.camera || 'room-reference low camera',
      normalization:
        'Alpha-bound crop; proportional inside1600; 8px transparent margin; WebP95, alpha100; no bitmap rotation/mirroring/warping.',
    });
  }
}
if (new Set(assets.map((asset) => asset.sha256)).size !== assets.length)
  throw Error('Duplicate views: each direction must have an independent render.');
if (missing.length && !partial)
  throw Error(`Refit is incomplete (${assets.length}/80): ${missing.join(', ')}`);

if (!partial) {
  for (const id of ids) {
    const reference = sizes[id][defaults[id]];
    calibration[id] = sizes[id].map((view, facing) => {
      // Upright furniture retains model height across views. The floor rug uses
      // its 3:2 physical footprint, avoiding enormous end-on floor silhouettes.
      const yaw = (facing * Math.PI) / 4;
      const refYaw = (defaults[id] * Math.PI) / 4;
      const footprint = (angle) => 3 * Math.abs(Math.cos(angle)) + 2 * Math.abs(Math.sin(angle));
      const factor =
        id === 'rug'
          ? ((view.width / view.visibleWidth) * footprint(yaw)) /
            ((reference.width / reference.visibleWidth) * footprint(refYaw))
          : view.width / view.visibleHeight / (reference.width / reference.visibleHeight);
      if (!Number.isFinite(factor) || factor < 0.15 || factor > 5)
        throw Error(`Implausible view scale: ${id}/${facing}`);
      return Number(factor.toFixed(5));
    });
  }
  if (!checkOnly)
    await fs.writeFile('shared/house-view-sizes.json', JSON.stringify(calibration, null, 2) + '\n');
  else {
    const saved = await json('shared/house-view-sizes.json');
    for (const id of ids)
      if (JSON.stringify(saved[id]) !== JSON.stringify(calibration[id]))
        throw Error(`Uncalibrated views: ${id}`);
  }
}
const manifest = {
  version,
  created_at: '2026-10-07',
  expected_views: 80,
  complete: missing.length === 0,
  calibrated: !partial,
  missing,
  default_facings: defaults,
  protected_assets: preservation,
  assets,
};
if (!checkOnly) {
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(`${outputRoot}/art-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
} else {
  const saved = await json(`${outputRoot}/art-manifest.json`);
  if (!saved.complete || !saved.calibrated || saved.assets.length !== 80)
    throw Error('Incomplete published manifest.');
  for (const asset of assets)
    if (
      saved.assets.find((entry) => entry.id === asset.id && entry.facing === asset.facing)
        ?.sha256 !== asset.sha256
    )
      throw Error(`Published hash mismatch: ${asset.path}`);
}
console.log(
  JSON.stringify({
    normalized_views: assets.length,
    expected_views: 80,
    complete: missing.length === 0,
    protected_views: 16,
    calibration_updated: !partial && !missing.length && !checkOnly,
  }),
);
