import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { houseCatalog } from '../shared/house.js';
import { mounts } from '../shared/mounts.js';
import { pets } from '../shared/pets.js';
import { cards } from '../shared/cards.js';
import { stableGear } from '../shared/stable-gear.js';

test('ouro ilimitado: administrador atual, seis compras, histórico e saldo real em DB isolado', async (t) => {
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
  type Account = { id: string; cookie: string };
  type Order = { path: string; body: Record<string, unknown>; total: number };
  async function request(path: string, account?: Account, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: account?.cookie || '',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup(name: string): Promise<Account> {
    const response = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: `unlimited-gold-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  const gold = async (id: string) =>
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [id])).rows[0].gold_cp;
  const counts = async (id: string) => {
    const tables = [
      'purchases',
      'shop_checkouts',
      'house_orders',
      'house_items',
      'character_pets',
      'character_mounts',
      'character_cards',
    ];
    return Promise.all(
      tables.map(
        async (table) =>
          (
            await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE character_id=$1`, [
              id,
            ])
          ).rows[0].count,
      ),
    );
  };
  try {
    const owner = await signup('Administrador do ouro'),
      player = await signup('Viajante comum');
    const hero = await createLegacyTestCharacter(owner.id, 'Aurora'),
      traveler = await createLegacyTestCharacter(player.id, 'Bruma');
    await pool.query('UPDATE characters SET gold_cp=0 WHERE id=ANY($1::uuid[])', [
      [hero.id, traveler.id],
    ]);
    // A legacy guild role must not grant this permission.
    await pool.query("INSERT INTO guild_staff(user_id,role)VALUES($1,'admin')", [owner.id]);
    const { rows: prices } = await pool.query(
      'SELECT id,price_cp FROM catalog_items WHERE id=ANY($1::text[])',
      [['club', 'dagger']],
    );
    const price = new Map(prices.map((item) => [item.id, item.price_cp as number]));
    const gearIds = ['barding-plate', 'saddle-military', 'feed'];
    const gearPrice = stableGear
      .filter((gear) => gearIds.includes(gear.id))
      .reduce((sum, gear) => sum + gear.price_cp, 0);
    const makeOrders = (characterId: string, cardId = 'vigil'): Order[] => [
      {
        path: '/purchases',
        body: {
          character_id: characterId,
          item_id: 'club',
          quantity: 2,
          idempotency_key: randomUUID(),
        },
        total: price.get('club')! * 2,
      },
      {
        path: '/shop/checkout',
        body: {
          character_id: characterId,
          items: [
            { item_id: 'club', quantity: 1 },
            { item_id: 'dagger', quantity: 2 },
          ],
          idempotency_key: randomUUID(),
        },
        total: price.get('club')! + price.get('dagger')! * 2,
      },
      {
        path: '/house/purchase',
        body: { character_id: characterId, catalog_id: 'table', idempotency_key: randomUUID() },
        total: houseCatalog.find((item) => item.id === 'table')!.price_cp,
      },
      {
        path: '/pets/purchase',
        body: {
          character_id: characterId,
          pet_id: 'dog',
          name: 'Brasa',
          appearance: 'original',
          idempotency_key: randomUUID(),
        },
        total: pets.find((pet) => pet.id === 'dog')!.price_cp,
      },
      {
        path: '/stable/purchase',
        body: {
          character_id: characterId,
          mount_id: 'warhorse',
          name: 'Trovão',
          coat: 'alternate',
          equipment: gearIds,
          idempotency_key: randomUUID(),
        },
        total: mounts.find((mount) => mount.id === 'warhorse')!.price_cp + gearPrice,
      },
      {
        path: '/cards/purchase',
        body: { character_id: characterId, card_id: cardId, idempotency_key: randomUUID() },
        total: cards.find((card) => card.id === cardId)!.price_cp,
      },
    ];
    const adminOrders = makeOrders(hero.id);
    let homeId = '';

    await t.test(
      'zero ouro e cargo legado não autorizam gasto; ownership e sessão são obrigatórios',
      async () => {
        assert.equal((await request('/me', owner)).data.gold_unlimited, false);
        assert.equal((await request('/characters', owner)).data[0].gold_unlimited, false);
        for (const order of adminOrders) {
          assert.equal(
            (await request(order.path, owner, 'POST', order.body)).status,
            409,
            order.path,
          );
          assert.equal(
            (await request(order.path, player, 'POST', order.body)).status,
            404,
            order.path,
          );
        }
        assert.equal(
          (await request('/purchases', undefined, 'POST', adminOrders[0].body)).status,
          401,
        );
        assert.deepEqual(await counts(hero.id), [0, 0, 0, 0, 0, 0, 0]);
        assert.equal(await gold(hero.id), 0);
      },
    );

    await t.test(
      'admin atual compra em todos os seis caminhos sem debitar, com preços históricos reais',
      async () => {
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
        const responses = await Promise.all(
          adminOrders.map((order) => request(order.path, owner, 'POST', order.body)),
        );
        for (const [index, response] of responses.entries()) {
          assert.equal(response.status, 201, adminOrders[index].path);
          assert.equal(response.data.gold_unlimited, true);
          assert.equal(response.data.gold_cp, 0);
        }
        assert.equal(responses[0].data.purchase.total_cp, adminOrders[0].total);
        assert.equal(responses[1].data.total_cp, adminOrders[1].total);
        assert.equal(responses[3].data.pet.price_cp, adminOrders[3].total);
        assert.equal(
          responses[4].data.mount.price_cp,
          mounts.find((mount) => mount.id === 'warhorse')!.price_cp,
        );
        assert.equal(responses[4].data.mount.equipment_price_cp, gearPrice);
        assert.equal(responses[5].data.card.price_cp, adminOrders[5].total);
        assert.equal(
          (await pool.query('SELECT total_cp FROM house_orders WHERE character_id=$1', [hero.id]))
            .rows[0].total_cp,
          adminOrders[2].total,
        );
        assert.equal(await gold(hero.id), 0);
        assert.deepEqual(await counts(hero.id), [3, 1, 1, 1, 1, 1, 1]);
        assert.equal((await request('/me', owner)).data.gold_unlimited, true);
        assert.equal((await request('/characters', owner)).data[0].gold_unlimited, true);
        assert.equal((await request('/house', owner)).data.gold_unlimited, true);
        const home = await request('/house', owner, 'POST', { character_id: hero.id });
        assert.equal(home.status, 201);
        homeId = home.data.id;
        const state = await request(`/house/${homeId}`, owner);
        assert.equal(state.data.gold_unlimited, true);
        assert.equal(state.data.gold_cp, 0);
      },
    );

    await t.test('replay concorrente conserva compras, inventário e saldo', async () => {
      const before = await counts(hero.id);
      for (const order of adminOrders) {
        const replays = await Promise.all([
          request(order.path, owner, 'POST', order.body),
          request(order.path, owner, 'POST', order.body),
        ]);
        for (const replay of replays) {
          assert.equal(replay.status, 200, order.path);
          assert.equal(replay.data.replayed, true);
          assert.equal(replay.data.gold_unlimited, true);
          assert.equal(replay.data.gold_cp, 0);
        }
      }
      assert.deepEqual(await counts(hero.id), before);
      assert.equal(
        (
          await pool.query(
            "SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='club'",
            [hero.id],
          )
        ).rows[0].quantity,
        3,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='dagger'",
            [hero.id],
          )
        ).rows[0].quantity,
        2,
      );
    });

    await t.test(
      'saldo positivo não muda e limite histórico continua protegido para admin',
      async () => {
        await pool.query('UPDATE characters SET gold_cp=133 WHERE id=$1', [hero.id]);
        assert.equal(
          (await request('/catalog/club/price', owner, 'PATCH', { price_cp: 2147483647 })).status,
          200,
        );
        const purchase = {
          character_id: hero.id,
          item_id: 'club',
          quantity: 1,
          idempotency_key: randomUUID(),
        };
        const response = await request('/purchases', owner, 'POST', purchase);
        assert.equal(response.status, 201);
        assert.equal(response.data.purchase.total_cp, 2147483647);
        assert.equal(response.data.gold_cp, 133);
        assert.equal(await gold(hero.id), 133);
        const before = await counts(hero.id);
        assert.equal(
          (
            await request('/purchases', owner, 'POST', {
              ...purchase,
              quantity: 2,
              idempotency_key: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request('/shop/checkout', owner, 'POST', {
              character_id: hero.id,
              items: [{ item_id: 'club', quantity: 2 }],
              idempotency_key: randomUUID(),
            })
          ).status,
          409,
        );
        assert.deepEqual(await counts(hero.id), before);
        assert.equal(await gold(hero.id), 133);
        assert.equal(
          (await request('/catalog/club/price', owner, 'PATCH', { price_cp: 200 })).status,
          200,
        );
        price.set('club', 200);
      },
    );

    await t.test(
      'revogação vale na mesma sessão; pedidos antigos continuam reproduzíveis sem novo débito',
      async () => {
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [owner.id]);
        const before = await counts(hero.id);
        for (const order of makeOrders(hero.id, 'raven'))
          assert.equal(
            (await request(order.path, owner, 'POST', order.body)).status,
            409,
            order.path,
          );
        for (const order of adminOrders) {
          const replay = await request(order.path, owner, 'POST', order.body);
          assert.equal(replay.status, 200);
          assert.equal(replay.data.gold_unlimited, false);
          assert.equal(replay.data.gold_cp, 133);
          assert.equal(replay.data.replayed, true);
        }
        assert.deepEqual(await counts(hero.id), before);
        assert.equal(await gold(hero.id), 133);
        assert.equal((await request('/me', owner)).data.gold_unlimited, false);
        assert.equal((await request('/characters', owner)).data[0].gold_unlimited, false);
        assert.equal((await request(`/house/${homeId}`, owner)).data.gold_unlimited, false);
      },
    );

    await t.test('jogador comum continua pagando o preço integral nos seis caminhos', async () => {
      const balance = 1000000;
      await pool.query('UPDATE characters SET gold_cp=$2 WHERE id=$1', [traveler.id, balance]);
      const orders = makeOrders(traveler.id);
      let remaining = balance;
      for (const order of orders) {
        const response = await request(order.path, player, 'POST', order.body);
        remaining -= order.total;
        assert.equal(response.status, 201, order.path);
        assert.equal(response.data.gold_unlimited, false);
        assert.equal(response.data.gold_cp, remaining);
        assert.equal(await gold(traveler.id), remaining);
      }
      // Promotion changes the current capability, not the paid purchase or its replay.
      await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [player.id]);
      const replay = await request(orders[0].path, player, 'POST', orders[0].body);
      assert.equal(replay.status, 200);
      assert.equal(replay.data.purchase.total_cp, orders[0].total);
      assert.equal(replay.data.gold_unlimited, true);
      assert.equal(replay.data.gold_cp, remaining);
      assert.equal(await gold(traveler.id), remaining);
    });

    await t.test(
      'revogação concorrente é observada antes do gasto após o lock da conta',
      async () => {
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
        const blocker = await pool.connect();
        const before = await counts(hero.id);
        let pending: ReturnType<typeof request> | undefined;
        try {
          await blocker.query('BEGIN');
          await blocker.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [owner.id]);
          pending = request('/purchases', owner, 'POST', {
            character_id: hero.id,
            item_id: 'club',
            quantity: 1,
            idempotency_key: randomUUID(),
          });
          let waiting = false;
          for (let attempts = 0; attempts < 200; attempts++) {
            const result = await pool.query(
              "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query=$1 AND wait_event_type='Lock'",
              ['SELECT administrador FROM "user" WHERE id=$1 FOR SHARE'],
            );
            if (result.rowCount) {
              waiting = true;
              break;
            }
            await setTimeout(10);
          }
          assert.equal(waiting, true, 'A compra deve consultar e bloquear a permissão atual.');
          await blocker.query('UPDATE "user" SET administrador=0 WHERE id=$1', [owner.id]);
          await blocker.query('COMMIT');
          assert.equal((await pending).status, 409);
          assert.deepEqual(await counts(hero.id), before);
          assert.equal(await gold(hero.id), 133);
        } finally {
          await blocker.query('ROLLBACK');
          blocker.release();
          if (pending) await pending;
        }
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
