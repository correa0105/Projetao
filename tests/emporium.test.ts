import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { compatibleSlots, twoHanded } from '../shared/equipment.js';
import { merchantComment } from '../src/shop-presentation.js';
import { houseCatalog } from '../shared/house.js';
test('Empório: catálogo SRD, assets e economia em banco descartável', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const expansion = JSON.parse(await readFile('data/emporium-expansion.json', 'utf8')).items;
  const legacy = JSON.parse(await readFile('data/shop-export/loja.json', 'utf8')).items;
  const equipment = JSON.parse(await readFile('data/equipment-catalog.json', 'utf8')).filter(
    (v: any) => v.active,
  );
  const definitions = JSON.parse(
    await readFile('data/emporium-source/magic-definitions.json', 'utf8'),
  );
  const index = JSON.parse(await readFile('data/emporium-source/srd-magic-index.json', 'utf8'));
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Viajante',
      email: 'emporium-' + randomUUID() + '@example.test',
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
      other = await signup(),
      hero = await createLegacyTestCharacter(owner.id, 'Aurora');
    const catalog = (await req('/catalog', owner.cookie)).data;
    await t.test('1319 itens, 258 famílias e quatro cosméticos de cada tipo', async () => {
      assert.equal(expansion.length, 1248);
      assert.equal(catalog.length, 1319);
      assert.equal(new Set(catalog.map((v: any) => v.id)).size, catalog.length);
      assert.equal(definitions.length, 258);
      assert.equal(index.length, 258);
      for (const d of definitions) {
        assert.equal(d.en, index[d.number - 1].name);
        assert.ok(
          catalog.some((v: any) => v.id === d.id || v.raw_data?.magic_number === d.number),
          d.en,
        );
      }
      for (const original of [...legacy, ...equipment]) {
        const live = catalog.find((v: any) => v.id === original.id);
        assert.ok(live);
        assert.equal(live.price_cp, original.price_cp, original.id + ' price preserved');
      }
      for (const slot of ['feet', 'hands', 'neck', 'cloak', 'head'] as const)
        assert.equal(
          catalog.filter(
            (v: any) => v.category === 'Cosméticos' && compatibleSlots(v).includes(slot),
          ).length,
          4,
          slot,
        );
      for (const item of expansion) {
        assert.ok(item.merchant_comment.length > 20, item.id + ' speech');
        assert.equal(merchantComment(item), item.merchant_comment);
        assert.ok(item.price_cp === null || Number.isSafeInteger(item.price_cp));
      }
      assert.equal((await req('/catalog')).status, 401);
    });
    await t.test('artes transparentes e 1331 sons próprios com hashes únicos', async () => {
      const arts = JSON.parse(await readFile('public/shop/expanded/art-manifest.json', 'utf8'));
      const referenced = new Set<string>(
        expansion
          .map((i: any) => i.image_path)
          .filter((p: string) => p.startsWith('/shop/expanded/')),
      );
      for (const path of referenced) {
        const a = arts.find((v: any) => '/' + v.path.replace(/^public\//, '') === path);
        assert.ok(a, path);
        const bytes = await readFile('public' + path);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
        const meta = await sharp(bytes).metadata();
        assert.ok(meta.hasAlpha);
        assert.ok(a.prompt.length > 30);
      }
      const audio = JSON.parse(await readFile('public/audio/emporium/manifest.json', 'utf8'));
      assert.equal(audio.length, 1319 + houseCatalog.length);
      assert.equal(new Set(audio.map((v: any) => v.sha256)).size, audio.length);
      for (const a of audio) {
        const bytes = await readFile(a.path);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
        assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
        assert.equal(bytes.readUInt16LE(22), 1);
        assert.equal(bytes.readUInt16LE(34), 16);
        assert.ok(bytes.length > 1000);
      }
    });
    await t.test(
      'compra idempotente, ownership, saldo concorrente e seed preservam histórico',
      async () => {
        await pool.query('UPDATE characters SET gold_cp=100 WHERE id=$1', [hero.id]);
        const input = {
          character_id: hero.id,
          item_id: 'club',
          quantity: 2,
          idempotency_key: randomUUID(),
        };
        assert.equal((await req('/purchases', other.cookie, 'POST', input)).status, 404);
        const results = await Promise.all([
          req('/purchases', owner.cookie, 'POST', input),
          req('/purchases', owner.cookie, 'POST', input),
        ]);
        assert.deepEqual(results.map((v) => v.status).sort(), [200, 201]);
        assert.equal(
          (
            await pool.query(
              'SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',
              [hero.id, 'club'],
            )
          ).rows[0].quantity,
          2,
        );
        assert.equal(
          (await req('/purchases', owner.cookie, 'POST', { ...input, quantity: 1 })).status,
          409,
        );
        await pool.query('UPDATE characters SET gold_cp=10 WHERE id=$1', [hero.id]);
        const concurrent = await Promise.all(
          Array.from({ length: 6 }, () =>
            req('/purchases', owner.cookie, 'POST', {
              ...input,
              quantity: 1,
              idempotency_key: randomUUID(),
            }),
          ),
        );
        assert.equal(concurrent.filter((v) => v.status === 201).length, 1);
        assert.equal(concurrent.filter((v) => v.status === 409).length, 5);
        const snapshots = async () => ({
          gold: (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows,
          inventory: (
            await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id', [
              hero.id,
            ])
          ).rows,
          purchases: (
            await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id', [hero.id])
          ).rows,
        });
        const before = await snapshots();
        await seed();
        await seed();
        assert.deepEqual(await snapshots(), before);
        assert.equal(before.gold[0].gold_cp, 0);
        const artifact = catalog.find((v: any) => v.price_cp === null);
        assert.ok(artifact);
        assert.equal(
          (
            await req('/purchases', owner.cookie, 'POST', {
              ...input,
              item_id: artifact.id,
              idempotency_key: randomUUID(),
            })
          ).status,
          409,
        );
      },
    );
    await t.test('equipamento distingue armas de duas mãos, cosméticos, bardas e veículos', () => {
      for (const id of ['greatclub', 'heavy-crossbow', 'musket', 'pike', 'glaive'])
        assert.equal(twoHanded(catalog.find((v: any) => v.id === id)), true, id);
      for (const id of ['club', 'pistol', 'rapier'])
        assert.equal(twoHanded(catalog.find((v: any) => v.id === id)), false, id);
      const nonWearables = expansion.filter(
        (v: any) => v.id.includes('barding') || v.category === 'Veículos',
      );
      assert.ok(nonWearables.length > 15);
      for (const v of nonWearables) assert.deepEqual(compatibleSlots(v), [], v.id);
    });
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await pool.end();
  }
});
