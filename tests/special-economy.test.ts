import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { defaultChoices } from '../shared/character-sheet';
import { abilityRollTotal } from '../shared/ability-rolls';
import { prestigeRewardsSchema } from '../shared/special-economy';
import { economyVersion } from '../shared/economy';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { guildDocumentSchema } from '../shared/guilds';
import { emptyBastionProgression } from '../shared/guild-bastion';

const rewards = Array.from({ length: 20 }, (_, i) =>
  i < 4 ? 0 : Math.floor(i / 4) * 20 + (i % 4),
);
const dice = [
  [6, 5, 4, 1],
  [5, 5, 3, 2],
  [6, 4, 3, 1],
  [5, 4, 3, 2],
  [4, 4, 3, 1],
  [4, 3, 2, 1],
];

test('Prestígio começa no nível 5 e aumenta mais nos quatro marcos', () => {
  assert(prestigeRewardsSchema.safeParse(rewards).success);
  assert(!prestigeRewardsSchema.safeParse(rewards.map((r, i) => (i === 0 ? 1 : r))).success);
  assert(
    !prestigeRewardsSchema.safeParse(rewards.map((r, i) => (i === 8 ? rewards[7] + 1 : r))).success,
  );
});

test('aposentadoria, compras e contribuições usam regras persistidas e preservam os bens', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const base = 'http://127.0.0.1:' + addr.port + '/api';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function account(name: string, admin = false): Promise<Account> {
    const id = randomUUID(),
      token = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email,administrador) VALUES($1,$2,$3,$4)', [
      id,
      name,
      id + '@example.test',
      admin ? 1 : 0,
    ]);
    await pool.query(
      'INSERT INTO session(id,token,"userId","expiresAt") VALUES($1,$2,$3,now()+interval \'1 hour\')',
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
  async function request(path: string, who: Account, method = 'GET', body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        'Content-Type': 'application/json',
        'X-Economy-Version': economyVersion,
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }
  async function ok(path: string, who: Account, method = 'GET', body?: unknown) {
    const response = await request(path, who, method, body);
    assert.equal(response.status, 200, path + ' ' + JSON.stringify(response.data));
    return response.data;
  }
  try {
    const admin = await account('Administradora', true),
      user = await account('Viajante');
    const leader = await account('Fundadora'),
      low = await account('Principiante');
    const hero = await createLegacyTestCharacter(user.id, 'Bruma');
    const permanent = await createLegacyTestCharacter(user.id, 'Vigia');
    const representative = await createLegacyTestCharacter(leader.id);
    const novice = await createLegacyTestCharacter(low.id, 'Névoa');
    await pool.query('UPDATE characters SET level=9,progression_missions=53 WHERE id=$1', [
      hero.id,
    ]);
    await pool.query('UPDATE characters SET level=5 WHERE id=$1', [permanent.id]);
    await pool.query('UPDATE characters SET level=3,creation_slot=1 WHERE id=$1', [novice.id]);
    await pool.query(
      'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,ability_roll_floor) VALUES($1,$2,$3,$4,now(),8),($5,$2,$3,$4,now(),8)',
      [
        hero.id,
        JSON.stringify(defaultChoices('Elfo', 'Guerreiro')),
        JSON.stringify(dice),
        '[0,1,2,3,4,5]',
        novice.id,
      ],
    );
    await pool.query(
      'INSERT INTO character_slot_rolls(user_id,slot,character_id,rolls,revealed) VALUES($1,1,$2,$3,6)',
      [low.id, novice.id, JSON.stringify(dice)],
    );
    await pool.query(
      "INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,'longsword',1)",
      [hero.id],
    );
    const retire = (id: string) => '/characters/' + id + '/retirement';
    const config = { rewards, revision: 0 };
    assert.equal((await request('/prestige/rewards', user, 'PUT', config)).status, 403);
    await ok('/prestige/rewards', admin, 'PUT', config);
    const novicePreview = await ok(retire(novice.id), low);
    assert.equal(novicePreview.points, null);
    assert.equal(
      (
        await request(retire(novice.id), low, 'POST', {
          name: novice.name,
          mode: 'permanent',
          level: 3,
          cycle: 0,
          revision: 1,
          request_id: randomUUID(),
        })
      ).status,
      409,
    );
    await ok('/characters/' + novice.id, low, 'DELETE', { name: novice.name });
    assert.equal((await ok('/prestige', low)).balance, 0);
    const lowSlot = (
      await pool.query(
        'SELECT rolls,matured FROM character_slot_rolls WHERE user_id=$1 AND slot=1',
        [low.id],
      )
    ).rows[0];
    assert.deepEqual(lowSlot, { rolls: dice, matured: false });
    const nextSlot = await ok('/character-slots/1/roll', low, 'POST', {});
    assert.deepEqual(nextSlot.rolls, dice);
    assert.equal(nextSlot.revealed, 6);

    const keep = {
      name: hero.name,
      mode: 'restart',
      class: 'Ladino',
      dice: 'keep',
      level: 9,
      cycle: 0,
      revision: 1,
      request_id: randomUUID(),
    };
    assert.equal((await request(retire(hero.id), low)).status, 404);
    assert.equal((await ok(retire(hero.id), user)).points, rewards[8]);
    const twice = await Promise.all([
      ok(retire(hero.id), user, 'POST', keep),
      ok(retire(hero.id), user, 'POST', keep),
    ]);
    assert.equal(twice.filter((r) => r.replayed).length, 1);
    const restarted = (
      await pool.query(
        'SELECT level,class,progression_missions,gold_cp,deleted_at,retirement_cycle FROM characters WHERE id=$1',
        [hero.id],
      )
    ).rows[0];
    assert.deepEqual(restarted, {
      level: 1,
      class: 'Ladino',
      progression_missions: 0,
      gold_cp: hero.gold_cp,
      deleted_at: null,
      retirement_cycle: 1,
    });
    const sheetPath = '/characters/' + hero.id + '/sheet';
    const draft = (await ok(sheetPath, user)).sheet;
    assert.deepEqual(draft.rolls, dice);
    assert.equal(draft.retirement_rebuild, true);
    const assignment = [1, 0, 2, 3, 4, 5];
    assert.equal(
      (await request(sheetPath + '/finalize', user, 'POST', { assignment })).status,
      409,
    );
    await ok(sheetPath + '/choices', user, 'POST', draft.choices);
    const finalized = (await ok(sheetPath + '/finalize', user, 'POST', { assignment })).sheet;
    assert.deepEqual(finalized.assignment, assignment);
    await ok('/characters/' + hero.id + '/starting-equipment', user, 'POST', {});
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
      hero.gold_cp,
    );
    assert.deepEqual(
      (await pool.query('SELECT item_id,quantity FROM inventory WHERE character_id=$1', [hero.id]))
        .rows,
      [{ item_id: 'longsword', quantity: 1 }],
    );

    await pool.query('UPDATE characters SET level=5 WHERE id=$1', [hero.id]);
    const reroll = {
      ...keep,
      class: 'Guerreiro',
      dice: 'reroll',
      level: 5,
      cycle: 1,
      request_id: randomUUID(),
    };
    await ok(retire(hero.id), user, 'POST', reroll);
    const after = (await ok(sheetPath, user)).sheet;
    assert.equal(after.rolls_revealed, 0);
    assert(abilityRollTotal(after.rolls) >= 72 && abilityRollTotal(after.rolls) <= 90);
    await ok(retire(hero.id), user, 'POST', reroll);
    assert.deepEqual((await ok(sheetPath, user)).sheet.rolls, after.rolls);
    await ok(retire(permanent.id), user, 'POST', {
      name: permanent.name,
      mode: 'permanent',
      level: 5,
      cycle: 0,
      revision: 1,
      request_id: randomUUID(),
    });
    assert(
      (await pool.query('SELECT deleted_at FROM characters WHERE id=$1', [permanent.id])).rows[0]
        .deleted_at,
    );
    assert.equal((await ok('/prestige', user)).balance, rewards[8] + 2 * rewards[4]);

    const portrait = '/profiles/frame-0-v1.webp';
    async function offer(
      currency: string,
      category: string,
      price: number,
      target_key: string | null = null,
      image_path: string | null = portrait,
    ) {
      const id = randomUUID();
      return ok('/special-shop/' + currency + '/offers/' + id, admin, 'PUT', {
        revision: 0,
        category,
        name: 'Item ' + category,
        description: 'Regra de teste',
        price,
        active: true,
        target_key,
        image_path,
      });
    }
    const border = await offer('prestige', 'profile_border', 3);
    const skin = await offer('prestige', 'weapon_skin', 4, 'longsword');
    const pet = await offer('prestige', 'pet', 5, 'dog');
    const mount = await offer('prestige', 'mount', 6, 'pony');
    const towerItem = await offer('crystals', 'tower_item', 7, null, null);
    const purchase = (
      item: any,
      currency: string,
      character_id?: string,
      request_id = randomUUID(),
    ) =>
      ok('/special-shop/' + currency + '/purchases', user, 'POST', {
        offer_id: item.id,
        revision: item.revision,
        character_id,
        request_id,
      });
    const borderBuy = await purchase(border, 'prestige');
    assert.equal(
      (await request('/prestige/profile-border', low, 'PUT', { purchase_id: borderBuy.id })).status,
      404,
    );
    await ok('/prestige/profile-border', user, 'PUT', { purchase_id: borderBuy.id });
    assert.equal((await ok('/profiles/' + user.id, low)).prestige_border, portrait);
    const skinBuy = await purchase(skin, 'prestige');
    await ok('/prestige/weapon-skin/' + skinBuy.id, user, 'PUT', {
      character_id: hero.id,
      enabled: true,
    });
    const storage = await ok('/characters/' + hero.id + '/storage', user);
    assert.equal(
      storage.inventory.find((item: { id: string }) => item.id === 'longsword').image_path,
      portrait,
    );
    await purchase(pet, 'prestige', hero.id);
    await purchase(mount, 'prestige', hero.id);
    assert.equal((await ok('/pets/' + hero.id, user))[0].image_url, portrait);
    assert.equal((await ok('/stable/' + hero.id, user))[0].image_url, portrait);

    await pool.query('INSERT INTO tower_wallets(character_id,crystals) VALUES($1,30)', [hero.id]);
    const buyId = randomUUID(),
      bought = await purchase(towerItem, 'crystals', hero.id, buyId);
    assert.equal((await purchase(towerItem, 'crystals', hero.id, buyId)).balance, 23);
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM inventory WHERE character_id=$1', [hero.id]))
        .rows[0].n,
      1,
    );
    const run = randomUUID();
    await pool.query(
      "INSERT INTO tower_expeditions(id,master_id,name,status) VALUES($1,$2,'Véu de teste','active')",
      [run, admin.id],
    );
    await pool.query('INSERT INTO tower_members(run_id,character_id) VALUES($1,$2)', [
      run,
      hero.id,
    ]);
    const table = '/tower/expeditions/' + run + '/table';
    const { room_id } = await ok(table, admin, 'POST', {});
    assert.equal((await ok(table, user, 'POST', { character_id: hero.id })).room_id, room_id);
    const unrelated = await request('/vtt', user, 'POST', { name: 'Mesa comum' });
    assert.equal(unrelated.status, 201);
    const use = (room: string) =>
      '/vtt/rooms/' + room + '/tower-items/' + hero.id + '/' + bought.id + '/use';
    assert.equal((await request(use(unrelated.data.id), user, 'POST', {})).status, 403);
    await pool.query("UPDATE vtt_members SET role='spectator' WHERE room_id=$1 AND user_id=$2", [
      room_id,
      user.id,
    ]);
    assert.equal((await request(use(room_id), user, 'POST', {})).status, 403);
    await pool.query("UPDATE vtt_members SET role='player' WHERE room_id=$1 AND user_id=$2", [
      room_id,
      user.id,
    ]);
    const uses = await Promise.all([
      ok(use(room_id), user, 'POST', {}),
      ok(use(room_id), user, 'POST', {}),
    ]);
    assert.equal(uses.filter((r) => r.replayed).length, 1);
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM vtt_messages WHERE room_id=$1', [room_id]))
        .rows[0].n,
      1,
    );

    const guild = randomUUID(),
      root = '/guilds/' + guild;
    await pool.query(
      'INSERT INTO player_guilds(id,owner_id,document,prestige,founding_cp,request_id) VALUES($1,$2,$3,300,0,$4)',
      [
        guild,
        leader.id,
        JSON.stringify(guildDocumentSchema.parse({ name: 'Companhia de teste' })),
        randomUUID(),
      ],
    );
    await pool.query(
      'INSERT INTO player_guild_members(guild_id,user_id,character_id) VALUES($1,$2,$3),($1,$4,$5)',
      [guild, leader.id, representative.id, user.id, hero.id],
    );
    for (const [room, kind, currency, amount] of [
      ['forge', 'prestige_cost', 'prestige', 10],
      ['meeting', 'crystal_cost', 'crystals', 8],
    ] as const) {
      const progression = emptyBastionProgression();
      Object.assign(progression.levels[0], { enabled: true, benefit: 'Benefício base' });
      Object.assign(progression.levels[1], {
        enabled: true,
        benefit: 'Benefício do nível 2',
        requirements: [{ kind, target: amount }],
      });
      const saved = await ok('/community/facilities/' + room, admin, 'PUT', {
        name: 'Instalação ' + room,
        description: 'Instalação',
        upgrade_description: 'Melhoria',
        x: 0.5,
        y: 0.6,
        scale: 0.2,
        revision: 0,
        progression,
      });
      const contribution = { currency, amount, character_id: hero.id, request_id: randomUUID() };
      const deposits = await Promise.all([
        ok(root + '/bastion/contributions', user, 'POST', contribution),
        ok(root + '/bastion/contributions', user, 'POST', contribution),
      ]);
      assert.equal(deposits.filter((r) => r.replayed).length, 1);
      assert.equal((await ok(root + '/bastion', user)).special_balances[currency], amount);
      assert.equal((await ok(root + '/bastion', low)).special_balances, undefined);
      const upgrade = root + '/facilities/' + room + '/upgrade',
        operation = { level: 2, revision: saved.revision };
      assert.equal((await request(upgrade, user, 'POST', operation)).status, 403);
      const attempts = await Promise.all([
        ok(upgrade, leader, 'POST', operation),
        ok(upgrade, leader, 'POST', operation),
      ]);
      assert.equal(attempts.filter((r) => r.replayed).length, 1);
      assert.equal((await ok(root + '/bastion', user)).special_balances[currency], 0);
    }
    assert.equal(
      (await pool.query('SELECT prestige FROM player_guilds WHERE id=$1', [guild])).rows[0]
        .prestige,
      300,
    );
    assert.equal(
      (await pool.query('SELECT crystals FROM tower_wallets WHERE character_id=$1', [hero.id]))
        .rows[0].crystals,
      15,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
