import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { generateCharacterArt } from '../server/codex-illustrator.js';
import { describeArtEquipment } from '../server/equipment-art.js';
import type { ArtEquipment } from '../shared/equipment.js';

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
      const directory = args[args.indexOf('--cd')+1], output = path.join(directory, 'output.png');
      fs.copyFileSync(images[1], output);
      fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ prompt, images: images.map(p => ({ path: p, hash: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') })) }));
      fs.writeFileSync(args[args.indexOf('--output-last-message')+1], JSON.stringify({ image_path: output, error: '' }));
    });
  `,
  );
  const originalPath = process.env.PATH,
    originalBin = process.env.CODEX_BIN;
  const reference = await readFile('docs/references/character-style-v1.png');
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
    assert.equal(captured.images.length, 9);
    for (const [index, item] of equipment.entries())
      assert.equal(
        captured.images[index + 2].hash,
        createHash('sha256').update(item.image).digest('hex'),
      );
    assert.equal(captured.images[2].hash, createHash('sha256').update(itemImage).digest('hex'));
    assert.match(captured.prompt, /"reference_image":3/);
    assert.match(captured.prompt, /Espada longa/);
    assert.match(captured.prompt, /SOMENTE os equipamentos listados/);
    assert.match(captured.prompt, /não cole as imagens/);
    assert.match(captured.prompt, /CAPACETE OBRIGATÓRIO/);
    assert.match(captured.prompt, /viseira fechada/);
    assert.match(captured.prompt, /exatamente UM PAR de ombreiras/);
    assert.match(captured.prompt, /ignore essas ombreiras/);
    assert.match(captured.prompt, /Transcreva essas exigências para o prompt enviado à ferramenta/);
    assert.match(captured.prompt, /"slot":"head"/);
    assert.match(captured.prompt, /"reference_image":9/);
    assert.ok(
      captured.prompt.includes(
        JSON.stringify(captured.images.map((image: { path: string }) => image.path)),
      ),
    );
    assert.match(captured.prompt, /use referenced_image_paths com TODOS esses caminhos/);
    assert.match(captured.prompt, /Não use num_last_images_to_include/);
    const tiara = describeArtEquipment(
      { slot: 'head', item_id: 'cosmetic-tiara', name: 'Tiara com gema azul', image: itemImage },
      0,
    );
    assert.doesNotMatch(tiara.wearing, /CAPACETE OBRIGATÓRIO|viseira/);
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
    assert.match(opened.prompt, /CAPACETE OBRIGATÓRIO ABERTO/);
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
