import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { worldClockTime, worldClockLabel, worldClockPhase } from '../shared/world-clock';

test('relógio avança, atravessa meia-noite e muda luz nos horários previstos', () => {
  assert.equal(worldClockLabel(worldClockTime(1439, 1000, 121000)), '00:07');
  assert.equal(worldClockLabel(worldClockTime(360, 2000, 1000)), '06:00');
  for (const [hour, phase] of [
    [0, 'night'],
    [5, 'night'],
    [6, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [16, 'afternoon'],
    [17, 'dusk'],
    [18, 'dusk'],
    [19, 'night'],
    [23, 'night'],
  ] as const)
    assert.equal(worldClockPhase(hour * 3600000), phase);
});

test('House 2.0 completa quatro ciclos por dia real, sem depender de abrir a página', () => {
  const anchor = Date.UTC(2026, 9, 20, 3);
  const hour = 3_600_000;
  assert.equal(worldClockLabel(worldClockTime(0, anchor, anchor + hour)), '04:00');
  assert.equal(worldClockPhase(worldClockTime(0, anchor, anchor + 1.5 * hour)), 'morning');
  assert.equal(worldClockPhase(worldClockTime(0, anchor, anchor + 3 * hour)), 'afternoon');
  assert.equal(worldClockPhase(worldClockTime(0, anchor, anchor + 4.5 * hour)), 'dusk');
  assert.equal(worldClockPhase(worldClockTime(0, anchor, anchor + 5 * hour)), 'night');
  for (const cycle of [1, 2, 3, 4]) {
    assert.equal(worldClockTime(0, anchor, anchor + 6 * cycle * hour), 0);
    assert.equal(worldClockLabel(worldClockTime(360, anchor, anchor + 6 * cycle * hour)), '06:00');
  }
});
test('hora compartilhada: leitura autenticada, edição só por administrador e concorrência protegida', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown, preview = false) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        ...(preview ? { 'X-Account-Preview': 'basic' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name,
      email: randomUUID() + '@clock.test',
      password: 'Clock-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const admin = await signup('Cronista'),
      player = await signup('Visitante');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    assert.equal((await req('/world-clock')).status, 401);
    const first = (await req('/world-clock', player.cookie)).data;
    assert.equal(first.canEdit, false);
    assert(first.timeMs >= 0 && first.timeMs < 86400000);
    assert.equal((await req('/world-clock', admin.cookie)).data.canEdit, true);
    assert.equal(
      (
        await req('/world-clock', player.cookie, 'POST', {
          time: '18:00',
          revision: first.revision,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await req(
          '/world-clock',
          admin.cookie,
          'POST',
          { time: '18:00', revision: first.revision },
          true,
        )
      ).status,
      403,
    );
    for (const time of ['24:00', '12:60', '9:00', '18:00:00'])
      assert.equal(
        (await req('/world-clock', admin.cookie, 'POST', { time, revision: first.revision }))
          .status,
        400,
      );
    const results = await Promise.all(
      ['06:15', '18:45'].map((time) =>
        req('/world-clock', admin.cookie, 'POST', { time, revision: first.revision }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const saved = results.find((r) => r.status === 200)!.data,
      next = (await req('/world-clock', player.cookie)).data;
    assert.equal(next.revision, first.revision + 1);
    assert.equal(worldClockLabel(next.timeMs), worldClockLabel(saved.timeMs));
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM world_clock_changes')).rows[0].n,
      1,
    );
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
    assert.equal(
      (await req('/world-clock', admin.cookie, 'POST', { time: '12:00', revision: next.revision }))
        .status,
      403,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
