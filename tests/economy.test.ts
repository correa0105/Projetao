import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { pool, transaction } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { guildDocumentSchema } from '../shared/guilds.js';
import { emptyBastionProgression } from '../shared/guild-bastion.js';
import { configureTestBastion } from './guild-bastion-fixtures.js';
import { house2FurnitureForSale, house2Houses } from '../shared/house-v2.js';
import { house2FinishesCatalog } from '../shared/house2-finishes.js';
import {
  balancedMagicPrice,
  economyVersion,
  isConsumable,
  magicRarity,
  missionReward,
  rarityReferencePo,
  missionDifficulties,
} from '../shared/economy.js';
import { RANKS } from '../shared/progression.js';
import { INITIAL_RULEBOOK } from '../shared/rulebook.js';
import { changeBastionCredits, bastionBalance } from '../server/bastion-currency.js';

test('Economia: migração preserva bens e pagamentos; missões e compras usam as moedas corretas', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  // Build the previous schema to exercise the actual migration with legacy data.
  await pool.query(
    'CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir('db/migrations'))
    .filter((n) => n.endsWith('.sql') && n < '138_')
    .sort()) {
    await pool.query(await readFile('db/migrations/' + name, 'utf8'));
    await pool.query('INSERT INTO schema_migrations(name)VALUES($1)', [name]);
  }
  const legacy = randomUUID();
  await pool.query('INSERT INTO "user"(id,name,email)VALUES($1,$2,$3)', [
    legacy,
    'Legado',
    'legacy-' + legacy + '@example.test',
  ]);
  const legacyCharacter = await createLegacyTestCharacter(legacy, 'Legado');
  await pool.query('UPDATE characters SET gold_cp=123456 WHERE id=$1', [legacyCharacter.id]);
  await pool.query('INSERT INTO house2_accounts(user_id,balance)VALUES($1,17321)', [legacy]);
  const legacyGuild = randomUUID();
  await pool.query(
    'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,founding_cp,request_id)VALUES($1,$2,$3,98765,10000,$4)',
    [
      legacyGuild,
      legacy,
      JSON.stringify(guildDocumentSchema.parse({ name: 'Guilda legada' })),
      randomUUID(),
    ],
  );
  const oldMission = (
    await pool.query(
      "INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,mission_rank,status,reward_cp)VALUES($1,'mission','Histórica','Aventura antiga','Vigília','Moderada','Ferro','completed',15000)RETURNING id",
      [legacy],
    )
  ).rows[0].id;
  await pool.query('INSERT INTO mission_participants(post_id,character_id)VALUES($1,$2)', [
    oldMission,
    legacyCharacter.id,
  ]);
  await pool.query(
    'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by,gold_cp)VALUES($1,$2,0,$3,15000)',
    [oldMission, legacyCharacter.id, legacy],
  );
  const openMission = (
    await pool.query(
      "INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,mission_rank,reward_cp)VALUES($1,'mission','Aberta','Aventura aberta','Vigília','Perigosa','Bronze',23000)RETURNING id",
      [legacy],
    )
  ).rows[0].id;
  const activeMission = (
    await pool.query(
      "INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,mission_rank,status,reward_cp)VALUES($1,'mission','Em andamento','Aventura em andamento','Vigília','Tranquila','Obsidiana','active',90000)RETURNING id",
      [legacy],
    )
  ).rows[0].id;
  await configureTestBastion();
  const oldBook = structuredClone(INITIAL_RULEBOOK);
  const oldArticle = oldBook.chapters
    .flatMap((c) => c.articles)
    .find((a) => a.id === 'missoes-recompensas')!;
  const currencyArticle = oldBook.chapters
    .flatMap((c) => c.articles)
    .find((a) => a.id === 'economia-moedas')!;
  currencyArticle.summary = 'Resumo de moedas publicado pela administração.';
  oldArticle.summary = 'Pagamento anterior';
  const oldRewardTable = oldArticle.blocks.find((block) => block.type === 'table')!;
  oldRewardTable.rows[1][3] = '350 PO + 90 CB';
  oldArticle.blocks.push({
    id: 'custom-economy-note',
    type: 'text',
    text: 'Anotação administrativa preservada.',
  });
  await pool.query('INSERT INTO rulebook_documents(id,document,revision)VALUES(1,$1,5)', [
    JSON.stringify(oldBook),
  ]);
  await migrate();
  await pool.query(
    "INSERT INTO economy_settings_history(version,area,reference,document)VALUES($1,'rulebook','1',$2)",
    [economyVersion, JSON.stringify(oldBook)],
  );
  await seed();
  await t.test(
    'preserva saldos e histórico, atualiza CB de missões abertas e em andamento e publica a regra',
    async () => {
      assert.equal(
        (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [legacyCharacter.id]))
          .rows[0].gold_cp,
        123456,
      );
      assert.equal(await bastionBalance(legacy), 17321);
      const g = (await pool.query('SELECT * FROM player_guilds WHERE id=$1', [legacyGuild]))
        .rows[0];
      assert.equal(Number(g.treasury_cp), 98765);
      assert.equal(g.bastion_treasury_cp, 0);
      assert.equal(g.founding_currency, 'gold');
      assert.deepEqual(
        (await pool.query('SELECT reward_cp,bastion_credits FROM board_posts WHERE id=$1', [oldMission])).rows[0],
        { reward_cp: 15000, bastion_credits: 0 },
      );
      assert.equal(
        (await pool.query('SELECT gold_cp FROM mission_rewards WHERE post_id=$1', [oldMission]))
          .rows[0].gold_cp,
        15000,
      );
      const m = (
        await pool.query('SELECT reward_cp,bastion_credits FROM board_posts WHERE id=$1', [
          openMission,
        ])
      ).rows[0];
      assert.deepEqual(m, { reward_cp: 35000, bastion_credits: 60 });
      assert.deepEqual(
        (await pool.query('SELECT reward_cp,bastion_credits FROM board_posts WHERE id=$1', [activeMission])).rows[0],
        { reward_cp: 200000, bastion_credits: 40 },
      );
      const p = (
        await pool.query("SELECT progression FROM guild_facility_definitions WHERE room='forge'")
      ).rows[0].progression;
      assert.equal(p.levels[1].requirements[0].target, 30000);
      assert.equal(p.levels[1].benefit, 'Benefício de teste do nível 2');
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM bastion_currency_ledger')).rows[0].n,
        0,
      );
      const book = (await pool.query('SELECT * FROM rulebook_documents WHERE id=1')).rows[0];
      assert.equal(book.revision, 6);
      assert(JSON.stringify(book.document).includes('Anotação administrativa preservada.'));
      assert(JSON.stringify(book.document).includes('Resumo de moedas publicado pela administração.'));
      assert(JSON.stringify(book.document).includes('350 PO + 60 CB'));
      assert(!JSON.stringify(book.document).includes('350 PO + 90 CB'));
      assert(!JSON.stringify(book.document).includes('Pagamento anterior'));
      assert.deepEqual(
        (await pool.query('SELECT snapshot FROM rulebook_versions WHERE revision=5')).rows[0]
          .snapshot,
        oldBook,
      );
    },
  );
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Client = { id: string; cookie: string };
  async function req(
    path: string,
    client?: Client,
    body?: unknown,
    method = body ? 'POST' : 'GET',
    current = true,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: client?.cookie || '',
        ...(current ? { 'X-Economy-Version': economyVersion } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  const ok = (r: { status: number; data: any }, status = 200) => {
    assert.equal(r.status, status, JSON.stringify(r.data));
    return r.data;
  };
  async function signup(admin = false): Promise<Client> {
    const r = await req('/auth/sign-up/email', undefined, {
      name: 'Economia',
      email: 'economy-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    ok(r);
    if (admin) await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [r.data.user.id]);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((s) => s.split(';')[0])
        .join('; '),
    };
  }
  const goldOf = async (id: string) =>
    Number((await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [id])).rows[0].gold_cp);
  try {
    const admin = await signup(true),
      player = await signup(),
      other = await signup();
    const a = await createLegacyTestCharacter(player.id, 'Primeiro'),
      b = await createLegacyTestCharacter(player.id, 'Segundo'),
      foreign = await createLegacyTestCharacter(other.id, 'Estrangeiro');
    await pool.query('UPDATE characters SET gold_cp=25000 WHERE id=ANY($1::uuid[])', [
      [a.id, b.id, foreign.id],
    ]);
    await t.test(
      '15 faixas de missão, raridades, quartos, lendários e seed idempotente',
      async () => {
        for (const rank of RANKS) {
          let prior = 0;
          for (const [index, difficulty] of missionDifficulties.entries()) {
            const r = missionReward(rank, difficulty);
            assert(r.gold_cp > prior);
            assert.equal(r.bastion_credits, [40, 50, 60][index]);
            prior = r.gold_cp;
          }
        }
        for (const [rarity, po] of Object.entries(rarityReferencePo)) {
          const permanent = balancedMagicPrice({
            id: 'test',
            price_cp: 100,
            raw_data: { rarity },
          })!;
          const consumable = balancedMagicPrice({
            id: 'test',
            price_cp: 100,
            raw_data: { rarity, consumable: true },
          })!;
          assert.equal(permanent, po * 100);
          assert.equal(consumable, permanent / 4);
        }
        assert.equal(
          balancedMagicPrice({ id: 'artifact', price_cp: null, raw_data: { rarity: 'artifact' } }),
          null,
        );
        const items = (
          await pool.query(
            'SELECT id,name,category,price_cp,raw_data FROM catalog_items WHERE active ORDER BY id',
          )
        ).rows;
        const groups: Record<string, { count: number; min: number; max: number }> = {};
        for (const item of items) {
          const rarity = magicRarity(item);
          if (!rarity || item.price_cp === null) continue;
          const key = rarity + (isConsumable(item) ? ' consumível' : ' permanente');
          const group = (groups[key] ||= { count: 0, min: Infinity, max: 0 });
          group.count++;
          group.min = Math.min(group.min, item.price_cp / 100);
          group.max = Math.max(group.max, item.price_cp / 100);
          if (rarity === 'legendary')
            assert(item.price_cp >= 25000000 / (isConsumable(item) ? 4 : 1));
        }
        assert.equal(items.find((i) => i.id === 'potion-of-growth')?.price_cp, 25000);
        const legendary = items.find(
          (i) => magicRarity(i) === 'legendary' && !isConsumable(i) && i.price_cp !== null,
        )!;
        ok(
          await req('/catalog/' + legendary.id + '/price', admin, { price_cp: 24999900 }, 'PATCH'),
          400,
        );
        ok(
          await req('/catalog/' + legendary.id + '/price', admin, { price_cp: 30000000 }, 'PATCH'),
        );
        const formerlyUnpriced=items.find(i=>magicRarity(i)==='rare'&&!isConsumable(i)&&i.price_cp!==null)!;
        await pool.query('DELETE FROM economy_price_history WHERE item_id=$1',[formerlyUnpriced.id]);
        ok(await req('/catalog/'+formerlyUnpriced.id+'/price',admin,{price_cp:null},'PATCH'));
        ok(await req('/catalog/'+formerlyUnpriced.id+'/price',admin,{price_cp:12340000},'PATCH'));
        const snapshot = (await pool.query('SELECT id,price_cp FROM catalog_items ORDER BY id'))
          .rows;
        await seed();
        assert.deepEqual(
          (await pool.query('SELECT id,price_cp FROM catalog_items ORDER BY id')).rows,
          snapshot,
        );
        assert(house2FurnitureForSale.every((f) => f.price >= 20 && f.price <= 800));
        assert(house2FinishesCatalog.every((f) => f.price >= 50 && f.price <= 150));
        await mkdir('.local/economy-20261102', { recursive: true });
        await writeFile(
          '.local/economy-20261102/catalog-audit.json',
          JSON.stringify(
            {
              groups,
              houses: house2Houses.map((h) => ({ id: h.id, price: h.price })),
              furniture: {
                count: house2FurnitureForSale.length,
                min: Math.min(...house2FurnitureForSale.map((f) => f.price)),
                max: Math.max(...house2FurnitureForSale.map((f) => f.price)),
              },
            },
            null,
            2,
          ),
        );
      },
    );
    async function mission(ids: string[], rank = 'Ferro', difficulty = 'Moderada') {
      const m = ok(
        await req('/board', admin, {
          kind: 'mission',
          title: 'Economia de teste',
          description: 'Uma missão de teste de recompensas.',
          location: 'Vigília',
          difficulty,
          mission_rank: rank,
          reward_cp: 999999,
          starts_at: new Date(Date.now() + 3600000).toISOString(),
        }),
        201,
      );
      const expected = missionReward(rank as any, difficulty);
      assert.equal(m.reward_cp, expected.gold_cp);
      assert.equal(m.bastion_credits, expected.bastion_credits);
      for (const id of ids) ok(await req('/board/' + m.id + '/join', player, { character_id: id }));
      ok(await req('/board/' + m.id, admin, { status: 'active' }, 'PATCH'));
      return m.id;
    }
    await t.test(
      'ouro por personagem, CB uma vez por jogador; repetição concorrente e rank maior',
      async () => {
        assert.equal(ok(await req('/bastion-wallet', player)).balance, 0);
        ok(await req('/bastion-wallet'), 401);
        const m = await mission([a.id, b.id]);
        const complete = {
          summary: 'Missão concluída sem duplicar recompensas.',
          rewards: [{ character_id: a.id }, { character_id: b.id }],
        };
        ok(await req('/board/' + m + '/complete', other, complete), 403);
        const results = await Promise.all([
          req('/board/' + m + '/complete', admin, complete),
          req('/board/' + m + '/complete', admin, complete),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal(await goldOf(a.id), 37500);
        assert.equal(await goldOf(b.id), 37500);
        assert.equal(await bastionBalance(player.id), 50);
        await pool.query('UPDATE characters SET level=5,progression_missions=22 WHERE id=$1', [
          a.id,
        ]);
        const bronze = await mission([a.id], 'Bronze', 'Perigosa');
        ok(
          await req('/board/' + bronze + '/complete', admin, {
            summary: 'Retorno de uma missão perigosa.',
            rewards: [{ character_id: a.id }],
          }),
        );
        assert.equal(await goldOf(a.id), 72500);
        assert.equal(await bastionBalance(player.id), 110);
      },
    );
    await t.test('saldo insuficiente desfaz missão inteira, sem crédito parcial', async () => {
      await pool.query('UPDATE house2_accounts SET balance=2147483647 WHERE user_id=$1', [
        player.id,
      ]);
      const m = await mission([b.id]);
      const before = await goldOf(b.id);
      ok(
        await req('/board/' + m + '/complete', admin, {
          summary: 'Tentativa deve ser totalmente desfeita.',
          rewards: [{ character_id: b.id }],
        }),
        409,
      );
      assert.equal(await goldOf(b.id), before);
      assert.equal(
        (await pool.query('SELECT status FROM board_posts WHERE id=$1', [m])).rows[0].status,
        'active',
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM mission_rewards WHERE post_id=$1', [m]))
          .rows[0].n,
        0,
      );
      await pool.query('UPDATE house2_accounts SET balance=110 WHERE user_id=$1', [player.id]);
    });
    await t.test('House usa somente CB, replays e cliente antigo protegidos', async () => {
      const before = await goldOf(a.id),
        order = {
          character_id: a.id,
          catalog_id: 'letter',
          content: { title: 'Teste', text: 'Economia' },
          idempotency_key: randomUUID(),
        };
      ok(await req('/house/purchase', player, order, 'POST', false), 409);
      ok(await req('/house/purchase', other, order), 404);
      const results = await Promise.all([
        req('/house/purchase', player, order),
        req('/house/purchase', player, order),
      ]);
      results.forEach((r) => assert([200, 201].includes(r.status), JSON.stringify(r.data)));
      assert.equal(await bastionBalance(player.id), 95);
      assert.equal(await goldOf(a.id), before);
      ok(await req('/catalog/house-letter/price', admin, { price_cp: 125 }, 'PATCH'), 400);
      const plot = (
        await pool.query(
          'SELECT id FROM house2_plots WHERE character_id IS NULL AND retired_at IS NULL LIMIT 1',
        )
      ).rows[0];
      const plotOrder = { character_id: a.id, idempotency_key: randomUUID() };
      ok(await req('/house-v2/plots/' + plot.id + '/purchase', player, plotOrder), 409);
      assert.equal(
        (await pool.query('SELECT character_id FROM house2_plots WHERE id=$1', [plot.id])).rows[0]
          .character_id,
        null,
      );
      await transaction((db) => changeBastionCredits(db, player.id, 1000, 'test', randomUUID()));
      const bought = await Promise.all([
        req('/house-v2/plots/' + plot.id + '/purchase', player, plotOrder),
        req('/house-v2/plots/' + plot.id + '/purchase', player, plotOrder),
      ]);
      bought.forEach((r) => ok(r));
      assert.equal(await bastionBalance(player.id), 495);
      assert.equal(await goldOf(a.id), before);
      const furniture = house2FurnitureForSale[0],
        furnitureOrder = {
          character_id: a.id,
          plot_id: plot.id,
          catalog_id: furniture.id,
          idempotency_key: randomUUID(),
        };
      ok(await req('/house-v2/furniture', player, furnitureOrder));
      assert.equal(await bastionBalance(player.id), 495 - furniture.price);
    });
    await t.test(
      'fundação, contribuição e mobília da guilda usam CB, preservando ouro antigo',
      async () => {
        await transaction((db) => changeBastionCredits(db, player.id, 5000, 'test', randomUUID()));
        const beforeGold = await goldOf(a.id),
          beforeBalance = await bastionBalance(player.id);
        const foundation = {
          character_id: a.id,
          request_id: randomUUID(),
          document: guildDocumentSchema.parse({ name: 'Companhia da economia' }),
        };
        const guild = ok(await req('/guilds', player, foundation), 201);
        assert.equal(await goldOf(a.id), beforeGold);
        assert.equal(await bastionBalance(player.id), beforeBalance - 1500);
        ok(await req('/guilds', player, foundation), 201);
        assert.equal(await bastionBalance(player.id), beforeBalance - 1500);
        await pool.query('UPDATE player_guilds SET treasury_cp=98765 WHERE id=$1', [guild.id]);
        const path = '/guilds/' + guild.id + '/credits/deposit?character_id=' + a.id,
          deposit = { amount: 1000, request_id: randomUUID() };
        ok(await req(path, other, deposit), 404);
        ok(await req(path.replace(a.id, b.id), player, deposit), 403);
        const results = await Promise.all([req(path, player, deposit), req(path, player, deposit)]);
        results.forEach((r) => ok(r));
        assert.equal(results.filter((r) => r.data.replayed).length, 1);
        assert.equal(await bastionBalance(player.id), beforeBalance - 2500);
        ok(await req(path, player, { ...deposit, amount: 1 }), 409);
        ok(await req(path, player, { amount: 1000000, request_id: randomUUID() }), 409);
        const f = house2FurnitureForSale[0];
        ok(
          await req('/guilds/' + guild.id + '/estate/furniture', player, {
            catalog_id: f.id,
            request_id: randomUUID(),
          }),
        );
        const g = (
          await pool.query(
            'SELECT treasury_cp,bastion_treasury_cp FROM player_guilds WHERE id=$1',
            [guild.id],
          )
        ).rows[0];
        assert.equal(Number(g.treasury_cp), 98765);
        assert.equal(g.bastion_treasury_cp, 100000 - f.price * 100);
        assert.equal(await goldOf(a.id), beforeGold);
        const upgrade = { level: 2 };
        const upgradeResults = await Promise.all([
          req('/guilds/' + guild.id + '/facilities/forge/upgrade', player, upgrade),
          req('/guilds/' + guild.id + '/facilities/forge/upgrade', player, upgrade),
        ]);
        upgradeResults.forEach((r) => ok(r));
        const afterUpgrade = (
          await pool.query(
            'SELECT treasury_cp,bastion_treasury_cp FROM player_guilds WHERE id=$1',
            [guild.id],
          )
        ).rows[0];
        assert.equal(Number(afterUpgrade.treasury_cp), 98765);
        assert.equal(afterUpgrade.bastion_treasury_cp, g.bastion_treasury_cp - 30000);
        ok(await req('/guilds/' + guild.id, player));
        await pool.query(
          "UPDATE player_guild_weeks SET template=jsonb_set(template,'{goal}','1') WHERE guild_id=$1 AND mission_id='chronicles'",
          [guild.id],
        );
        const weeklyMission = await mission([a.id], 'Bronze', 'Perigosa');
        ok(
          await req('/board/' + weeklyMission + '/complete', admin, {
            summary: 'Nova aventura em companhia da guilda.',
            rewards: [{ character_id: a.id }],
          }),
        );
        const claim = '/guilds/' + guild.id + '/weekly/chronicles/claim';
        const claims = await Promise.all([req(claim, player, {}), req(claim, player, {})]);
        claims.forEach((r) => ok(r));
        assert.equal(claims.filter((r) => r.data.replayed).length, 1);
        const afterWeekly = (
          await pool.query(
            'SELECT treasury_cp,bastion_treasury_cp FROM player_guilds WHERE id=$1',
            [guild.id],
          )
        ).rows[0];
        assert.equal(Number(afterWeekly.treasury_cp), 98765);
        assert.equal(afterWeekly.bastion_treasury_cp, afterUpgrade.bastion_treasury_cp + 10000);
        const leaked = ok(await req('/guilds/' + guild.id, other));
        assert.equal(leaked.treasury_cp, null);
        assert.equal(leaked.legacy_treasury_cp, null);
      },
    );
    // Disabled levels and existing non-monetary rules are not unlocked by repricing.
    assert.equal(emptyBastionProgression().levels[1].enabled, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    await pool.end();
  }
});
