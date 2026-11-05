import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { magicArmorSharedArt } from './lib/magic-armor-shared-art.mjs';

const files = ['data/shop-export/loja.json', 'data/equipment-catalog.json', 'data/emporium-expansion.json', 'data/animal-equipment-catalog.json', 'data/shop-magic-completion-20261009/catalog.json'];
const items = new Map();
for (const file of files) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const item of Array.isArray(data) ? data : data.items) items.set(item.id, item);
}
const file = 'data/thematic-equipment-art-20261102.json';
const registry = JSON.parse(await fs.readFile(file, 'utf8'));
const assets = new Map(registry.assets.map(asset => [asset.id, asset]));
const oldPieces = JSON.parse(await fs.readFile('shared/armor-piece-images.json', 'utf8'));
const aliases = magicArmorSharedArt(items);
for (const [id, sourceId] of aliases) {
  const source = assets.get(sourceId);
  assert(source?.review === 'approved' && !source.shared_from, 'Review +1 source first: ' + sourceId);
  const split = id.lastIndexOf('--');
  const legacyPath = assets.get(id)?.legacy_path || (split < 0 ? items.get(id)?.image_path : oldPieces[id.slice(0, split) + ':' + id.slice(split + 2)]);
  assert(legacyPath, 'Unknown armor model or piece: ' + id);
  assets.set(id, { ...source, id, legacy_path: legacyPath, shared_from: sourceId });
}
registry.assets = [...assets.values()].sort((a, b) => a.id.localeCompare(b.id));
await fs.writeFile(file, JSON.stringify(registry, null, 2) + '\n');
await fs.writeFile('shared/thematic-equipment-images.json', JSON.stringify(Object.fromEntries(registry.assets.filter(asset => asset.review === 'approved').map(asset => [asset.id, asset.path])), null, 2) + '\n');
console.log(JSON.stringify({ shared_references: aliases.size, native_artworks: new Set(aliases.values()).size, copies_generated: 0 }));
