import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

let server: Server;

let base: string;
const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
const users: string[] = [];
type Client = { cookie: string; id: string; email: string; password: string };
async function request(
  path: string,
  client?: Client,
  body?: unknown,
  method = body ? 'POST' : 'GET',
  extra: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(client ? { Cookie: client.cookie } : {}),
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function signup(email = `integration-${randomUUID()}@example.test`): Promise<Client> {
  const password = `Test-${randomUUID()}`;
  const response = await request('/api/auth/sign-up/email', undefined, {
    name: 'Aventureiro de teste',
    email,
    password,
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  users.push(response.data.user.id);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  return { cookie, id: response.data.user.id, email, password };
}
before(async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  // Only remove records created by this test run, including authored posts.
  if (users.length) {
    await pool.query('DELETE FROM board_posts WHERE author_id=ANY($1::text[])', [users]);
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
  }
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  await pool.end();
});

test('Conquistas: metas históricas, limites, região e isolamento', async () => {
  const owner = await signup();
  const outsider = await signup();
  const c = await createLegacyTestCharacter(owner.id, 'Veterano');
  const other = await createLegacyTestCharacter(owner.id, 'Outro');
  const path = `/api/characters/${c.id}/achievements`;
  assert.equal((await request(path, outsider)).status, 404);
  const item = (await pool.query('SELECT id FROM catalog_items LIMIT 1')).rows[0].id;
  await pool.query(
    'INSERT INTO purchases(character_id,item_id,quantity,total_cp,idempotency_key) VALUES($1,$2,1,99999,$3)',
    [c.id, item, randomUUID()],
  );
  const missions: string[] = [];
  for (let i = 0; i < 11; i++) {
    const region = i === 10 ? 'northundria' : 'reino-do-norte';
    const b = (
      await pool.query(
        `INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,status,region_id) VALUES($1,'mission','Uma aventura','Uma história de teste','Teste','Moderada',$2,$3) RETURNING id`,
        [outsider.id, i === 9 ? 'active' : 'completed', region],
      )
    ).rows[0].id;
    missions.push(b);
    await pool.query('INSERT INTO mission_participants(post_id,character_id) VALUES($1,$2)', [
      b,
      c.id,
    ]);
    if (i !== 9)
      await pool.query(
        'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by) VALUES($1,$2,0,$3)',
        [b, c.id, outsider.id],
      );
  }
  let result = await request(path, owner);
  assert.equal(result.data.progress.north_veteran.current, 9);
  assert.equal(result.data.progress.shop_patron.current, 999);
  assert.equal(result.data.progress.north_renown.available, false);
  assert.equal(result.data.unlocked.length, 0);
  await pool.query(
    'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by) VALUES($1,$2,0,$3)',
    [missions[9], c.id, outsider.id],
  );
  await pool.query("UPDATE board_posts SET status='completed' WHERE id=$1", [missions[9]]);
  await pool.query('UPDATE board_posts SET author_id=$1 WHERE id=$2', [owner.id, missions[0]]);
  await pool.query(
    'INSERT INTO purchases(character_id,item_id,quantity,total_cp,idempotency_key) VALUES($1,$2,1,1,$3)',
    [c.id, item, randomUUID()],
  );
  result = await request(path, owner);
  assert.deepEqual(result.data.unlocked.map((v: { code: string }) => v.code).sort(), [
    'first_story',
    'north_veteran',
    'shop_patron',
  ]);
  const repeated = await request(path, owner);
  assert.deepEqual(repeated.data.unlocked, result.data.unlocked);
  const sibling = await request(`/api/characters/${other.id}/achievements`, owner);
  assert.deepEqual(
    sibling.data.unlocked.map((v: { code: string }) => v.code),
    ['first_story'],
  );
  assert.equal(sibling.data.progress.north_veteran.current, 0);
  assert.equal(sibling.data.progress.shop_patron.current, 0);
  await pool.query('DELETE FROM board_posts WHERE id=ANY($1::uuid[])', [missions]);
});
