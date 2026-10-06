import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { houseCatalog } from '../shared/house.js';

test('Empório: preços administrativos, autorização e compras em banco descartável', async (t) => {
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
      name: 'Viajante dos preços',
      email: `shop-prices-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id as string,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }

  try {
    const admin = await signup(),
      player = await signup();
    const hero = await createLegacyTestCharacter(player.id, 'Aurora dos preços');
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    const edit = (id: string, price_cp: number | null, cookie = admin.cookie) =>
      req(`/catalog/${id}/price`, cookie, 'PATCH', { price_cp });
    const single = (key = randomUUID(), quantity = 1) => ({
      character_id: hero.id,
      item_id: 'club',
      quantity,
      idempotency_key: key,
    });
    const cart = (key = randomUUID()) => ({
      character_id: hero.id,
      idempotency_key: key,
      items: [{ item_id: 'club', quantity: 2 }],
    });
    const ordinaryPrice = async () =>
      (await pool.query('SELECT price_cp FROM catalog_items WHERE id=$1', ['club'])).rows[0]
        .price_cp;
    const gold = async () =>
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp;

    await t.test('somente administrador vigente altera preços', async () => {
      const before = await ordinaryPrice();
      assert.equal((await edit('club', 123, '')).status, 401);
      assert.equal((await edit('club', 123, player.cookie)).status, 403);
      assert.equal((await edit('house-sofa', 123, player.cookie)).status, 403);
      assert.equal(await ordinaryPrice(), before);
      assert.equal((await edit('club', 123)).status, 200);
      await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
      assert.equal((await edit('club', 456)).status, 403);
      assert.equal(await ordinaryPrice(), 123);
      await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    });

    await t.test('preço é inteiro positivo em cobre, null só para catálogo comum', async () => {
      for (const value of [0, -1, 1.5, 2147483648, '100', true]) {
        const response = await req('/catalog/club/price', admin.cookie, 'PATCH', {
          price_cp: value,
        });
        assert.equal(response.status, 400, JSON.stringify(value));
      }
      assert.equal((await req('/catalog/club/price', admin.cookie, 'PATCH', {})).status, 400);
      assert.equal(
        (
          await req('/catalog/club/price', admin.cookie, 'PATCH', {
            price_cp: 100,
            user_id: admin.id,
          })
        ).status,
        400,
      );
      assert.equal((await edit('does-not-exist', 100)).status, 404);
      assert.equal((await edit('house-does-not-exist', 100)).status, 404);
      assert.equal((await edit('house-sofa', null)).status, 400);
      const response = await edit('club', 1234);
      assert.deepEqual(response.data, { id: 'club', price_cp: 1234 });
    });

    await t.test(
      'compras novas usam o preço atual, replay e histórico conservam o anterior',
      async () => {
        const oldSingle = single(),
          oldCart = cart();
        const before = await gold();
        const first = await req('/purchases', player.cookie, 'POST', oldSingle);
        assert.equal(first.status, 201);
        assert.equal(first.data.purchase.total_cp, 1234);
        const checkout = await req('/shop/checkout', player.cookie, 'POST', oldCart);
        assert.equal(checkout.status, 201);
        assert.equal(checkout.data.total_cp, 2468);
        assert.equal((await edit('club', 876)).status, 200);
        const replay = await req('/purchases', player.cookie, 'POST', oldSingle);
        const cartReplay = await req('/shop/checkout', player.cookie, 'POST', oldCart);
        assert.equal(replay.status, 200);
        assert.equal(replay.data.purchase.total_cp, 1234);
        assert.equal(cartReplay.status, 200);
        assert.equal(cartReplay.data.total_cp, 2468);
        assert.equal(await gold(), before - 3702);
        const next = await req('/purchases', player.cookie, 'POST', single());
        const nextCart = await req('/shop/checkout', player.cookie, 'POST', cart());
        assert.equal(next.status, 201);
        assert.equal(next.data.purchase.total_cp, 876);
        assert.equal(nextCart.status, 201);
        assert.equal(nextCart.data.total_cp, 1752);
        assert.equal(await gold(), before - 3702 - 2628);
        assert.equal(
          (await pool.query('SELECT total_cp FROM purchases WHERE id=$1', [first.data.purchase.id]))
            .rows[0].total_cp,
          1234,
        );
        assert.equal(
          Number(
            (
              await pool.query('SELECT total_cp FROM shop_checkouts WHERE id=$1', [
                checkout.data.id,
              ])
            ).rows[0].total_cp,
          ),
          2468,
        );
      },
    );

    await t.test(
      'sem preço bloqueia novas compras e sobrevive ao seed sem alterar bens',
      async () => {
        const historyBefore = await pool.query(
          'SELECT * FROM purchases WHERE character_id=$1 ORDER BY id',
          [hero.id],
        );
        const inventoryBefore = await pool.query(
          'SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id',
          [hero.id],
        );
        const before = await gold();
        assert.equal((await edit('club', null)).status, 200);
        assert.equal((await req('/purchases', player.cookie, 'POST', single())).status, 409);
        assert.equal((await req('/shop/checkout', player.cookie, 'POST', cart())).status, 409);
        await seed();
        assert.equal(await ordinaryPrice(), null);
        const catalog = (await req('/catalog', player.cookie)).data;
        assert.equal(catalog.find((item: any) => item.id === 'club').price_cp, null);
        assert.equal(await gold(), before);
        assert.deepEqual(
          (await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id', [hero.id]))
            .rows,
          historyBefore.rows,
        );
        assert.deepEqual(
          (
            await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id', [
              hero.id,
            ])
          ).rows,
          inventoryBefore.rows,
        );
        assert.equal((await edit('club', 1200)).status, 200);
        await seed();
        assert.equal(await ordinaryPrice(), 1200);
        assert.equal(
          (await req('/purchases', player.cookie, 'POST', single())).data.purchase.total_cp,
          1200,
        );
      },
    );

    await t.test('House consulta e cobra o preço editado mantendo pedidos anteriores', async () => {
      const input = { character_id: hero.id, catalog_id: 'sofa', idempotency_key: randomUUID() };
      const defaultPrice = houseCatalog.find((item) => item.id === 'sofa')!.price_cp;
      const before = await gold();
      assert.equal((await req('/house/purchase', player.cookie, 'POST', input)).status, 201);
      assert.equal((await edit('house-sofa', 4321)).status, 200);
      const index = (await req('/house', player.cookie)).data;
      assert.equal(index.catalog.find((item: any) => item.id === 'sofa').price_cp, 4321);
      const replay = await req('/house/purchase', player.cookie, 'POST', input);
      assert.equal(replay.status, 200);
      assert.equal(replay.data.replayed, true);
      assert.equal(await gold(), before - defaultPrice);
      const next = { ...input, idempotency_key: randomUUID() };
      assert.equal((await req('/house/purchase', player.cookie, 'POST', next)).status, 201);
      assert.equal(await gold(), before - defaultPrice - 4321);
      const orders = (
        await pool.query(
          'SELECT idempotency_key,total_cp FROM house_orders WHERE character_id=$1',
          [hero.id],
        )
      ).rows;
      assert.equal(
        orders.find((order) => order.idempotency_key === input.idempotency_key).total_cp,
        defaultPrice,
      );
      assert.equal(
        orders.find((order) => order.idempotency_key === next.idempotency_key).total_cp,
        4321,
      );
      await seed();
      assert.equal(
        (await req('/house', player.cookie)).data.catalog.find((item: any) => item.id === 'sofa')
          .price_cp,
        4321,
      );
      assert.equal(
        (
          await pool.query('SELECT updated_by FROM shop_price_overrides WHERE item_id=$1', [
            'house-sofa',
          ])
        ).rows[0].updated_by,
        admin.id,
      );
    });

    await t.test(
      'edição e compra House concorrentes cobram integralmente uma versão do preço',
      async () => {
        const before = await gold();
        const input = { character_id: hero.id, catalog_id: 'sofa', idempotency_key: randomUUID() };
        const [edited, purchased] = await Promise.all([
          edit('house-sofa', 6543),
          req('/house/purchase', player.cookie, 'POST', input),
        ]);
        assert.equal(edited.status, 200);
        assert.equal(purchased.status, 201);
        const order = (
          await pool.query(
            'SELECT total_cp FROM house_orders WHERE character_id=$1 AND idempotency_key=$2',
            [hero.id, input.idempotency_key],
          )
        ).rows[0];
        assert.ok([4321, 6543].includes(order.total_cp));
        assert.equal(await gold(), before - order.total_cp);
        assert.equal(
          (await req('/house', player.cookie)).data.catalog.find((item: any) => item.id === 'sofa')
            .price_cp,
          6543,
        );
      },
    );

    await t.test('valores acima do limite de um pedido falham sem gastar ouro', async () => {
      const before = await gold();
      assert.equal((await edit('club', 2147483647)).status, 200);
      assert.equal(
        (await req('/purchases', player.cookie, 'POST', single(randomUUID(), 2))).status,
        409,
      );
      assert.equal((await req('/shop/checkout', player.cookie, 'POST', cart())).status, 409);
      assert.equal(await gold(), before);
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
