import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { assignMagicSkins } from './magic-skin-profiles.mjs';

const catalog = JSON.parse(await fs.readFile('data/emporium-expansion.json', 'utf8')).items;
const old = JSON.parse(await fs.readFile('data/shop-export/loja.json', 'utf8')).items;
const snapshot = JSON.stringify(catalog);
assignMagicSkins(catalog, old);
assert.equal(JSON.stringify(catalog), snapshot, 'A catalogue rebuild must retain magical skins.');
const manifest = JSON.parse(
  await fs.readFile('public/shop/magic-skins/skin-manifest.json', 'utf8'),
).assets;
let checked = 0;
for (const item of catalog.filter((x) => x.raw_data?.magic_skin)) {
  const row = manifest.find((x) => x.id === item.id);
  assert.ok(row, item.id);
  assert.notEqual(item.image_path, item.raw_data.magic_skin.reference);
  assert.equal(row.model, item.raw_data.base_item);
  const bytes = await fs.readFile('public' + item.image_path);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), row.sha256);
  const source = bytes.toString();
  assert.ok(!/<script|foreignObject|<!DOCTYPE|<!ENTITY/i.test(source));
  for (const match of source.matchAll(/href="([^"]+)"/g))
    assert.ok(match[1].startsWith('data:image/png;base64,') || match[1] === '#model');
  const png = await sharp(bytes).png().toBuffer();
  const stats = await sharp(png).stats();
  assert.equal(stats.isOpaque, false, `Transparent skin: ${item.id}`);
  assert.ok(
    stats.channels[3].max > 100 && stats.channels[3].mean > 0.1,
    `Visible skin: ${item.id}`,
  );
  checked++;
}
assert.equal(checked, manifest.length);
const shortbow = catalog.find((x) => x.id === 'energy-bow-shortbow');
assert.equal(shortbow.raw_data.base_item, 'shortbow');
assert.equal(shortbow.image_path, '/shop/magic-skins/energy-bow-shortbow.webp');
assert.equal((await sharp('public' + shortbow.image_path).stats()).isOpaque, false);
const flame = catalog.find((x) => x.id === 'flame-tongue-battleaxe');
assert.equal(flame.raw_data.magic_skin.material, 'flame');
const ice = catalog.find((x) => x.id === 'frost-brand-glaive');
assert.equal(ice.raw_data.magic_skin.material, 'frost');
assert.notEqual(flame.raw_data.magic_skin.color, ice.raw_data.magic_skin.color);
for (const family of [
  'Sword of Sharpness',
  'Dancing Sword',
  'Dragon Slayer',
  'Holy Avenger',
  'Vicious Weapon',
  'Weapon of Warning',
]) {
  const models = catalog.filter((x) => x.raw_data?.magic_family === family);
  assert.ok(models.length > 1, family);
  assert.equal(
    new Set(models.map((x) => x.raw_data.magic_skin?.texture)).size,
    1,
    `Shared family identity: ${family}`,
  );
  assert.ok(
    models.every((x) => x.raw_data.magic_skin?.material.startsWith('family-')),
    family,
  );
}
assert.notEqual(
  catalog.find((x) => x.raw_data?.magic_family === 'Sword of Sharpness').raw_data.magic_skin
    .texture,
  catalog.find((x) => x.raw_data?.magic_family === 'Dancing Sword').raw_data.magic_skin.texture,
);
const belts = catalog.filter((x) => x.raw_data?.magic_family === 'Belt of Giant Strength');
assert.equal(belts.length, 5);
assert.equal(new Set(belts.map((x) => x.image_path)).size, 5, 'Each giant belt has its own skin.');
assert.deepEqual(
  belts.map((x) => x.raw_data.strength).sort((a, b) => a - b),
  [21, 23, 25, 27, 29],
);
for (const belt of belts)
  assert.equal((await sharp('public' + belt.image_path).stats()).isOpaque, false);
console.log(
  `Verified ${checked} decoded transparent family/model skins, dedicated energy shortbow, safe embedded resources and catalogue rebuild stability.`,
);
