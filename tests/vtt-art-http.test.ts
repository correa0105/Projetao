import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';

test('VTT: carregar o acervo não quebra miniaturas nem esgota o orçamento de edição', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const ids = [
    'monster-aboleth',
    'monster-adult-black-dragon',
    'monster-adult-blue-dragon',
    'monster-adult-brass-dragon',
    'monster-adult-bronze-dragon',
    'monster-adult-copper-dragon',
    'monster-adult-gold-dragon',
  ];
  type Account = { id: string; cookie: string };
  async function request(path: string, account?: Account, method = 'GET', body?: unknown) {
    return fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: account?.cookie || '',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function signup(name: string): Promise<Account> {
    const response = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(response.status, 200);
    return {
      id: (await response.json()).user.id,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  try {
    const administrator = await signup('Mestre das artes');
    const player = await signup('Visitante sem premium');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [administrator.id]);
    for (const id of ids) {
      assert.equal((await request('/vtt/premium-art/' + id)).status, 401);
      assert.equal((await request('/vtt/premium-art/' + id, player)).status, 403);
    }
    const manifest = JSON.parse(await readFile('data/vtt/premium-art/manifest.json', 'utf8'));
    const catalogResponse = await request('/vtt/premium', administrator);
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.available, manifest.assets.length);
    assert.ok(catalog.available > 240, 'O acervo real ultrapassa o limite comum da API.');
    // HEAD executes the same authenticated route and permission/file checks as GET,
    // while avoiding 130+ MB of image bodies in this rate-budget regression.
    for (const monster of catalog.monsters) {
      const response = await request(monster.image.slice('/api'.length), administrator, 'HEAD');
      assert.equal(response.status, 200, monster.id + ': ' + response.status);
      assert.match(response.headers.get('Content-Type') || '', /^image\/webp/);
    }
    for (const id of ids) {
      const response = await request('/vtt/premium-art/' + id, administrator);
      assert.equal(response.status, 200, id);
      assert.match(response.headers.get('Cache-Control') || '', /private.*no-store/);
      const image = Buffer.from(await response.arrayBuffer());
      const asset = manifest.assets.find((entry: { id: string }) => entry.id === id);
      assert.equal(createHash('sha256').update(image).digest('hex'), asset.sha256);
      const metadata = await sharp(image).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.hasAlpha, true);
      await sharp(image).raw().toBuffer();
    }
    // Loading imagery must leave ordinary authenticated actions available.
    const preference = await request('/vtt/premium-tokens', administrator, 'PUT', {
      enabled: true,
    });
    assert.equal(preference.status, 200);
    assert.equal((await preference.json()).premiumTokens, true);
    assert.equal((await request('/vtt/premium-art/monster-adult-black-dragon')).status, 401);
    assert.equal(
      (await request('/vtt/premium-art/monster-adult-black-dragon', player)).status,
      403,
    );
    const invalid = await request('/vtt/premium-art/../../manifest.json', administrator);
    assert.notEqual(invalid.status, 200);
    // The ordinary API remains protected by its original IP budget.
    let limited = false;
    for (let count = 0; count < 241; count++) {
      const response = await request('/vtt/premium', administrator, 'HEAD');
      if (response.status === 429) {
        limited = true;
        break;
      }
      assert.equal(response.status, 200);
    }
    assert.equal(limited, true);
    assert.equal(
      (await request('/vtt/premium-art/monster-adult-blue-dragon', administrator, 'HEAD')).status,
      200,
    );
    // Artwork is still bounded, and one viewer cannot exhaust another viewer's
    // image allowance on the same connection.
    let artworkLimited = false;
    for (let count = 0; count < 1201; count++) {
      const response = await request(
        '/vtt/premium-art/' + ids[count % ids.length],
        administrator,
        'HEAD',
      );
      if (response.status === 429) {
        artworkLimited = true;
        assert.ok(response.headers.get('Retry-After'));
        break;
      }
      assert.equal(response.status, 200);
    }
    assert.equal(artworkLimited, true);
    assert.equal(
      (await request('/vtt/premium-preview-art/monster-aboleth', player, 'HEAD')).status,
      200,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
