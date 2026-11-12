import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { pool, transaction } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { emptyBastionProgression } from '../shared/guild-bastion';
import { guildDocumentSchema } from '../shared/guilds';
import { house2Houses } from '../shared/house-v2';
import { economyVersion } from '../shared/economy';

test('lançamento bloqueado, ouro da Ferraria, tags, tutoriais e horta posicionável', async (t) => {
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
  async function account(admin = false) {
    const id = randomUUID(),
      token = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email,administrador)VALUES($1,$2,$3,$4)', [
      id,
      'Revisor',
      id + '@example.test',
      admin ? 1 : 0,
    ]);
    await pool.query(
      'INSERT INTO session(id,token,"userId","expiresAt")VALUES($1,$2,$3,now()+interval \'1 hour\')',
      [randomUUID(), token, id],
    );
    const cookie =
      'better-auth.session_token=' +
      encodeURIComponent(
        token +
          '.' +
          createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(token).digest('base64'),
      );
    return { id, cookie };
  }
  async function request(path: string, who: { cookie: string }, method = 'GET', body?: unknown) {
    const result = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        'Content-Type': 'application/json',
        'X-Economy-Version': economyVersion,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: result.status, data: await result.json() };
  }
  try {
    const owner = await account(),
      other = await account(),
      admin = await account(true);
    const hero = await createLegacyTestCharacter(owner.id),
      visitor = await createLegacyTestCharacter(other.id);
    await t.test(
      'Torre e cristais bloqueados inclusive para administração e links diretos',
      async () => {
        for (const who of [owner, admin]) {
          const me = await request('/me', who);
          assert(me.data.maintenance_areas.includes('tower'));
          assert(me.data.maintenance_areas.includes('cristais'));
          for (const path of [
            '/tower',
            '/tower/expeditions/' + randomUUID(),
            '/special-shop/crystals',
            '/vtt/rooms/' + randomUUID() + '/tower-items/' + hero.id,
          ])
            assert.equal((await request(path, who)).status, 503, path);
          assert.equal((await request('/special-shop/prestige', who)).status, 200);
        }
      },
    );
    await t.test('preferência de tutorial pertence à conta e pode ser reativada', async () => {
      assert.equal(
        (await request('/tutorials/house2', owner, 'PUT', { dismissed: true })).status,
        200,
      );
      assert.deepEqual((await request('/tutorials', owner)).data.dismissed, ['house2']);
      assert.deepEqual((await request('/tutorials', other)).data.dismissed, []);
      assert.equal(
        (await request('/tutorials/inventada', owner, 'PUT', { dismissed: true })).status,
        400,
      );
      await request('/tutorials/house2', owner, 'PUT', { dismissed: false });
      assert.deepEqual((await request('/tutorials', owner)).data.dismissed, []);
    });
    const guild = randomUUID();
    await pool.query(
      'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,prestige,founding_cp,request_id)VALUES($1,$2,$3,0,10000,0,$4)',
      [
        guild,
        owner.id,
        JSON.stringify(guildDocumentSchema.parse({ name: 'Companhia de revisão' })),
        randomUUID(),
      ],
    );
    await pool.query(
      'INSERT INTO player_guild_members(guild_id,user_id,character_id)VALUES($1,$2,$3),($1,$4,$5)',
      [guild, owner.id, hero.id, other.id, visitor.id],
    );
    const root = '/guilds/' + guild;
    async function configure(room: string, kind: 'gold_cost' | 'monster_tags', target: number) {
      const definition = (await request('/community/facilities', admin)).data.items.find(
        (item: { room: string }) => item.room === room,
      );
      const progression = emptyBastionProgression();
      progression.levels[0] = {
        level: 1,
        enabled: true,
        benefit: 'Benefício inicial de revisão.',
        requirements: [],
      };
      progression.levels[1] = {
        level: 2,
        enabled: true,
        benefit: 'Benefício ampliado de revisão.',
        requirements: [{ kind, target }],
      };
      const { room: _, ...input } = definition;
      const saved = await request('/community/facilities/' + room, admin, 'PUT', {
        ...input,
        progression,
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
    }
    await t.test(
      'membros contribuem ouro uma vez e só o fundador autoriza a melhoria',
      async () => {
        await configure('forge', 'gold_cost', 2000);
        await pool.query('UPDATE characters SET gold_cp=10000 WHERE id=$1', [hero.id]);
        assert.equal(
          (
            await request(root + '/bastion/contributions', owner, 'POST', {
              currency: 'crystals',
              amount: 10,
              request_id: randomUUID(),
              character_id: hero.id,
            })
          ).status,
          400,
        );
        const contribution = {
          currency: 'gold',
          amount: 3000,
          request_id: randomUUID(),
          character_id: hero.id,
        };
        const replies = await Promise.all(
          [1, 2].map(() => request(root + '/bastion/contributions', owner, 'POST', contribution)),
        );
        assert.deepEqual(
          replies.map((reply) => reply.status),
          [200, 200],
        );
        assert.equal(replies.filter((reply) => reply.data.replayed).length, 1);
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
            .gold_cp,
          7000,
        );
        assert.equal(
          (await request(root + '/facilities/forge/upgrade', other, 'POST', { level: 2 })).status,
          403,
        );
        const upgrades = await Promise.all(
          [1, 2].map(() =>
            request(root + '/facilities/forge/upgrade', owner, 'POST', { level: 2 }),
          ),
        );
        assert.deepEqual(
          upgrades.map((reply) => reply.status),
          [200, 200],
        );
        assert.equal(
          (
            await pool.query('SELECT treasury_cp::int AS gold FROM player_guilds WHERE id=$1', [
              guild,
            ])
          ).rows[0].gold,
          1000,
        );
      },
    );
    await t.test(
      'tags são cumulativas por guilda e suficientes para evoluir a expedição',
      async () => {
        await configure('meeting', 'monster_tags', 2);
        assert.equal(
          (await request(root + '/facilities/meeting/upgrade', owner, 'POST', { level: 2 })).status,
          409,
        );
        const tag = (await pool.query('SELECT id FROM mission_tags LIMIT 1')).rows[0].id;
        await pool.query(
          "INSERT INTO guild_bastion_credits(guild_id,metric,reference,tag_id,amount)VALUES($1,'monster_tag','revisao',$2,2)",
          [guild, tag],
        );
        const state = (await request(root + '/bastion', owner)).data;
        const next = state.facilities.find(
          (item: { room: string }) => item.room === 'meeting',
        ).next;
        assert.equal(next.requirements[0].current, 2);
        assert.equal(next.requirements[0].consumed, false);
        assert.equal(
          (await request(root + '/facilities/meeting/upgrade', owner, 'POST', { level: 2 })).status,
          200,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT amount::int FROM guild_bastion_credits WHERE guild_id=$1 AND reference='revisao'",
              [guild],
            )
          ).rows[0].amount,
          2,
        );
      },
    );
    await t.test('canteiro e fermentador mantêm suas posições, dimensões e dono', async () => {
      const plot = (
        await pool.query(
          'SELECT * FROM house2_plots WHERE character_id IS NULL AND retired_at IS NULL LIMIT 1',
        )
      ).rows[0];
      await pool.query(
        'UPDATE house2_plots SET character_id=$2,house_id=$3,house_x=x+width/2.0,house_y=y+height/2.0 WHERE id=$1',
        [plot.id, hero.id, house2Houses[0].id],
      );
      const gardenPath = '/house-v2/plots/' + plot.id + '/garden';
      const created = await Promise.all(
        [1, 2].map(() => request(gardenPath + '/items', owner, 'POST', { character_id: hero.id })),
      );
      assert.deepEqual(
        created.map((reply) => reply.status),
        [200, 200],
      );
      assert.equal(created[0].data.items.length, 2);
      assert.deepEqual(
        created[0].data.items.map((item: { id: string }) => item.id),
        created[1].data.items.map((item: { id: string }) => item.id),
      );
      assert.equal(
        (await request(gardenPath + '/items', other, 'POST', { character_id: hero.id })).status,
        404,
      );
      const scene = (await request('/house-v2/neighborhoods/' + plot.neighborhood_id, owner)).data;
      const current = scene.plots.find((item: { id: string }) => item.id === plot.id);
      const bed = created[0].data.items.find(
        (item: { garden_role: string }) => item.garden_role === 'bed',
      );
      const layout = {
        revision: current.revision,
        house: { x: current.house_x, y: current.house_y, rotation: current.house_rotation },
        items: [{ id: bed.id, x: plot.x + 3, y: plot.y + 3, rotation: 37.5, scale: 1.2 }],
      };
      const path = '/house-v2/plots/' + plot.id + '/layout';
      assert.equal((await request(path, owner, 'PUT', layout)).status, 200);
      const updated = (await request('/house-v2/neighborhoods/' + plot.neighborhood_id, owner))
        .data;
      const placed = updated.items.find((item: { id: string }) => item.id === bed.id);
      assert.equal(placed.rotation, 37.5);
      assert.equal(placed.scale, 1.2);
      assert.equal(placed.garden_role, 'bed');
      layout.revision++;
      layout.items[0].x = plot.x - 2;
      assert.equal((await request(path, owner, 'PUT', layout)).status, 400);
      layout.items[0].x = plot.x + 3;
      assert.equal((await request(path, other, 'PUT', layout)).status, 403);
    });
    await t.test('revisão do livro conserva imagens e anotações e aplica uma vez', async () => {
      const book = (await request('/rulebook', admin)).data;
      book.document.chapters[0].articles[0].summary = 'Resumo antigo para revisão.';
      const additions = [
        { id: 'nota-de-revisao', type: 'text', text: 'Anotação particular do administrador.' },
        { id: 'imagem-de-revisao', type: 'image', src: '/rules/rulebook-desk.webp', caption: 'Imagem já publicada.' },
      ];
      book.document.chapters[0].articles[0].blocks.push(...additions);
      const saved = await request('/rulebook', admin, 'PUT', { revision: book.revision, document: book.document });
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      await pool.query("DELETE FROM economy_settings_history WHERE version='site-rules-20261112' AND area='rulebook'");
      const { applyCurrentRulebook } = await import('../server/rulebook-update');
      await transaction(applyCurrentRulebook);
      const updated = (await request('/rulebook', admin)).data;
      for (const addition of additions)
        assert.deepEqual(updated.document.chapters[0].articles[0].blocks.find((block: {id:string}) => block.id === addition.id), addition);
      assert.notEqual(updated.document.chapters[0].articles[0].summary, 'Resumo antigo para revisão.');
      assert.equal(updated.revision, saved.data.revision + 1);
      await transaction(applyCurrentRulebook);
      assert.equal((await request('/rulebook', admin)).data.revision, updated.revision);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
