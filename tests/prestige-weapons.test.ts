import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { prestigeExtraDamage } from '../server/vtt-prestige-weapons';
import { createLegacyTestCharacter } from './character-fixtures';
import { defaultChoices } from '../shared/character-sheet';
import { equippedAttacks } from '../shared/equipped-attacks';
import { prestigeWeapons } from '../shared/prestige-weapons';
import { newDocument, newToken } from '../shared/vtt';
import { economyVersion } from '../shared/economy';
import { vttProtocolVersion } from '../shared/vtt-protocol';

const [sword, bow, hammer, rapier] = prestigeWeapons;
const choices = defaultChoices('Elfo', 'Guerreiro');

test('estágios substituem os bônus anteriores e efeitos têm gatilhos próprios', () => {
  for (const [level, expected] of [[1, 0], [5, 1], [10, 1], [11, 2], [17, 3]]) {
    const character = { race: 'Elfo', class: 'Guerreiro', stats: [16, 14, 12, 10, 10, 10], level };
    const common = { name: 'Espada longa', quantity: 1, equipped: ['main_hand'] };
    const [base, special] = equippedAttacks(character, choices, [
      { ...common, id: 'longsword' },
      { ...common, id: sword.id, raw_data: { base_item: 'longsword' } },
    ]);
    assert.equal(special.attack - base.attack, expected);
    assert.equal(special.ability - base.ability, expected);
  }
  const scene = newDocument(randomUUID()).scenes[0];
  const actor = { ...newToken(randomUUID(), scene), x: 0, y: 0, hp: 10, maxHp: 20 };
  const target = { ...newToken(randomUUID(), scene), x: scene.grid.size * 8, y: 0, hp: 5, maxHp: 10 };
  scene.grid.unit = 'ft';
  scene.grid.scale = 5;
  assert.equal(prestigeExtraDamage(sword, 10, true, actor, target, scene), '');
  assert.equal(prestigeExtraDamage(sword, 11, true, actor, target, scene), '+1d4');
  assert.equal(prestigeExtraDamage(sword, 17, false, actor, target, scene), '');
  assert.equal(prestigeExtraDamage(bow, 5, false, actor, target, scene), '+2');
  assert.equal(prestigeExtraDamage(bow, 5, false, actor, { ...target, x: scene.grid.size * 7 }, scene), '');
  assert.equal(prestigeExtraDamage(bow, 5, false, actor, { ...target, x: scene.grid.size * 31 }, scene), '');
  assert.equal(prestigeExtraDamage(hammer, 9, false, actor, target, scene), '+2');
  assert.equal(prestigeExtraDamage(hammer, 9, false, { ...actor, hp: 11 }, target, scene), '');
  assert.equal(prestigeExtraDamage(rapier, 5, false, actor, target, scene), '+1');
  assert.equal(prestigeExtraDamage(rapier, 5, false, actor, { ...target, hp: 6 }, scene), '');
});

test('a compra entrega uma unidade e a mesa usa a arma equipada com dano idempotente', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];

  async function account(name: string) {
    const id = randomUUID(), token = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [id, name, id + '@example.test']);
    await pool.query(`INSERT INTO session(id,token,"userId","expiresAt") VALUES($1,$2,$3,now()+interval '1 hour')`,
      [randomUUID(), token, id]);
    const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');
    return { id, cookie: 'better-auth.session_token=' + encodeURIComponent(token + '.' + signature) };
  }
  async function request(path: string, who: Awaited<ReturnType<typeof account>>, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin, Cookie: who.cookie, 'Content-Type': 'application/json',
        'X-Economy-Version': economyVersion, 'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    const player = await account('Viajante da forja');
    const observer = await account('Espectadora da forja');
    const hero = await createLegacyTestCharacter(player.id, 'Aurora');
    await pool.query('INSERT INTO prestige_wallets(user_id,points) VALUES($1,100)', [player.id]);
    const shop = await request('/special-shop/prestige', player);
    const offer = shop.data.offers.find((entry: { target_key: string }) => entry.target_key === sword.id);
    assert.equal(offer.category, 'prestige_weapon');
    const body = { offer_id: offer.id, revision: offer.revision, request_id: randomUUID(), character_id: hero.id };
    const buy = (purchase = body) => request('/special-shop/prestige/purchases', player, 'POST', purchase);
    assert.equal((await buy()).status, 409);
    assert.equal((await request('/special-shop/prestige', player)).data.balance, 100);
    await pool.query('UPDATE characters SET level=11 WHERE id=$1', [hero.id]);
    const bought = await Promise.all([buy(), buy()]);
    assert.deepEqual(bought.map((reply) => reply.status), [200, 200]);
    assert.equal(bought.filter((reply) => reply.data.replayed).length, 1);
    assert.equal(bought[0].data.balance, 58);
    assert.equal((await buy({ ...body, request_id: randomUUID() })).status, 409);
    const { rows: [owned] } = await pool.query(
      'SELECT quantity,active FROM inventory JOIN catalog_items ON id=item_id WHERE character_id=$1 AND item_id=$2',
      [hero.id, sword.id],
    );
    assert.deepEqual(owned, { quantity: 1, active: false });

    await pool.query(
      `INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at)
       VALUES($1,$2,'[[6,5,4,1],[5,5,3,2],[6,4,3,1],[5,4,3,2],[4,4,3,1],[4,3,2,1]]','[0,1,2,3,4,5]',now())`,
      [hero.id, JSON.stringify(choices)],
    );
    const doc = newDocument(randomUUID()), scene = doc.scenes[0], roomId = randomUUID();
    const actor = { ...newToken(randomUUID(), scene), name: hero.name, hp: 11, controller: player.id, characterId: hero.id };
    const target = { ...newToken(randomUUID(), scene), name: 'Alvo de treino', hp: 10, ac: 0 };
    scene.tokens.push(actor, target);
    await pool.query('INSERT INTO vtt_rooms(id,owner_id,invite,document) VALUES($1,$2,$3,$4)',
      [roomId, player.id, randomUUID(), JSON.stringify(doc)]);
    await pool.query("INSERT INTO vtt_members(room_id,user_id,role) VALUES($1,$2,'spectator')", [roomId, observer.id]);
    await pool.query('INSERT INTO vtt_character_links(room_id,character_id,imported_by) VALUES($1,$2,$3)', [roomId, hero.id, player.id]);
    const room = '/vtt/rooms/' + roomId;
    const path = room + '/prestige-attacks';
    const action = {
      request_id: randomUUID(), item_id: sword.id, actor_id: actor.id, target_id: target.id,
      mode: 'advantage', visual: true, private: false,
    };
    assert.equal((await request(path, observer, 'POST', action)).status, 403);
    assert.equal((await request(path, player, 'POST', action)).status, 409);
    const equipped = await request(room + '/sheets/' + actor.id + '/weapons', player, 'PUT', {
      main_hand: sword.id, off_hand: null, main_hand_two_handed: false,
    });
    assert.equal(equipped.status, 200, JSON.stringify(equipped.data));
    const current = equipped.data.attacks.find((attack: { itemId: string }) => attack.itemId === sword.id);
    let attack = await request(path, player, 'POST', action);
    assert.equal(attack.status, 201, JSON.stringify(attack.data));
    for (let attempt = 0; !attack.data.weaponOutcome.hit && attempt < 8; attempt++) {
      action.request_id = randomUUID();
      attack = await request(path, player, 'POST', action);
    }
    assert.equal(attack.data.weaponOutcome.hit, true);
    const attackId = attack.data.createdMessageId;
    const rolled = attack.data.messages.find((message: { id: string }) => message.id === attackId);
    const signed = (value: number) => value < 0 ? String(value) : '+' + value;
    assert.equal(rolled.roll.formula, '2d20kh1' + signed(current.attack));
    assert.equal((await request(path, player, 'POST', action)).data.createdMessageId, attackId);
    const damagePath = path + '/' + attackId + '/damage';
    assert.equal((await request(damagePath, observer, 'POST', {})).status, 403);
    const damage = await Promise.all([
      request(damagePath, player, 'POST', {}),
      request(damagePath, player, 'POST', {}),
    ]);
    assert.deepEqual(damage.map((reply) => reply.status), [201, 201]);
    const damageId = damage[0].data.createdMessageId;
    assert.equal(damage[1].data.createdMessageId, damageId);
    const hit = damage[0].data.messages.find((message: { id: string }) => message.id === damageId);
    assert.equal(hit.damage.target_id, target.id);
    assert.equal(hit.roll.formula, attack.data.weaponOutcome.critical
      ? '2d8' + signed(current.ability) + '+1d4'
      : '1d8' + signed(current.ability));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
