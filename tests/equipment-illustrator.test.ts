import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { generateCharacterArt, IllustratorError } from '../server/codex-illustrator.js';
import { describeArtEquipment } from '../server/equipment-art.js';
import { equipmentReferenceSheet } from '../server/equipment-reference.js';
import sharp from 'sharp';
import { EQUIPMENT_SLOTS } from '../shared/equipment.js';
import type { ArtEquipment } from '../shared/equipment.js';

test('recupera último arquivo da sessão e corrige fundo opaco sem confiar no JSON final', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'native-art-'));
  const cli = join(temp, 'cli.cjs');
  const transparent = await sharp({ create: { width: 512, height: 768, channels: 4, background: '#00000000' } }).png().toBuffer();
  const opaque = await sharp({ create: { width: 512, height: 768, channels: 3, background: '#112233' } }).png().toBuffer();
  await writeFile(join(temp, 'transparent.png'), transparent);
  await writeFile(join(temp, 'opaque.png'), opaque);
  const statePath = join(temp, 'state.json');
  await writeFile(cli, `
    const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
    const args=process.argv.slice(2), result=args[args.indexOf('--output-last-message')+1];
    let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      if(JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved){
        fs.writeFileSync(result,JSON.stringify({approved:true,issues:[]}));return;
      }
      const statePath=${JSON.stringify(statePath)};
      const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{renders:0};
      state.renders++;state.prompt=prompt;fs.writeFileSync(statePath,JSON.stringify(state));
      const id=crypto.randomUUID(), root=path.join(process.env.CODEX_HOME,'generated_images',id);
      fs.mkdirSync(root,{recursive:true});
      fs.copyFileSync(${JSON.stringify(join(temp, 'opaque.png'))},path.join(root,'exec-old.png'));
      fs.utimesSync(path.join(root,'exec-old.png'),new Date(0),new Date(0));
      fs.copyFileSync(${JSON.stringify(temp)} + (state.renders===1?'/opaque.png':'/transparent.png'),path.join(root,'exec-final.png'));
      console.log(JSON.stringify({type:'thread.started',thread_id:id}));
      fs.writeFileSync(result,JSON.stringify({image_path:'',error:'Não consegui devolver o caminho.'}));
    });
  `);
  const originalBin = process.env.CODEX_BIN, originalHome = process.env.CODEX_HOME;
  // A fake CLI uses Node as its executable through the standard npm entry point.
  const originalPath = process.env.PATH;
  const entry = join(temp, 'node_modules/@openai/codex/bin');
  await mkdir(entry, { recursive: true });
  await writeFile(join(entry, 'codex.js'), await readFile(cli));
  try {
    delete process.env.CODEX_BIN;
    process.env.PATH = temp + delimiter + (originalPath || '');
    process.env.CODEX_HOME = temp;
    assert.deepEqual(await generateCharacterArt({ id: randomUUID(), race: 'Humano', class: 'Guerreiro', reference: transparent }), transparent);
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(state.renders, 2);
    assert.match(state.prompt, /Remover completamente o fundo/);
  } finally {
    for (const [name, value] of [['CODEX_BIN', originalBin], ['CODEX_HOME', originalHome], ['PATH', originalPath]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
    await rm(temp, { recursive: true, force: true });
  }
});

test('ilustrador envia estilo, aparência e imagens reais dos itens na ordem indicada', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'equipment-cli-'));
  const entry = join(temp, 'node_modules/@openai/codex/bin');
  await mkdir(entry, { recursive: true });
  const capture = join(temp, 'capture.json');
  // Test-only executable; exercises the actual spawn and attachments without generating art.
  await writeFile(
    join(entry, 'codex.js'),
    `
    const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
    const args = process.argv.slice(2), images = args.flatMap((v,i) => v === '--image' ? [args[i+1]] : []);
    let prompt = ''; process.stdin.on('data', c => prompt += c);
    process.stdin.on('end', () => {
      if (images.length > 5) process.exit(1);
      if (JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1], 'utf8')).properties.approved) {
        fs.writeFileSync(args[args.indexOf('--output-last-message')+1], JSON.stringify({approved:true,issues:[]}));
        return;
      }
      const directory = args[args.indexOf('--cd')+1], output = path.join(directory, 'output.png');
      fs.copyFileSync(images[1], output);
      fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ prompt, images: images.map(p => ({ path: p, hash: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') })) }));
      fs.writeFileSync(args[args.indexOf('--output-last-message')+1], JSON.stringify({ image_path: output, error: '' }));
    });
  `,
  );
  const originalPath = process.env.PATH,
    originalBin = process.env.CODEX_BIN;
  const reference = await sharp(await readFile('docs/references/character-style-v1.png')).removeAlpha().ensureAlpha(0.5).png().toBuffer();
  const itemImage = await readFile('public/shop/items/longsword.png');
  const equipment: ArtEquipment[] = [
    { slot: 'main_hand', item_id: 'longsword', name: 'Espada longa', image: itemImage },
    {
      slot: 'head',
      item_id: 'plate-helmet',
      name: 'Capacete de placas',
      image: await readFile('public/shop/equipment/plate-helmet.png'),
    },
    {
      slot: 'armor',
      item_id: 'plate-armor',
      name: 'Peitoral de placas',
      image: await readFile('public/shop/items/plate-armor.png'),
    },
    {
      slot: 'shoulders',
      item_id: 'plate-pauldrons',
      name: 'Ombreiras de placas',
      image: await readFile('public/shop/equipment/plate-pauldrons.png'),
    },
    {
      slot: 'bracers',
      item_id: 'plate-bracers',
      name: 'Braçadeiras de placas com luvas',
      image: await readFile('public/shop/equipment/plate-bracers.png'),
    },
    {
      slot: 'legs',
      item_id: 'plate-leggings',
      name: 'Calça de placas',
      image: await readFile('public/shop/equipment/plate-leggings.png'),
    },
    {
      slot: 'feet',
      item_id: 'plate-boots',
      name: 'Botas de placas',
      image: await readFile('public/shop/equipment/plate-boots.png'),
    },
    {
      slot: 'off_hand',
      item_id: 'shield',
      name: 'Escudo',
      image: await readFile('public/shop/items/shield.png'),
    },
    {
      slot: 'ring_left',
      item_id: 'ring-of-protection',
      name: 'Anel de proteção',
      image: await readFile('public/shop/items/ring-of-protection.png'),
    },
  ];
  try {
    process.env.PATH = temp + delimiter + (originalPath || '');
    delete process.env.CODEX_BIN;
    const output = await generateCharacterArt({
      id: randomUUID(),
      race: 'Elfo',
      class: 'Guerreiro',
      character_id: randomUUID(),
      reference,
      equipment,
    });
    assert.deepEqual(output, reference);
    const captured = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(captured.images.length, 3);
    assert.equal(captured.images[0].hash, createHash('sha256').update(await readFile('docs/references/character-style-v1.png')).digest('hex'));
    assert.equal(captured.images[1].hash, createHash('sha256').update(reference).digest('hex'));
    assert.equal(
      captured.images[2].hash,
      createHash('sha256')
        .update(await equipmentReferenceSheet(equipment))
        .digest('hex'),
    );
    for (const [index, item] of equipment.entries()) {
      assert.ok(captured.prompt.includes(`"reference_panel":${index + 1}`));
      assert.ok(captured.prompt.includes(item.item_id));
    }
    assert.match(captured.prompt, /"reference_image":3/);
    assert.match(captured.prompt, /Espada longa/);
    assert.match(captured.prompt, /SOMENTE os equipamentos listados/);
    assert.match(captured.prompt, /trapos velhos de tecido: camisa branca e calça cinza/);
    assert.match(captured.prompt, /humano não recebe asas/);
    assert.match(captured.prompt, /draconato não recebe orelhas élficas/);
    assert.match(captured.prompt, /segunda imagem fornece somente características físicas/);
    assert.match(captured.prompt, /Tamanho: Médio/);
    assert.match(captured.prompt, /fundo transparente real/);
    assert.match(captured.prompt, /viseira fechada/);
    assert.match(captured.prompt, /ombreiras vêm exclusivamente do slot shoulders/);
    assert.match(captured.prompt, /"slot":"head"/);
    assert.doesNotMatch(captured.prompt, /"reference_image":9/);
    assert.match(captured.prompt, /NÃO reproduza sua grade/);
    assert.ok(captured.prompt.includes(JSON.stringify(captured.images.map((image: { path: string }) => image.path))));
    assert.match(captured.prompt, /Use referenced_image_paths com TODOS esses caminhos/);
    assert.match(captured.prompt, /Não use num_last_images_to_include/);
    assert.match(captured.prompt, /acessórios encobertos podem ficar invisíveis/);
    assert.match(captured.prompt, /escudo preso ou segurado pelo braço, único e íntegro/);
    assert.match(captured.prompt, /Capa é um manto sem mangas/);
    assert.match(
      describeArtEquipment({ slot: 'cloak', item_id: 'cosmetic-cape', name: 'Capa', image: itemImage }, 0).wearing,
      /capa desdobrada, como manto sem mangas/,
    );
    assert.ok(captured.prompt.length < 8500, 'Prompt completo deve permanecer compacto mesmo com vários equipamentos.');
    for (const slot of ['ring_left', 'ring_right'] as const) {
      assert.match(describeArtEquipment({ slot, item_id: 'ring-of-protection', name: 'Anel', image: itemImage }, 0).wearing, /pode ficar oculto/);
    }
    const tiara = describeArtEquipment(
      { slot: 'head', item_id: 'cosmetic-tiara', name: 'Tiara com gema azul', image: itemImage },
      0,
    );
    assert.doesNotMatch(tiara.wearing, /Capacete|viseira/);
    const helmet = equipment.find((item) => item.slot === 'head')!;
    assert.match(describeArtEquipment(helmet, 0, 'open').wearing, /viseira levantada/);
    await generateCharacterArt({
      id: randomUUID(),
      reference,
      race: 'Elfo',
      class: 'Guerreiro',
      character_id: randomUUID(),
      equipment: [helmet],
      helmet_mode: 'open',
    });
    const opened = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(opened.images.length, 3);
    assert.equal(opened.images[2].hash, createHash('sha256').update(helmet.image).digest('hex'));
    assert.match(opened.prompt, /Capacete vestido na cabeça, viseira levantada/);
    assert.doesNotMatch(opened.prompt, /Este capacete de placas é fechado/);
    await assert.rejects(readFile(captured.images[2].path), { code: 'ENOENT' });
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    await rm(temp, { recursive: true, force: true });
  }
});

test('prancha mantém as quinze posições em painéis distintos, sem cortar as referências', async () => {
  const items: ArtEquipment[] = [];
  for (const [i, slot] of EQUIPMENT_SLOTS.entries()) {
    items.push({
      slot,
      item_id: slot,
      name: slot,
      image: await sharp({
        create: {
          width: i % 2 ? 20 : 80,
          height: i % 2 ? 80 : 20,
          channels: 3,
          background: { r: 30 + i * 10, g: 80, b: 120 },
        },
      })
        .png()
        .toBuffer(),
    });
  }
  const sheet = await equipmentReferenceSheet(items);
  const { data, info } = await sharp(sheet)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1536);
  assert.equal(info.height, 2112);
  for (let i = 0; i < items.length; i++) {
    const x = (i % 4) * 384 + 192,
      y = Math.floor(i / 4) * 528 + 288;
    assert.deepEqual(
      [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)],
      [30 + i * 10, 80, 120],
    );
  }
});

test('revisão visual corrige resultado reprovado e rejeita arte que continua errada', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'composition-cli-'));
  const entry = join(temp, 'node_modules/@openai/codex/bin');
  await mkdir(entry, { recursive: true });
  const statePath = join(temp, 'state.json');
  await writeFile(
    join(entry, 'codex.js'),
    `
    const fs=require('node:fs'),path=require('node:path');
    const args=process.argv.slice(2), directory=args[args.indexOf('--cd')+1];
    const images=args.flatMap((v,i)=>v==='--image'?[args[i+1]]:[]);
    if(images.length>5)process.exit(1);
    const statePath=${JSON.stringify(statePath)};
    const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)): {renders:0,reviews:0};
    let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      const result=args[args.indexOf('--output-last-message')+1];
      const review=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved;
      if(review){
        state.reviews++; const approved=state.reviews>1 && !state.alwaysReject;
        fs.writeFileSync(result,JSON.stringify({approved,issues:approved?[]:['A capa está enrolada no braço; soltar o manto sobre as ombreiras.']}));
      }else{
        state.renders++;state.prompt=prompt;state.images=images;
        const output=path.join(directory,'output.png');fs.copyFileSync(images.length===1?images[0]:images[1],output);
        fs.writeFileSync(result,JSON.stringify({image_path:output,error:''}));
      }
      fs.writeFileSync(statePath,JSON.stringify(state));
    });
  `,
  );
  const originalPath = process.env.PATH,
    originalBin = process.env.CODEX_BIN;
  try {
    process.env.PATH = temp + delimiter + (originalPath || '');
    delete process.env.CODEX_BIN;
    const reference = await sharp(await readFile('docs/references/character-style-v1.png')).removeAlpha().ensureAlpha(0.5).png().toBuffer();
    const job = {
      id: randomUUID(),
      race: 'Humano',
      class: 'Guerreiro',
      reference,
      equipment: [
        { slot: 'cloak' as const, item_id: 'cosmetic-cape', name: 'Capa', image: reference },
      ],
    };
    assert.deepEqual(await generateCharacterArt(job), reference);
    const repaired = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(repaired.renders, 2);
    assert.equal(repaired.reviews, 2);
    assert.match(repaired.prompt, /CORREÇÃO OBRIGATÓRIA/);
    assert.match(repaired.prompt, /A capa está enrolada no braço/);
    assert.equal(repaired.images.length, 1);
    await assert.rejects(readFile(repaired.images.at(-1)), { code: 'ENOENT' });
    await writeFile(statePath, JSON.stringify({ renders: 0, reviews: 0, alwaysReject: true }));
    await assert.rejects(
      generateCharacterArt({ ...job, id: randomUUID() }),
      (error: unknown) =>
        error instanceof IllustratorError && error.code === 'composition_rejected',
    );
    const rejected = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(rejected.renders, 3);
    assert.equal(rejected.reviews, 3);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    await rm(temp, { recursive: true, force: true });
  }
});
