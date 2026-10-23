import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { completeArt } from '../server/character-art.js';
import { defaultChoices } from '../shared/character-sheet.js';
import { testArtImage, testTokenImage } from './character-fixtures.js';

test('criação recuperável: texto, ficha, imagem e arte aprovada sobrevivem à falha; retry é privado e idempotente', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
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
      name: 'Criação salva',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    users.push(r.data.user.id);
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
      other = await signup(),
      id = randomUUID(),
      reference = await testArtImage();
    const legacyChoices = defaultChoices('Warforged', 'Bárbaro', 'Soldado');
    delete legacyChoices.warforgedAppearance;
    delete legacyChoices.warforgedArtMode;
    const creation = {
      name: 'Artorias teste',
      race: 'Warforged',
      class: 'Bárbaro',
      background: 'Soldado',
      biography: 'Uma história extensa.\nSegunda linha com acentos: coração e memória.',
      choices: legacyChoices,
      stats: [15, 14, 13, 12, 10, 8],
    };
    await pool.query(
      "INSERT INTO character_art_jobs(id,user_id,creation,reference,approved_portrait,status,idempotency_key,error) VALUES($1,$2,$3,$4,$4,'failed',$5,'Token reprovado')",
      [id, owner.id, JSON.stringify(creation), reference, randomUUID()],
    );
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now()) ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
    );
    const route = '/character-art/' + id;
    assert.equal((await req(route + '/draft', other.cookie)).status, 404);
    assert.equal((await req(route + '/retry', other.cookie, {})).status, 404);
    const draft = await req(route + '/draft', owner.cookie);
    assert.equal(draft.status, 200);
    assert.deepEqual(draft.data.creation, creation);
    assert.equal(draft.data.reference, reference.toString('base64'));
    const catalog = await req('/character-art', owner.cookie);
    assert.equal(catalog.data.jobs.find((j: { id: string }) => j.id === id).can_retry, true);
    const repeated = await Promise.all([
      req(route + '/retry', owner.cookie, {}),
      req(route + '/retry', owner.cookie, {}),
    ]);
    assert(repeated.every((r) => r.status === 202 && r.data.id === id));
    let row = (await pool.query('SELECT * FROM character_art_jobs WHERE id=$1', [id])).rows[0];
    assert.equal(row.status, 'queued');
    assert.deepEqual(row.creation, creation);
    assert.deepEqual(row.reference, reference);
    assert.deepEqual(row.approved_portrait, reference);
    // An older failed job without its original image can still restore every field,
    // accept a replacement reference, and retry the same job rather than duplicate it.
    await pool.query(
      "UPDATE character_art_jobs SET status='failed',reference=NULL,approved_portrait=NULL WHERE id=$1",
      [id],
    );
    assert.equal((await req(route + '/retry', owner.cookie, {})).status, 409);
    assert.deepEqual((await req(route + '/draft', owner.cookie)).data.creation, creation);
    const edited = { ...creation, biography: creation.biography + '\nCapítulo recuperado.', choices: { ...legacyChoices, physicalTraits: { height: 'short', build: 'slim', age: 'adult', gender: 'male' }, warforgedBody: 'compact' } };
    assert.equal(
      (
        await req(route + '/retry', owner.cookie, {
          creation: edited,
          reference: reference.toString('base64'),
        })
      ).status,
      202,
    );
    row = (await pool.query('SELECT * FROM character_art_jobs WHERE id=$1', [id])).rows[0];
    assert.deepEqual(row.creation, edited);
    assert(row.reference);
    assert.equal(row.approved_portrait, null);
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [id]);
    const characterId = await completeArt(id, {
      portrait: reference,
      token: await testTokenImage(),
    });
    const saved = (
      await pool.query(
        'SELECT c.biography,s.choices FROM characters c JOIN character_sheets s ON s.character_id=c.id WHERE c.id=$1',
        [characterId],
      )
    ).rows[0];
    assert.equal(saved.biography, edited.biography);
    assert.deepEqual(saved.choices, edited.choices);
    const done = await req(route + '/retry', owner.cookie, {});
    assert.equal(done.status, 202);
    assert.equal(done.data.status, 'completed');
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM characters WHERE user_id=$1', [owner.id]))
        .rows[0].n,
      1,
    );
  } finally {
    for (const id of users) await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
