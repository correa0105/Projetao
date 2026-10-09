import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { completeArt } from '../server/character-art.js';
import { normalizeCharacterToken } from '../server/character-token-art.js';
import {
  generateCharacterArtPair,
  generateCharacterToken,
} from '../server/character-token-illustrator.js';
import {
  createLegacyTestCharacter,
  testArtImage,
  testTokenImage,
  lockTestIllustrator,
} from './character-fixtures.js';
import { defaultChoices } from '../shared/character-sheet.js';
import { vttAssetId } from '../shared/vtt-token-image.js';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('duas artes atômicas, perfil separado, atualização do token sem alterar posição e imagem personalizada preservada', async () => {
  await migrate();
  await seed();
  const unlock = await lockTestIllustrator();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function request(path: string, cookie = '', method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': '7',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const r = await request('/auth/sign-up/email', '', 'POST', {
      name: 'Token teste',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  const media = async (path: string, cookie = '') =>
    fetch(base + path, { headers: { Cookie: cookie } });
  try {
    const alice = await signup(),
      master = await signup(),
      outsider = await signup();
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [master.id]);
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const character = await createLegacyTestCharacter(alice.id);
    const oldPortrait = await testArtImage(),
      token = await testTokenImage();
    await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
      character.id,
      oldPortrait,
    ]);
    let room = (await request('/vtt', master.cookie, 'POST', { name: 'Tokens separados' })).data;
    assert.equal(
      (await request('/vtt/join', alice.cookie, 'POST', { invite: room.invite })).status,
      200,
    );
    room = (await request('/vtt/rooms/' + room.id, master.cookie)).data;
    const scene = room.document.scenes[0],
      imported = scene.tokens.find((t: any) => t.characterId === character.id);
    assert.ok(imported.image && !imported.image.endsWith('/top-down'));
    const legacyPreview = await media(`/characters/${character.id}/token`, alice.cookie);
    assert.equal(legacyPreview.status, 200);
    assert.deepEqual(Buffer.from(await legacyPreview.arrayBuffer()), oldPortrait);
    assert.equal((await media(`/characters/${character.id}/token`, outsider.cookie)).status, 404);
    assert.equal((await media(`/characters/${character.id}/token`)).status, 401);
    Object.assign(imported, { x: 420, y: 350, rotation: 75, width: 140, height: 110 });
    const customized = {
      ...structuredClone(imported),
      id: randomUUID(),
      image: '/vtt/monsters/monster-knight.webp',
      x: 600,
    };
    scene.tokens.push(customized);
    assert.equal(
      (
        await request('/vtt/rooms/' + room.id, master.cookie, 'PUT', {
          revision: room.revision,
          document: room.document,
        })
      ).status,
      200,
    );
    const submit = {
      character_id: character.id,
      reference: oldPortrait.toString('base64'),
      idempotency_key: randomUUID(),
    };
    assert.equal((await request('/character-art', outsider.cookie, 'POST', submit)).status, 404);
    const job = await request('/character-art', alice.cookie, 'POST', submit);
    assert.equal(job.status, 202);
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [job.data.id]);
    const invalid = await sharp({
      create: { width: 512, height: 512, channels: 3, background: '#8899aa' },
    })
      .png()
      .toBuffer();
    await assert.rejects(completeArt(job.data.id, { portrait: oldPortrait, token: invalid }));
    assert.equal(
      (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [character.id]))
        .rows[0].portrait_revision,
      0,
    );
    assert.equal(
      (await pool.query('SELECT 1 FROM character_tokens WHERE character_id=$1', [character.id]))
        .rowCount,
      0,
    );
    const portrait = await sharp(oldPortrait).modulate({ brightness: 0.6 }).png().toBuffer();
    assert.equal(await completeArt(job.data.id, { portrait, token }), character.id);
    const revision = (
      await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [character.id])
    ).rows[0].portrait_revision;
    assert.equal(revision, 1);
    assert.equal(await completeArt(job.data.id, { portrait, token }), character.id);
    assert.equal(
      (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [character.id]))
        .rows[0].portrait_revision,
      1,
    );
    const profile = await media(`/characters/${character.id}/portrait`, alice.cookie);
    assert.equal(profile.status, 200);
    assert.equal((await sharp(Buffer.from(await profile.arrayBuffer())).metadata()).height, 768);
    assert.equal(
      (await media(`/characters/${character.id}/portrait`, outsider.cookie)).status,
      404,
    );
    room = (await request('/vtt/rooms/' + room.id, master.cookie)).data;
    const updated = room.document.scenes[0].tokens.find((t: any) => t.id === imported.id);
    assert.ok(updated.image.endsWith('/top-down'));
    assert.deepEqual(
      [updated.x, updated.y, updated.rotation, updated.width, updated.height],
      [420, 350, 75, 140, 110],
    );
    assert.equal(
      room.document.scenes[0].tokens.find((t: any) => t.id === customized.id).image,
      customized.image,
    );
    const delivered = await media(updated.image.slice(4), alice.cookie);
    assert.equal(delivered.status, 200);
    const png = Buffer.from(await delivered.arrayBuffer()),
      meta = await sharp(png).metadata();
    assert.equal(meta.width, 512);
    assert.equal(meta.height, 512);
    assert.ok(meta.hasAlpha);
    assert.equal((await sharp(png).stats()).isOpaque, false);
    const preview = await media(`/characters/${character.id}/token`, alice.cookie);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('Cache-Control') || '', /^private/);
    const previewMeta = await sharp(Buffer.from(await preview.arrayBuffer())).metadata();
    assert.equal(previewMeta.width, 512);
    assert.equal(previewMeta.height, 512);
    assert.ok(previewMeta.hasAlpha);
    assert.equal((await media(updated.image.slice(4))).status, 401);
    assert.equal((await media(updated.image.slice(4), outsider.cookie)).status, 404);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM character_art_jobs WHERE user_id=$1 AND status='completed'",
          [alice.id],
        )
      ).rows[0].n,
      1,
    );
    // New characters also receive both images before becoming visible in the roster.
    const creation = await request('/character-art', alice.cookie, 'POST', {
      creation: {
        name: 'Novo token',
        race: 'Humano',
        class: 'Guerreiro',
        choices: defaultChoices('Humano', 'Guerreiro'),
        stats: [15, 14, 13, 12, 10, 8],
      },
      reference: portrait.toString('base64'),
      idempotency_key: randomUUID(),
    });
    assert.equal(creation.status, 202, JSON.stringify(creation.data));
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [
      creation.data.id,
    ]);
    const cid = await completeArt(creation.data.id, { portrait, token });
    assert.ok(
      (await pool.query('SELECT 1 FROM character_tokens WHERE character_id=$1', [cid])).rowCount,
    );
    const room2 = (await request('/vtt', master.cookie, 'POST', { name: 'Importar novo token' }))
      .data;
    assert.equal(
      (await request('/vtt/join', alice.cookie, 'POST', { invite: room2.invite })).status,
      200,
    );
    const ready = (await request('/vtt/rooms/' + room2.id, alice.cookie)).data;
    assert.ok(
      ready.document.scenes[0].tokens
        .filter((t: any) => t.characterId)
        .every((t: any) => t.image.endsWith('/top-down')),
    );
    // A token asset remains protected from deletion while used, including its /top-down suffix.
    assert.equal(
      (
        await request(
          `/vtt/rooms/${room.id}/assets/${vttAssetId(updated.image)}`,
          master.cookie,
          'DELETE',
        )
      ).status,
      409,
    );
    assert.equal(
      (await request('/characters', alice.cookie)).data.find((c: any) => c.id === character.id)
        .art_used,
      1,
    );
  } finally {
    await unlock();
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

test('validação do token rejeita opaco, vazio e retrato; mantém alfa e silhueta quadrada', async () => {
  await assert.rejects(normalizeCharacterToken(await testArtImage()));
  const empty = await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#00000000' },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeCharacterToken(empty));
  const token = await normalizeCharacterToken(await testTokenImage());
  assert.equal((await sharp(token).metadata()).width, 512);
});

test('ilustrador gera duas imagens reais em sequência, referencia o retrato aprovado e revisa/rejeita o token', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'token-cli-')),
    entry = join(temp, 'node_modules/@openai/codex/bin');
  await mkdir(entry, { recursive: true });
  const statePath = join(temp, 'state.json'),
    portrait = await testArtImage(),
    token = await testTokenImage();
  await writeFile(join(temp, 'portrait.png'), portrait);
  await writeFile(join(temp, 'token.png'), token);
  await writeFile(
    join(entry, 'codex.js'),
    `
    const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
    const args=process.argv.slice(2), dir=args[args.indexOf('--cd')+1], result=args[args.indexOf('--output-last-message')+1], images=args.flatMap((v,i)=>v==='--image'?[args[i+1]]:[]);
    let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      const state=fs.existsSync(${JSON.stringify(statePath)})?JSON.parse(fs.readFileSync(${JSON.stringify(statePath)})):{renders:[],reviews:[]};
      const top=dir.includes('character-token-art'), review=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved;
      if(review){state.reviews.push({top,prompt});fs.writeFileSync(result,JSON.stringify({approved:!state.rejectToken||!top,issues:state.rejectToken&&top?['Câmera frontal incorreta.']:[]}));}
      else{state.renders.push({top,prompt,hashes:images.map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'))});const output=path.join(dir,'output.png');fs.copyFileSync(top?${JSON.stringify(join(temp, 'token.png'))}:${JSON.stringify(join(temp, 'portrait.png'))},output);fs.writeFileSync(result,JSON.stringify({image_path:output,error:''}));}
      fs.writeFileSync(${JSON.stringify(statePath)},JSON.stringify(state));
    });`,
  );
  const env = {
    PATH: process.env.PATH,
    CODEX_BIN: process.env.CODEX_BIN,
    CODEX_HOME: process.env.CODEX_HOME,
  };
  try {
    process.env.PATH = temp + delimiter + (env.PATH || '');
    delete process.env.CODEX_BIN;
    process.env.CODEX_HOME = temp;
    const job = { id: randomUUID(), race: 'Humano', class: 'Guerreiro', reference: portrait };
    const pair = await generateCharacterArtPair(job);
    assert.equal(hash(pair.portrait), hash(portrait));
    assert.equal(hash(pair.token), hash(token));
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(state.renders.length, 2);
    assert.equal(state.reviews.length, 2);
    assert.equal(state.renders[1].hashes[0], hash(portrait));
    assert.match(state.renders[1].prompt, /90 graus/);
    assert.match(state.renders[1].prompt, /transparent_background=true/);
    assert.match(state.reviews[1].prompt, /mãos com pegada impossível/);
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], rejectToken: true }));
    await assert.rejects(generateCharacterToken({ ...job, id: randomUUID() }, portrait), /revisão/);
    const failed = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(failed.renders.length, 3);
    assert.ok(failed.renders[1].prompt.includes('Câmera frontal incorreta.'));
  } finally {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temp, { recursive: true, force: true });
  }
});
