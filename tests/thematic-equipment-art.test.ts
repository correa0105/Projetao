import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { purchase } from '../server/services.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { armorPieceImage } from '../shared/armor-piece-art.js';
import { armorBundle } from '../shared/armor-bundles.js';
import { thematicEquipmentImage } from '../shared/thematic-equipment-art.js';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const registry = JSON.parse(await readFile('data/thematic-equipment-art-20261102.json','utf8'));

test('artes nativas e cópias leves conservam alfa, proporção, integridade e referências por peça', async () => {
  assert.equal(registry.assets.length, 12);
  for (const asset of registry.assets) {
    const source = await readFile(asset.original), display = await readFile('public'+asset.path);
    assert.equal(hash(source), asset.original_sha256); assert.equal(hash(display), asset.sha256);
    assert.equal(asset.review, 'approved'); assert.equal(asset.generator, 'image_gen.imagegen');
    assert.equal(thematicEquipmentImage(asset.id), asset.path);
    assert(display.length < source.length / 5, asset.id);
    const original = await sharp(source).metadata(), small = await sharp(display).metadata();
    assert(small.hasAlpha && !(await sharp(display).stats()).isOpaque);
    assert(Math.max(small.width!,small.height!) <= 768);
    assert(Math.abs(original.width!/original.height! - small.width!/small.height!) < .003);
    const split = asset.id.lastIndexOf('--');
    if (split >= 0) assert.equal(armorPieceImage(asset.id.slice(0,split), asset.id.slice(split+2) as 'head'), asset.path);
    assert.notEqual(asset.path, asset.legacy_path);
  }
});

test('geradores antigos recusam revestimentos antes de modificar arquivos', async () => {
  const tracked = ['data/emporium-expansion.json','data/armor-piece-art-20261012.json','data/shop-magic-completion-20261009/art-manifest.json'];
  const before = await Promise.all(tracked.map(async file => hash(await readFile(file))));
  for (const script of ['build-magic-skins','build-armor-piece-art','build-shop-completion-skins']) {
    assert.throws(() => execFileSync(process.execPath,['scripts/'+script+'.mjs'],{windowsHide:true,stdio:'pipe'}), /sobreposição de texturas desativada/);
  }
  assert.deepEqual(await Promise.all(tracked.map(async file => hash(await readFile(file)))),before);
});

test('seed troca somente referências de arte e preserva compras, bens, preços e replay', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[a-f0-9]{32}$/);
  try {
    await migrate(); await seed();
    const user = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[user,'Arte temática',user+'@example.test']);
    const character = await createLegacyTestCharacter(user);
    await pool.query('UPDATE characters SET gold_cp=100000000 WHERE id=$1',[character.id]);
    const parentIds = ['mithral-spiked-armor','mariner-s-padded-armor'];
    await pool.query('INSERT INTO shop_price_overrides(item_id,price_cp) VALUES($1,123456) ON CONFLICT(item_id) DO UPDATE SET price_cp=excluded.price_cp',[parentIds[0]]);
    await pool.query('UPDATE catalog_items SET price_cp=123456 WHERE id=$1',[parentIds[0]]);
    const keys = parentIds.map(()=>randomUUID());
    for (let i=0;i<parentIds.length;i++) await purchase(user,character.id,parentIds[i],1,keys[i]);
    const state = async () => ({
      character:(await pool.query('SELECT to_jsonb(c) AS value FROM characters c WHERE id=$1',[character.id])).rows,
      inventory:(await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id',[character.id])).rows,
      purchases:(await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id',[character.id])).rows,
      grants:(await pool.query('SELECT g.* FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1 ORDER BY g.item_id',[character.id])).rows,
      overrides:(await pool.query('SELECT * FROM shop_price_overrides ORDER BY item_id')).rows,
    });
    const before = await state(); assert.equal(before.inventory.length,12);
    const normalize = (row: any) => { const result=structuredClone(row);delete result.image_path;delete result.raw_data.armor_bundle_model_image;return result; };
    const catalogBefore = (await pool.query('SELECT * FROM catalog_items ORDER BY id')).rows.map(normalize);
    for (const asset of registry.assets) await pool.query('UPDATE catalog_items SET image_path=$2 WHERE id=$1',[asset.id,asset.legacy_path]);
    await seed();
    assert.deepEqual(await state(),before);
    assert.deepEqual((await pool.query('SELECT * FROM catalog_items ORDER BY id')).rows.map(normalize),catalogBefore);
    for (const asset of registry.assets) assert.equal((await pool.query('SELECT image_path FROM catalog_items WHERE id=$1',[asset.id])).rows[0].image_path,asset.path);
    for(let i=0;i<parentIds.length;i++) await purchase(user,character.id,parentIds[i],1,keys[i]);
    assert.deepEqual(await state(),before);
    for(const parent of parentIds) assert.equal(armorBundle(parent)!.pieces.length,6);
  } finally { await pool.end(); }
});
