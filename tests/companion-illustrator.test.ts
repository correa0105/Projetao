import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, relative, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { generateCompanionArt } from '../server/codex-illustrator.js';
import { equipmentReferenceSheet } from '../server/equipment-reference.js';
import { describeCompanionEquipment, type CompanionArtEquipment } from '../server/companion-art.js';
import sharp from 'sharp';

test('animal veste referências reais sobre BASE sem estilo humano ou mistura de sessões', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'companion-cli-')),
    entry = join(temp, 'node_modules/@openai/codex/bin'),
    capture = join(temp, 'capture.json');
  await mkdir(entry, { recursive: true });
  await writeFile(
    join(entry, 'codex.js'),
    `
    const fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2),images=args.flatMap((v,i)=>v==='--image'?[args[i+1]]:[]),result=args[args.indexOf('--output-last-message')+1];
    let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      if(JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1],'utf8')).properties.approved){const saved=JSON.parse(fs.readFileSync(${JSON.stringify(capture)},'utf8'));saved.review=prompt;fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(saved));fs.writeFileSync(result,JSON.stringify({approved:true,issues:[]}));return;}
      if(images.length>5)process.exit(1);
      fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({prompt,images:images.map(p=>({path:p,bytes:fs.readFileSync(p).toString('base64')}))}));
      const out=path.join(args[args.indexOf('--cd')+1],'output.png');fs.copyFileSync(images[0],out);fs.writeFileSync(result,JSON.stringify({image_path:out,error:''}));
    });
  `,
  );
  const beforePath = process.env.PATH,
    beforeBin = process.env.CODEX_BIN;
  const base = await sharp({
    create: { width: 768, height: 512, channels: 4, background: '#00000000' },
  })
    .png()
    .toBuffer();
  const slots = [
    'head',
    'armor',
    'shoulders',
    'bracers',
    'legs',
    'feet',
    'neck',
    'cloak',
    'back',
    'belt',
    'saddle',
  ] as const;
  const equipment: CompanionArtEquipment[] = await Promise.all(
    slots.map(async (slot, index) => ({
      slot,
      item_id: `owned-${slot}`,
      name: `Equipamento real ${slot}`,
      image: await sharp({
        create: {
          width: 32,
          height: 48,
          channels: 4,
          background: { r: 20 + index * 12, g: 40, b: 70, alpha: 0.8 },
        },
      })
        .png()
        .toBuffer(),
    })),
  );
  try {
    delete process.env.CODEX_BIN;
    process.env.PATH = temp + delimiter + (beforePath || '');
    assert.deepEqual(
      await generateCompanionArt({
        id: randomUUID(),
        reference: base,
        kind: 'mount',
        species_id: 'warhorse',
        appearance: 'original',
        name: 'Brasa',
        equipment,
      }),
      base,
    );
    const rendered = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(rendered.images.length, 2);
    assert.deepEqual(Buffer.from(rendered.images[0].bytes, 'base64'), base);
    assert.equal(
      createHash('sha256').update(Buffer.from(rendered.images[1].bytes, 'base64')).digest('hex'),
      createHash('sha256')
        .update(await equipmentReferenceSheet(equipment))
        .digest('hex'),
    );
    assert.match(rendered.prompt, /imagem BASE do animal/);
    assert.match(rendered.prompt, /primeira referência/);
    assert.match(rendered.prompt, /SOMENTE os equipamentos listados/);
    assert.match(rendered.prompt, /patas traseiras naturais/);
    assert.match(rendered.prompt, /sem mãos, braços humanos, torso humano, cavaleiro ou armas/);
    assert.doesNotMatch(
      rendered.prompt,
      /Raça validada:|Classe validada:|camisa branca|calça cinza/,
    );
    assert.match(rendered.prompt, /"reference_image":2/);
    assert.match(rendered.prompt, /NÃO reproduza sua grade/);
    for (const [index, item] of equipment.entries()) {
      assert.ok(rendered.prompt.includes(item.item_id));
      assert.ok(rendered.prompt.includes(`"reference_panel":${index + 1}`));
    }
    assert.match(describeCompanionEquipment(equipment.at(-1)!, 0).wearing, /Sela única/);
    assert.ok(
      rendered.prompt.includes(
        JSON.stringify(rendered.images.map((image: { path: string }) => image.path)),
      ),
    );
    await generateCompanionArt({
      id: randomUUID(),
      reference: base,
      kind: 'mount',
      species_id: 'warhorse',
      appearance: 'original',
      name: 'Brasa',
      barding_parts: ['chest', 'body'],
      equipment: [
        { ...equipment.find((item) => item.slot === 'armor')!, item_id: 'legacy:barding-plate' },
      ],
    });
    const partial = JSON.parse(await readFile(capture, 'utf8'));
    for (const prompt of [partial.prompt, partial.review]) {
      assert.match(prompt, /INCLUIR Proteção do peito; Tronco e flancos/);
      assert.match(
        prompt,
        /NÃO desenhar as partes desmarcadas da barda: Capacete \/ testeira; Proteção do pescoço/,
      );
      assert.match(prompt, /Proteção das patas dianteiras; Proteção das patas traseiras/);
    }
    assert.match(
      describeCompanionEquipment({ ...equipment[1], item_id: 'legacy:barding-plate' }, 0).wearing,
      /ARMADURA COMPLETA/,
    );
  } finally {
    if (beforePath === undefined) delete process.env.PATH;
    else process.env.PATH = beforePath;
    if (beforeBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = beforeBin;
    assert.ok(relative(resolve(tmpdir()), resolve(temp)).startsWith('companion-cli-'));
    await rm(temp, { recursive: true, force: true });
  }
});
