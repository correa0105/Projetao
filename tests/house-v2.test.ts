import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { createLegacyTestCharacter } from './character-fixtures';
import {
  house2Houses,
  house2Furniture,
  house2FurnitureForSale,
  house2Within,
} from '../shared/house-v2';

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
    await t.test('200 × 200, três vizinhanças e autenticação', async () => {
      assert.equal((await req('/house-v2')).status, 401);
      assert.equal(scene.plots.length, 12);
      assert.equal(directory.neighborhoods.length, 3);
      assert.equal(directory.balance, 20000);
      assert.equal(house2Houses.length, 25);
      assert.equal(house2Furniture.length, 452);
      assert.equal(house2FurnitureForSale.length, 450);
      assert.equal(
        house2FurnitureForSale.filter((f) => f.id.startsWith('house2-new-')).length,
        100,
      );
      assert(scene.plots.every((p: any) => p.x + p.width <= 200 && p.y + p.height <= 200));
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
        403,
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
    await t.test(
      'tamanho e coordenadas livres persistem com limites e propriedade no servidor',
      async () => {
        scene = (await req('/house-v2/neighborhoods/' + n, owner)).data;
        const p = scene.plots[0];
        const body = {
          revision: p.revision,
          house: { x: p.house_x, y: p.house_y, rotation: p.house_rotation },
          items: [{ id: item, x: p.x + 6.17, y: p.y + 5.23, rotation: 90, scale: 1.6 }],
        };
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/layout`, other, 'PUT', body)).status,
          403,
        );
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
              ...body,
              items: [{ ...body.items[0], x: p.x + 0.1 }],
            })
          ).status,
          400,
        );
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body)).status,
          200,
        );
        const saved = (await req('/house-v2', owner)).data.inventory.find(
          (i: any) => i.id === item,
        );
        assert.equal(saved.x, p.x + 6.17);
        assert.equal(saved.y, p.y + 5.23);
        assert.equal(saved.scale, 1.6);
        const legacy = {
          ...body,
          revision: p.revision + 1,
          items: body.items.map(({ scale, ...i }) => i),
        };
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', legacy)).status,
          200,
        );
        assert.equal(
          (await req('/house-v2', owner)).data.inventory.find((i: any) => i.id === item).scale,
          1.6,
        );
      },
    );
    await t.test(
      'giro livre decimal persiste, respeita propriedade e não permite atravessar o lote',
      async () => {
        const current = (await req('/house-v2/neighborhoods/' + n, owner)).data;
        const p = current.plots.find((p: any) => p.id === lot.id);
        const body = {
          revision: p.revision,
          house: { x: p.house_x, y: p.house_y, rotation: p.house_rotation },
          items: [{ id: item, x: p.x + 6, y: p.y + 6, rotation: 37.25, scale: 1.6 }],
        };
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/layout`, other, 'PUT', body)).status,
          403,
        );
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', body)).status,
          200,
        );
        const saved = (await req('/house-v2', owner)).data.inventory.find(
          (i: any) => i.id === item,
        );
        assert.equal(saved.rotation, 37.25);
        assert.equal(typeof saved.rotation, 'number');
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
              ...body,
              revision: p.revision + 1,
              items: [{ ...body.items[0], x: p.x + 0.8, rotation: 45 }],
            })
          ).status,
          400,
        );
        for (const rotation of [-1, 360, 720])
          assert.equal(
            (
              await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
                ...body,
                revision: p.revision + 1,
                items: [{ ...body.items[0], rotation }],
              })
            ).status,
            400,
          );
        assert.equal(
          (await req('/house-v2', owner)).data.inventory.find((i: any) => i.id === item).rotation,
          37.25,
        );
      },
    );
    await t.test(
      'pintura persiste, recorta no próprio terreno e mantém ownership e clientes antigos',
      async () => {
        scene = (await req('/house-v2/neighborhoods/' + n, owner)).data;
        const p = scene.plots.find((p: any) => p.id === lot.id);
        const ground = [
          {
            material: 'grass-sienna',
            width: 1,
            points: [
              { x: p.x + 0.2, y: p.y + 0.2 },
              { x: p.x + 2, y: p.y + 2 },
            ],
          },
        ];
        const body = {
          revision: p.revision,
          house: p.house_id ? { x: p.house_x, y: p.house_y, rotation: p.house_rotation } : null,
          items: scene.items
            .filter((i: any) => i.plot_id === lot.id)
            .map((i: any) => ({ id: i.id, x: i.x, y: i.y, rotation: i.rotation, scale: i.scale })),
          ground,
        };
        for (const account of [other, admin])
          assert.equal(
            (await req('/house-v2/plots/' + lot.id + '/layout', account, 'PUT', body)).status,
            403,
          );
        assert.equal(
          (
            await req('/house-v2/plots/' + lot.id + '/layout', owner, 'PUT', {
              ...body,
              ground: [{ ...ground[0], material: 'inventado' }],
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await req('/house-v2/plots/' + lot.id + '/layout', owner, 'PUT', {
              ...body,
              ground: [{ ...ground[0], points: [{ x: p.x + p.width + 1, y: p.y }] }],
            })
          ).status,
          400,
        );
        const saved = await req('/house-v2/plots/' + lot.id + '/layout', owner, 'PUT', body);
        assert.equal(saved.status, 200);
        assert.equal(
          (await req('/house-v2/plots/' + lot.id + '/layout', owner, 'PUT', body)).status,
          409,
        );
        let visit = (await req('/house-v2/neighborhoods/' + n, other)).data;
        assert.deepEqual(visit.plots.find((p: any) => p.id === lot.id).ground, ground);
        const { ground: _, ...legacy } = body;
        assert.equal(
          (
            await req('/house-v2/plots/' + lot.id + '/layout', owner, 'PUT', {
              ...legacy,
              revision: saved.data.revision,
            })
          ).status,
          200,
        );
        visit = (await req('/house-v2/neighborhoods/' + n, other)).data;
        assert.deepEqual(visit.plots.find((p: any) => p.id === lot.id).ground, ground);
      },
    );
    await t.test(
      'dois jogadores salvam terrenos diferentes ao mesmo tempo sem perder nenhuma alteração',
      async () => {
        const before = (await req('/house-v2/neighborhoods/' + n, owner)).data;
        const layout = (id: string, material: string) => {
          const p = before.plots.find((p: any) => p.id === id);
          return {
            revision: p.revision,
            house: p.house_id ? { x: p.house_x, y: p.house_y, rotation: p.house_rotation } : null,
            items: before.items
              .filter((i: any) => i.plot_id === id)
              .map((i: any) => ({
                id: i.id,
                x: i.x,
                y: i.y,
                rotation: i.rotation,
                scale: i.scale,
              })),
            ground: [{ material, width: 1, points: [{ x: p.x + 2, y: p.y + 2 }] }],
          };
        };
        const first = layout(lot.id, 'grass-reference-light'),
          neighbor = layout(second.id, 'earth');
        const saves = await Promise.all([
          req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', first),
          req(`/house-v2/plots/${second.id}/layout`, other, 'PUT', neighbor),
        ]);
        assert.deepEqual(
          saves.map((r) => r.status),
          [200, 200],
        );
        for (const account of [owner, other]) {
          const after = (await req('/house-v2/neighborhoods/' + n, account)).data;
          for (const [id, input] of [
            [lot.id, first],
            [second.id, neighbor],
          ] as const) {
            const p = after.plots.find((p: any) => p.id === id);
            assert.equal(p.revision, input.revision + 1);
            assert.deepEqual(p.ground, input.ground);
            assert.deepEqual(
              after.items.filter((i: any) => i.plot_id === id),
              before.items.filter((i: any) => i.plot_id === id),
            );
          }
          for (const p of after.plots.filter((p: any) => p.id !== lot.id && p.id !== second.id)) {
            const old = before.plots.find((old: any) => old.id === p.id);
            assert.equal(p.revision, old.revision);
            assert.deepEqual(p.ground, old.ground);
          }
        }
        const stale = await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
          ...first,
          ground: [{ ...first.ground[0], material: 'earth' }],
        });
        assert.equal(stale.status, 409);
        const preserved = (await req('/house-v2/neighborhoods/' + n, owner)).data;
        assert.deepEqual(preserved.plots.find((p: any) => p.id === lot.id).ground, first.ground);
        assert.deepEqual(
          preserved.plots.find((p: any) => p.id === second.id).ground,
          neighbor.ground,
        );
      },
    );
    await t.test(
      'revestimentos: preço no servidor, compra idempotente, posse, categoria e revisão',
      async () => {
        const before = (await req('/house-v2', owner)).data.balance,
          body = { ...buy(a.id), catalog_id: 'floor-marble' };
        const results = await Promise.all([
          req('/house-v2/finishes', owner, 'POST', body),
          req('/house-v2/finishes', owner, 'POST', body),
        ]);
        results.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
        const d = (await req('/house-v2', owner)).data;
        assert.equal(d.balance, before - 380);
        assert.deepEqual(d.finishes, ['floor-marble']);
        assert.equal(
          (
            await req('/house-v2/finishes', owner, 'POST', {
              ...buy(a.id),
              catalog_id: 'floor-marble',
              price: 0,
            })
          ).status,
          400,
        );
        const p = (await req('/house-v2/neighborhoods/' + n, owner)).data.plots.find(
            (p: any) => p.id === lot.id,
          ),
          apply = { kind: 'floor', catalog_id: 'floor-marble', revision: p.revision };
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/finish`, other, 'POST', apply)).status,
          403,
        );
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', { ...apply, kind: 'roof' }))
            .status,
          403,
        );
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', apply)).status,
          200,
        );
        assert.equal(
          (await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', apply)).status,
          409,
        );
        const after = (await req('/house-v2/neighborhoods/' + n, owner)).data.plots.find(
          (p: any) => p.id === lot.id,
        );
        assert.deepEqual(after.finishes, { floor: 'floor-marble' });
        assert.equal(after.house_id, p.house_id);
        assert.equal(after.house_x, p.house_x);
        assert.deepEqual(after.ground, p.ground);
      },
    );
    await t.test(
      'luzes pertencem aos objetos; alteração independente não sobrescreve layout',
      async () => {
        const bought = await req('/house-v2/furniture', owner, 'POST', {
          ...buy(a.id),
          plot_id: lot.id,
          catalog_id: 'h2-firepit',
        });
        assert.equal(bought.status, 200);
        const id = bought.data.item_id;
        assert.equal(
          (await req(`/house-v2/items/${id}/light`, other, 'POST', { on: true, revision: 0 }))
            .status,
          404,
        );
        assert.equal(
          (await req(`/house-v2/items/${item}/light`, owner, 'POST', { on: true, revision: 0 }))
            .status,
          400,
        );
        for (const r of await Promise.all([
          req(`/house-v2/items/${id}/light`, owner, 'POST', { on: true, revision: 0 }),
          req(`/house-v2/items/${id}/light`, owner, 'POST', { on: true, revision: 0 }),
        ]))
          assert.equal(r.status, 200);
        assert.equal(
          (await req(`/house-v2/items/${id}/light`, owner, 'POST', { on: false, revision: 0 }))
            .status,
          409,
        );
        assert.equal(
          (
            await req(`/house-v2/items/${id}/light`, owner, 'POST', {
              on: false,
              revision: 1,
              color: 'red',
            })
          ).status,
          400,
        );
        const saved = (await req('/house-v2', owner)).data.inventory.find((i: any) => i.id === id);
        assert.equal(saved.light_on, true);
        assert.equal(saved.light_revision, 1);
        assert.equal(
          (await req(`/house-v2/items/${id}/light`, owner, 'POST', { on: false, revision: 1 }))
            .status,
          200,
        );
      },
    );
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
          (await pool.query('SELECT gold_cp FROM characters WHERE id=ANY($1::uuid[])',[[a.id,b.id,c.id]])).rows.every(
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
        12,
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
    await t.test(
      'camas retiradas da venda mantêm coleção, layout e replay de compras antigas',
      async () => {
        const before = (await req('/house-v2', owner)).data,
          orders = (await pool.query('SELECT count(*)::int n FROM house2_orders')).rows[0].n;
        const retired = ['furniture-113', 'furniture-115'];
        for (const id of retired) {
          assert(!house2FurnitureForSale.some((f) => f.id === id));
          assert(house2Furniture.some((f) => f.id === id));
          assert.equal(
            (
              await req('/house-v2/furniture', owner, 'POST', {
                ...buy(a.id),
                plot_id: lot.id,
                catalog_id: id,
              })
            ).status,
            400,
          );
        }
        assert.deepEqual((await req('/house-v2', owner)).data.inventory, before.inventory);
        assert.equal((await req('/house-v2', owner)).data.balance, before.balance);
        assert.equal(
          (await pool.query('SELECT count(*)::int n FROM house2_orders')).rows[0].n,
          orders,
        );
        const legacy = [];
        for (const id of retired)
          legacy.push(
            (
              await pool.query(
                'INSERT INTO house2_items(user_id,catalog_id)VALUES($1,$2)RETURNING id,catalog_id',
                [owner.id, id],
              )
            ).rows[0],
          );
        const scene = (await req('/house-v2/neighborhoods/' + n, owner)).data,
          p = scene.plots.find((p: any) => p.id === lot.id);
        const items = [
          ...scene.items
            .filter((i: any) => i.plot_id === lot.id)
            .map((i: any) => ({ id: i.id, x: i.x, y: i.y, rotation: i.rotation, scale: i.scale })),
          ...legacy.map((i, index) => ({
            id: i.id,
            x: p.x + 3 + index * 4,
            y: p.y + 3,
            rotation: 0,
            scale: 1,
          })),
        ];
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/layout`, owner, 'PUT', {
              revision: p.revision,
              house: { x: p.house_x, y: p.house_y, rotation: p.house_rotation },
              ground: p.ground,
              items,
            })
          ).status,
          200,
        );
        const placed = (await req('/house-v2/neighborhoods/' + n, owner)).data.items;
        assert(legacy.every((i) => placed.some((p: any) => p.id === i.id && p.plot_id === lot.id)));
        const key = randomUUID(),
          fingerprint = createHash('sha256')
            .update(JSON.stringify(['furniture', [lot.id, a.id, retired[0]]]))
            .digest('hex');
        await pool.query(
          'INSERT INTO house2_orders(user_id,idempotency_key,fingerprint,amount,result)VALUES($1,$2,$3,$4,$5)',
          [
            owner.id,
            key,
            fingerprint,
            house2Furniture.find((f) => f.id === retired[0])!.price,
            JSON.stringify({ item_id: legacy[0].id }),
          ],
        );
        const replay = await req('/house-v2/furniture', owner, 'POST', {
          character_id: a.id,
          idempotency_key: key,
          plot_id: lot.id,
          catalog_id: retired[0],
        });
        assert.equal(replay.status, 200);
        assert.equal(replay.data.item_id, legacy[0].id);
        assert.equal(replay.data.replay, true);
        assert.equal((await req('/house-v2', owner)).data.balance, before.balance);
      },
    );
    await t.test(
      'guardar é imediato, restrito ao dono e mantém compra, escala e outros objetos',
      async () => {
        const scene = (await req('/house-v2/neighborhoods/' + n, owner)).data,
          p = scene.plots.find((p: any) => p.id === lot.id);
        const before = (await pool.query('SELECT * FROM house2_items ORDER BY id')).rows,
          target = before.find((i) => i.plot_id === lot.id)!;
        const input = { plot_id: lot.id, revision: p.revision },
          balance = (await req('/house-v2', owner)).data.balance;
        for (const account of [other, admin])
          assert.equal(
            (await req('/house-v2/items/' + target.id + '/store', account, 'POST', input)).status,
            403,
          );
        assert.equal(
          (
            await req('/house-v2/items/' + target.id + '/store', owner, 'POST', {
              ...input,
              revision: p.revision - 1,
            })
          ).status,
          409,
        );
        const stored = await req('/house-v2/items/' + target.id + '/store', owner, 'POST', input);
        assert.equal(stored.status, 200);
        assert.equal(stored.data.stored, true);
        assert.equal(stored.data.layout.revision, p.revision + 1);
        assert(!stored.data.layout.items.some((i: any) => i.id === target.id));
        const after = (await pool.query('SELECT * FROM house2_items ORDER BY id')).rows;
        assert.deepEqual(
          after.filter((i) => i.id !== target.id),
          before.filter((i) => i.id !== target.id),
        );
        assert.deepEqual(
          after.find((i) => i.id === target.id),
          { ...target, plot_id: null, x: null, y: null },
        );
        assert.equal((await req('/house-v2', owner)).data.balance, balance);
        const repeated = await req('/house-v2/items/' + target.id + '/store', owner, 'POST', {
          ...input,
          revision: stored.data.layout.revision,
        });
        assert.equal(repeated.status, 200);
        assert.equal(repeated.data.layout.revision, stored.data.layout.revision);
        assert.equal(
          (await req('/house-v2/items/' + target.id + '/store', owner, 'POST', input)).status,
          409,
        );
      },
    );
    await t.test('novos móveis usam compra idempotente e entram na coleção do dono', async () => {
      // The owner wallet is deliberately exhausted by an earlier insufficient-balance case.
      const buyer = other,
        hero = b;
      for (const catalog_id of ['house2-new-001', 'house2-new-050', 'house2-new-100']) {
        const body = { ...buy(hero.id), plot_id: second.id, catalog_id };
        const first = await req('/house-v2/furniture', buyer, 'POST', body);
        const repeated = await req('/house-v2/furniture', buyer, 'POST', body);
        assert.equal(first.status, 200, JSON.stringify(first.data));
        assert.equal(repeated.status, 200);
        assert.equal(repeated.data.item_id, first.data.item_id);
        assert.equal(repeated.data.replay, true);
        const row = (
          await pool.query('SELECT user_id,catalog_id FROM house2_items WHERE id=$1', [
            first.data.item_id,
          ])
        ).rows[0];
        assert.equal(row.user_id, buyer.id);
        assert.equal(row.catalog_id, catalog_id);
      }
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
