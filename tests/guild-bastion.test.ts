import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool, transaction } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { guildDocumentSchema } from '../shared/guilds';
import {
  bastionProgressionSchema,
  emptyBastionProgression,
  type BastionState,
} from '../shared/guild-bastion';
import { creditBastionCrystals, creditBastionMission } from '../server/guild-bastion';

test('bastião exige benefício base, níveis sequenciais e requisitos distintos válidos', () => {
  const p = emptyBastionProgression();
  assert(bastionProgressionSchema.safeParse(p).success);
  p.levels[1].enabled = true;
  p.levels[1].benefit = 'Benefício melhorado';
  assert(!bastionProgressionSchema.safeParse(p).success);
  p.levels[0].enabled = true;
  assert(!bastionProgressionSchema.safeParse(p).success);
  p.levels[0].benefit = 'Benefício inicial';
  assert(bastionProgressionSchema.safeParse(p).success);
  p.levels[1].requirements = [
    { kind: 'missions', target: 2 },
    { kind: 'missions', target: 5 },
  ];
  assert(!bastionProgressionSchema.safeParse(p).success);
  p.levels[1].requirements = [{ kind: 'tower_crystals', target: -1 }];
  assert(!bastionProgressionSchema.safeParse(p).success);
  p.levels[0].requirements = [{ kind: 'missions', target: 1 }];
  assert(!bastionProgressionSchema.safeParse(p).success);
});

test('bastião: metas cumulativas, benefícios por nível, revisão, sigilo e evolução transacional', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
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
    const signed =
      token +
      '.' +
      createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');
    return { id, cookie: 'better-auth.session_token=' + encodeURIComponent(signed) };
  }
  async function request(path: string, who?: Account, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: who?.cookie || '', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    const owner = await account('Fundador'),
      member = await account('Companheiro'),
      admin = await account('Administrador', true),
      outsider = await account('Visitante');
    const hero = await createLegacyTestCharacter(owner.id),
      guest = await createLegacyTestCharacter(member.id);
    const guildId = randomUUID(),
      tag = 'd70910aa-47e5-4884-a261-100000000001';
    await pool.query(
      'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,founding_cp,request_id) VALUES($1,$2,$3,50000,0,$4)',
      [
        guildId,
        owner.id,
        JSON.stringify(guildDocumentSchema.parse({ name: 'Bastião de teste' })),
        randomUUID(),
      ],
    );
    await pool.query(
      'INSERT INTO player_guild_members(guild_id,user_id,character_id) VALUES($1,$2,$3),($1,$4,$5)',
      [guildId, owner.id, hero.id, member.id, guest.id],
    );
    const root = '/guilds/' + guildId,
      upgrade = root + '/facilities/main/upgrade';
    const read = async (who = owner) =>
      (await request(root + '/bastion', who)).data as BastionState;
    await t.test(
      'níveis não configurados não cobram ouro nem evoluem; visitantes não recebem progresso privado',
      async () => {
        assert.equal((await request(root + '/bastion')).status, 401);
        assert.equal((await request(upgrade, owner, 'POST', { level: 2 })).status, 409);
        assert.equal((await read()).facilities[0].level, 1);
        assert.equal((await read()).facilities[0].benefit, null);
        assert.equal((await read(outsider)).progress_visible, false);
      },
    );
    let definition = (await request('/community/facilities', admin)).data.items.find(
      (f: any) => f.room === 'main',
    );
    const progression = emptyBastionProgression();
    progression.levels[0] = {
      level: 1,
      enabled: true,
      benefit: 'Benefício base aprovado para teste.',
      requirements: [],
    };
    progression.levels[1] = {
      level: 2,
      enabled: true,
      benefit: 'Benefício melhorado de teste.',
      requirements: [
        { kind: 'missions', target: 1 },
        { kind: 'monster_tag', tag_id: tag, target: 2 },
        { kind: 'tower_crystals', target: 10 },
        { kind: 'treasury', target: 10000 },
        { kind: 'custom', key: 'reliquias', label: 'Relíquias encontradas', target: 3 },
      ],
    };
    const { room, ...input } = definition;
    await t.test(
      'regras são administrativas, validadas e protegidas contra sobrescrita concorrente',
      async () => {
        assert.equal(
          (await request('/community/facilities/main', owner, 'PUT', { ...input, progression }))
            .status,
          403,
        );
        const invalid = structuredClone(progression);
        invalid.levels[1].requirements[1] = {
          kind: 'monster_tag',
          tag_id: randomUUID(),
          target: 2,
        };
        assert.equal(
          (
            await request('/community/facilities/main', admin, 'PUT', {
              ...input,
              progression: invalid,
            })
          ).status,
          400,
        );
        const replies = await Promise.all(
          [1, 2].map(() =>
            request('/community/facilities/main', admin, 'PUT', { ...input, progression }),
          ),
        );
        assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
        definition = replies.find((r) => r.status === 200)!.data;
        assert.equal((await read()).facilities[0].benefit, progression.levels[0].benefit);
        assert.equal((await request(upgrade, member, 'POST', { level: 2 })).status, 403);
        assert.equal((await request(upgrade, admin, 'POST', { level: 2 })).status, 403);
        assert.equal(
          (await request(upgrade, owner, 'POST', { level: 2, revision: definition.revision }))
            .status,
          409,
        );
      },
    );
    await t.test(
      'conquistas não duplicam, missão é única por companhia e tags contam por participante',
      async () => {
        const postId = randomUUID(),
          runId = randomUUID();
        await pool.query(
          'INSERT INTO character_tag_credits(post_id,character_id,tag_id) VALUES($1,$2,$4),($1,$3,$4)',
          [postId, hero.id, guest.id, tag],
        );
        await pool.query(
          'INSERT INTO character_tag_totals(character_id,tag_id,total) VALUES($1,$3,1),($2,$3,1)',
          [hero.id, guest.id, tag],
        );
        await pool.query('INSERT INTO tower_wallets(character_id,crystals) VALUES($1,777)', [
          hero.id,
        ]);
        for (let i = 0; i < 2; i++)
          await transaction(async (db) => {
            await creditBastionMission(db, postId, hero.id);
            await creditBastionMission(db, postId, guest.id);
            await creditBastionCrystals(db, runId, hero.id, 8, 'base');
            await creditBastionCrystals(db, runId, hero.id, 2, 'bonus');
          });
        const current = (await read()).facilities[0].next!;
        assert.deepEqual(
          current.requirements.map((r) => r.current),
          [1, 2, 10, 50000, 0],
        );
        assert.equal(
          (await read(outsider)).facilities[0].next!.requirements.every(
            (r) => r.current === 0 && !r.met,
          ),
          true,
        );
        await pool.query('DELETE FROM player_guild_members WHERE guild_id=$1 AND user_id=$2', [
          guildId,
          member.id,
        ]);
        assert.deepEqual(
          (await read()).facilities[0].next!.requirements.map((r) => r.current),
          [1, 2, 10, 50000, 0],
        );
        await assert.rejects(
          transaction(async (db) => {
            await creditBastionCrystals(db, randomUUID(), hero.id, 99, 'base');
            throw Error('rollback');
          }),
        );
        assert.equal((await read()).facilities[0].next!.requirements[2].current, 10);
      },
    );
    await t.test(
      'outros critérios exigem administrador atual, revisão e justificativa',
      async () => {
        const path = root + '/bastion/progress/reliquias',
          body = { value: 3, revision: 0, note: 'Três relíquias verificadas.' };
        assert.equal((await request(path, owner, 'PUT', body)).status, 403);
        assert.equal((await request(path, admin, 'PUT', { ...body, note: '' })).status, 400);
        assert.equal(
          (await request(root + '/bastion/progress/inexistente', admin, 'PUT', body)).status,
          400,
        );
        assert.equal((await request(path, admin, 'PUT', body)).status, 200);
        assert.equal((await request(path, admin, 'PUT', body)).status, 409);
        assert.equal((await read()).facilities[0].can_upgrade, true);
      },
    );
    await t.test(
      'evolução cumpre todas as metas, não consome tags/cristais e reenvio não duplica cobrança',
      async () => {
        assert.equal(
          (await request(upgrade, owner, 'POST', { level: 2, revision: definition.revision - 1 }))
            .status,
          409,
        );
        const replies = await Promise.all(
          [1, 2].map(() =>
            request(upgrade, owner, 'POST', { level: 2, revision: definition.revision }),
          ),
        );
        assert(replies.every((r) => r.status === 200));
        assert.equal(replies.filter((r) => r.data.replayed).length, 1);
        const current = (await read()).facilities[0];
        assert.equal(current.level, 2);
        assert.equal(current.benefit, progression.levels[1].benefit);
        assert.equal(
          Number(
            (await pool.query('SELECT treasury_cp FROM player_guilds WHERE id=$1', [guildId]))
              .rows[0].treasury_cp,
          ),
          40000,
        );
        assert.equal(
          (await pool.query('SELECT crystals FROM tower_wallets WHERE character_id=$1', [hero.id]))
            .rows[0].crystals,
          777,
        );
        assert.equal(
          Number(
            (
              await pool.query(
                'SELECT sum(total) AS total FROM character_tag_totals WHERE character_id=ANY($1::uuid[])',
                [[hero.id, guest.id]],
              )
            ).rows[0].total,
          ),
          2,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM player_guild_ledger WHERE guild_id=$1 AND reference='facility:main:2'",
              [guildId],
            )
          ).rowCount,
          1,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT 1 FROM guild_bastion_audit WHERE guild_id=$1 AND kind='upgrade'",
              [guildId],
            )
          ).rowCount,
          1,
        );
        assert.equal((await request(upgrade, owner, 'POST', { level: 3 })).status, 409);
        assert.equal((await request(upgrade, owner, 'POST', { level: 4 })).status, 409);
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
        assert.equal(
          (
            await request(root + '/bastion/progress/reliquias', admin, 'PUT', {
              value: 4,
              revision: 1,
              note: 'Outra verificação',
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'missão e Torre reais alimentam o bastião e a recuperação histórica não duplica créditos',
      async () => {
        const post = await request('/board', owner, 'POST', {
          kind: 'mission',
          title: 'Jornada do bastião',
          description: 'Conferência da integração real.',
          location: 'Norte',
          difficulty: 'Moderada',
          mission_rank: 'Ferro',
          starts_at: new Date(Date.now() + 3600000).toISOString(),
          tag_ids: [tag],
        });
        assert.equal(post.status, 201, JSON.stringify(post.data));
        const mission = '/board/' + post.data.id;
        assert.equal(
          (await request(mission + '/join', owner, 'POST', { character_id: hero.id })).status,
          200,
        );
        assert.equal((await request(mission, owner, 'PATCH', { status: 'active' })).status, 200);
        const completion = { summary: 'Jornada concluída.', rewards: [{ character_id: hero.id }] };
        assert.equal((await request(mission + '/complete', owner, 'POST', completion)).status, 200);
        assert.equal((await request(mission + '/complete', owner, 'POST', completion)).status, 409);
        const totals = async () =>
          Object.fromEntries(
            (
              await pool.query(
                'SELECT metric,sum(amount)::float8 AS total FROM guild_bastion_credits WHERE guild_id=$1 GROUP BY metric',
                [guildId],
              )
            ).rows.map((r) => [r.metric, r.total]),
          );
        assert.deepEqual(await totals(), { missions: 2, monster_tag: 3, tower_crystals: 10 });
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
        const expedition = await request('/tower/expeditions', admin, 'POST', {
          name: 'Subida do bastião',
        });
        assert.equal(expedition.status, 201);
        const runId = expedition.data.id,
          run = '/tower/expeditions/' + runId;
        assert.equal(
          (await request(run + '/join', owner, 'POST', { character_id: hero.id })).status,
          200,
        );
        for (const action of ['start', 'clear', 'finish']) {
          const revision = (
            await pool.query('SELECT revision FROM tower_expeditions WHERE id=$1', [runId])
          ).rows[0].revision;
          const response = await request(run + '/progress', admin, 'POST', { revision, action });
          assert.equal(response.status, 200, JSON.stringify(response.data));
        }
        const treasure = await request(run + '/treasure', owner, 'POST', { character_id: hero.id });
        assert.equal(treasure.status, 200);
        const expected = 10 + treasure.data.base_crystals + treasure.data.bonus_crystals;
        assert.equal((await totals()).tower_crystals, expected);
        assert.equal(
          (await request(run + '/treasure', owner, 'POST', { character_id: hero.id })).status,
          200,
        );
        assert.equal((await totals()).tower_crystals, expected);
        const sql = await readFile('db/migrations/136_guild_bastion_progression.sql', 'utf8');
        const inserts = sql.match(
          /INSERT INTO guild_bastion_credits[\s\S]*?ON CONFLICT DO NOTHING;/g,
        )!;
        assert.equal(inserts.length, 4);
        for (const statement of inserts) await pool.query(statement);
        assert.deepEqual(await totals(), { missions: 2, monster_tag: 3, tower_crystals: expected });
        await pool.query('DELETE FROM board_posts WHERE id=$1', [post.data.id]);
        assert.equal((await totals()).missions, 2);
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
