import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { compatibleSlots, twoHanded } from '../shared/equipment.js';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const addr = server.address();
assert(addr && typeof addr !== 'string');
const base = `http://127.0.0.1:${addr.port}`,
  origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
let cookie = '';
async function request(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(base + '/api' + path, {
    method,
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json(), headers: r.headers };
}
try {
  const signup = await request('/auth/sign-up/email', 'POST', {
    name: 'Catálogo mágico',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  assert.equal(signup.status, 200);
  cookie = signup.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
  const user = signup.data.user,
    hero = await createLegacyTestCharacter(user.id, 'Conferência do Empório');
  await pool.query('UPDATE characters SET gold_cp=10000000 WHERE id=$1', [hero.id]);
  const completion = JSON.parse(
    await readFile('data/shop-magic-completion-20261009/catalog.json', 'utf8'),
  );
  assert(completion.ready && completion.items.length > 0);
  const art = JSON.parse(
    await readFile('data/shop-magic-completion-20261009/art-manifest.json', 'utf8'),
  ).assets;
  const all = (await request('/catalog')).data;
  const ids = completion.items.map((x: any) => x.id),
    hashes = new Set(),
    voices = new Set();
  for (const expected of completion.items) {
    const actual = all.find((x: any) => x.id === expected.id);
    assert(actual, expected.id);
    assert.equal(actual.image_path, expected.image_path);
    assert.equal(actual.price_cp, expected.price_cp);
    assert.deepEqual(compatibleSlots(actual), expected.raw_data.equipment_slots);
    assert.equal(twoHanded(actual), expected.raw_data.two_handed);
    const rules = await request(`/catalog/${expected.id}/rules`);
    assert.equal(rules.status, 200);
    assert.equal(rules.data.description, expected.raw_data.rules_summary);
    assert(rules.data.source_name.includes(expected.raw_data.source_book));
    assert(!rules.data.source_name.includes('CC BY'));
    assert.equal(rules.data.project_content, false);
    const image = await fetch(base + expected.image_path);
    assert.equal(image.status, 200);
    const b = Buffer.from(await image.arrayBuffer());
    const h = createHash('sha256').update(b).digest('hex');
    assert.equal(h, art.find((x: any) => x.id === expected.id).sha256);
    assert(!hashes.has(h));
    hashes.add(h);
    assert((await sharp(b).metadata()).hasAlpha);
    const audio = await fetch(base + expected.audio_path);
    assert.equal(audio.status, 200);
    assert.equal(Buffer.from(await audio.arrayBuffer()).toString('ascii', 0, 4), 'RIFF');
    assert(!voices.has(expected.merchant_comment));
    voices.add(expected.merchant_comment);
  }
  const before = (
    await pool.query('SELECT * FROM catalog_items WHERE NOT(id=ANY($1::text[])) ORDER BY id', [ids])
  ).rows;
  const override = ids[0];
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  assert.equal(
    (await request(`/catalog/${override}/price`, 'PATCH', { price_cp: 4321 })).status,
    200,
  );
  await seed();
  assert.deepEqual(
    (
      await pool.query('SELECT * FROM catalog_items WHERE NOT(id=ANY($1::text[])) ORDER BY id', [
        ids,
      ])
    ).rows,
    before,
  );
  assert.equal(
    (await pool.query('SELECT price_cp FROM catalog_items WHERE id=$1', [override])).rows[0]
      .price_cp,
    4321,
  );
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user.id]);
  assert.equal((await request(`/catalog/${override}/price`, 'PATCH', { price_cp: 1 })).status, 403);
  const buy = {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    items: ids.map((item_id: string) => ({ item_id, quantity: 1 })),
  };
  assert.equal((await request('/shop/checkout', 'POST', buy)).status, 201);
  assert.equal((await request('/shop/checkout', 'POST', buy)).status, 200);
  const ledger = (
    await pool.query(
      'SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
      [hero.id],
    )
  ).rows;
  assert.equal(ledger.length, ids.length);
  const total = completion.items.reduce(
    (sum: number, x: any) => sum + (x.id === override ? 4321 : x.price_cp),
    0,
  );
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
    10000000 - total,
  );
  for (const [id, slot] of [
    ['cloak-of-billowing', 'cloak'],
    ['clockwork-amulet', 'neck'],
    ['hat-of-wizardry', 'head'],
    ['arcane-grimoire-plus-1', 'main_hand'],
    ['dragonhide-belt-plus-1', 'belt'],
  ])
    assert.equal(
      (await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: id, slot }))
        .status,
      200,
      id,
    );
  assert.equal(
    (
      await request('/inventory/equipment', 'POST', {
        character_id: hero.id,
        item_id: 'hat-of-wizardry',
        slot: 'armor',
      })
    ).status,
    400,
  );
  console.log(
    `PASS ${ids.length} reviewed magic items: original art/audio/source descriptions, exact equipment, all old catalog rows unchanged, persistent admin price, purchase replay/ledger/gold and equipment.`,
  );
} finally {
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
