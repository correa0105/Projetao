import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { characterTokenCameraReference } from '../server/character-token-camera-reference';

test('local camera source stays private and unchanged; unavailable or escaping configured paths fail closed', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'token-camera-reference-'));
  const root = join(temp, 'private-library'), profile = join(temp, 'profile.json');
  await mkdir(root);
  try {
    const original = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 80, g: 50, b: 30, alpha: 0.7 } } }).webp().toBuffer();
    const file = join(root, 'camera.webp');
    await writeFile(file, original);
    const before = createHash('sha256').update(original).digest('hex');
    assert.deepEqual(await characterTokenCameraReference('owned.png', profile), { path: resolve('owned.png'), custom: false });
    await writeFile(profile, JSON.stringify({ root, file: 'camera.webp' }));
    const selected = await characterTokenCameraReference('owned.png', profile);
    assert.equal(selected.custom, true);
    assert.equal(resolve(selected.path), resolve(file));
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), before);
    const outside = join(temp, 'outside.webp');
    await writeFile(outside, original);
    for (const invalid of ['../outside.webp', outside, 'missing.webp']) {
      await writeFile(profile, JSON.stringify({ root, file: invalid }));
      await assert.rejects(characterTokenCameraReference('owned.png', profile), /inválida ou indisponível/);
    }
    await writeFile(join(root, 'not-image.json'), '{}');
    await writeFile(profile, JSON.stringify({ root, file: 'not-image.json' }));
    await assert.rejects(characterTokenCameraReference('owned.png', profile), /inválida ou indisponível/);
    await writeFile(profile, '{invalid');
    await assert.rejects(characterTokenCameraReference('owned.png', profile), /inválida ou indisponível/);
  } finally {
    assert.equal(dirname(resolve(temp)), resolve(tmpdir()));
    await rm(temp, { recursive: true, force: true });
  }
});

test('generation and visual review receive the same private camera reference and retry a rejected body projection', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'token-camera-integration-'));
  const library = join(temp, 'library'), profile = join(temp, 'profile.json');
  const cli = join(temp, 'node_modules/@openai/codex/bin'), capture = join(temp, 'capture.json');
  const id = randomUUID(), directory = resolve('.local/character-token-art', id);
  const keys = ['PATH', 'CODEX_BIN', 'CODEX_HOME', 'CHARACTER_TOKEN_CAMERA_PROFILE'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    await mkdir(library);await mkdir(cli, { recursive: true });
    const token = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 80, g: 30, b: 20, alpha: 0.6 } } }).png().toBuffer();
    const reference = join(library, 'camera.png'), fixture = join(temp, 'fixture.png');
    await writeFile(reference, token);await writeFile(fixture, token);
    await writeFile(profile, JSON.stringify({ root: library, file: 'camera.png' }));
    await writeFile(join(cli, 'codex.js'), `
const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2),output=args[args.indexOf('--output-last-message')+1],dir=args[args.indexOf('--cd')+1];
let prompt='';process.stdin.on('data',chunk=>prompt+=chunk);process.stdin.on('end',()=>{
 const file=${JSON.stringify(capture)},state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{renders:[],reviews:[]};
 const images=args.flatMap((value,index)=>value==='--image'?[args[index+1]]:[]),review=Boolean(JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved);
 if(review){state.reviews.push({prompt,images});const correct=state.reviews.length>1;fs.writeFileSync(output,JSON.stringify({approved:true,top_down_correct:correct,appendages_correct:true,clothing_correct:true,physical_traits_correct:true,facial_hair_correct:true,issues:correct?[]:['Pés invertidos em relação ao quadril.']}));}
 else {state.renders.push({prompt,images});const image=path.join(dir,'fixture-output.png');fs.copyFileSync(${JSON.stringify(fixture)},image);fs.writeFileSync(output,JSON.stringify({image_path:image,error:''}));}
 fs.writeFileSync(file,JSON.stringify(state));
});`);
    process.env.PATH = temp + delimiter + (previous.PATH || '');
    delete process.env.CODEX_BIN;process.env.CODEX_HOME = temp;
    process.env.CHARACTER_TOKEN_CAMERA_PROFILE = profile;
    const { generateCharacterToken } = await import('../server/character-token-illustrator');
    const result = await generateCharacterToken({ id, reference: token, race: 'Humano', class: 'Guerreiro', equipment: [] }, token);
    assert.deepEqual(result, token);
    const calls = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(calls.renders.length, 2);assert.equal(calls.reviews.length, 2);
    assert.equal(resolve(calls.renders[0].images[1]), resolve(reference));
    assert.equal(resolve(calls.renders[1].images[2]), resolve(reference));
    for (const review of calls.reviews) {
      assert.equal(resolve(review.images[2]), resolve(reference));
      assert.doesNotMatch(review.prompt, /precisa zênite estritamente vertical de 90 graus/);
    }
    assert.match(calls.renders[1].prompt, /Pés invertidos em relação ao quadril/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];else process.env[key] = previous[key];
    }
    assert.equal(dirname(directory), resolve('.local/character-token-art'));
    await rm(directory, { recursive: true, force: true });
    assert.equal(dirname(resolve(temp)), resolve(tmpdir()));
    await rm(temp, { recursive: true, force: true });
  }
});
