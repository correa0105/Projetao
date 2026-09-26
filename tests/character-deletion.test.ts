import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import {
  createLegacyTestCharacter,
  testArtImage,
  lockTestIllustrator,
} from './character-fixtures.js';

test('excluir personagem: confirmação, titularidade, vaga livre e auditoria preservada', async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const unlock = await lockTestIllustrator();
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
  const request = async (
    path: string,
    cookie = '',
    method = 'GET',
    body?: unknown,
    requestOrigin = origin,
  ) => {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: { Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  };
  try {
    const signup = async () => {
      const result = await request('/auth/sign-up/email', '', 'POST', {
        name: 'Teste de exclusão',
        email: `delete-${randomUUID()}@example.test`,
        password: `Test-${randomUUID()}`,
      });
      assert.equal(result.status, 200);
      users.push(result.data.user.id);
      return {
        id: result.data.user.id,
        cookie: result.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; '),
      };
    };
    const alice = await signup(),
      bob = await signup();
    const character = await createLegacyTestCharacter(alice.id, 'Arden');
    const path = `/characters/${character.id}`;
    const confirmation = { name: 'Arden' };
    assert.equal((await request(path, '', 'DELETE', confirmation)).status, 401);
    assert.equal((await request(path, bob.cookie, 'DELETE', confirmation)).status, 404);
    assert.equal((await request(path, alice.cookie, 'DELETE', { name: 'Outro' })).status, 400);
    assert.equal(
      (await request(path, alice.cookie, 'DELETE', confirmation, 'https://invalid.example')).status,
      403,
    );
    assert.equal(
      (
        await request('/purchases', alice.cookie, 'POST', {
          character_id: character.id,
          item_id: 'longsword',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      201,
    );
    await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
      character.id,
      await testArtImage(),
    ]);
    const {
      rows: [job],
    } = await pool.query(
      `INSERT INTO character_art_jobs(user_id,character_id,idempotency_key) VALUES($1,$2,$3) RETURNING id`,
      [alice.id, character.id, randomUUID()],
    );
    assert.equal((await request(path, alice.cookie, 'DELETE', confirmation)).status, 409);
    await pool.query("UPDATE character_art_jobs SET status='completed' WHERE id=$1", [job.id]);
    assert.equal((await request(path, alice.cookie, 'DELETE', confirmation)).status, 200);
    assert.equal((await request(path, alice.cookie, 'DELETE', confirmation)).status, 200);
    assert.equal((await request('/characters', alice.cookie)).data.length, 0);
    assert.equal((await request(path + '/details', alice.cookie)).status, 404);
    assert.equal((await request(path + '/portrait', alice.cookie)).status, 404);
    assert.equal(
      (
        await request('/purchases', alice.cookie, 'POST', {
          character_id: character.id,
          item_id: 'longsword',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal(
      (await pool.query('SELECT 1 FROM purchases WHERE character_id=$1', [character.id])).rowCount,
      1,
    );
    assert.equal(
      (await pool.query('SELECT 1 FROM character_portraits WHERE character_id=$1', [character.id]))
        .rowCount,
      0,
    );
    assert.equal((await request('/character-art', alice.cookie)).data.jobs.length, 0);
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const reference = (await testArtImage()).toString('base64');
    assert.equal(
      (
        await request('/character-art', alice.cookie, 'POST', {
          character_id: character.id,
          reference,
          idempotency_key: randomUUID(),
        })
      ).status,
      404,
    );
    await createLegacyTestCharacter(alice.id, 'Mira');
    assert.equal(
      (
        await request('/character-art', alice.cookie, 'POST', {
          creation: { name: 'Novo', race: 'Elfo', class: 'Mago', stats: [15, 14, 13, 12, 10, 8] },
          reference,
          idempotency_key: randomUUID(),
        })
      ).status,
      202,
    );
  } finally {
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await unlock();
    await pool.end();
  }
});
