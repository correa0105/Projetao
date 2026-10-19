import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const file = 'data/class-badge-layer-art-20261019.json';
const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const base = '/sheet/badge-parts-20261019/';
const available = new Set();
for (const asset of manifest.assets) {
  const source = await fs.readFile(asset.nativePath);
  const output = await sharp(source)
    .resize(640, 640, { fit: 'contain', background: '#00000000' })
    .webp({ quality: 95, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const { data, info } = await sharp(output)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let clear = 0,
    opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) clear++;
    if (data[i] > 240) opaque++;
  }
  assert(clear > info.width * info.height * 0.15, 'Alpha missing: ' + asset.id);
  assert(opaque > info.width * info.height * 0.015, 'Empty layer: ' + asset.id);
  const url = base + asset.id + '.webp';
  await fs.mkdir(path.dirname('public' + url), { recursive: true });
  await fs.writeFile('public' + url, output);
  Object.assign(asset, {
    url,
    sourceSha256: hash(source),
    sha256: hash(output),
    width: 640,
    height: 640,
    bytes: output.length,
  });
  available.add(asset.id);
}
const classes = {
  artificer: ['hammer', 'wrench'],
  barbarian: ['axe', 'axe'],
  warlock: ['purple-staff', 'purple-staff'],
  cleric: ['holy-mace', 'holy-mace'],
  druid: ['wood-staff', 'sickle'],
  sorcerer: ['fire-staff', 'fire-staff'],
  fighter: ['sword', 'sword'],
  rogue: ['dagger', 'dagger'],
  wizard: ['blue-staff', 'blue-staff'],
  monk: ['baton', 'baton'],
  paladin: ['warhammer', 'warhammer'],
  ranger: ['arrow', 'arrow'],
};
const layers = {};
for (const asset of manifest.assets.filter((a) => a.id.startsWith('core-'))) {
  const key = asset.id.slice(5),
    classId = key.replace(/-\d+$/, '');
  const parts = classes[classId];
  assert(parts && parts.every((p) => available.has(p)), 'Missing tool for ' + key);
  layers[key] = { core: asset.url, tools: parts.map((p) => base + p + '.webp') };
  if (classId === 'artificer') Object.assign(layers[key], { toolScale: 1.1, toolWidthScale: 0.75 });
}
if (process.argv.includes('--require-complete')) assert.equal(Object.keys(layers).length, 32);
manifest.layeredBadges = Object.keys(layers).length;
manifest.method =
  'Complete rigid tools in separate DOM layers behind weapon-free core; rotations -45/+45 around a shared center.';
await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile('shared/class-badge-layers.json', JSON.stringify(layers, null, 2) + '\n');
console.log(JSON.stringify({ layers: manifest.assets.length, badges: Object.keys(layers).length }));
