import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { seedProfessionCatalog } from '../server/professions';
import { createLegacyTestCharacter } from './character-fixtures';
import { defaultChoices } from '../shared/character-sheet';
import {
  craftRecipes,
  professions,
  materialItemId,
  professionMaterials,
  validWorkshopInput,
  type WorkshopStep,
} from '../shared/professions';
import { purchaseContents } from '../shared/armor-bundles';
import { economyVersion } from '../shared/economy';
import { professionProgress } from '../shared/profession-progression';
import { newDocument, newToken } from '../shared/vtt';
import {
  defaultProfessionLootTables,
  materialOutcome,
  materialProbabilities,
  professionMaterialLevel,
  professionLootTable,
} from '../shared/profession-loot';
import { professionBuffs } from '../shared/profession-buffs';
import referencePrices from '../shared/profession-reference-prices.json';

test('oficinas: posse, proficiência, materiais reais, etapas, tempo, reenvios e entregas em mesa', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const app = createApp();
  app.set('trust proxy', 1);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((ok) => server.once('listening', ok));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const root = 'http://127.0.0.1:' + address.port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
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
  type Account = Awaited<ReturnType<typeof account>>;
  let network = 1;
  async function request(
    path: string,
    who?: Account,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await fetch(root + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Economy-Version': economyVersion,
        'X-Forwarded-For': '198.51.' + Math.floor(network / 250) + '.' + (network % 250),
        ...(who ? { Cookie: who.cookie } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  async function count(character: string, item: string) {
    return (
      (
        await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
          character,
          item,
        ])
      ).rows[0]?.quantity ?? 0
    );
  }
  async function stock(character: string, items: { item_id: string; quantity: number }[]) {
    for (const i of items)
      await pool.query(
        'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=excluded.quantity',
        [character, i.item_id, i.quantity],
      );
  }
  const solve = (s: WorkshopStep) => {
    if (s.kind === 'dial') return { value: s.target };
    if (s.kind === 'balance') return { ratios: s.target };
    if (s.kind === 'assembly') return { slots: s.target };
    if (s.kind === 'trace')
      return {
        path: s.guide.flatMap((p, i) =>
          i === 0
            ? [p]
            : Array.from({ length: 8 }, (_, j) => ({
                x: s.guide[i - 1].x + ((p.x - s.guide[i - 1].x) * (j + 1)) / 8,
                y: s.guide[i - 1].y + ((p.y - s.guide[i - 1].y) * (j + 1)) / 8,
              })),
        ),
      };
    return { points: s.target };
  };
  try {
    const owner = await account('Artesão'),
      other = await account('Visitante'),
      master = await account('Mestre'),
      stranger = await account('Fora da mesa');
    const hero = await createLegacyTestCharacter(owner.id),
      visitor = await createLegacyTestCharacter(other.id),
      outsider = await createLegacyTestCharacter(stranger.id);
    const choices = defaultChoices(hero.race, hero.class);
    await pool.query(
      'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at)VALUES($1,$2,$3,$4,now())',
      [
        hero.id,
        JSON.stringify(choices),
        JSON.stringify(Array.from({ length: 6 }, () => [4, 4, 4, 4])),
        JSON.stringify([0, 1, 2, 3, 4, 5]),
      ],
    );
    const recipe = craftRecipes.find((r) => r.id === 'herbalism-healing')!;
    const body = { character_id: hero.id, recipe_id: recipe.id, request_id: randomUUID() };
    await t.test(
      'somente o dono e uma ficha concluída com a proficiência podem produzir',
      async () => {
        assert.equal((await request('/professions')).status, 401);
        assert.equal((await request('/professions?character_id=' + hero.id, other)).status, 404);
        assert.equal((await request('/professions/projects', other, body)).status, 404);
        assert.equal((await request('/professions/projects', owner, body)).status, 403);
        await pool.query('UPDATE characters SET sheet_overrides=$2 WHERE id=$1', [
          hero.id,
          JSON.stringify({ proficiencies: ['Kit de herbalismo'] }),
        ]);
        await pool.query('UPDATE character_sheets SET finalized_at=NULL WHERE character_id=$1', [
          hero.id,
        ]);
        assert.equal((await request('/professions/projects', owner, body)).status, 403);
        await pool.query('UPDATE character_sheets SET finalized_at=now() WHERE character_id=$1', [
          hero.id,
        ]);
        assert.equal(
          (
            await request('/professions/projects', owner, {
              ...body,
              output_item_id: 'potion-of-flying',
            })
          ).status,
          400,
        );
        assert.equal((await request('/professions/projects', owner, body)).status, 409);
      },
    );
    let project: any;
    await t.test(
      'consumo é atômico, não usa o cofre e não duplica em reenvios concorrentes',
      async () => {
        await stock(hero.id, recipe.ingredients);
        await pool.query(
          "INSERT INTO character_equipment(character_id,slot,item_id)VALUES($1,'main_hand','vial')",
          [hero.id],
        );
        assert.equal((await request('/professions/projects', owner, body)).status, 409);
        for (const ingredient of recipe.ingredients)
          assert.equal(await count(hero.id, ingredient.item_id), ingredient.quantity);
        await pool.query('DELETE FROM character_equipment WHERE character_id=$1', [hero.id]);
        const started = await Promise.all([
          request('/professions/projects', owner, body),
          request('/professions/projects', owner, body),
        ]);
        assert(
          started.every((r) => r.status === 200),
          JSON.stringify(started),
        );
        assert.equal(started[0].data.id, started[1].data.id);
        project = started[0].data;
        assert.equal(
          new Date(project.ready_at).getTime() - new Date(project.created_at).getTime(),
          24 * 3600_000,
        );
        for (const ingredient of recipe.ingredients)
          assert.equal(await count(hero.id, ingredient.item_id), 0);
        assert.equal(
          (await request('/professions/projects', owner, { ...body, request_id: randomUUID() }))
            .status,
          409,
        );
        assert.equal(
          (
            await request('/professions/projects', owner, {
              ...body,
              recipe_id: 'herbalism-antitoxin',
            })
          ).status,
          409,
        );
        assert.equal(
          (await request('/professions/projects/' + project.id + '/collect', other, {})).status,
          404,
        );
        assert.equal(
          (await request('/professions/projects/' + project.id + '/collect', owner, {})).status,
          409,
        );
      },
    );
    await t.test(
      'as etapas não podem ser puladas, repetidas com outra resposta nem alteradas por terceiros',
      async () => {
        const path = '/professions/projects/' + project.id + '/steps';
        assert.equal(
          (
            await request(path, owner, {
              revision: 0,
              request_id: randomUUID(),
              input: { points: [0] },
            })
          ).status,
          400,
        );
        for (let index = 0; index < project.recipe.steps.length; index++) {
          const b = {
            revision: project.revision,
            request_id: randomUUID(),
            input: solve(project.recipe.steps[index]),
          };
          const result = await request(path, owner, b);
          assert.equal(result.status, 200, JSON.stringify(result.data));
          project = result.data;
          const replay = await request(path, owner, b);
          assert.equal(replay.status, 200);
          assert.equal(replay.data.step, index + 1);
          assert.equal((await request(path, owner, { ...b, input: { value: 3 } })).status, 409);
          if (index < project.recipe.steps.length - 1)
            assert.equal(
              (await request(path, owner, { ...b, request_id: randomUUID() })).status,
              409,
            );
        }
        assert.equal(
          (
            await request('/professions/projects/' + project.id + '/collect', owner, {
              ready_at: '2000-01-01',
            })
          ).status,
          400,
        );
        assert.equal(
          (await request('/professions/projects/' + project.id + '/collect', owner, {})).status,
          409,
        );
        await pool.query(
          "UPDATE profession_projects SET ready_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
          [project.id],
        );
        await pool.query('UPDATE characters SET sheet_overrides=$2 WHERE id=$1', [
          hero.id,
          JSON.stringify({ proficiencies: [] }),
        ]);
        assert.equal(
          (await request('/professions/projects/' + project.id + '/collect', owner, {})).status,
          403,
        );
        await pool.query('UPDATE characters SET sheet_overrides=$2 WHERE id=$1', [
          hero.id,
          JSON.stringify({ proficiencies: ['Kit de herbalismo'] }),
        ]);
        const collected = await Promise.all([
          request('/professions/projects/' + project.id + '/collect', owner, {}),
          request('/professions/projects/' + project.id + '/collect', owner, {}),
        ]);
        assert(collected.every((r) => r.status === 200));
        assert.equal(await count(hero.id, 'potion-of-healing'), 1);
      },
    );
    await t.test(
      'níveis liberam receitas e a experiência é concedida uma vez por criação',
      async () => {
        assert.equal(professionProgress(0).level, 1);
        assert.equal(professionProgress(40).level, 2);
        assert.equal(professionProgress(100).level, 3);
        assert.equal(professionProgress(2800).level, 10);
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT experience FROM character_profession_progress WHERE character_id=$1 AND profession_id='herbalism'",
                [hero.id],
              )
            ).rows[0].experience,
          ),
          20,
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM profession_experience_rewards WHERE project_id=$1',
              [project.id],
            )
          ).rows[0].n,
          1,
        );
        const advanced = craftRecipes.find(
          (r) => r.profession_id === 'herbalism' && r.required_level === 3,
        )!;
        await stock(hero.id, advanced.ingredients);
        const payload = { character_id: hero.id, recipe_id: advanced.id, request_id: randomUUID() };
        assert.equal((await request('/professions/projects', owner, payload)).status, 403);
        assert.equal(
          (await request('/professions/projects', owner, { ...payload, experience: 99999 })).status,
          400,
        );
        await pool.query(
          "UPDATE character_profession_progress SET experience=100 WHERE character_id=$1 AND profession_id='herbalism'",
          [hero.id],
        );
        let response = await request('/professions/projects', owner, payload);
        assert.equal(response.status, 200, JSON.stringify(response.data));
        let p = response.data;
        for (const step of advanced.steps) {
          response = await request('/professions/projects/' + p.id + '/steps', owner, {
            revision: p.revision,
            request_id: randomUUID(),
            input: solve(step),
          });
          assert.equal(response.status, 200, JSON.stringify(response.data));
          p = response.data;
        }
        await pool.query(
          "UPDATE profession_projects SET ready_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
          [p.id],
        );
        const results = await Promise.all([
          request('/professions/projects/' + p.id + '/collect', owner, {}),
          request('/professions/projects/' + p.id + '/collect', owner, {}),
        ]);
        assert(results.every((r) => r.status === 200));
        assert.equal(
          Number(
            (
              await pool.query(
                "SELECT experience FROM character_profession_progress WHERE character_id=$1 AND profession_id='herbalism'",
                [hero.id],
              )
            ).rows[0].experience,
          ),
          135,
        );
        const progress = (
          await request('/professions?character_id=' + hero.id, owner)
        ).data.progress.find((v: any) => v.profession_id === 'herbalism');
        assert.equal(progress.level, 3);
        assert.equal(progress.experience, 135);
      },
    );
    await t.test(
      'todas as 25 profissões e 618 receitas produzem automaticamente os itens corretos no prazo',
      async () => {
        assert.equal(professions.length, 25);
        assert.equal(craftRecipes.length, 618);
        await pool.query('UPDATE characters SET sheet_overrides=$2 WHERE id=$1', [
          hero.id,
          JSON.stringify({ proficiencies: professions.flatMap((p) => p.tools) }),
        ]);
        for (const p of professions)
          await pool.query(
            'INSERT INTO character_profession_progress(character_id,profession_id,experience)VALUES($1,$2,2800)ON CONFLICT(character_id,profession_id)DO UPDATE SET experience=2800',
            [hero.id, p.id],
          );
        for (const recipe of craftRecipes) {
          network++;
          await stock(hero.id, recipe.ingredients);
          const output = purchaseContents(recipe.output.item_id),
            before = await Promise.all(output.map((id) => count(hero.id, id)));
          const started = await request('/professions/projects', owner, {
            character_id: hero.id,
            recipe_id: recipe.id,
            request_id: randomUUID(),
          });
          assert.equal(started.status, 200, recipe.id + ': ' + JSON.stringify(started.data));
          let p = started.data;
          assert(
            Math.abs(
              new Date(p.ready_at).getTime() -
                new Date(p.created_at).getTime() -
                recipe.hours * 3600_000,
            ) < 10,
            recipe.id,
          );
          assert.equal(p.step, 0);
          await pool.query(
            "UPDATE profession_projects SET ready_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
            [p.id],
          );
          assert.equal(
            (await request('/professions/projects/' + p.id + '/collect', owner, {})).status,
            200,
          );
          for (let i = 0; i < output.length; i++)
            assert.equal(
              await count(hero.id, output[i]),
              before[i] + recipe.output.quantity,
              recipe.id + ': ' + output[i],
            );
        }
      },
    );
    await t.test(
      'produção automática e ajuda opcional: 30 minutos, intervalo de duas horas e reenvios',
      async () => {
        await stock(hero.id, recipe.ingredients);
        const before = await count(hero.id, 'potion-of-healing');
        const start = await request('/professions/projects', owner, {
          character_id: hero.id,
          recipe_id: recipe.id,
          request_id: randomUUID(),
        });
        assert.equal(start.status, 200);
        let p = start.data;
        assert.equal(p.step, 0);
        const path = '/professions/projects/' + p.id + '/assist';
        assert.equal((await request(path, other, { request_id: randomUUID() })).status, 404);
        assert.equal(
          (await request(path, owner, { request_id: randomUUID(), minutes: 900 })).status,
          400,
        );
        const keys = [randomUUID(), randomUUID()];
        const results = await Promise.all(
          keys.map((request_id) => request(path, owner, { request_id })),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        const accepted = results.findIndex((r) => r.status === 200),
          first = results[accepted].data;
        assert.equal(Date.parse(p.ready_at) - Date.parse(first.ready_at), 1800000);
        assert.equal(first.assist_count, 1);
        assert.equal(first.seconds_saved, 1800);
        assert.equal(
          (await request(path, owner, { request_id: keys[accepted] })).data.assist_count,
          1,
        );
        assert.equal((await request(path, owner, { request_id: randomUUID() })).status, 409);
        await pool.query(
          "UPDATE profession_projects SET last_assisted_at=clock_timestamp()-interval '2 hours'+interval '10 seconds' WHERE id=$1",
          [p.id],
        );
        assert.equal((await request(path, owner, { request_id: randomUUID() })).status, 409);
        await pool.query(
          "UPDATE profession_projects SET last_assisted_at=clock_timestamp()-interval '2 hours' WHERE id=$1",
          [p.id],
        );
        const second = await request(path, owner, { request_id: randomUUID() });
        assert.equal(second.status, 200);
        assert.equal(second.data.assist_count, 2);
        assert.equal(Date.parse(first.ready_at) - Date.parse(second.data.ready_at), 1800000);
        assert.equal(
          (await request('/professions/projects/' + p.id + '/collect', owner, {})).status,
          409,
        );
        await pool.query(
          "UPDATE profession_projects SET ready_at=clock_timestamp()+interval '10 minutes',last_assisted_at=clock_timestamp()-interval '2 hours' WHERE id=$1",
          [p.id],
        );
        const finish = await request(path, owner, { request_id: randomUUID() });
        assert.equal(finish.status, 200);
        assert.equal(finish.data.step, 0);
        assert(Date.parse(finish.data.ready_at) <= Date.now());
        const claims = await Promise.all([
          request('/professions/projects/' + p.id + '/collect', owner, {}),
          request('/professions/projects/' + p.id + '/collect', owner, {}),
        ]);
        assert(claims.every((r) => r.status === 200));
        assert.equal(await count(hero.id, 'potion-of-healing'), before + 1);
        assert.equal((await request(path, owner, { request_id: randomUUID() })).status, 409);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM profession_project_assists WHERE project_id=$1',
              [p.id],
            )
          ).rows[0].n,
          3,
        );
        for (const ingredient of recipe.ingredients)
          assert.equal(await count(hero.id, ingredient.item_id), 0);
        // A legacy project also completes with no preparation steps performed.
        await stock(hero.id, recipe.ingredients);
        p = (
          await request('/professions/projects', owner, {
            character_id: hero.id,
            recipe_id: recipe.id,
            request_id: randomUUID(),
          })
        ).data;
        await pool.query(
          "UPDATE profession_projects SET ready_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
          [p.id],
        );
        assert.equal(
          (await request('/professions/projects/' + p.id + '/collect', owner, {})).status,
          200,
        );
      },
    );
    await t.test(
      'materiais só são entregues pela conclusão do VTT e continuam fora da loja',
      async () => {
        const before = await count(visitor.id, materialItemId('hide'));
        assert.equal(
          (
            await request('/professions/material-grants', master, {
              character_id: visitor.id,
              material_id: materialItemId('hide'),
              quantity: 99,
            })
          ).status,
          410,
        );
        assert.equal(await count(visitor.id, materialItemId('hide')), before);
        assert.equal(
          (
            await pool.query('SELECT active FROM catalog_items WHERE id=$1', [
              materialItemId('hide'),
            ])
          ).rows[0].active,
          false,
        );
        assert.equal(
          (
            await request('/shop/checkout', owner, {
              character_id: hero.id,
              idempotency_key: randomUUID(),
              items: [{ item_id: materialItemId('hide'), quantity: 1 }],
            })
          ).status,
          409,
        );
        await seedProfessionCatalog(pool);
        assert.equal(await count(visitor.id, materialItemId('hide')), before);
        assert.equal(professionMaterials.length, 25);
      },
    );
    await t.test(
      'acesso ilimitado exige habilitação da conta e administrador global atual',
      async () => {
        network = 190;
        const admin = await account('Administrador de teste'),
          another = await account('Outro administrador'),
          scoped = await account('Admin VTT');
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=ANY($1::text[])', [
          [admin.id, another.id],
        ]);
        const c = await createLegacyTestCharacter(admin.id),
          otherHero = await createLegacyTestCharacter(another.id),
          scopedHero = await createLegacyTestCharacter(scoped.id);
        const target = craftRecipes.find(
          (r) => r.profession_id === 'smithing' && r.required_level === 10,
        )!;
        const b = { character_id: c.id, recipe_id: target.id, request_id: randomUUID() };
        assert.equal((await request('/professions/projects', admin, b)).status, 403);
        await pool.query(
          "INSERT INTO profession_administrator_access(user_id,enabled,granted_by,reason)VALUES($1,true,$1,'Solicitação explícita de teste')",
          [admin.id],
        );
        const state = (await request('/professions?character_id=' + c.id, admin)).data;
        assert.equal(state.capabilities.all_professions, true);
        assert.equal(state.capabilities.unlimited_materials, true);
        assert.equal(state.progress[0].level, 1);
        assert.equal(
          (await request('/professions?character_id=' + otherHero.id, another)).data.capabilities
            .all_professions,
          false,
        );
        await pool.query("INSERT INTO administrator_scopes(user_id,scope)VALUES($1,'vtt')", [
          scoped.id,
        ]);
        await pool.query(
          "INSERT INTO profession_administrator_access(user_id,enabled,granted_by,reason)VALUES($1,true,$1,'Teste de permissão por área')",
          [scoped.id],
        );
        assert.equal(
          (await request('/professions?character_id=' + scopedHero.id, scoped)).data.capabilities
            .unlimited_materials,
          false,
        );
        const basic = (
          await request('/professions?character_id=' + c.id, admin, undefined, {
            'X-Account-Preview': 'basic',
          })
        ).data;
        assert.equal(basic.capabilities.all_professions, false);
        const started = await request('/professions/projects', admin, b);
        assert.equal(started.status, 200, JSON.stringify(started.data));
        let p = started.data;
        assert.equal(p.materials_waived, true);
        for (const i of target.ingredients) assert.equal(await count(c.id, i.item_id), 0);
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
        assert.equal(
          (
            await request('/professions/projects/' + p.id + '/assist', admin, {
              request_id: randomUUID(),
            })
          ).status,
          403,
        );
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
        await pool.query(
          'UPDATE profession_administrator_access SET enabled=false WHERE user_id=$1',
          [admin.id],
        );
        assert.equal(
          (
            await request('/professions/projects/' + p.id + '/assist', admin, {
              request_id: randomUUID(),
            })
          ).status,
          403,
        );
        await pool.query(
          'UPDATE profession_administrator_access SET enabled=true WHERE user_id=$1',
          [admin.id],
        );

        assert.equal(
          (await request('/professions/projects/' + p.id + '/collect', admin, {})).status,
          409,
        );
        await pool.query(
          "UPDATE profession_projects SET ready_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
          [p.id],
        );
        assert.equal(
          (await request('/professions/projects/' + p.id + '/collect', admin, {})).status,
          200,
        );
        for (const id of purchaseContents(target.output.item_id))
          assert.equal(await count(c.id, id), 1);
        for (const i of target.ingredients) assert.equal(await count(c.id, i.item_id), 0);
      },
    );
    await t.test(
      'novas mecânicas rejeitam misturas incompletas, encaixes errados e traçados fora do molde',
      async () => {
        const steps = craftRecipes.flatMap((r) => r.steps);
        const mix = steps.find((s) => s.kind === 'balance')!;
        assert.equal(validWorkshopInput(mix, { ratios: [50, 30, 20] }), true);
        assert.equal(validWorkshopInput(mix, { ratios: [50, 30, 19] }), false);
        assert.equal(validWorkshopInput(mix, { ratios: [100, 0, 0] }), false);
        const assembly = steps.find((s) => s.kind === 'assembly')!;
        assert.equal(validWorkshopInput(assembly, solve(assembly)), true);
        assert.equal(validWorkshopInput(assembly, { slots: [0, 0, 0] }), false);
        const trace = steps.find((s) => s.kind === 'trace')!;
        assert.equal(validWorkshopInput(trace, solve(trace)), true);
        assert.equal(
          validWorkshopInput(trace, { path: Array.from({ length: 30 }, () => ({ x: 99, y: 99 })) }),
          false,
        );
        assert.equal(
          validWorkshopInput(trace, {
            path: [
              { x: 12, y: 72 },
              { x: 88, y: 28 },
            ],
          }),
          false,
        );
      },
    );
    await t.test(
      '60 sessões independentes criam e recolhem sem misturar materiais ou resultados',
      async () => {
        const actors: { who: Account; character: { id: string } }[] = [];
        for (let index = 0; index < 60; index++) {
          const who = await account('Ofício paralelo ' + index),
            c = await createLegacyTestCharacter(who.id);
          await pool.query('UPDATE characters SET sheet_overrides=$2 WHERE id=$1', [
            c.id,
            JSON.stringify({ proficiencies: ['Kit de herbalismo'] }),
          ]);
          await pool.query(
            'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at)VALUES($1,$2,$3,$4,now())',
            [
              c.id,
              JSON.stringify(choices),
              JSON.stringify(Array.from({ length: 6 }, () => [4, 4, 4, 4])),
              JSON.stringify([0, 1, 2, 3, 4, 5]),
            ],
          );
          await stock(c.id, recipe.ingredients);
          actors.push({ who, character: c });
        }
        network = 100;
        const started = await Promise.all(
          actors.map((a) =>
            request('/professions/projects', a.who, {
              character_id: a.character.id,
              recipe_id: recipe.id,
              request_id: randomUUID(),
            }),
          ),
        );
        assert(
          started.every((r) => r.status === 200),
          JSON.stringify(started.filter((r) => r.status !== 200)),
        );
        const projects = started.map((r) => r.data);
        network = 101;

        await pool.query(
          "UPDATE profession_projects SET ready_at=clock_timestamp()-interval '1 minute' WHERE character_id=ANY($1::uuid[])",
          [actors.map((a) => a.character.id)],
        );
        network = 102;
        const collected = await Promise.all(
          projects.map((p, index) =>
            request('/professions/projects/' + p.id + '/collect', actors[index].who, {}),
          ),
        );
        assert(collected.every((r) => r.status === 200));
        for (const a of actors) {
          assert.equal(await count(a.character.id, 'potion-of-healing'), 1);
          for (const i of recipe.ingredients)
            assert.equal(await count(a.character.id, i.item_id), 0);
        }
      },
    );
    await t.test('raridade, níveis, bônus ×2 e custo das receitas são coerentes', async () => {
      const tables = defaultProfessionLootTables();
      assert.equal(tables.length, 100);
      assert.equal(professionBuffs.length, 48);
      for (const table of tables) {
        const probabilities = materialProbabilities(table.entries);
        assert.equal(
          probabilities.reduce((n, e) => n + e.chance, 0),
          100,
        );
        for (const e of table.entries)
          assert(professionMaterialLevel(table.profession_id, e.item_id) <= table.min_level);
        for (let value = 91; value <= 100; value++)
          assert.equal(materialOutcome(table.entries, value)?.multiplier, 2);
        for (let value = 1; value <= 90; value++)
          assert([undefined, 1].includes(materialOutcome(table.entries, value)?.multiplier));
        if (table.min_level > 1) {
          const previous = professionLootTable(
            tables,
            table.profession_id,
            table.min_level === 3 ? 1 : table.min_level === 6 ? 3 : 6,
          )!;
          for (const e of previous.entries) {
            const before = materialProbabilities(previous.entries)
              .filter((p) => p.item_id === e.item_id)
              .reduce((n, p) => n + p.chance * p.quantity, 0);
            const after = probabilities
              .filter((p) => p.item_id === e.item_id)
              .reduce((n, p) => n + p.chance * p.quantity, 0);
            assert(after >= before, table.profession_id + ' ' + table.min_level + ' ' + e.item_id);
          }
        }
      }
      for (const r of craftRecipes) {
        const price = (referencePrices as Record<string, number>)[r.output.item_id] ?? 0;
        if (price >= 1000000) {
          assert.equal(r.required_level, 10);
          assert(r.ingredients.some((i) => i.item_id === materialItemId('masterwork-core')));
        }
        if (price >= 100000)
          assert(r.ingredients.some((i) => i.item_id === materialItemId('rare-catalyst')));
      }
    });
    await t.test(
      'VTT: um d100 por inscrito, nível da profissão, ausentes e entrega somente na conclusão',
      async () => {
        network = 5000;
        await pool.query('UPDATE characters SET sheet_overrides=$2 WHERE id=$1', [
          visitor.id,
          JSON.stringify({ proficiencies: ['Kit de herbalismo'] }),
        ]);
        await pool.query(
          'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at)VALUES($1,$2,$3,$4,now())ON CONFLICT(character_id)DO UPDATE SET choices=excluded.choices,finalized_at=now()',
          [
            visitor.id,
            JSON.stringify(defaultChoices(visitor.race, visitor.class)),
            JSON.stringify(Array.from({ length: 6 }, () => [4, 4, 4, 4])),
            JSON.stringify([0, 1, 2, 3, 4, 5]),
          ],
        );
        const second = await createLegacyTestCharacter(owner.id, 'Outra ficha do mesmo jogador');
        const document = newDocument(randomUUID());
        const room = (
          await pool.query(
            'INSERT INTO vtt_rooms(owner_id,invite,document)VALUES($1,$2,$3)RETURNING id',
            [master.id, randomUUID(), JSON.stringify(document)],
          )
        ).rows[0].id;
        await pool.query(
          "INSERT INTO vtt_members(room_id,user_id,role)VALUES($1,$2,'player'),($1,$3,'player'),($1,$4,'spectator')",
          [room, owner.id, other.id, stranger.id],
        );
        const path = '/vtt/rooms/' + room + '/material-rewards';
        const tables = defaultProfessionLootTables().filter((t) =>
          ['herbalism', 'smithing'].includes(t.profession_id),
        );
        const payload = {
          request_id: randomUUID(),
          title: 'Caçada dos artesãos',
          mission_id: null,
          character_ids: [hero.id, second.id, visitor.id],
          tables,
        };
        assert.equal((await request(path, undefined)).status, 401);
        assert.equal((await request(path, owner, payload)).status, 403);
        assert.equal(
          (
            await request(path, master, {
              ...payload,
              tables: [
                {
                  profession_id: 'herbalism',
                  min_level: 1,
                  entries: [{ item_id: materialItemId('arcane'), chance: 1, quantity: 1 }],
                },
              ],
            })
          ).status,
          400,
        );
        const opened = await Promise.all([
          request(path, master, payload),
          request(path, master, payload),
        ]);
        assert(
          opened.every((r) => r.status === 200),
          JSON.stringify(opened),
        );
        assert.equal(opened[0].data.id, opened[1].data.id);
        const run = opened[0].data;
        assert.equal(run.roster.length, 2);
        assert.equal(
          (await request(path, master, { ...payload, title: 'Outra aventura' })).status,
          409,
        );
        assert.equal(
          (await request(path, master, { ...payload, request_id: randomUUID() })).status,
          409,
        );
        const rollPath = path + '/' + run.id + '/roll',
          b = {
            request_id: randomUUID(),
            player_id: other.id,
            character_id: visitor.id,
            profession_id: 'herbalism',
          };
        assert.equal((await request(rollPath, owner, b)).status, 403);
        assert.equal(
          (
            await request(rollPath, stranger, {
              ...b,
              player_id: stranger.id,
              character_id: outsider.id,
            })
          ).status,
          403,
        );
        assert.equal(
          (await request(rollPath, other, { ...b, profession_id: 'smithing' })).status,
          403,
        );
        assert.equal((await request(rollPath, other, { ...b, value: 100 })).status, 400);
        assert.equal((await request(path + '/presence', other, {})).status, 200);
        assert.equal((await request(path + '/presence', master, {})).status, 200);
        assert(
          (await pool.query('SELECT material_owner_seen_at FROM vtt_rooms WHERE id=$1', [room]))
            .rows[0].material_owner_seen_at,
        );
        assert.equal((await request(rollPath, master, b)).status, 409);
        const stockBefore = new Map(
          await Promise.all(
            professionMaterials.map(
              async ([id]) =>
                [materialItemId(id), await count(visitor.id, materialItemId(id))] as const,
            ),
          ),
        );
        const rolled = await Promise.all([
          request(rollPath, other, b),
          request(rollPath, other, { ...b, request_id: randomUUID() }),
        ]);
        assert.deepEqual(rolled.map((r) => r.status).sort(), [200, 409]);
        const result = rolled.find((r) => r.status === 200)!.data;
        assert.equal(result.profession_level, 1);
        assert.equal(result.table_level, 1);
        assert.equal(result.multiplier, result.value >= 91 ? 2 : 1);
        if (result.item_id) assert(professionMaterialLevel('herbalism', result.item_id) <= 1);
        assert.equal(
          (await request(rollPath, other, { ...b, request_id: result.request_id })).status,
          200,
        );
        for (const [id, n] of stockBefore) assert.equal(await count(visitor.id, id), n);
        assert.equal(
          (
            await request(path + '/' + run.id + '/complete', master, {
              summary: 'Os inscritos concluíram a caçada.',
            })
          ).status,
          409,
        );
        const ownBody = {
          request_id: randomUUID(),
          player_id: owner.id,
          character_id: hero.id,
          profession_id: 'smithing',
        };
        const ownRoll = await request(rollPath, master, ownBody);
        assert.equal(ownRoll.status, 200, JSON.stringify(ownRoll.data));
        const ownBefore = ownRoll.data.item_id ? await count(hero.id, ownRoll.data.item_id) : 0;
        assert.equal(
          (
            await request(rollPath, master, {
              ...ownBody,
              character_id: second.id,
              request_id: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(path + '/' + run.id + '/complete', other, {
              summary: 'Um jogador não pode concluir a mesa.',
            })
          ).status,
          403,
        );
        const completed = await Promise.all([
          request(path + '/' + run.id + '/complete', master, {
            summary: 'Os inscritos concluíram a caçada.',
          }),
          request(path + '/' + run.id + '/complete', master, {
            summary: 'Os inscritos concluíram a caçada.',
          }),
        ]);
        assert(
          completed.every((r) => r.status === 200),
          JSON.stringify(completed),
        );
        if (result.item_id)
          assert.equal(
            await count(visitor.id, result.item_id),
            stockBefore.get(result.item_id)! + result.quantity,
          );
        if (ownRoll.data.item_id)
          assert.equal(
            await count(hero.id, ownRoll.data.item_id),
            ownBefore + ownRoll.data.quantity,
          );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM vtt_table_conclusions WHERE reward_id=$1',
              [run.id],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM vtt_profession_reward_rolls WHERE reward_id=$1 AND granted_at IS NOT NULL',
              [run.id],
            )
          ).rows[0].n,
          2,
        );
        const messages = (
          await pool.query('SELECT roll FROM vtt_messages WHERE room_id=$1 AND roll IS NOT NULL', [
            room,
          ])
        ).rows;
        assert.equal(messages.length, 2);
        assert(messages.every((m) => m.roll.formula === '1d100'));
        // The same roster is derived from mission inscriptions, not from client recipients.
        const mission = (
          await pool.query(
            "INSERT INTO board_posts(author_id,kind,title,description,location,status,starts_at,mission_rank,difficulty,reward_cp)VALUES($1,'mission','Expedição de ofício','Uma expedição completa para os artesãos.','Teste','active',now(),'Ferro','Moderada',12500)RETURNING id",
            [master.id],
          )
        ).rows[0].id;
        await pool.query(
          'INSERT INTO mission_participants(post_id,character_id)VALUES($1,$2),($1,$3),($1,$4)',
          [mission, hero.id, second.id, visitor.id],
        );
        const linked = await request(path, master, {
          ...payload,
          request_id: randomUUID(),
          mission_id: mission,
          character_ids: [],
          title: 'Expedição de ofício',
        });
        assert.equal(linked.status, 200, JSON.stringify(linked.data));
        assert.equal(linked.data.roster.length, 2);
        const summary = {
          summary: 'A expedição foi concluída com todos os inscritos.',
          rewards: [hero.id, second.id, visitor.id].map((character_id) => ({ character_id })),
        };
        assert.equal(
          (await request('/board/' + mission + '/complete', master, summary)).status,
          409,
        );
        const goldBefore = (
          await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [visitor.id])
        ).rows[0].gold_cp;
        await pool.query(
          "UPDATE vtt_members SET last_seen_at=clock_timestamp()-interval '2 minutes' WHERE room_id=$1",
          [room],
        );
        for (const [who, cid, prof] of [
          [owner.id, hero.id, 'smithing'],
          [other.id, visitor.id, 'herbalism'],
        ])
          assert.equal(
            (
              await request(path + '/' + linked.data.id + '/roll', master, {
                request_id: randomUUID(),
                player_id: who,
                character_id: cid,
                profession_id: prof,
              })
            ).status,
            200,
          );
        assert.equal(
          (
            await request(path + '/' + linked.data.id + '/complete', master, {
              summary: summary.summary,
            })
          ).status,
          200,
        );
        assert.equal(
          (await pool.query('SELECT status FROM board_posts WHERE id=$1', [mission])).rows[0]
            .status,
          'completed',
        );
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [visitor.id])).rows[0]
            .gold_cp,
          goldBefore + 12500,
        );
        assert.equal(
          (
            await request(path, master, {
              ...payload,
              request_id: randomUUID(),
              mission_id: mission,
            })
          ).status,
          409,
        );
        await pool.query("UPDATE vtt_members SET role='player' WHERE room_id=$1 AND user_id=$2", [
          room,
          stranger.id,
        ]);
        const untrained = await request(path, master, {
          ...payload,
          request_id: randomUUID(),
          title: 'Aventura sem ofício habilitado',
          character_ids: [outsider.id],
        });
        assert.equal(untrained.status, 200);
        const noPrize = await request(path + '/' + untrained.data.id + '/roll', master, {
          request_id: randomUUID(),
          player_id: stranger.id,
          character_id: outsider.id,
          profession_id: 'no-profession',
        });
        assert.equal(noPrize.status, 200, JSON.stringify(noPrize.data));
        assert.equal(noPrize.data.item_id, null);
        assert.equal(noPrize.data.profession_level, 0);
        assert.equal(
          (
            await request(path + '/' + untrained.data.id + '/complete', master, {
              summary: 'Registrada a participação sem materiais habilitados.',
            })
          ).status,
          200,
        );
        // Consumable buffs use the existing real-inventory and resource ledger.
        const scene = document.scenes[0],
          token = newToken(randomUUID(), scene);
        token.characterId = visitor.id;
        token.controller = other.id;
        token.name = visitor.name;
        scene.tokens.push(token);
        await pool.query('UPDATE vtt_rooms SET document=$2 WHERE id=$1', [
          room,
          JSON.stringify(document),
        ]);
        await pool.query(
          'INSERT INTO vtt_character_links(room_id,character_id,imported_by)VALUES($1,$2,$3)',
          [room, visitor.id, other.id],
        );
        const sheetPath = '/vtt/rooms/' + room + '/sheets/' + token.id;
        const initial = (await request(sheetPath, other)).data;
        const baseSkill = initial.derived.skills.find((s: any) => s.name === 'Investigação').value;
        await stock(visitor.id, [
          { item_id: 'craft-support-calligraphy-3', quantity: 2 },
          { item_id: 'craft-support-calligraphy-6', quantity: 1 },
        ]);
        const use = {
          kind: 'consumable',
          item_id: 'craft-support-calligraphy-3',
          idempotency_key: randomUUID(),
        };
        assert.equal((await request(sheetPath + '/use', owner, use)).status, 403);
        const used = await Promise.all([
          request(sheetPath + '/use', other, use),
          request(sheetPath + '/use', other, use),
        ]);
        assert(
          used.every((r) => r.status === 200),
          JSON.stringify(used),
        );
        assert.equal(await count(visitor.id, use.item_id), 1);
        assert.equal(
          used[0].data.derived.skills.find((s: any) => s.name === 'Investigação').value,
          baseSkill + 1,
        );
        assert.equal(
          (
            await request(sheetPath + '/use', other, {
              kind: 'consumable',
              item_id: 'craft-support-calligraphy-6',
              idempotency_key: randomUUID(),
            })
          ).status,
          200,
        );
        const after = (await request(sheetPath, other)).data;
        assert.equal(after.profession_buffs.length, 1);
        assert.equal(
          after.derived.skills.find((s: any) => s.name === 'Investigação').value,
          baseSkill + 2,
        );
        const check = { skill: 'Investigação', request_id: randomUUID() };
        assert.equal(
          (await request(sheetPath + '/skill-check', other, { ...check, bonus: 99 })).status,
          400,
        );
        assert.equal((await request(sheetPath + '/skill-check', other, check)).status, 200);
        assert.equal((await request(sheetPath + '/skill-check', other, check)).status, 200);
        const recorded = (
          await pool.query('SELECT roll,skill_check FROM vtt_messages WHERE skill_check_key=$1', [
            check.request_id,
          ])
        ).rows;
        assert.equal(recorded.length, 1);
        assert.equal(recorded[0].skill_check.profession_bonus, 2);
        assert.equal(recorded[0].roll.total - recorded[0].roll.dice[0], baseSkill + 2);
        await pool.query(
          "UPDATE character_profession_buffs SET started_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 minute' WHERE character_id=$1",
          [visitor.id],
        );
        const expired = { ...check, request_id: randomUUID() };
        assert.equal((await request(sheetPath + '/skill-check', other, expired)).status, 200);
        assert.equal(
          (
            await pool.query('SELECT skill_check FROM vtt_messages WHERE skill_check_key=$1', [
              expired.request_id,
            ])
          ).rows[0].skill_check.profession_bonus,
          0,
        );
      },
    );
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
    await pool.end();
  }
});
