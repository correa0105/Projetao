import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { purchase } from '../server/services.js';
import { armorBundle, purchaseContents, shopWeight } from '../shared/armor-bundles.js';
import { basicArmorPo, balancedMagicPrice } from '../shared/economy.js';

test('Armaduras básicas: preços seletivos, peças parciais, compra e preservação do legado', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await pool.query(
    'CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir('db/migrations'))
    .filter((n) => n.endsWith('.sql') && n < '139_')
    .sort()) {
    await pool.query(await readFile('db/migrations/' + name, 'utf8'));
    await pool.query('INSERT INTO schema_migrations(name)VALUES($1)', [name]);
  }
  await seed();
  const legacy = randomUUID();
  await pool.query('INSERT INTO "user"(id,name,email)VALUES($1,$2,$3)', [
    legacy,
    'Armaduras antigas',
    'armor-legacy-' + legacy + '@example.test',
  ]);
  const old = await createLegacyTestCharacter(legacy, 'Veterano');
  await pool.query('UPDATE characters SET gold_cp=123456 WHERE id=$1', [old.id]);
  await pool.query(`INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,active)
  VALUES('breastplate--head','Proteção legada','Legacy','Peças de armadura','Peça antiga',NULL,2.46,'Legado','',
  '{"equipment_target":"human","armor_bundle_parent":"breastplate","piece_slot":"head","equipment_slots":["head"]}',false)`);
  await pool.query(
    "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'breastplate',1),($1,'breastplate--head',1)",
    [old.id],
  );
  await pool.query(
    "INSERT INTO character_equipment(character_id,slot,item_id)VALUES($1,'head','breastplate--head')",
    [old.id],
  );
  const order = (
    await pool.query(
      "INSERT INTO purchases(character_id,item_id,quantity,total_cp,idempotency_key)VALUES($1,'breastplate',1,40000,$2)RETURNING id",
      [old.id, randomUUID()],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO purchase_item_grants(purchase_id,item_id,quantity)VALUES($1,'breastplate',1),($1,'breastplate--head',1)",
    [order],
  );
  for (const [id, po] of [
    ['splint-armor', 1200],
    ['plate-armor', 1500],
    ['scale-mail', 350],
    ['chain-mail', 75],
    ['half-plate-armor-of-gleaming', 800],
  ] as const) {
    await pool.query(
      'INSERT INTO shop_price_overrides(item_id,price_cp)VALUES($1,$2)ON CONFLICT(item_id)DO UPDATE SET price_cp=excluded.price_cp',
      [id, po * 100],
    );
    await pool.query('UPDATE catalog_items SET price_cp=$2 WHERE id=$1', [id, po * 100]);
  }
  const before = (
    await pool.query(
      "SELECT * FROM shop_price_overrides WHERE item_id IN ('splint-armor','plate-armor')ORDER BY item_id",
    )
  ).rows;
  const originalInventory = (
    await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id', [old.id])
  ).rows;
  const originalEquipment = (
    await pool.query('SELECT * FROM character_equipment WHERE character_id=$1', [old.id])
  ).rows;
  const originalGrants = (
    await pool.query('SELECT * FROM purchase_item_grants WHERE purchase_id=$1 ORDER BY item_id', [
      order,
    ])
  ).rows;
  await migrate();
  await seed();
  await t.test(
    'mantém talas/placas e bens já comprados; histórico registra preços anteriores',
    async () => {
      assert.deepEqual(
        (
          await pool.query(
            "SELECT * FROM shop_price_overrides WHERE item_id IN ('splint-armor','plate-armor')ORDER BY item_id",
          )
        ).rows,
        before,
      );
      assert.equal(
        (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [old.id])).rows[0].gold_cp,
        123456,
      );
      assert.deepEqual(
        (
          await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id', [
            old.id,
          ])
        ).rows,
        originalInventory,
      );
      assert.deepEqual(
        (await pool.query('SELECT * FROM character_equipment WHERE character_id=$1', [old.id]))
          .rows,
        originalEquipment,
      );
      assert.deepEqual(
        (
          await pool.query(
            'SELECT * FROM purchase_item_grants WHERE purchase_id=$1 ORDER BY item_id',
            [order],
          )
        ).rows,
        originalGrants,
      );
      assert.equal(
        (await pool.query('SELECT total_cp FROM purchases WHERE id=$1', [order])).rows[0].total_cp,
        40000,
      );
      const h = (
        await pool.query(
          "SELECT before_price_cp,after_price_cp FROM economy_price_history WHERE version='basic-armor-20261102' AND item_id='chain-mail'",
        )
      ).rows[0];
      assert.deepEqual(h, { before_price_cp: 7500, after_price_cp: 65000 });
    },
  );
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const a = server.address();
  assert(a && typeof a !== 'string');
  const base = `http://127.0.0.1:${a.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const signup = await fetch(base + '/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Armadureiro',
      email: 'armor-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    }),
  });
  assert.equal(signup.status, 200);
  const uid = (await signup.json()).user.id,
    cookie = signup.headers
      .getSetCookie()
      .map((s) => s.split(';')[0])
      .join('; ');
  async function req(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  }
  try {
    const c = await createLegacyTestCharacter(uid, 'Novo comprador');
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [c.id]);
    await t.test(
      'preços refletem proteção; versões comuns encantadas não custam menos',
      async () => {
        for (const [id, po] of Object.entries(basicArmorPo))
          assert.equal(
            (await pool.query('SELECT price_cp FROM catalog_items WHERE id=$1', [id])).rows[0]
              .price_cp,
            po * 100,
            id,
          );
        assert.equal(
          (
            await pool.query(
              "SELECT price_cp FROM catalog_items WHERE id='half-plate-armor-of-gleaming'",
            )
          ).rows[0].price_cp,
          130000,
        );
        assert.equal(
          balancedMagicPrice({
            id: 'half-plate-armor-of-gleaming',
            price_cp: 80000,
            raw_data: {
              rarity: 'Common',
              base_item: 'half-plate-armor',
              equipment_target: 'human',
            },
          }),
          130000,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM economy_price_history WHERE version='basic-armor-20261102' AND item_id IN ('splint-armor','plate-armor')",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test(
      'peitoral e meia armadura, inclusive variantes, entregam somente uma peça com peso inteiro',
      async () => {
        for (const [id, weight] of [
          ['breastplate', 20],
          ['half-plate-armor', 40],
          ['breastplate-of-gleaming', 20],
          ['half-plate-armor-of-gleaming', 40],
        ] as const) {
          assert.deepEqual(purchaseContents(id), [id]);
          const item = (await pool.query('SELECT * FROM catalog_items WHERE id=$1', [id])).rows[0];
          assert.equal(Number(item.weight_lb), weight);
          assert.equal(shopWeight(item), weight);
          assert.deepEqual(item.raw_data.armor_bundle_pieces, [{ id, slot: 'armor' }]);
        }
        const body = {
          character_id: c.id,
          idempotency_key: randomUUID(),
          items: [
            { item_id: 'breastplate', quantity: 2 },
            { item_id: 'half-plate-armor', quantity: 1 },
          ],
        };
        const replies = await Promise.all([
          req('/shop/checkout', body),
          req('/shop/checkout', body),
        ]);
        assert.deepEqual(replies.map((r) => r.status).sort(), [200, 201]);
        assert.equal(replies[0].data.total_cp, 250000);
        assert.deepEqual(
          (
            await pool.query(
              'SELECT item_id,quantity FROM inventory WHERE character_id=$1 ORDER BY item_id',
              [c.id],
            )
          ).rows,
          [
            { item_id: 'breastplate', quantity: 2 },
            { item_id: 'half-plate-armor', quantity: 1 },
          ],
        );
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [c.id])).rows[0].gold_cp,
          750000,
        );
        const equip = await req('/inventory/equipment-set', {
          character_id: c.id,
          item_id: 'half-plate-armor',
        });
        assert.equal(equip.status, 200, JSON.stringify(equip.data));
        assert.deepEqual(
          (
            await pool.query('SELECT slot,item_id FROM character_equipment WHERE character_id=$1', [
              c.id,
            ])
          ).rows,
          [{ slot: 'armor', item_id: 'half-plate-armor' }],
        );
        const magic = await purchase(uid, c.id, 'breastplate-of-gleaming', 1, randomUUID());
        assert.equal(magic.replayed, false);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM inventory WHERE character_id=$1 AND item_id LIKE 'breastplate-of-gleaming--%'",
              [c.id],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(armorBundle('plate-armor')!.pieces.length, 6);
        assert.equal(armorBundle('splint-armor')!.pieces.length, 6);
        assert.equal(armorBundle('barding-breastplate')!.pieces.length, 1);
      },
    );
    await t.test(
      'falha por ouro insuficiente não entrega peças; reinícios não repetem preço ou concessão',
      async () => {
        const poor = await createLegacyTestCharacter(uid, 'Sem ouro');
        await pool.query('UPDATE characters SET gold_cp=0 WHERE id=$1', [poor.id]);
        const r = await req('/shop/checkout', {
          character_id: poor.id,
          idempotency_key: randomUUID(),
          items: [{ item_id: 'half-plate-armor', quantity: 1 }],
        });
        assert.equal(r.status, 409);
        assert.equal(
          (
            await pool.query('SELECT count(*)::int n FROM inventory WHERE character_id=$1', [
              poor.id,
            ])
          ).rows[0].n,
          0,
        );
        const inv = (await pool.query('SELECT * FROM inventory ORDER BY character_id,item_id'))
          .rows;
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [uid]);
        assert.equal(
          (await req('/catalog/chain-mail/price', { price_cp: 72500 }, 'PATCH')).status,
          200,
        );
        await migrate();
        await seed();
        assert.equal(
          (await pool.query("SELECT price_cp FROM catalog_items WHERE id='chain-mail'")).rows[0]
            .price_cp,
          72500,
        );
        assert.deepEqual(
          (await pool.query('SELECT * FROM inventory ORDER BY character_id,item_id')).rows,
          inv,
        );
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
