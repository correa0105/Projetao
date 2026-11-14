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
        'X-Forwarded-For': '198.51.100.' + network,
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
      'todas as 25 profissões e 125 receitas produzem os itens corretos com suas etapas e prazos',
      async () => {
        assert.equal(professions.length, 25);
        assert.equal(craftRecipes.length, 125);
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
          for (const step of recipe.steps) {
            assert(validWorkshopInput(step, solve(step)));
            const result = await request('/professions/projects/' + p.id + '/steps', owner, {
              revision: p.revision,
              request_id: randomUUID(),
              input: solve(step),
            });
            assert.equal(result.status, 200, JSON.stringify(result.data));
            p = result.data;
          }
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
      'materiais de mesa ficam fora da loja e só o mestre atual pode conceder a participantes',
      async () => {
        const room = (
          await pool.query(
            'INSERT INTO vtt_rooms(owner_id,invite,document)VALUES($1,$2,$3)RETURNING id',
            [master.id, randomUUID(), JSON.stringify({ name: 'Jornada da oficina' })],
          )
        ).rows[0].id;
        await pool.query('INSERT INTO vtt_members(room_id,user_id)VALUES($1,$2)', [room, other.id]);
        const body = {
          room_id: room,
          character_id: visitor.id,
          material_id: materialItemId('hide'),
          quantity: 2,
          reason: 'Couro obtido na caçada da aventura.',
          request_id: randomUUID(),
        };
        assert.equal(
          (await request('/professions/rooms/' + room + '/characters', owner)).status,
          403,
        );
        assert.equal((await request('/professions/material-grants', owner, body)).status, 403);
        assert.equal(
          (
            await request('/professions/material-grants', master, {
              ...body,
              character_id: outsider.id,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request('/professions/material-grants', master, {
              ...body,
              material_id: 'potion-of-healing',
            })
          ).status,
          400,
        );
        const grants = await Promise.all([
          request('/professions/material-grants', master, body),
          request('/professions/material-grants', master, body),
        ]);
        assert(
          grants.every((r) => r.status === 200),
          JSON.stringify(grants),
        );
        assert.equal(grants[0].data.id, grants[1].data.id);
        assert.equal(await count(visitor.id, materialItemId('hide')), 2);
        assert.equal(
          (await request('/professions/material-grants', master, { ...body, quantity: 3 })).status,
          409,
        );
        await pool.query(
          "UPDATE vtt_members SET role='spectator' WHERE room_id=$1 AND user_id=$2",
          [room, other.id],
        );
        assert.equal(
          (
            await request('/professions/material-grants', master, {
              ...body,
              request_id: randomUUID(),
            })
          ).status,
          403,
        );
        const material = (
          await pool.query('SELECT active FROM catalog_items WHERE id=$1', [materialItemId('hide')])
        ).rows[0];
        assert.equal(material.active, false);
        const checkout = await request('/shop/checkout', owner, {
          character_id: hero.id,
          idempotency_key: randomUUID(),
          items: [{ item_id: materialItemId('hide'), quantity: 1 }],
        });
        assert.equal(checkout.status, 409);
        const before = await count(visitor.id, materialItemId('hide'));
        await seedProfessionCatalog(pool);
        assert.equal(await count(visitor.id, materialItemId('hide')), before);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM profession_material_grants WHERE actor_id=$1',
              [master.id],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(professionMaterials.length, 23);
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
            await request('/professions/projects/' + p.id + '/steps', admin, {
              revision: p.revision,
              request_id: randomUUID(),
              input: solve(p.recipe.steps[0]),
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
            await request('/professions/projects/' + p.id + '/steps', admin, {
              revision: p.revision,
              request_id: randomUUID(),
              input: solve(p.recipe.steps[0]),
            })
          ).status,
          403,
        );
        await pool.query(
          'UPDATE profession_administrator_access SET enabled=true WHERE user_id=$1',
          [admin.id],
        );
        for (const step of target.steps) {
          const r = await request('/professions/projects/' + p.id + '/steps', admin, {
            revision: p.revision,
            request_id: randomUUID(),
            input: solve(step),
          });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          p = r.data;
        }
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
        for (let step = 0; step < recipe.steps.length; step++) {
          const advanced = await Promise.all(
            projects.map((p, index) =>
              request('/professions/projects/' + p.id + '/steps', actors[index].who, {
                revision: step,
                request_id: randomUUID(),
                input: solve(recipe.steps[step]),
              }),
            ),
          );
          assert(advanced.every((r) => r.status === 200));
        }
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
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
    await pool.end();
  }
});
