import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { enqueueArt } from '../server/character-art.js';
import { equipmentArtReference } from '../server/equipment-art-reference.js';
import { armorMagicAppearance, snapshottedArmorMagic, withArmorMagicAppearance } from '../server/armor-magic-appearance.js';
import { generateCharacterArt } from '../server/codex-illustrator.js';
import { generateCharacterToken } from '../server/character-token-illustrator.js';

test('magia de armadura: todas as famílias, modelos e peças chegam ao snapshot do Vestir', async t => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate(); await seed();
  const id = randomUUID();
  await pool.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())', [id, 'Armadureiro', id + '@example.test']);
  const hero = await createLegacyTestCharacter(id);
  await pool.query('INSERT INTO character_art_allowances(user_id,unlimited) VALUES($1,true)', [id]);
  await pool.query('INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true');
  const reference = (await sharp({ create: { width: 512, height: 768, channels: 4, background: '#00000000' } }).png().toBuffer()).toString('base64');
  try {
    await t.test('431 conjuntos de 27 famílias e 13 modelos preservam o encantamento nas seis peças', async () => {
      const roots = (await pool.query("SELECT id,raw_data FROM catalog_items WHERE raw_data ? 'armor_bundle_pieces' AND raw_data ? 'magic_family'")).rows;
      assert.equal(roots.length, 431); assert.equal(new Set(roots.map(item => item.raw_data.magic_family)).size, 27);
      assert.equal(new Set(roots.map(item => item.raw_data.base_item)).size, 13);
      const pieces = (await pool.query("SELECT c.id, COALESCE(c.raw_data->>'armor_piece_name',c.name) name,c.image_path,COALESCE(p.raw_data,'{}'::jsonb)||COALESCE(c.raw_data,'{}'::jsonb) raw_data FROM catalog_items c JOIN catalog_items p ON p.id=c.raw_data->>'armor_bundle_parent' WHERE p.raw_data ? 'magic_family'")).rows;
      assert.equal(pieces.length, 431 * 6);
      for (const item of pieces) {
        const parent = roots.find(root => root.id === item.raw_data.armor_bundle_parent)!;
        assert.equal(snapshottedArmorMagic(equipmentArtReference(item)), armorMagicAppearance(parent.raw_data), item.id);
      }
      assert.match(armorMagicAppearance(roots.find(item => item.id === 'magic-armor').raw_data)!, /azul prateadas/);
      assert.match(armorMagicAppearance(roots.find(item => item.id === 'magic-armor-leather-armor-plus-2').raw_data)!, /violeta azuladas/);
      assert.equal(armorMagicAppearance({ armor_bundle_parent: 'plate-armor' }), undefined);
    });
    async function queue(items: { slot: string; id: string }[]) {
      await pool.query('DELETE FROM character_equipment WHERE character_id=$1', [hero.id]);
      for (const item of items) {
        await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,1) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=GREATEST(inventory.quantity,1)', [hero.id, item.id]);
        await pool.query('INSERT INTO character_equipment(character_id,slot,item_id) VALUES($1,$2,$3)', [hero.id, item.slot, item.id]);
      }
      const job = await enqueueArt(id, { character_id: hero.id, reference, idempotency_key: randomUUID(), equipment_slots: items.map(item => item.slot) });
      const stored = (await pool.query('SELECT item_id,slot,name FROM character_art_equipment WHERE job_id=$1 ORDER BY slot', [job.id])).rows;
      await pool.query("UPDATE character_art_jobs SET status='failed',reference=NULL WHERE id=$1", [job.id]);
      return stored;
    }
    await t.test('peça mágica sem peitoral herda dados do conjunto; item mundano misturado não recebe magia', async () => {
      const stored = await queue([{ slot: 'head', id: 'magic-armor--head' }, { slot: 'armor', id: 'plate-armor' }]);
      assert.match(snapshottedArmorMagic(stored.find(item => item.slot === 'head')!)!, /encantamento \+1/);
      assert.equal(snapshottedArmorMagic(stored.find(item => item.slot === 'armor')!), undefined);
    });
    await t.test('conjunto mágico de couro leva acabamento e material para todas as posições', async () => {
      const root = (await pool.query('SELECT raw_data FROM catalog_items WHERE id=$1', ['magic-armor-leather-armor-plus-2'])).rows[0];
      const stored = await queue(root.raw_data.armor_bundle_pieces.map((piece: any) => ({ slot: piece.slot, id: piece.id })));
      assert.equal(stored.length, 6);
      for (const item of stored) assert.match(snapshottedArmorMagic(item)!, /encantamento \+2.*couro continua couro/);
    });
    await t.test('propriedade e disponibilidade do equipamento continuam obrigatórias', async () => {
      await assert.rejects(enqueueArt(randomUUID(), { character_id: hero.id, reference, idempotency_key: randomUUID(), equipment_slots: ['head'] }), /Personagem não encontrado/);
      await assert.rejects(enqueueArt(id, { character_id: hero.id, reference, idempotency_key: randomUUID(), equipment_slots: ['neck'] }), /equipamento mudou/);
    });
  } finally { await pool.end(); }
});

test('ilustrador reprova ausência de magia, corrige o retrato e conserva o efeito no token', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'magic-armor-cli-')), entry = join(temp, 'node_modules/@openai/codex/bin'), state = join(temp, 'state.json');
  await mkdir(entry, { recursive: true });
  const image = await sharp({ create: { width: 768, height: 768, channels: 4, background: '#00000000' } }).png().toBuffer();
  await writeFile(join(temp, 'output.png'), image);
  await writeFile(join(entry, 'codex.js'), `
    const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2),file=${JSON.stringify(state)};
    let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      const s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{renders:[],reviews:[]};
      const output=args[args.indexOf('--output-last-message')+1],schema=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1]));
      if(schema.properties.approved){s.reviews.push(prompt);fs.writeFileSync(output,JSON.stringify(s.reviews.length===1?{approved:false,issues:['Armadura sem encantamento visível; aplicar runas luminosas nas peças expostas.']}:{approved:true,issues:[]}));}
      else{s.renders.push(prompt);const destination=path.join(args[args.indexOf('--cd')+1],'output.png');fs.copyFileSync(${JSON.stringify(join(temp, 'output.png'))},destination);fs.writeFileSync(output,JSON.stringify({image_path:destination,error:''}));}
      fs.writeFileSync(file,JSON.stringify(s));
    });
  `);
  const beforePath = process.env.PATH, beforeBin = process.env.CODEX_BIN;
  try {
    delete process.env.CODEX_BIN; process.env.PATH = temp + delimiter + (beforePath || '');
    const equipment = [{ slot: 'head' as const, item_id: 'magic-armor--head', image, name: withArmorMagicAppearance('Elmo mágico', { armor_bundle_parent: 'magic-armor', magic_family: 'Armor, +1, +2, or +3', enhancement: 1 }) }];
    const job = { id: randomUUID(), race: 'Humano', class: 'Guerreiro', reference: image, equipment };
    assert.deepEqual(await generateCharacterArt(job), image);
    assert.deepEqual(await generateCharacterToken(job, image), image);
    const captured = JSON.parse(await readFile(state, 'utf8'));
    assert.equal(captured.renders.length, 3); assert.equal(captured.reviews.length, 3);
    assert.match(captured.renders[0], /APARÊNCIA MÁGICA OBRIGATÓRIA.*azul prateadas/);
    assert.match(captured.reviews[0], /Reprove armadura mágica que pareça sua versão mundana/);
    assert.match(captured.renders[1], /Armadura sem encantamento visível/);
    assert.match(captured.renders[1], /APARÊNCIA MÁGICA OBRIGATÓRIA/);
    assert.match(captured.renders[2], /Preserve os efeitos mágicos aprovados na arte principal/);
    assert.match(captured.reviews[2], /Reprove a ausência dos efeitos mágicos/);
  } finally {
    if (beforePath === undefined) delete process.env.PATH; else process.env.PATH = beforePath;
    if (beforeBin === undefined) delete process.env.CODEX_BIN; else process.env.CODEX_BIN = beforeBin;
    await rm(temp, { recursive: true, force: true });
  }
});
