import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { generateCharacterArt } from '../server/codex-illustrator.js';

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
  try {
    process.env.PATH = temp + delimiter + (originalPath || '');
    delete process.env.CODEX_BIN;
    const output = await generateCharacterArt({
      id: randomUUID(),
      race: 'Elfo',
      class: 'Guerreiro',
      character_id: randomUUID(),
      reference,
      equipment: [
        { slot: 'main_hand', item_id: 'longsword', name: 'Espada longa', image: itemImage },
      ],
    });
    assert.deepEqual(output, reference);
    const captured = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(captured.images.length, 3);
    assert.equal(captured.images[2].hash, createHash('sha256').update(itemImage).digest('hex'));
    assert.match(captured.prompt, /"reference_image":3/);
    assert.match(captured.prompt, /Espada longa/);
    assert.match(captured.prompt, /SOMENTE os equipamentos listados/);
    assert.match(captured.prompt, /não cole as imagens/);
    await assert.rejects(readFile(captured.images[2].path), { code: 'ENOENT' });
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    await rm(temp, { recursive: true, force: true });
  }
});
