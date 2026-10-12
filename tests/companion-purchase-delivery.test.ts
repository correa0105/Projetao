import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { purchaseContents } from '../shared/armor-bundles.js';

test('compras: mochilas individuais, destino, replay, propriedade e reserva sem animal', async t => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate(); await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`, origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function req(path: string, account?: Account, body?: unknown, method?: string) {
    const r = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: { Origin: origin, Cookie: account?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', undefined, { name: 'Entrega aos animais', email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() }); assert.equal(r.status, 200);
    return { id: r.data.user.id, cookie: r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') };
  }
  try {
    const owner = await signup(), other = await signup(), hero = await createLegacyTestCharacter(owner.id, 'Guardião'), outsider = await createLegacyTestCharacter(other.id, 'Visitante');
    await pool.query('UPDATE characters SET gold_cp=9000000 WHERE id=ANY($1::uuid[])', [[hero.id, outsider.id]]);
    const cart = (items: unknown[], key = randomUUID(), account = owner, character_id = hero.id) => req('/shop/checkout', account, { character_id, idempotency_key: key, items });
    const bag = async (id: string) => (await pool.query('SELECT item_id,quantity FROM companion_inventory WHERE wardrobe_id=$1 ORDER BY item_id', [id])).rows;
    const stock = async (item: string) => (await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [hero.id, item])).rows[0]?.quantity || 0;
    await t.test('sem animal, conserva o acessório na mochila do personagem', async () => {
      const r = await cart([{ item_id: 'pet-armor-leather', quantity: 1 }, { item_id: 'saddle-riding', quantity: 1 }]); assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal((await pool.query('SELECT count(*)::int n FROM companion_inventory WHERE character_id=$1', [hero.id])).rows[0].n, 0);
      assert.equal(await stock('saddle-riding'), 1); for (const id of purchaseContents('pet-armor-leather')) assert.equal(await stock(id), 1);
    });
    const pet = async (account: Account, character_id: string, name: string) => {
      const r = await req('/pets/purchase', account, { character_id, pet_id: 'dog', name, idempotency_key: randomUUID() }); assert.equal(r.status, 201); return r.data.pet;
    };
    const mount = async (name: string) => {
      const r = await req('/stable/purchase', owner, { character_id: hero.id, mount_id: 'warhorse', name, equipment: [], idempotency_key: randomUUID() }); assert.equal(r.status, 201); return r.data.mount;
    };
    const dog = await pet(owner, hero.id, 'Pingo'), secondDog = await pet(owner, hero.id, 'Lua'), foreignPet = await pet(other, outsider.id, 'Brisa'), horse = await mount('Brasa'), secondHorse = await mount('Farol');
    await req(`/pets/${hero.id}/display`, owner, { pet_id: secondDog.id }, 'PUT');
    await req(`/stable/${hero.id}/display`, owner, { mount_id: secondHorse.id }, 'PUT');
    const key = randomUUID(), lines = [{ item_id: 'pet-armor-chain', quantity: 2 }, { item_id: 'barding-chain-mail', quantity: 1 }, { item_id: 'leather-armor', quantity: 1 }];
    await t.test('destino automático segue o animal exibido; entrega conjunto completo e mantém a mochila humana', async () => {
      const r = await cart(lines, key); assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.deepEqual(await bag(secondDog.id), purchaseContents('pet-armor-chain').sort().map(item_id => ({ item_id, quantity: 2 })));
      assert.deepEqual(await bag(secondHorse.id), [{ item_id: 'barding-chain-mail', quantity: 1 }]); assert.deepEqual(await bag(dog.id), []); assert.deepEqual(await bag(horse.id), []);
      assert.equal(await stock('leather-armor'), 1);
      const storage = (await req(`/characters/${hero.id}/storage`, owner)).data;
      assert.equal(storage.companion_allocated['pet-armor-chain'], 2); assert.equal(storage.companion_allocated['leather-armor'], undefined);
      assert.equal((await pool.query('SELECT count(*)::int n FROM companion_equipment WHERE character_id=$1 AND item_id IS NOT NULL', [hero.id])).rows[0].n, 0);
    });
    await t.test('replay após mudar o animal exibido não duplica nem redireciona a compra', async () => {
      const money = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp;
      assert.equal((await req(`/pets/${hero.id}/display`, owner, { pet_id: dog.id }, 'PUT')).status, 200);
      assert.equal((await cart(lines, key)).status, 200); assert.equal((await bag(secondDog.id))[0].quantity, 2); assert.deepEqual(await bag(dog.id), []);
      assert.equal((await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp, money);
    });
    await t.test('escolha explícita no carrinho é persistida e participa da idempotência', async () => {
      const chosen = [{ item_id: 'pet-armor-padded', quantity: 1, companion_id: secondDog.id }, { item_id: 'saddle-riding', quantity: 2, companion_id: horse.id }], k = randomUUID();
      const r = await cart(chosen, k); assert.equal(r.status, 201, JSON.stringify(r.data)); assert.equal((await bag(horse.id))[0].quantity, 2);
      assert.equal((await cart(chosen, k)).status, 200);
      assert.equal((await cart([{ ...chosen[0], companion_id: dog.id }, chosen[1]], k)).status, 409);
      const saved = (await pool.query('SELECT lines FROM shop_checkouts WHERE character_id=$1 AND idempotency_key=$2', [hero.id, k])).rows[0].lines; assert.equal(saved.find((l: any) => l.item_id === 'pet-armor-padded').companion_id, secondDog.id);
    });
    await t.test('animal alheio, espécie de destino errada e item humano no animal rejeitam tudo atomicamente', async () => {
      const money = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp, before = await stock('saddle-riding');
      for (const [item_id, companion_id, status] of [['pet-armor-scales', foreignPet.id, 404], ['pet-armor-scales', horse.id, 404], ['leather-armor', dog.id, 400]] as const) {
        const r = await cart([{ item_id: 'saddle-riding', quantity: 1 }, { item_id, quantity: 1, companion_id }]); assert.equal(r.status, status, JSON.stringify(r.data));
      }
      assert.equal(await stock('saddle-riding'), before); assert.equal((await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp, money); assert.deepEqual(await bag(foreignPet.id), []);
      assert.equal((await cart([{ item_id: 'pet-armor-padded', quantity: 1 }], randomUUID(), other)).status, 404);
    });
    await t.test('rota de compra individual também entrega automaticamente', async () => {
      const body = { character_id: hero.id, item_id: 'pet-armor-scales', quantity: 1, idempotency_key: randomUUID() };
      assert.equal((await req('/purchases', owner, body)).status, 201); assert.equal((await req('/purchases', owner, body)).status, 200);
      assert.deepEqual(await bag(dog.id), purchaseContents('pet-armor-scales').sort().map(item_id => ({ item_id, quantity: 1 })));
    });
    await t.test('peças entregues podem ser equipadas no próprio animal', async () => {
      const r = await req(`/companions/${hero.id}/equipment-set`, owner, { kind: 'pet', companion_id: dog.id, item_id: 'pet-armor-scales' }, 'PUT'); assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.companions.find((a: any) => a.id === dog.id).equipped.length, 6);
      assert.equal(r.data.companions.find((a: any) => a.id === dog.id).inventory.length, 6);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await pool.end(); }
});
