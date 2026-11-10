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
      'UPDATE house2_plots SET character_id=$2,house_id=$3,house_x=x+2,house_y=y+2 WHERE id=$1',
      [plot, character.id, house2Houses[0].id],
    );
    assert.equal((await send(other)).status, 404);
    assert.equal(
      (await send(other, { action: 'plant', crop: 'erva-balsamo' }, undefined, visitor.id)).status,
      404,
    );
    const plant = { action: 'plant', crop: 'erva-balsamo' } as const;
    const key = randomUUID();
    const planted = await Promise.all([act(plant, key), act(plant, key)]);
    assert(
      planted.every((result) => result.garden.gold_cp === 4500 && result.garden.ready_at === null),
    );
    assert.equal((await send(owner, { action: 'water' }, key)).status, 409);
    const growing = (await act({ action: 'water' })).garden;
    assert.equal(Date.parse(growing.ready_at) - Date.parse(growing.server_time), 8 * 3600_000);
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
    assert.equal(Date.parse(growing.ready_at) - Date.parse(fertilized.ready_at), 2 * 3600_000);
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
    await pool.query('UPDATE house2_plots SET character_id=$2 WHERE id=$1', [plot, visitor.id]);
    assert.equal((await send(owner)).status, 404);
    assert.equal((await send(other)).data.crop, null);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
