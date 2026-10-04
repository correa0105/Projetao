import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

test('montaria em exibição: compra, escolha persistente, concorrência e isolamento por personagem', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const response = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Cavaleiro',
      email: `mount-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((item) => item.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup(),
      other = await signup();
    const a = await createLegacyTestCharacter(owner.id, 'Cavaleiro um'),
      b = await createLegacyTestCharacter(owner.id, 'Cavaleiro dois'),
      c = await createLegacyTestCharacter(other.id, 'Outro jogador');
    await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=ANY($1::uuid[])', [
      [a.id, b.id, c.id],
    ]);
    const order = {
      character_id: a.id,
      mount_id: 'riding-horse',
      name: 'Brasa',
      coat: 'alternate',
      equipment: ['saddle-riding'],
      idempotency_key: randomUUID(),
    };
    const first = await req('/stable/purchase', owner.cookie, 'POST', order);
    assert.equal(first.status, 201);
    assert.equal(first.data.mount.displayed, true);
    const second = await req('/stable/purchase', owner.cookie, 'POST', {
      ...order,
      name: 'Neve',
      mount_id: 'pony',
      equipment: [],
      idempotency_key: randomUUID(),
    });
    assert.equal(second.status, 201);
    assert.equal(second.data.mount.displayed, false);
    const foreign = await req('/stable/purchase', other.cookie, 'POST', {
      ...order,
      character_id: c.id,
      idempotency_key: randomUUID(),
    });
    const display = `/stable/${a.id}/display`;
    assert.equal((await req(display, '', 'PUT', { mount_id: first.data.mount.id })).status, 401);
    assert.equal(
      (await req(display, other.cookie, 'PUT', { mount_id: first.data.mount.id })).status,
      404,
    );
    assert.equal(
      (await req(display, owner.cookie, 'PUT', { mount_id: foreign.data.mount.id })).status,
      404,
    );
    assert.equal(
      (await req(`/stable/${b.id}/display`, owner.cookie, 'PUT', { mount_id: first.data.mount.id }))
        .status,
      404,
    );
    assert.equal((await req(`/stable/${b.id}`, owner.cookie)).data.length, 0);
    assert.equal(
      (await req(display, owner.cookie, 'PUT', { mount_id: second.data.mount.id })).status,
      200,
    );
    let items = (await req(`/stable/${a.id}`, owner.cookie)).data;
    assert.equal(items.filter((item: { displayed: boolean }) => item.displayed).length, 1);
    assert.equal(
      items.find((item: { displayed: boolean }) => item.displayed).id,
      second.data.mount.id,
    );
    assert.equal((await req('/stable/purchase', owner.cookie, 'POST', order)).status, 200);
    assert.equal(
      (await req(`/stable/${a.id}`, owner.cookie)).data.find(
        (item: { displayed: boolean }) => item.displayed,
      ).id,
      second.data.mount.id,
    );
    const choices = await Promise.all(
      [first, second].map((item) =>
        req(display, owner.cookie, 'PUT', { mount_id: item.data.mount.id }),
      ),
    );
    assert.ok(choices.every((choice) => choice.status === 200));
    items = (await req(`/stable/${a.id}`, owner.cookie)).data;
    assert.equal(items.filter((item: { displayed: boolean }) => item.displayed).length, 1);
    await req(display, owner.cookie, 'PUT', { mount_id: null });
    await seed();
    assert.equal(
      (await req(`/stable/${a.id}`, owner.cookie)).data.some(
        (item: { displayed: boolean }) => item.displayed,
      ),
      false,
    );
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [a.id])).rows[0].gold_cp,
      88500,
    );
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [other.id]);
    assert.equal(
      (await req(display, other.cookie, 'PUT', { mount_id: first.data.mount.id })).status,
      404,
    );
    await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1', [a.id]);
    assert.equal(
      (await req(display, owner.cookie, 'PUT', { mount_id: first.data.mount.id })).status,
      404,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
