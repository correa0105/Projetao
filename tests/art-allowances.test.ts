import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter, finishTestArt, testArtImage } from './character-fixtures.js';

test('imagens sem limite: todos os personagens da conta, cota comum, posse e fila', async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
  async function req(path: string, cookie = '', body?: unknown) {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json(), headers: res.headers };
  }
  async function signup() {
    const res = await req('/auth/sign-up/email', '', {
      name: 'Teste cota',
      email: `art-limit-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
      art_unlimited: true,
    });
    assert.equal(res.status, 200);
    users.push(res.data.user.id);
    return {
      id: res.data.user.id,
      cookie: res.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup();
    const first = await createLegacyTestCharacter(alice.id, 'Primeiro'),
      second = await createLegacyTestCharacter(alice.id, 'Segundo'),
      normal = await createLegacyTestCharacter(bob.id);
    for (const [character, owner] of [
      [first, alice],
      [second, alice],
      [normal, bob],
    ])
      for (let i = 0; i < 3; i++)
        await pool.query(
          "INSERT INTO character_art_jobs(user_id,character_id,idempotency_key,status) VALUES($1,$2,$3,'completed')",
          [owner.id, character.id, randomUUID()],
        );
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const reference = (await testArtImage()).toString('base64');
    const body = (id: string) => ({
      character_id: id,
      reference,
      idempotency_key: randomUUID(),
      art_unlimited: true,
    });
    assert.equal((await req('/character-art', bob.cookie, body(normal.id))).status, 409);
    assert.equal((await req('/characters', bob.cookie)).data[0].art_unlimited, false);
    await pool.query('INSERT INTO character_art_allowances(user_id,unlimited) VALUES($1,true)', [
      alice.id,
    ]);
    assert.ok(
      (await req('/characters', alice.cookie)).data.every(
        (c: { art_unlimited: boolean }) => c.art_unlimited,
      ),
    );
    for (const character of [first, second, first]) {
      const input = body(character.id);
      const accepted = await req('/character-art', alice.cookie, input);
      assert.equal(accepted.status, 202);
      assert.equal((await req('/character-art', alice.cookie, input)).data.id, accepted.data.id);
      assert.equal((await req('/character-art', alice.cookie, body(character.id))).status, 409);
      await finishTestArt(accepted.data.id);
    }
    assert.equal((await req('/character-art', alice.cookie, body(normal.id))).status, 404);
    assert.equal((await req('/character-art', bob.cookie, body(first.id))).status, 404);
    assert.equal((await req('/character-art', bob.cookie, body(normal.id))).status, 409);
    assert.equal(
      (await req('/characters', alice.cookie)).data.find((c: { id: string }) => c.id === first.id)
        .art_used,
      5,
    );
  } finally {
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
