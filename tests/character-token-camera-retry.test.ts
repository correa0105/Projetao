import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { generateCharacterToken } from '../server/character-token-illustrator.js';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('câmera reprovada reconstrói o token sem reutilizar a projeção errada; correções locais preservam o candidato', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'token-camera-retry-'));
  const entry = join(temp, 'node_modules/@openai/codex/bin');
  await mkdir(entry, { recursive: true });
  const portrait = await sharp({ create: { width: 512, height: 768, channels: 4, background: '#88776688' } }).png().toBuffer();
  const camera = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#22334488' } }).png().toBuffer();
  const token = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } })
    .composite([{ input: await sharp({ create: { width: 200, height: 300, channels: 4, background: '#aabbcc' } }).png().toBuffer(), left: 156, top: 106 }]).png().toBuffer();
  await writeFile(join(temp, 'camera.png'), camera);
  await writeFile(join(temp, 'token.png'), token);
  const profile = join(temp, 'camera-profile.json');
  await writeFile(profile, JSON.stringify({ root: temp, file: 'camera.png' }));
  const statePath = join(temp, 'state.json');
  await writeFile(join(entry, 'codex.js'), `
    const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
    const args=process.argv.slice(2),result=args[args.indexOf('--output-last-message')+1];
    const images=args.flatMap((v,i)=>v==='--image'?[args[i+1]]:[]);
    let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      const state=JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}));
      const reviewing=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved;
      if(reviewing){
        state.reviews++;
        const bad=state.alwaysReject||state.reviews===1;
        fs.writeFileSync(result,JSON.stringify({approved:true,top_down_correct:!(bad&&state.failure==='camera'),appendages_correct:true,clothing_correct:!(bad&&state.failure==='clothing'),issues:bad?[state.failure==='camera'?'Câmera frontal incorreta.':'Tecido atravessando o braço.']:[]}));
      }else{
        state.renders.push({prompt,hashes:images.map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'))});
        const output=path.join(args[args.indexOf('--cd')+1],'output.png');
        fs.copyFileSync(${JSON.stringify(join(temp, 'token.png'))},output);
        fs.writeFileSync(result,JSON.stringify({image_path:output,error:''}));
      }
      fs.writeFileSync(${JSON.stringify(statePath)},JSON.stringify(state));
    });
  `);
  const saved = Object.fromEntries(['PATH', 'CODEX_BIN', 'CODEX_HOME', 'CHARACTER_TOKEN_CAMERA_PROFILE'].map(name => [name, process.env[name]]));
  try {
    process.env.PATH = temp + delimiter + (saved.PATH || '');
    delete process.env.CODEX_BIN;
    process.env.CODEX_HOME = temp;
    process.env.CHARACTER_TOKEN_CAMERA_PROFILE = profile;
    for (const failure of ['camera', 'clothing']) {
      await writeFile(statePath, JSON.stringify({ failure, renders: [], reviews: 0 }));
      await generateCharacterToken({ id: randomUUID(), race: 'Humano', class: 'Guerreiro', reference: portrait }, portrait);
      const state = JSON.parse(await readFile(statePath, 'utf8'));
      assert.equal(state.reviews, 2);
      assert.deepEqual(state.renders[0].hashes, [hash(portrait), hash(camera)]);
      if (failure === 'camera') {
        assert.deepEqual(state.renders[1].hashes, [hash(portrait), hash(camera)]);
        assert.match(state.renders[1].prompt, /RECONSTRUIR A CÂMERA/);
        assert.doesNotMatch(state.renders[1].prompt, /EDITE a imagem 1/);
        assert.match(state.renders[1].prompt, /Câmera frontal incorreta/);
      } else {
        assert.deepEqual(state.renders[1].hashes, [hash(token), hash(portrait), hash(camera)]);
        assert.match(state.renders[1].prompt, /EDITE a imagem 1/);
        assert.match(state.renders[1].prompt, /Tecido atravessando o braço/);
      }
    }
    await writeFile(statePath, JSON.stringify({ failure: 'camera', alwaysReject: true, renders: [], reviews: 0 }));
    await assert.rejects(generateCharacterToken({ id: randomUUID(), race: 'Humano', class: 'Guerreiro', reference: portrait }, portrait), /revisão/);
    const rejected = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(rejected.reviews, 3);
    for (const render of rejected.renders) assert.deepEqual(render.hashes, [hash(portrait), hash(camera)]);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await rm(temp, { recursive: true, force: true });
  }
});
