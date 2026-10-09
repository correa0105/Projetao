import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  generateCompanionArtPair,
  generateCharacterToken,
} from '../server/character-token-illustrator';
import { basicCompanionToken } from '../shared/companion-token-art';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
test('animal pair uses approved identity and its actual species/coat overhead guide; rejected token cannot complete the pair', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'animal-token-cli-')),
    entry = join(temp, 'node_modules/@openai/codex/bin'),
    capture = join(temp, 'capture.json');
  await mkdir(entry, { recursive: true });
  const portrait = await readFile(
    'data/companion-token-art-20261009/references/companion-pet-dog-original-v1.png',
  );
  await writeFile(join(temp, 'portrait.png'), portrait);
  const token = await sharp(
    await readFile('public' + basicCompanionToken('pet', 'dog', 'shepherd')),
  )
    .png()
    .toBuffer();
  await writeFile(join(temp, 'token.png'), token);
  await writeFile(
    join(entry, 'codex.js'),
    `
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),args=process.argv.slice(2),dir=args[args.indexOf('--cd')+1],result=args[args.indexOf('--output-last-message')+1],images=args.flatMap((v,i)=>v==='--image'?[args[i+1]]:[]);
 let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
 const state=fs.existsSync(${JSON.stringify(capture)})?JSON.parse(fs.readFileSync(${JSON.stringify(capture)})):{renders:[],reviews:[]},top=dir.includes('companion-token-art'),review=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved;
 const record={top,prompt,images:images.map(p=>({path:p,hash:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}))};
 if(review){state.reviews.push(record);fs.writeFileSync(result,JSON.stringify({approved:!(top&&state.reject),issues:top&&state.reject?['A câmera está frontal.']:[]}));}
 else{state.renders.push(record);const file=path.join(dir,'output.png');fs.copyFileSync(top?${JSON.stringify(join(temp, 'token.png'))}:${JSON.stringify(join(temp, 'portrait.png'))},file);fs.writeFileSync(result,JSON.stringify({image_path:file,error:''}));}
 fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(state));
 });`,
  );
  const saved = {
    PATH: process.env.PATH,
    CODEX_BIN: process.env.CODEX_BIN,
    CODEX_HOME: process.env.CODEX_HOME,
  };
  try {
    process.env.PATH = temp + delimiter + (saved.PATH || '');
    delete process.env.CODEX_BIN;
    process.env.CODEX_HOME = temp;
    for (const subject of [
      { kind: 'pet', species_id: 'dog', appearance: 'shepherd', name: 'Fenrir' },
      { kind: 'mount', species_id: 'warhorse', appearance: 'alternate', name: 'Brisa' },
    ] as const) {
      await writeFile(capture, JSON.stringify({ renders: [], reviews: [] }));
      const pair = await generateCompanionArtPair({
        id: randomUUID(),
        reference: portrait,
        ...subject,
      });
      assert.equal(hash(pair.portrait), hash(portrait));
      assert.equal(hash(pair.token), hash(token));
      const record = JSON.parse(await readFile(capture, 'utf8'));
      assert.equal(record.renders.length, 2);
      assert.equal(record.reviews.length, 2);
      const overhead = record.renders[1];
      assert.equal(overhead.top, true);
      assert.equal(overhead.images.length, 2);
      assert.equal(overhead.images[0].hash, hash(portrait));
      assert.equal(
        overhead.images[1].hash,
        hash(
          await readFile(
            'public' + basicCompanionToken(subject.kind, subject.species_id, subject.appearance),
          ),
        ),
      );
      assert.match(overhead.prompt, /90 graus/);
      assert.ok(overhead.prompt.includes(subject.species_id));
      assert.ok(overhead.prompt.includes(subject.appearance));
      assert.doesNotMatch(overhead.prompt, /Raça: Humano|Classe: Guerreiro|monster-berserker/);
      assert.match(record.reviews[1].prompt, /As patas ficam sob o tronco/);
    }
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [], reject: true }));
    await assert.rejects(
      generateCompanionArtPair({
        id: randomUUID(),
        reference: portrait,
        kind: 'pet',
        species_id: 'dog',
        appearance: 'shepherd',
        name: 'Fenrir',
      }),
      /não passou pela revisão/,
    );
    const rejected = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(rejected.renders.filter((r: { top: boolean }) => r.top).length, 3);
    assert.match(rejected.renders[2].prompt, /A câmera está frontal/);
    await assert.rejects(
      generateCharacterToken(
        {
          id: randomUUID(),
          reference: portrait,
          race: 'Humano',
          class: 'Guerreiro',
          companion: { kind: 'pet', species_id: 'dog', appearance: 'invalid-coat', name: 'Cão' },
        },
        portrait,
      ),
      /modelo do token/,
    );
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(temp, { recursive: true, force: true });
  }
});
