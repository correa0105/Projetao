import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { house2Houses } from '../shared/house-v2';
import { gardenHealingItem, type GardenAction } from '../shared/house-garden';

test('horta usa horas reais, respeita o dono e paga a colheita uma vez', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function account(name: string) {
    const id = randomUUID(),
      token = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email)VALUES($1,$2,$3)', [
      id,
      name,
      id + '@example.test',
    ]);
    await pool.query(
      'INSERT INTO session(id,token,"userId","expiresAt")VALUES($1,$2,$3,now()+interval \'1 hour\')',
      [randomUUID(), token, id],
    );
    const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
      .update(token)
      .digest('base64');
    return {
      id,
      cookie: 'better-auth.session_token=' + encodeURIComponent(token + '.' + signature),
    };
  }
  try {
    const owner = await account('Horticultor'),
      other = await account('Vizinho');
    const character = await createLegacyTestCharacter(owner.id);
    const visitor = await createLegacyTestCharacter(other.id);
    await pool.query('UPDATE characters SET gold_cp=5000 WHERE id=$1', [character.id]);
    const plot = (
      await pool.query(
        'SELECT id FROM house2_plots WHERE character_id IS NULL AND retired_at IS NULL LIMIT 1',
      )
    ).rows[0].id;
    const url = 'http://127.0.0.1:' + address.port + '/api/house-v2/plots/' + plot + '/garden';
    async function send(
      who: { cookie: string },
      operation?: GardenAction,
      request: string = randomUUID(),
      actor = character.id,
    ) {
      const response = await fetch(url, {
        method: operation ? 'POST' : 'GET',
        headers: { Origin: origin, Cookie: who.cookie, 'Content-Type': 'application/json' },
        body: operation
          ? JSON.stringify({ character_id: actor, request_id: request, operation })
          : undefined,
      });
      return { status: response.status, data: await response.json() };
    }
    async function act(operation: GardenAction, request?: string) {
      const result = await send(owner, operation, request);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      return result.data;
    }
    assert.equal((await send(owner)).status, 404);
    await pool.query(
      'UPDATE house2_plots SET character_id=$2,house_id=$3,house_x=x+width/2.0,house_y=y+height/2.0 WHERE id=$1',
      [plot, character.id, house2Houses[0].id],
    );
    assert.equal((await send(other)).status, 404);
    assert.equal(
      (await send(other, { action: 'plant', crop: 'erva-balsamo' }, undefined, visitor.id)).status,
      404,
    );
    const arrange = () => fetch(url + '/items', {
      method: 'POST',
      headers: { Origin: origin, Cookie: owner.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id: character.id }),
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await arrange();
      assert.equal(response.status, 200);
      const { items } = await response.json();
      assert.equal(items.length, 1);
      assert.equal(items[0].garden_role, 'bed');
    }
    assert.equal((await pool.query('SELECT count(*)::int n FROM house2_items WHERE garden_plot_id=$1', [plot])).rows[0].n, 1);
    const retired = (await pool.query(
      `INSERT INTO house2_items(user_id,catalog_id,plot_id,x,y,garden_plot_id,garden_role)
       SELECT $1,'h2-garden-compost',id,x+5,y+5,id,'compost' FROM house2_plots WHERE id=$2 RETURNING id`,
      [owner.id, plot],
    )).rows[0].id;
    const apiRoot = 'http://127.0.0.1:' + address.port + '/api';
    const directory = await (await fetch(apiRoot + '/house-v2', { headers: { Cookie: owner.cookie } })).json();
    assert(!directory.inventory.some((piece: { id: string }) => piece.id === retired));
    const neighborhood = (await pool.query('SELECT neighborhood_id FROM house2_plots WHERE id=$1', [plot])).rows[0].neighborhood_id;
    const scene = await (await fetch(apiRoot + '/house-v2/neighborhoods/' + neighborhood, { headers: { Cookie: owner.cookie } })).json();
    assert(!scene.items.some((piece: { id: string }) => piece.id === retired));
    assert.equal((await pool.query('SELECT plot_id FROM house2_items WHERE id=$1', [retired])).rows[0].plot_id, plot);
    const bed = directory.inventory.find((piece: { garden_role?: string }) => piece.garden_role === 'bed');
    const layoutUrl = apiRoot + '/house-v2/plots/' + plot + '/layout';
    async function layout(scale: number, who = owner) {
      const p = (await pool.query('SELECT * FROM house2_plots WHERE id=$1', [plot])).rows[0];
      return fetch(layoutUrl, {
        method: 'PUT',
        headers: { Origin: origin, Cookie: who.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: p.revision,
          house: { x: p.house_x, y: p.house_y, rotation: p.house_rotation },
          items: [{ id: bed.id, x: p.x + p.width / 2, y: p.y + p.height / 2, rotation: 37.25, scale }],
        }),
      });
    }
    for (const scale of [1.5001, 1.6, 3, 3.01, 0.24]) assert.equal((await layout(scale)).status, 400);
    assert.equal((await layout(1.5, other)).status, 403);
    assert.equal((await layout(1.5)).status, 200);
    assert.equal((await pool.query('SELECT scale FROM house2_items WHERE id=$1', [bed.id])).rows[0].scale, 1.5);
    await pool.query('UPDATE house2_items SET scale=2 WHERE id=$1', [bed.id]);
    assert.equal((await layout(2.1)).status, 400);
    assert.equal((await layout(2)).status, 200);
    assert.equal((await pool.query('SELECT scale FROM house2_items WHERE id=$1', [bed.id])).rows[0].scale, 2);
    assert.equal((await layout(1.5)).status, 200);
    assert.equal((await layout(2)).status, 400);
    const plant = { action: 'plant', crop: 'erva-balsamo' } as const;
    const key = randomUUID();
    const planted = await Promise.all([act(plant, key), act(plant, key)]);
    assert(
      planted.every((result) => result.garden.gold_cp === 4500 && result.garden.ready_at === null),
    );
    assert.equal((await send(owner, { action: 'water' }, key)).status, 409);
    const growing = (await act({ action: 'water' })).garden;
    assert.equal(Date.parse(growing.ready_at) - Date.parse(growing.server_time), 24 * 3600_000);
    assert.equal((await send(owner, { action: 'harvest', destination: 'healing' })).status, 409);
    const fermenting = (await act({ action: 'ferment', compost: 'cascas' })).garden;
    assert.equal(fermenting.gold_cp, 4200);
    assert.equal(
      Date.parse(fermenting.compost_ready_at) - Date.parse(fermenting.server_time),
      2 * 3600_000,
    );
    assert.equal((await send(owner, { action: 'fertilize' })).status, 409);
    await pool.query(
      "UPDATE house2_gardens SET compost_ready_at=now()-interval '1 minute' WHERE plot_id=$1",
      [plot],
    );
    const fertilized = (await act({ action: 'fertilize' })).garden;
    assert.equal(fertilized.fertilized, true);
    assert.equal(fertilized.compost, null);
    assert.equal(Date.parse(growing.ready_at) - Date.parse(fertilized.ready_at), 1 * 3600_000);
    assert.equal((await send(owner)).data.ready_at, fertilized.ready_at);
    assert.equal((await send(owner, { action: 'fertilize' })).status, 409);
    await pool.query(
      "UPDATE house2_gardens SET ready_at=now()-interval '1 minute' WHERE plot_id=$1",
      [plot],
    );
    const healing = { action: 'harvest', destination: 'healing' } as const;
    const harvestKey = randomUUID();
    const harvested = await Promise.all([act(healing, harvestKey), act(healing, harvestKey)]);
    assert(
      harvested.every(
        (result) => result.item_id === gardenHealingItem && result.garden.crop === null,
      ),
    );
    assert.equal(
      (
        await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
          character.id,
          gardenHealingItem,
        ])
      ).rows[0].quantity,
      1,
    );
    await act({ action: 'plant', crop: 'raiz-dourada' });
    const root = (await act({ action: 'water' })).garden;
    assert.equal(Date.parse(root.ready_at) - Date.parse(root.server_time), 12 * 3600_000);
    await pool.query(
      "UPDATE house2_gardens SET ready_at=now()-interval '1 minute' WHERE plot_id=$1",
      [plot],
    );
    assert.equal((await send(owner, healing)).status, 409);
    const sell = { action: 'harvest', destination: 'sell' } as const;
    const sellKey = randomUUID();
    const sales = await Promise.all([act(sell, sellKey), act(sell, sellKey)]);
    assert(
      sales.every((result) => result.gold_delta_cp === 2000 && result.garden.gold_cp === 5400),
    );
    assert.equal((await send(owner, sell)).status, 409);
    await act({ action: 'plant', crop: 'raiz-dourada' });
    const secondRoot = (await act({ action: 'water' })).garden;
    await act({ action: 'ferment', compost: 'composto' });
    assert.equal((await send(owner, { action: 'fertilize' })).status, 409);
    await pool.query("UPDATE house2_gardens SET compost_ready_at=now()-interval '1 minute' WHERE plot_id=$1", [plot]);
    const leaves = (await act({ action: 'fertilize' })).garden;
    assert.equal(Date.parse(secondRoot.ready_at) - Date.parse(leaves.ready_at), 2 * 3600_000);
    await pool.query('UPDATE house2_plots SET character_id=$2 WHERE id=$1', [plot, visitor.id]);
    assert.equal((await send(owner)).status, 404);
    assert.equal((await send(other)).data.crop, null);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
