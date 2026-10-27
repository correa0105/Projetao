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
import {defaultStartingOutfit} from '../shared/starting-outfit.js';
import { vttAssetId } from '../shared/vtt-token-image.js';
import { vttProtocolVersion } from '../shared/vtt-protocol.js';
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
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
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
    assert.equal((await pool.query('SELECT portrait_revision FROM characters WHERE id=$1',[character.id])).rows[0].portrait_revision,0);
    assert.deepEqual((await pool.query('SELECT image FROM character_portraits WHERE character_id=$1',[character.id])).rows[0].image,oldPortrait);
    assert.equal((await media(`/character-art/${job.data.id}/proposed/portrait`)).status,401);
    assert.equal((await media(`/character-art/${job.data.id}/proposed/token`,outsider.cookie)).status,404);
    const proposed=await media(`/character-art/${job.data.id}/proposed/portrait`,alice.cookie);
    assert.equal(proposed.status,200);assert.match(proposed.headers.get('Cache-Control')||'',/private, no-store/);
    const waiting=await request('/character-art',alice.cookie);assert.equal(waiting.data.reviews[0].id,job.data.id);
    assert.equal((await request(`/character-art/${job.data.id}/decision`,outsider.cookie,'POST',{decision:'accepted'})).status,404);
    assert.equal((await request(`/character-art/${job.data.id}/decision`,alice.cookie,'POST',{decision:'accepted'})).status,200);
    assert.equal((await request(`/character-art/${job.data.id}/decision`,alice.cookie,'POST',{decision:'accepted'})).status,200);
    assert.equal((await request(`/character-art/${job.data.id}/decision`,alice.cookie,'POST',{decision:'kept'})).status,409);
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
        choices: { ...defaultChoices('Humano', 'Guerreiro'), physicalTraits: { height: 'average', build: 'athletic', age: 'adult', gender: 'male' }, facialHair: { beard: 'goatee', mustache: 'english', color: 'blond', graying: true } },
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
    assert.deepEqual((await pool.query('SELECT choices FROM character_sheets WHERE character_id=$1', [cid])).rows[0].choices.facialHair, { beard: 'goatee', mustache: 'english', color: 'blond', graying: true });
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
      if(review){state.reviews.push({top,prompt});fs.writeFileSync(result,JSON.stringify({approved:!state.rejectToken||!top,top_down_correct:state.omitCamera?undefined:!state.rejectCamera,clothing_correct:!state.rejectClothing,facial_hair_correct:state.omitFacialHair?undefined:!state.rejectFacialHair,physical_traits_correct:state.omitPhysical?undefined:!state.rejectPhysical,selected_head_correct:!state.rejectHead,appendages_correct:!state.rejectAnatomy,issues:state.rejectToken&&top?['Câmera frontal incorreta.']:[]}));}
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
    assert.match(state.reviews[0].prompt, /um chifre na testa e outro no alto da cabeça/);
    assert.match(state.reviews[1].prompt, /mesma altura anatômica/);
    const physicalJob = { ...job, choices: { ...defaultChoices('Humano', 'Guerreiro'), startingOutfit:{...defaultStartingOutfit,top:'vest' as const,topColor:'#123abc',sash:false}, physicalTraits: { height: 'tall' as const, build: 'slim' as const, age: 'old' as const, gender: 'female' as const,posture:'hunched' as const,cane:'wooden' as const } } };
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [] }));
    await generateCharacterArtPair({ ...physicalJob, id: randomUUID() });
    const physical = JSON.parse(await readFile(statePath, 'utf8'));
    for (const stage of [...physical.renders, ...physical.reviews]) { assert.match(stage.prompt, /PERSONALIZAÇÃO FÍSICA/); assert.match(stage.prompt, /Personagem mulher/); }
    assert.match(physical.reviews[1].prompt, /physical_traits_correct=false/);
    for(const flags of [{rejectCamera:true},{omitCamera:true}]){await writeFile(statePath,JSON.stringify({renders:[],reviews:[],...flags}));await assert.rejects(generateCharacterToken({...job,id:randomUUID()},portrait),/revisão|conferir/);}
    for(const stage of [...physical.renders,...physical.reviews])for(const detail of ['POSTURA CURVADA','BENGALA:','#123abc','SEM FAIXA DE TECIDO','projeção curta e encurtada'])assert(stage.prompt.includes(detail),detail);
    for (const flags of [{ rejectPhysical: true }, { omitPhysical: true }]) {
      await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], ...flags }));
      await assert.rejects(generateCharacterToken({ ...physicalJob, id: randomUUID() }, portrait), /revisão|conferir/);
    }
    const facialJob = { ...job, choices: { ...defaultChoices('Humano', 'Guerreiro'), physicalTraits: { height: 'average' as const, build: 'average' as const, age: 'elder' as const, gender: 'male' as const }, facialHair: { beard: 'none' as const, mustache: 'horseshoe' as const, color: 'brown' as const, graying: false } } };
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [] }));
    await generateCharacterArtPair({ ...facialJob, id: randomUUID() });
    const facial = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(facial.renders[0].hashes.length, 3); assert.equal(facial.renders[1].hashes.length, 3);
    for (const stage of [...facial.renders, ...facial.reviews]) { assert.match(stage.prompt, /Barba Sem barba/); assert.match(stage.prompt, /Bigode Ferradura/); assert.match(stage.prompt, /Sem fios grisalhos adicionais/); }
    assert.match(facial.reviews[1].prompt, /facial_hair_correct=false/);
    for (const flags of [{ rejectFacialHair: true }, { omitFacialHair: true }]) {
      await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], ...flags }));
      await assert.rejects(generateCharacterToken({ ...facialJob, id: randomUUID() }, portrait), /revisão|conferir/);
    }
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [] }));
    const hornChoices = { ...defaultChoices('Tiefling', 'Guerreiro'), tieflingHorns: 'short' as const };
    await generateCharacterArtPair({ ...job, id: randomUUID(), race: 'Tiefling', choices: hornChoices });
    const horns = JSON.parse(await readFile(statePath, 'utf8'));
    assert.match(horns.renders[0].prompt, /FORMATO DE CHIFRES ESCOLHIDO:.*chifres curtos/);
    assert.equal(horns.renders[0].hashes.at(-1), hash(await readFile('public/character-creation/tiefling-horns-short.webp')));
    assert.match(horns.reviews[0].prompt, /Reprove um formato diferente/);
    assert.match(horns.renders[1].prompt, /Formato de chifres escolhido.*chifres curtos/);
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [] }));
    const warforgedChoices = defaultChoices('Warforged', 'Guerreiro');
    warforgedChoices.warforgedAppearance!.head = 'cavalier';
    const constructed = await generateCharacterArtPair({ ...job, id: randomUUID(), reference: null, race: 'Warforged', choices: warforgedChoices });
    assert.equal(hash(constructed.portrait), hash(portrait));
    assert.equal(hash(constructed.token), hash(token));
    const warforged = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(warforged.renders[0].hashes.length, 3);
    assert.equal(warforged.renders[0].hashes.at(-1), hash(await sharp('public/character-creation/warforged-heads-detailed-20261021.png').extract({left:512,top:0,width:512,height:512}).png().toBuffer()));
    assert.equal(warforged.renders[1].hashes[0], hash(portrait));
    assert.equal(warforged.renders[1].hashes.at(-1),warforged.renders[0].hashes.at(-1));
    assert.equal(warforged.renders[1].hashes.length,3);
    for (const stage of [...warforged.renders, ...warforged.reviews]) {
      assert.match(stage.prompt, /Cabeça Cavaleiro/);
      assert.match(stage.prompt, /Reprove tecido atravessando as pernas/);
    }
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], rejectHead: true }));
    await assert.rejects(generateCharacterToken({...job,id:randomUUID(),race:'Warforged',choices:warforgedChoices},portrait), /revisão/);
    const headRejected=JSON.parse(await readFile(statePath,'utf8'));
    assert.equal(headRejected.reviews.length,3);
    assert.match(headRejected.renders[1].prompt,/Restaurar o modelo exato da cabeça isolada/);
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], rejectToken: true }));
    await assert.rejects(generateCharacterToken({ ...job, id: randomUUID() }, portrait), /revisão/);
    const failed = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(failed.renders.length, 3);
    assert.ok(failed.renders[1].prompt.includes('Câmera frontal incorreta.'));
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], rejectClothing: true }));
    await assert.rejects(generateCharacterToken({ ...job, id: randomUUID() }, portrait), /revisão/);
    assert.equal(JSON.parse(await readFile(statePath, 'utf8')).reviews.length, 3);
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], rejectAnatomy: true }));
    await assert.rejects(generateCharacterArtPair({ ...job, id: randomUUID() }), /não passou/);
    const anatomy = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(anatomy.renders.length, 3);
    assert.equal(anatomy.renders.some((render: {top: boolean}) => render.top), false);
    assert.ok(anatomy.renders[1].prompt.includes('bases do par de chifres'));
    await writeFile(statePath, JSON.stringify({ renders: [], reviews: [], rejectAnatomy: true }));
    await assert.rejects(generateCharacterToken({ ...job, id: randomUUID() }, portrait), /revisão/);
    assert.equal(JSON.parse(await readFile(statePath, 'utf8')).renders.length, 3);
  } finally {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temp, { recursive: true, force: true });
  }
});
