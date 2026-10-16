import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';

test('Prévia global: capacidades básicas por requisição, rascunhos privados e conta preservada', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function request(
    path: string,
    cookie = '',
    preview = false,
    method = 'GET',
    body?: unknown,
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        ...(preview ? { 'X-Account-Preview': 'basic' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  async function signup() {
    return request('/auth/sign-up/email', '', false, 'POST', {
      name: 'Leitor',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
  }
  try {
    const admin = await signup(),
      basic = await signup();
    assert.equal(admin.status, 200);
    assert.equal(basic.status, 200);
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.data.user.id]);
    const character = await createLegacyTestCharacter(admin.data.user.id, 'Aurora');
    const index = (await request('/lore', admin.cookie)).data;
    const draft = await request('/lore/pages', admin.cookie, false, 'POST', {
      region_id: 'reino-do-norte',
      folder_id: index.folders.find((f: any) => f.region_id === 'reino-do-norte').id,
      title: 'Rascunho secreto do arquivo',
      subtitle: 'Reservado',
      published: false,
      blocks: [],
    });
    assert.equal(draft.status, 201);
    const before = (await pool.query('SELECT id,administrador FROM "user" ORDER BY id')).rows;
    for (let i = 0; i < 4; i++) {
      const [normal, preview, ordinary, forged] = await Promise.all([
        request('/me', admin.cookie),
        request('/me', admin.cookie, true),
        request('/me', basic.cookie),
        request('/me', basic.cookie, true),
      ]);
      assert.equal(normal.data.administrador, 1);
      assert.equal(normal.data.gold_unlimited, true);
      assert.equal(preview.data.administrador, 0);
      assert.equal(preview.data.role, 'player');
      assert.equal(preview.data.gold_unlimited, false);
      assert.equal(preview.data.canEditKingdom, false);
      assert.equal(preview.data.id, normal.data.id);
      assert.equal(ordinary.data.administrador, 0);
      assert.equal(forged.data.administrador, 0);
    }
    for (const path of [
      '/lore',
      '/lore-timeline',
      '/rulebook',
      '/events',
      '/achievements/catalog',
      '/pets/catalog',
      '/vtt',
    ]) {
      const [preview, normal, b] = await Promise.all([
        request(path, admin.cookie, true),
        request(path, admin.cookie),
        request(path, basic.cookie),
      ]);
      assert.equal(preview.status, 200, path);
      assert.equal(normal.status, 200, path);
      assert.equal(b.status, 200, path);
      if ('can_edit' in preview.data) {
        assert.equal(preview.data.can_edit, false, path);
        assert.equal(normal.data.can_edit, true, path);
      }
      if ('can_create' in preview.data) assert.equal(preview.data.can_create, false, path);
      if (path === '/lore') {
        assert.equal(preview.data.can_manage_folders, false);
        assert.equal(normal.data.can_manage_folders, true);
        assert.deepEqual(preview.data.pages, b.data.pages);
        assert(normal.data.pages.some((p: any) => p.id === draft.data.id));
      }
    }
    assert.equal((await request('/lore/pages/' + draft.data.id, admin.cookie, true)).status, 404);
    const characters = (await request('/characters', admin.cookie, true)).data;
    assert.equal(characters[0].id, character.id);
    assert.equal(characters[0].gold_unlimited, false);
    const count = (await pool.query('SELECT count(*)::int n FROM house2_neighborhoods')).rows[0].n;
    assert.equal(
      (
        await request('/house-v2/neighborhoods', admin.cookie, true, 'POST', {
          name: 'Não criar na prévia',
          description: '',
          terrain: 'grass',
        })
      ).status,
      403,
    );
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM house2_neighborhoods')).rows[0].n,
      count,
    );
    assert.deepEqual(
      (await pool.query('SELECT id,administrador FROM "user" ORDER BY id')).rows,
      before,
    );
    assert.equal((await request('/me', admin.cookie)).data.administrador, 1);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
