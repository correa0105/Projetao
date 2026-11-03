import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Imports native imagegen artwork; never generates a material coating or changes rules.
const sourceFile = process.argv.find(arg => arg.startsWith('--sources='))?.slice(10);
assert(sourceFile, 'Use --sources=arquivo-privado.json com id, source e prompt de cada arte nativa.');
const approve = process.argv.includes('--approve-reviewed');
const entries = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
const manifestPath = 'data/thematic-equipment-art-20261102.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let manifest = { policy_version: 1, generator: 'image_gen.imagegen', assets: [] };
try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const imported = [];
const sourceCatalogs = await Promise.all(['data/shop-export/loja.json', 'data/equipment-catalog.json', 'data/emporium-expansion.json', 'data/animal-equipment-catalog.json', 'data/shop-magic-completion-20261009/catalog.json'].map(async file => {
  const data = JSON.parse(await fs.readFile(file, 'utf8')); return Array.isArray(data) ? data : data.items;
}));
const catalogItems = new Map(sourceCatalogs.flat().map(item => [item.id, item]));
const oldPieces = JSON.parse(await fs.readFile('shared/armor-piece-images.json', 'utf8'));
for (const entry of entries) {
  assert(/^[a-z0-9-]+$/.test(entry.id) && entry.prompt?.length > 50, 'Invalid native artwork record');
  assert(!imported.some(asset => asset.id === entry.id), 'Duplicate asset');
  const bytes = await fs.readFile(entry.source);
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  assert.equal(metadata.format, 'png');
  assert(metadata.hasAlpha && !(await sharp(bytes).stats()).isOpaque, entry.id + ': transparency required');
  assert(metadata.width >= 512 && metadata.height >= 512, entry.id + ': source too small');
  const original = `artwork-archive/thematic-equipment-20261102/${entry.id}.png`;
  const output = `/shop/thematic-equipment-20261102/${entry.id}.webp`;
  await fs.mkdir(path.dirname(original), { recursive: true });
  await fs.mkdir(path.dirname('public' + output), { recursive: true });
  try { assert.equal(hash(await fs.readFile(original)), hash(bytes), 'Preserve the existing native original'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await fs.writeFile(original, bytes); }
  const optimized = await sharp(bytes).resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 }).toBuffer();
  assert(optimized.length < bytes.length, entry.id + ': display copy must be lighter');
  await fs.writeFile('public' + output, optimized);
  const display = await sharp(optimized).metadata();
  const split = entry.id.lastIndexOf('--');
  const legacyPath = manifest.assets.find(asset => asset.id === entry.id)?.legacy_path || (split < 0
    ? catalogItems.get(entry.id)?.image_path
    : oldPieces[entry.id.slice(0,split) + ':' + entry.id.slice(split+2)]);
  assert(legacyPath, 'Unknown catalog item or armor piece: ' + entry.id);
  const record = { id: entry.id, path: output, legacy_path: legacyPath, original, generator: 'image_gen.imagegen', prompt: entry.prompt,
    review: approve ? 'approved' : 'pending', design_method: 'original thematic construction',
    original_sha256: hash(bytes), sha256: hash(optimized), original_bytes: bytes.length, bytes: optimized.length,
    original_width: metadata.width, original_height: metadata.height, width: display.width, height: display.height };
  manifest.assets = manifest.assets.filter(asset => asset.id !== entry.id);
  manifest.assets.push(record); imported.push(record);
}
manifest.assets.sort((a,b) => a.id.localeCompare(b.id));
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
if (approve) {
  const images = Object.fromEntries(manifest.assets.filter(asset => asset.review === 'approved').map(asset => [asset.id, asset.path]));
  await fs.writeFile('shared/thematic-equipment-images.json', JSON.stringify(images, null, 2) + '\n');
}
console.log(JSON.stringify({ imported: imported.length, approved: approve, original_bytes: imported.reduce((n,a)=>n+a.original_bytes,0), display_bytes: imported.reduce((n,a)=>n+a.bytes,0) }));
