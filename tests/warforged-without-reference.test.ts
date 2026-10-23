import { test } from 'node:test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { completeArt } from '../server/character-art.js';
import { defaultChoices } from '../shared/character-sheet.js';
import { testArtImage, testTokenImage } from './character-fixtures.js';

test('Warforged sem referência: fila, escolhas, privacidade, retomada e entrega sem duplicação', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(route: string, cookie = '', body?: unknown) {
    const r = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', {
      name: 'Construtor beta',
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
  try {
    const owner = await signup(),
      other = await signup();
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at) VALUES(true,true,now()) ON CONFLICT(id) DO UPDATE SET available=true,heartbeat_at=now()',
    );
    const choices = defaultChoices('Warforged', 'Guerreiro');
    choices.physicalTraits = { height: 'tall', build: 'slim', age: 'old' };
    choices.warforgedAppearance = {
      body: 'robust',
      head: 'angular',
      metal: 'copper',
      finish: 'rusted',
      accentEnabled: true,
      accentColor: '#123abc',
    };
    const creation = { name: 'Forjado sem foto', race: 'Warforged', class: 'Guerreiro', choices };
    for (const patch of [{ physicalTraits: undefined }, { physicalTraits: { height: 'short' } }, { physicalTraits: { height: 'invalid', build: 'slim', age: 'old' } }]) {
      assert.equal((await req('/character-art', owner.cookie, { creation: { ...creation, choices: { ...choices, ...patch } }, idempotency_key: randomUUID() })).status, 400);
    }
    const key = randomUUID();
    const queued = await req('/character-art', owner.cookie, { creation, idempotency_key: key });
    assert.equal(queued.status, 202, JSON.stringify(queued.data));
    const id = queued.data.id,
      route = '/character-art/' + id;
    assert.equal(
      (await req('/character-art', owner.cookie, { creation, idempotency_key: key })).data.id,
      id,
    );
    let row = (await pool.query('SELECT * FROM character_art_jobs WHERE id=$1', [id])).rows[0];
    assert.equal(row.reference, null);
    assert.deepEqual(row.creation.choices.warforgedAppearance, choices.warforgedAppearance);
    assert.equal((await req(route + '/draft', other.cookie)).status, 404);
    assert.equal((await req(route + '/retry', other.cookie, {})).status, 404);
    assert.equal((await req(route + '/draft', owner.cookie)).data.reference, '');
    await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1", [id]);
    assert.equal(
      (await req('/character-art', owner.cookie)).data.jobs.find((j: { id: string }) => j.id === id)
        .can_retry,
      true,
    );
    assert.equal((await req(route + '/retry', owner.cookie, {})).status, 202);
    await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1", [id]);
    const image = await testArtImage();
    const referenceChoices = {
      ...choices,
      warforgedArtMode: 'reference' as const,
      warforgedAppearance: undefined,
      warforgedBody: 'long-legs' as const,
    };
    const referenceCreation = { ...creation, choices: referenceChoices };
    assert.equal((await req('/character-art', owner.cookie, { creation: { ...referenceCreation, choices: { ...referenceChoices, warforgedBody: undefined } }, reference: image.toString('base64'), idempotency_key: randomUUID() })).status, 400);
    assert.equal(
      (
        await req(route + '/retry', owner.cookie, {
          creation: referenceCreation,
          reference: image.toString('base64'),
        })
      ).status,
      202,
    );
    assert(
      (await pool.query('SELECT reference FROM character_art_jobs WHERE id=$1', [id])).rows[0]
        .reference,
    );
    await pool.query(
      "UPDATE character_art_jobs SET status='failed',approved_portrait=$2 WHERE id=$1",
      [id, image],
    );
    assert.equal((await req(route + '/retry', owner.cookie, { creation })).status, 202);
    row = (
      await pool.query('SELECT reference,approved_portrait FROM character_art_jobs WHERE id=$1', [
        id,
      ])
    ).rows[0];
    assert.equal(row.reference, null, 'Escolher sem imagem remove a referência anterior');
    assert.equal(row.approved_portrait, null, 'Alterar construção invalida o retrato anterior');
    for (const payload of [
      { creation: { ...creation, race: 'Humano', choices: defaultChoices('Humano', 'Guerreiro') } },
      { creation: { ...creation, choices: { ...choices, warforgedAppearance: undefined } } },
      {
        creation: {
          ...creation,
          choices: {
            ...choices,
            warforgedAppearance: { ...choices.warforgedAppearance, body: 'invalid' },
          },
        },
      },
      { creation, reference: 'not_an_image' },
    ])
      assert.equal(
        (await req('/character-art', owner.cookie, { ...payload, idempotency_key: randomUUID() }))
          .status,
        400,
      );
    assert.equal(
      (
        await req('/character-art', owner.cookie, {
          character_id: randomUUID(),
          idempotency_key: randomUUID(),
        })
      ).status,
      404,
    );
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [id]);
    const cid = await completeArt(id, { portrait: image });
    await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1", [id]);
    assert.equal((await req(route + '/retry', owner.cookie, {})).status, 202);
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [id]);
    assert.equal(await completeArt(id, { portrait: image, token: await testTokenImage() }), cid);
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM characters WHERE user_id=$1', [owner.id]))
        .rows[0].n,
      1,
    );
    const saved = (
      await pool.query('SELECT choices FROM character_sheets WHERE character_id=$1', [cid])
    ).rows[0];
    assert.deepEqual(saved.choices.warforgedAppearance, choices.warforgedAppearance);
    const state = (await req('/character-art', owner.cookie)).data;
    assert.equal(state.quotas[cid].used, 0, 'Arte inicial continua gratuita');
    assert.equal(row.reference, null);
    const base = (
      await pool.query('SELECT construction_base FROM character_portraits WHERE character_id=$1', [
        cid,
      ])
    ).rows[0].construction_base;
    assert.deepEqual(base, image);
    assert.equal(
      (
        await req('/character-art', owner.cookie, {
          character_id: cid,
          reference: image.toString('base64'),
          idempotency_key: randomUUID(),
        })
      ).status,
      400,
      'Montagem não recebe referência externa',
    );
    assert.equal(
      (await req('/characters/' + cid + '/sheet/choices', owner.cookie, referenceChoices)).status,
      409,
      'Modo de criação não pode ser trocado na ficha',
    );
    const dressed = await req('/character-art', owner.cookie, {
      character_id: cid,
      idempotency_key: randomUUID(),
    });
    assert.equal(dressed.status, 202, JSON.stringify(dressed.data));
    const dressJob = (
      await pool.query('SELECT reference,reference_mode FROM character_art_jobs WHERE id=$1', [
        dressed.data.id,
      ])
    ).rows[0];
    assert.equal(dressJob.reference_mode, 'construction');
    assert.deepEqual(dressJob.reference, base);
    const different = await sharp({
      create: { width: 512, height: 768, channels: 4, background: '#403020cc' },
    })
      .png()
      .toBuffer();
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [
      dressed.data.id,
    ]);
    await completeArt(dressed.data.id, { portrait: different, token: await testTokenImage() });
    assert.deepEqual(
      (
        await pool.query(
          'SELECT construction_base FROM character_portraits WHERE character_id=$1',
          [cid],
        )
      ).rows[0].construction_base,
      base,
    );
    const referenceJob = await req('/character-art', owner.cookie, {
      creation: { ...referenceCreation, name: 'Forjado por referência' },
      reference: image.toString('base64'),
      idempotency_key: randomUUID(),
    });
    assert.equal(referenceJob.status, 202, JSON.stringify(referenceJob.data));
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [
      referenceJob.data.id,
    ]);
    const referenceId = await completeArt(referenceJob.data.id, {
      portrait: image,
      token: await testTokenImage(),
    });
    const referenceSaved = (await pool.query('SELECT choices FROM character_sheets WHERE character_id=$1', [referenceId])).rows[0].choices;
    assert.deepEqual(referenceSaved.physicalTraits, choices.physicalTraits);
    assert.equal(referenceSaved.warforgedBody, 'long-legs');
    assert.equal(
      (
        await req('/character-art', owner.cookie, {
          character_id: referenceId,
          idempotency_key: randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req('/character-art', owner.cookie, {
          character_id: referenceId,
          reference: image.toString('base64'),
          idempotency_key: randomUUID(),
        })
      ).status,
      202,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
