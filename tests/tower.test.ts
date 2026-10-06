import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { towerFloors, towerLootTable, towerBaseReward, towerTreasure } from '../shared/tower.js';
import { purchaseContents } from '../shared/armor-bundles.js';
test('Torre: cem andares, guardiões configuráveis e tesouros exaustivos e progressivos', () => {
  assert.equal(towerFloors.length, 100);
  assert.deepEqual(
    towerFloors.filter((f) => f.boss).map((f) => f.number),
    Array.from({ length: 20 }, (_, i) => (i + 1) * 5),
  );
  for (let tier = 0; tier <= 100; tier++) {
    const table = towerLootTable(tier);
    const counts = Array(5).fill(0);
    for (let roll = 1; roll <= 100; roll++) {
      const reward = towerTreasure(tier, roll);
      counts[table.indexOf(table.find((x) => x.min === reward.min)!)] += 1;
    }
    assert.deepEqual(counts, [50, 25, 15, 8, 2]);
    if (tier) assert.ok(table[4].gold_cp > towerLootTable(tier - 1)[4].gold_cp);
  }
  assert.deepEqual(towerBaseReward(5, [5]), { floor: 5, tier: 1, gold_cp: 7500, crystals: 18 });
  for (const roll of [0, 101, 1.5, NaN]) assert.throws(() => towerTreasure(0, roll));
  assert.throws(() => towerBaseReward(4, [5]));
  assert.throws(() => towerBaseReward(5, [5, 5]));
  assert.throws(() => towerBaseReward(101, []));
  assert.equal(towerBaseReward(100, [2, 5, 100]).tier, 3);
});
test('Torre: permissões, sequência, pagamento e d100 idempotentes em PostgreSQL isolado', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function request(path: string, who?: Account, method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: who?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: `tower-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
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
    const gm = await signup('Mestre'),
      player = await signup('Explorador'),
      other = await signup('Outro mestre');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=ANY($1::text[])', [
      [gm.id, other.id],
    ]);
    const hero = await createLegacyTestCharacter(player.id, 'Bruma'),
      outsider = await createLegacyTestCharacter(other.id, 'Vigia');
    const initial = hero.gold_cp;
    let run: any;
    const load = async () => {
      run = (await request('/tower', gm)).data.expeditions.find((r: any) => r.id === run.id);
      return run;
    };
    const progress = (action: string, extra = {}) =>
      request(`/tower/expeditions/${run.id}/progress`, gm, 'POST', {
        revision: run.revision,
        action,
        ...extra,
      });
    await t.test('conteúdo só para sessão e criação exclusiva de administrador', async () => {
      assert.equal((await request('/tower')).status, 401);
      assert.equal(
        (await request('/tower/expeditions', player, 'POST', { name: 'Uma subida' })).status,
        403,
      );
      assert.equal(
        (await request('/tower/expeditions', gm, 'POST', { name: 'Subida', reward_cp: 999999 }))
          .status,
        400,
      );
      const r = await request('/tower/expeditions', gm, 'POST', { name: 'Os que voltam' });
      assert.equal(r.status, 201);
      run = r.data;
      await load();
      assert.equal((await progress('start')).status, 409);
    });
    await t.test(
      'edição administrativa e sigilo real de criaturas/armadilhas antes da descoberta',
      async () => {
        const current = (await request('/tower', gm)).data.floors[0];
        const input = {
          revision: current.revision,
          name: 'Entrada velada',
          description: 'Uma entrada de pedra.',
          challenge: 'Desafio secreto!',
          hazard: 'Ambiente secreto!',
          traps: 'Armadilha secreta!',
          creatures: [{ name: 'Sentinela inédita', art: 'Skeleton' }],
          boss: false,
          boss_name: '',
          base_gold_cp: 4200,
          base_crystals: 7,
        };
        assert.equal((await request('/tower/floors/1', player, 'POST', input)).status, 403);
        assert.equal((await request('/tower/floors/1', gm, 'POST', input)).status, 200);
        assert.equal((await request('/tower/floors/1', gm, 'POST', input)).status, 409);
        assert.equal((await request('/tower/floors/101', gm, 'POST', input)).status, 400);
        const fresh = (await request('/tower', gm)).data.floors[0];
        assert.equal(
          (
            await request('/tower/floors/1', gm, 'POST', {
              ...input,
              revision: fresh.revision,
              creatures: [{ name: 'Algo', art: 'http://invalid.test/image' }],
            })
          ).status,
          400,
        );
        const hidden = (await request('/tower', player)).data;
        assert.equal(hidden.floors.length, 100);
        assert.equal(hidden.floors[0].name, 'Entrada velada');
        for (const key of ['creatures', 'traps', 'hazard', 'challenge', 'boss_name'])
          assert.equal(hidden.floors[0][key], null);
        for (const secret of [
          'Sentinela inédita',
          'Armadilha secreta!',
          'Ambiente secreto!',
          'Desafio secreto!',
        ])
          assert.ok(!JSON.stringify(hidden).includes(secret));
        assert.equal(fresh.creatures[0].name, 'Sentinela inédita');
      },
    );
    await t.test(
      'somente personagem próprio; inscrição repetida não duplica; uma subida por personagem',
      async () => {
        assert.equal(
          (
            await request(`/tower/expeditions/${run.id}/join`, other, 'POST', {
              character_id: hero.id,
            })
          ).status,
          404,
        );
        for (let i = 0; i < 2; i++)
          assert.equal(
            (
              await request(`/tower/expeditions/${run.id}/join`, player, 'POST', {
                character_id: hero.id,
              })
            ).status,
            200,
          );
        await load();
        assert.equal(run.members.length, 1);
        const second = await request('/tower/expeditions', gm, 'POST', { name: 'Outra subida' });
        assert.equal(
          (
            await request(`/tower/expeditions/${second.data.id}/join`, player, 'POST', {
              character_id: hero.id,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(`/tower/expeditions/${run.id}/treasure`, player, 'POST', {
              character_id: hero.id,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      'mestre dono controla sequência e precisa confirmar o guardião; revisões antigas falham',
      async () => {
        assert.equal(
          (
            await request(`/tower/expeditions/${run.id}/progress`, other, 'POST', {
              action: 'start',
              revision: run.revision,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request(`/tower/expeditions/${run.id}/progress`, player, 'POST', {
              action: 'start',
              revision: run.revision,
            })
          ).status,
          403,
        );
        assert.equal((await progress('start')).status, 200);
        assert.equal((await progress('clear')).status, 409);
        await load();
        assert.equal((await progress('finish')).status, 409);
        for (let floor = 1; floor <= 5; floor++) {
          if (floor === 5) assert.equal((await progress('clear')).status, 409);
          assert.equal((await progress('clear', { defeat_boss: floor === 5 })).status, 200);
          await load();
          assert.equal(run.cleared_floor, floor);
        }
        assert.deepEqual(run.bosses, [5]);
        const personal = (await request('/tower', player)).data.floors,
          guild = (await request('/tower', other)).data.floors;
        assert.equal(personal[0].discovery, 'personal');
        assert.equal(personal[0].creatures[0].name, 'Sentinela inédita');
        assert.equal(personal[0].traps, 'Armadilha secreta!');
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [other.id]);
        const shared = (await request('/tower', other)).data.floors;
        assert.equal(shared[0].discovery, 'guild');
        assert.equal(shared[5].discovery, 'hidden');
        assert.equal(shared[5].creatures, null);
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [other.id]);
        assert.equal((await progress('clear', { cleared_floor: 30 })).status, 400);
      },
    );
    await t.test(
      'conclusões concorrentes pagam apenas uma vez e não alteram missões/XP',
      async () => {
        const replies = await Promise.all([
          progress('finish', { summary: 'Voltaram do guardião.' }),
          progress('finish', { summary: 'Voltaram do guardião.' }),
        ]);
        assert.ok(replies.every((r) => r.status === 200));
        const c = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0];
        assert.equal(c.gold_cp, initial + 7500);
        assert.equal(c.progression_missions, hero.progression_missions);
        assert.equal(c.experience, hero.experience);
        assert.equal(
          Number(
            (await pool.query('SELECT count(*) FROM tower_claims WHERE character_id=$1', [hero.id]))
              .rows[0].count,
          ),
          1,
        );
        assert.equal(
          (await pool.query('SELECT crystals FROM tower_wallets WHERE character_id=$1', [hero.id]))
            .rows[0].crystals,
          18,
        );
        await load();
        assert.equal(run.status, 'completed');
      },
    );
    await t.test(
      'd100 real, bônus e relíquia únicos sob concorrência; sem resultado/saldo do cliente',
      async () => {
        assert.equal(
          (
            await request(`/tower/expeditions/${run.id}/treasure`, other, 'POST', {
              character_id: hero.id,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request(`/tower/expeditions/${run.id}/treasure`, player, 'POST', {
              character_id: hero.id,
              roll: 100,
            })
          ).status,
          400,
        );
        const rewards = await Promise.all(
          Array.from({ length: 8 }, () =>
            request(`/tower/expeditions/${run.id}/treasure`, player, 'POST', {
              character_id: hero.id,
            }),
          ),
        );
        assert.ok(rewards.every((r) => r.status === 200));
        assert.ok(rewards.every((r) => r.data.roll === rewards[0].data.roll));
        const claim = rewards[0].data,
          expected = towerTreasure(1, claim.roll);
        assert.equal(claim.relic, expected.relic);
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
            .gold_cp,
          initial + 7500 + expected.gold_cp,
        );
        assert.equal(
          (await pool.query('SELECT crystals FROM tower_wallets WHERE character_id=$1', [hero.id]))
            .rows[0].crystals,
          18 + expected.crystals,
        );
        const privateState = (await request('/tower', other)).data;
        assert.deepEqual(privateState.claims, []);
        assert.deepEqual(privateState.wallets, []);
      },
    );
    await t.test(
      'prêmios editáveis com catálogo, snapshot de retorno e itens idempotentes no inventário',
      async () => {
        const state = (await request('/tower', gm)).data,
          table = state.reward_tables[0];
        const row = {
          min: 1,
          max: 100,
          rarity: 'Especial',
          relic: 'Armadura da exploração',
          gold_cp: 12300,
          crystals: 11,
          item_id: 'plate-armor',
          quantity: 2,
        };
        assert.equal(
          (
            await request('/tower/rewards/0', player, 'POST', {
              revision: table.revision,
              rows: [row],
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request('/tower/rewards/0', gm, 'POST', {
              revision: table.revision,
              rows: [{ ...row, min: 2 }],
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request('/tower/rewards/0', gm, 'POST', {
              revision: table.revision,
              rows: [{ ...row, item_id: 'inventado' }],
            })
          ).status,
          400,
        );
        assert.equal(
          (await request('/tower/rewards/0', gm, 'POST', { revision: table.revision, rows: [row] }))
            .status,
          200,
        );
        assert.equal(
          (await request('/tower/rewards/0', gm, 'POST', { revision: table.revision, rows: [row] }))
            .status,
          409,
        );
        const made = (await request('/tower/expeditions', gm, 'POST', { name: 'Itens da torre' }))
          .data;
        await request('/tower/expeditions/' + made.id + '/join', player, 'POST', {
          character_id: hero.id,
        });
        const step = async (action: string) => {
          const r = (await request('/tower', gm)).data.expeditions.find(
            (r: any) => r.id === made.id,
          );
          assert.equal(
            (
              await request('/tower/expeditions/' + made.id + '/progress', gm, 'POST', {
                revision: r.revision,
                action,
              })
            ).status,
            200,
          );
        };
        await step('start');
        await step('clear');
        const goldBefore = (
          await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])
        ).rows[0].gold_cp;
        await step('finish');
        const pending = (await request('/tower', player)).data.claims.find(
          (c: any) => c.run_id === made.id,
        );
        assert.equal(pending.base_gold_cp, 4200);
        assert.equal(pending.base_crystals, 7);
        const latest = (await request('/tower', gm)).data.reward_tables[0];
        await request('/tower/rewards/0', gm, 'POST', {
          revision: latest.revision,
          rows: [{ ...row, gold_cp: 99999, quantity: 9 }],
        });
        const before = new Map(
          (
            await pool.query('SELECT item_id,quantity FROM inventory WHERE character_id=$1', [
              hero.id,
            ])
          ).rows.map((r) => [r.item_id, r.quantity]),
        );
        const replies = await Promise.all(
          Array.from({ length: 8 }, () =>
            request('/tower/expeditions/' + made.id + '/treasure', player, 'POST', {
              character_id: hero.id,
            }),
          ),
        );
        assert.ok(
          replies.every(
            (r) =>
              r.status === 200 &&
              r.data.item_id === 'plate-armor' &&
              r.data.item_quantity === 2 &&
              r.data.bonus_gold_cp === 12300,
          ),
        );
        for (const item of purchaseContents('plate-armor'))
          assert.equal(
            (
              await pool.query(
                'SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',
                [hero.id, item],
              )
            ).rows[0].quantity,
            (before.get(item) || 0) + 2,
          );
        assert.equal(
          (
            await pool.query('SELECT count(*)::int AS n FROM tower_item_grants WHERE run_id=$1', [
              made.id,
            ])
          ).rows[0].n,
          purchaseContents('plate-armor').length,
        );
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
            .gold_cp,
          goldBefore + 4200 + 12300,
        );
        const claim = (await request('/tower', player)).data.claims.find(
          (c: any) => c.run_id === made.id,
        );
        assert.equal(claim.item.id, 'plate-armor');
        assert.ok(claim.item.description);
        assert.ok(claim.item.image_path);
      },
    );
    await t.test('andar 100, guardião fora do intervalo padrão e limite persistente', async () => {
      const made = (await request('/tower/expeditions', gm, 'POST', { name: 'Coroa da torre' }))
        .data;
      await request('/tower/expeditions/' + made.id + '/join', player, 'POST', {
        character_id: hero.id,
      });
      await pool.query(
        "UPDATE tower_expeditions SET status='active',cleared_floor=98,bosses=$2 WHERE id=$1",
        [made.id, JSON.stringify(Array.from({ length: 19 }, (_, i) => (i + 1) * 5))],
      );
      const floor99 = (await request('/tower', gm)).data.floors[98];
      await request('/tower/floors/99', gm, 'POST', {
        ...floor99,
        discovery: undefined,
        number: undefined,
        boss: true,
        boss_name: 'O guardião escolhido',
        creatures: [],
        traps: '',
        challenge: '',
        hazard: '',
      });
      let r = (await request('/tower', gm)).data.expeditions.find((r: any) => r.id === made.id);
      assert.equal(
        (
          await request('/tower/expeditions/' + made.id + '/progress', gm, 'POST', {
            revision: r.revision,
            action: 'clear',
          })
        ).status,
        409,
      );
      for (const floor of [99, 100]) {
        assert.equal(
          (
            await request('/tower/expeditions/' + made.id + '/progress', gm, 'POST', {
              revision: r.revision,
              action: 'clear',
              defeat_boss: true,
            })
          ).status,
          200,
        );
        r = (await request('/tower', gm)).data.expeditions.find((r: any) => r.id === made.id);
        assert.equal(r.cleared_floor, floor);
      }
      assert.equal(
        (
          await request('/tower/expeditions/' + made.id + '/progress', gm, 'POST', {
            revision: r.revision,
            action: 'clear',
            defeat_boss: true,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request('/tower/expeditions/' + made.id + '/progress', gm, 'POST', {
            revision: r.revision,
            action: 'finish',
          })
        ).status,
        200,
      );
      const claim = (await request('/tower', player)).data.claims.find(
        (c: any) => c.run_id === made.id,
      );
      assert.equal(claim.floor, 100);
      assert.equal(claim.tier, 21);
    });
    await t.test('cancelamento não paga; revogação administrativa vale imediatamente', async () => {
      const created = (
        await request('/tower/expeditions', other, 'POST', { name: 'Sem recompensa' })
      ).data;
      await request(`/tower/expeditions/${created.id}/join`, other, 'POST', {
        character_id: outsider.id,
      });
      const r = (await request('/tower', other)).data.expeditions.find(
        (r: any) => r.id === created.id,
      );
      assert.equal(
        (
          await request(`/tower/expeditions/${r.id}/progress`, other, 'POST', {
            action: 'cancel',
            revision: r.revision,
          })
        ).status,
        200,
      );
      assert.equal(
        (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [outsider.id])).rows[0]
          .gold_cp,
        outsider.gold_cp,
      );
      await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [gm.id]);
      assert.equal(
        (await request('/tower/expeditions', gm, 'POST', { name: 'Revogado' })).status,
        403,
      );
      assert.equal((await request('/tower', gm)).data.can_create, false);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
