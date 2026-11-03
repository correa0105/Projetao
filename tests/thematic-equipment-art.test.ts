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
  assert(registry.assets.length >= 12);
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

test('família Mitral tem desenho aprovado para cada tipo do seletor e suas peças', async () => {
  const files=['data/shop-export/loja.json','data/equipment-catalog.json','data/emporium-expansion.json','data/animal-equipment-catalog.json','data/shop-magic-completion-20261009/catalog.json'];
  const catalog=(await Promise.all(files.map(async file=>{const data=JSON.parse(await readFile(file,'utf8'));return Array.isArray(data)?data:data.items;}))).flat();
  const mithral=catalog.filter(item=>item.raw_data?.magic_family==='Mithral Armor');
  assert.equal(mithral.length,9);
  const approved=new Map(registry.assets.filter((asset:any)=>asset.review==='approved').map((asset:any)=>[asset.id,asset]));
  for(const item of mithral){
    assert(approved.has(item.id),item.id);
    for(const slot of ['head','shoulders','bracers','legs','feet'] as const){
      const id=item.id+'--'+slot;
      assert(approved.has(id),id);
      assert.equal(armorPieceImage(item.id,slot),thematicEquipmentImage(id));
    }
    assert.equal(armorBundle(item.id)!.pieces.length,['breastplate','half-plate-armor'].includes(item.raw_data.base_item)?1:6);
  }
});

test('seed troca somente referências de arte e preserva compras, bens, preços e replay', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[a-f0-9]{32}$/);
  try {
    await migrate(); await seed();
    const user = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[user,'Arte temática',user+'@example.test']);
    const character = await createLegacyTestCharacter(user);
    const legacy = registry.assets.filter((asset:any)=>asset.legacy_owned_piece);
    for(const asset of legacy){
      const split=asset.id.lastIndexOf('--'),parent=asset.id.slice(0,split),slot=asset.id.slice(split+2);
      await pool.query(`INSERT INTO catalog_items(id,name,original_name,category,description,weight_lb,source,source_url,raw_data,active,image_path)
        VALUES($1,$1,$1,'Peças de armadura','Peça legada preservada',1,'Conteúdo do projeto','',$2,false,$3) ON CONFLICT(id) DO NOTHING`,
      [asset.id,{equipment_target:'human',armor_bundle_parent:parent,armor_bundle_model_image:'legacy-parent.png',piece_slot:slot,equipment_slots:[slot]},asset.legacy_path]);
      await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,2) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=2',[character.id,asset.id]);
    }
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
    const before = await state(); assert.equal(before.inventory.length,12+legacy.length);
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
