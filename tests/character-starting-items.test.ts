import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import {
  defaultChoices,
  startingEquipment,
  classRules,
  backgroundRules,
  equipmentFields,
  tools,
} from '../shared/character-sheet';
import itemMap from '../shared/starting-equipment-items.json';
import { createLegacyTestCharacter } from './character-fixtures';

test('todo conjunto inicial, antecedente e ferramenta resolve catálogo com quantidades físicas corretas', async () => {
  await migrate();
  await seed();
  for (const cls of Object.keys(classRules))
    for (const bg of Object.keys(backgroundRules))
      for (const pack of equipmentFields(cls)[0].options) {
        const c = defaultChoices('Orc', cls, bg);
        c.equipment.package = [pack];
        for (const name of startingEquipment(cls, c)) assert(name in itemMap, name);
      }
  for (const name of tools) assert(name in itemMap, name);
  const ids = [...new Set(Object.values(itemMap).map((x) => x.id))];
  assert.equal(
    (await pool.query('SELECT id FROM catalog_items WHERE id=ANY($1::text[])', [ids])).rowCount,
    ids.length,
  );
  assert.equal(itemMap['Duas adagas'].quantity, 2);
  assert.equal(itemMap['Três frascos de óleo'].quantity, 3);
  assert.equal(itemMap['20 flechas'].quantity, 1);
  assert.equal(itemMap['10 folhas de pergaminho'].quantity, 10);
});
test('entrega inicial: propriedade, conclusão, concorrência, compra preservada, equipar e nunca repor após descarte', async () => {
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address() as { port: number },
    base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
  async function req(path: string, cookie = '', body?: unknown, from = origin) {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: from, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', {
      name: 'Initial gear',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    users.push(r.data.user.id);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const a = await signup(),
      b = await signup(),
      character = await createLegacyTestCharacter(a.id, 'OBruxo de teste');
    await pool.query("UPDATE characters SET class='Bruxo',race='Orc' WHERE id=$1", [character.id]);
    const choices = defaultChoices('Orc', 'Bruxo', 'Eremita');
    await pool.query('INSERT INTO character_sheets(character_id,choices)VALUES($1,$2)', [
      character.id,
      JSON.stringify(choices),
    ]);
    const path = `/characters/${character.id}/starting-equipment`;
    assert.equal((await req(path, '', {})).status, 401);
    assert.equal((await req(path, b.cookie, {})).status, 404);
    assert.equal((await req(path, a.cookie, {}, 'https://evil.invalid')).status, 403);
    assert.equal((await req(path, a.cookie, {})).data.inventory.length, 0);
    await pool.query(
      "UPDATE character_sheets SET finalized_at=now(),rolls='[[4,4,4,4],[4,4,4,4],[4,4,4,4],[4,4,4,4],[4,4,4,4],[4,4,4,4]]',assignment='[0,1,2,3,4,5]' WHERE character_id=$1",
      [character.id],
    );
    await pool.query("INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'dagger',1)", [
      character.id,
    ]);
    const before = (
      await pool.query('SELECT gold_cp,stats,hp,armor_class FROM characters WHERE id=$1', [
        character.id,
      ])
    ).rows[0];
    const results = await Promise.all([
      req(path, a.cookie, {}),
      req(path, a.cookie, {}),
      req(path, a.cookie, {}),
    ]);
    assert(results.every((r) => r.status === 200));
    const bag = results[0].data.inventory;
    assert.equal(bag.find((i: any) => i.id === 'dagger').quantity, 3);
    assert.equal(bag.find((i: any) => i.id === 'oil').quantity, 3);
    assert.equal(bag.find((i: any) => i.id === 'book').quantity, 2);
    assert(bag.some((i: any) => i.id === 'leather-armor'));
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM character_starting_item_grants WHERE character_id=$1',
          [character.id],
        )
      ).rows[0].n,
      1,
    );
    assert.deepEqual(
      (
        await pool.query('SELECT gold_cp,stats,hp,armor_class FROM characters WHERE id=$1', [
          character.id,
        ])
      ).rows[0],
      before,
    );
    assert.equal(
      (
        await req('/inventory/equipment', a.cookie, {
          character_id: character.id,
          slot: 'main_hand',
          item_id: 'sickle',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req('/inventory/discards', a.cookie, {
          character_id: character.id,
          item_id: 'oil',
          source: 'backpack',
          quantity: 3,
          idempotency_key: randomUUID(),
        })
      ).status,
      201,
    );
    assert(!(await req(path, a.cookie, {})).data.inventory.some((i: any) => i.id === 'oil'));
    assert.equal((await req(`/characters/${character.id}/storage`, b.cookie)).status, 404);
  } finally {
    for (const id of users) await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
