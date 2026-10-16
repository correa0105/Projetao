import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { createLegacyTestCharacter } from './character-fixtures';
import { house2Houses, house2Furniture, house2Within } from '../shared/house-v2';

test('House 2.0: compras isoladas, concorrência e edição exclusiva dos terrenos comprados', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function req(path: string, a?: Account, method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: a?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await req('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
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
    const owner = await signup('Morador'),
      other = await signup('Vizinho'),
      admin = await signup('Administrador');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    const a = await createLegacyTestCharacter(owner.id, 'Aurora'),
      b = await createLegacyTestCharacter(other.id, 'Bruma'),
      c = await createLegacyTestCharacter(admin.id, 'Pedra');
    await pool.query('UPDATE characters SET gold_cp=76543 WHERE id=ANY($1::uuid[])', [
      [a.id, b.id, c.id],
    ]);
    const directory = (await req('/house-v2', owner)).data;
    const n = directory.neighborhoods[0].id;
    let scene = (await req('/house-v2/neighborhoods/' + n, owner)).data;
    const lot = scene.plots[0],
      second = scene.plots[1],
      racing = scene.plots[2];
    const buy = (character_id: string) => ({ character_id, idempotency_key: randomUUID() });
    await t.test('100 × 100, três vizinhanças e autenticação', async () => {
      assert.equal((await req('/house-v2')).status, 401);
      assert.equal(scene.plots.length, 36);
      assert.equal(directory.neighborhoods.length, 3);
      assert.equal(directory.balance, 20000);
      assert.equal(house2Houses.length, 25);
      assert.equal(house2Furniture.length, 100);
      assert(scene.plots.every((p: any) => p.x + p.width <= 100 && p.y + p.height <= 100));
      assert.equal(
        (
          await req('/house-v2/neighborhoods', owner, 'POST', {
            name: 'Proibida',
            description: '',
            terrain: 'earth',
          })
        ).status,
        403,
      );
    });
    await t.test(
      'compra exige personagem próprio, sem aceitar preço ou proprietário do cliente',
      async () => {
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/purchase`, other, 'POST', buy(a.id))).status,
          404,
        );
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/purchase`, owner, 'POST', {
              ...buy(a.id),
              price: 1,
            })
          ).status,
          400,
        );
        const body = buy(a.id),
          results = await Promise.all([
            req(`/house-v2/plots/${lot.id}/purchase`, owner, 'POST', body),
            req(`/house-v2/plots/${lot.id}/purchase`, owner, 'POST', body),
          ]);
        assert(results.every((r) => r.status === 200));
        assert.equal(results.filter((r) => r.data.replay).length, 1);
        assert.equal((await req('/house-v2', owner)).data.balance, 18800);
        assert.equal(
          (await req(`/house-v2/plots/${second.id}/purchase`, owner, 'POST', body)).status,
          409,
        );
        assert.equal(
          (await req(`/house-v2/plots/${second.id}/purchase`, other, 'POST', buy(b.id))).status,
          200,
        );
      },
    );
    await t.test('duas pessoas comprando o mesmo terreno têm um único vencedor', async () => {
      const r = await Promise.all([
        req(`/house-v2/plots/${racing.id}/purchase`, owner, 'POST', buy(a.id)),
        req(`/house-v2/plots/${racing.id}/purchase`, other, 'POST', buy(b.id)),
      ]);
      assert.deepEqual(r.map((v) => v.status).sort(), [200, 409]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM house2_orders WHERE result->>'plot_id'=$1",
            [racing.id],
          )
        ).rows[0].n,
        1,
      );
    });
    await t.test(
      'somente casas vazias, sem bypass de administrador ou edição de lote livre',
      async () => {
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/house`, admin, 'POST', {
              ...buy(c.id),
              catalog_id: house2Houses[0].id,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/house`, owner, 'POST', {
              ...buy(a.id),
              catalog_id: 'house-001',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/house`, owner, 'POST', {
              ...buy(a.id),
              catalog_id: house2Houses[0].id,
            })
          ).status,
          200,
        );
        const input = { revision: 0, house: null, items: [] };
        for (const account of [other, admin])
          assert.equal(
            (await req(`/house-v2/plots/${lot.id}/layout`, account, 'PUT', input)).status,
            403,
          );
        assert.equal(
          (await req(`/house-v2/plots/${scene.plots[10].id}/layout`, owner, 'PUT', input)).status,
          403,
        );
      },
    );
    let item = '';
    await t.test('mobília comprada uma vez e propriedade conferida antes de colocar', async () => {
      const input = { ...buy(a.id), plot_id: lot.id, catalog_id: house2Furniture[0].id };
      const results = await Promise.all([
        req('/house-v2/furniture', owner, 'POST', input),
        req('/house-v2/furniture', owner, 'POST', input),
      ]);
      assert(results.every((r) => r.status === 200));
      assert.equal(results[0].data.item_id, results[1].data.item_id);
      item = results[0].data.item_id;
      assert.equal(
        (
          await req('/house-v2/furniture', other, 'POST', {
            ...buy(b.id),
            plot_id: lot.id,
            catalog_id: house2Furniture[0].id,
          })
        ).status,
        403,
      );
      scene = (await req('/house-v2/neighborhoods/' + n, owner)).data;
      const p = scene.plots[0],
        body = {
          revision: p.revision,
          house: { x: p.house_x, y: p.house_y, rotation: 0 },
          items: [{ id: item, x: p.x + 6, y: p.y + 6, rotation: 0 }],
        };
      assert.equal((await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body)).status, 200);
      assert.equal((await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body)).status, 409);
      const otherLot = (await req('/house-v2/neighborhoods/' + n, other)).data.plots[1];
      assert.equal(
        (
          await req(`/house-v2/plots/${second.id}/layout`, other, 'PUT', {
            revision: otherLot.revision,
            house: null,
            items: [{ id: item, x: otherLot.x + 6, y: otherLot.y + 6, rotation: 0 }],
          })
        ).status,
        403,
      );
    });
    await t.test('nem uma parte do objeto ou da casa pode atravessar o limite', async () => {
      scene = (await req('/house-v2/neighborhoods/' + n, owner)).data;
      const p = scene.plots[0];
      const body = {
        revision: p.revision,
        house: { x: p.house_x, y: p.house_y, rotation: 0 },
        items: [{ id: item, x: p.x, y: p.y + 6, rotation: 90 }],
      };
      assert.equal((await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body)).status, 400);
      assert.equal(
        (
          await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
            ...body,
            items: [],
            house: { x: p.x + 2, y: p.y + 6, rotation: 0 },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
            ...body,
            items: [{ id: item, x: -1, y: 4, rotation: 0 }],
          })
        ).status,
        400,
      );
      assert.equal(house2Within(p, { x: p.x + 0.5, y: p.y + 2, rotation: 90 }, 3, 1), true);
      assert.equal(house2Within(p, { x: p.x + 0.49, y: p.y + 2, rotation: 90 }, 3, 1), false);
    });
    await t.test('visita expõe proprietário e decoração, sem saldo ou coleção alheia', async () => {
      const visit = (await req('/house-v2/neighborhoods/' + n, other)).data;
      assert.equal(visit.plots[0].owner_name, 'Aurora');
      assert.equal(visit.plots[0].can_edit, false);
      assert(!('gold_cp' in visit.plots[0]));
      assert(!('user_id' in visit.plots[0]));
      assert((await req('/house-v2', other)).data.inventory.every((i: any) => i.id !== item));
      assert.equal(visit.items.filter((i: any) => i.id === item).length, 1);
    });
    await t.test(
      'guardar mantém a compra, revisão concorrente protege e ouro real não muda',
      async () => {
        scene = (await req('/house-v2/neighborhoods/' + n, owner)).data;
        const p = scene.plots[0];
        const body = {
          revision: p.revision,
          house: { x: p.house_x, y: p.house_y, rotation: 0 },
          items: [],
        };
        const r = await Promise.all([
          req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body),
          req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body),
        ]);
        assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
        assert.equal(
          (await req('/house-v2', owner)).data.inventory.find((i: any) => i.id === item).plot_id,
          null,
        );
        assert(
          (await pool.query('SELECT gold_cp FROM characters')).rows.every(
            (c) => c.gold_cp === 76543,
          ),
        );
        assert.equal((await pool.query('SELECT count(*)::int n FROM house_homes')).rows[0].n, 0);
        await pool.query('UPDATE house2_accounts SET balance=0 WHERE user_id=$1', [owner.id]);
        const before = (await req('/house-v2', owner)).data.inventory.length;
        assert.equal(
          (
            await req('/house-v2/furniture', owner, 'POST', {
              ...buy(a.id),
              plot_id: lot.id,
              catalog_id: house2Furniture[0].id,
            })
          ).status,
          409,
        );
        assert.equal((await req('/house-v2', owner)).data.inventory.length, before);
      },
    );
    await t.test('criação de vizinhança exige permissão atual do banco', async () => {
      const r = await req('/house-v2/neighborhoods', admin, 'POST', {
        name: 'Bairro de teste',
        description: '',
        terrain: 'grass',
      });
      assert.equal(r.status, 201);
      assert.equal(
        (await req('/house-v2/neighborhoods/' + r.data.id, owner)).data.plots.length,
        36,
      );
      await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
      assert.equal(
        (
          await req('/house-v2/neighborhoods', admin, 'POST', {
            name: 'Bairro proibido',
            description: '',
            terrain: 'stone',
          })
        ).status,
        403,
      );
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
