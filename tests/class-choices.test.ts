import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { originFixture, legalAdvance, advanceFixture } from './advancement-fixtures.js';
import { levelPlan, validateAdvance } from '../shared/character-advancement.js';
import { deriveSheet, sheetAttacks, defaultChoices } from '../shared/character-sheet.js';
import { classFightingStyles } from '../shared/fighting-styles.js';
import { characterLimit } from '../shared/character-art.js';
import { MISSION_THRESHOLDS } from '../shared/progression.js';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { createLegacyTestCharacter, testArtImage, finishTestArt } from './character-fixtures.js';

test('melhoria usa exatamente dois pontos; talento substitui melhoria e respeita requisitos', () => {
  const f = originFixture('Guerreiro');
  for (let i = 2; i <= 3; i++)
    advanceFixture(f.character, f.choices, legalAdvance(f.character, f.choices));
  const next = legalAdvance(f.character, f.choices);
  assert.throws(() =>
    validateAdvance(f.character, f.choices, { ...next, boosts: [2, 2, 2, 2, 0, 0] }),
  );
  validateAdvance(f.character, f.choices, { ...next, boosts: [1, 1, 0, 0, 0, 0] });
  assert.throws(() => validateAdvance(f.character, f.choices, { ...next, feat: 'tough' }));
  next.feat = 'tough';
  next.boosts = [0, 0, 0, 0, 0, 0];
  const before = deriveSheet(f.character, f.choices).hp;
  const d = advanceFixture(f.character, f.choices, next);
  assert.equal(d.hp - before, 8 + 2 * 4);
  const feat = d.featureEntries.find((r) => r.title === 'Robusto' && r.category === 'feat');
  assert.equal(feat?.classLevel, 4);
  assert.match(feat!.source, /Guerreiro.*nível 4.*melhoria/);
  assert(
    d.featureEntries
      .filter((r) => r.category === 'class')
      .every((r) => r.className && r.classLevel),
  );
  assert.throws(() =>
    validateAdvance(f.character, f.choices, {
      ...legalAdvance(f.character, f.choices),
      feat: 'tough',
    }),
  );
});

test('troca de estilo segue nível de Guerreiro e remove o bônus antigo, inclusive no histórico', () => {
  const f = originFixture('Guerreiro');
  f.choices.options.style = ['Arquearia'];
  const before = sheetAttacks(
    f.character.race,
    f.character.class,
    f.character.stats,
    f.choices,
    ['Arco longo'],
    1,
  )[0].attack;
  const next = legalAdvance(f.character, f.choices);
  next.retrain = [{ kind: 'style', from: 'Arquearia', to: 'Defesa' }];
  const d = advanceFixture(f.character, f.choices, next);
  assert.deepEqual(classFightingStyles('Guerreiro', f.choices).Guerreiro, ['Defesa']);
  assert.equal(
    sheetAttacks(
      f.character.race,
      f.character.class,
      f.character.stats,
      f.choices,
      ['Arco longo'],
      2,
    )[0].attack,
    before - 2,
  );
  const style = d.featureEntries.find((r) => r.title === 'Defesa' && r.category === 'feat');
  assert.equal(style?.classLevel, 1);
  assert.match(style!.description, /nível 2/);
  const multi = legalAdvance(f.character, f.choices, 'Mago');
  assert(!levelPlan(f.character, f.choices, multi).retraining.some((r) => r.kind === 'style'));
  assert.throws(() =>
    validateAdvance(f.character, f.choices, {
      ...multi,
      retrain: [{ kind: 'style', from: 'Defesa', to: 'Arquearia' }],
    }),
  );
  advanceFixture(f.character, f.choices, legalAdvance(f.character, f.choices));
  const feat = legalAdvance(f.character, f.choices);
  feat.feat = 'grappler';
  feat.boosts = [1, 0, 0, 0, 0, 0];
  validateAdvance(f.character, f.choices, feat);
  assert.throws(() =>
    validateAdvance(f.character, f.choices, { ...feat, boosts: [2, 0, 0, 0, 0, 0] }),
  );
  assert.throws(() =>
    validateAdvance(f.character, f.choices, { ...feat, boosts: [0, 0, 1, 0, 0, 0] }),
  );
});

test('capacidade de personagens acompanha privilégio atual', () => {
  assert.equal(characterLimit(false), 2);
  assert.equal(characterLimit(true), 4);
});

test('API: concessões ADM creditam mínimo, estilo é idempotente, recursos são protegidos e backfill preserva recompensas', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app.js'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  let cookie = '',
    user = '';
  async function req(path: string, body?: unknown) {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  try {
    const signup = await req('/auth/sign-up/email', {
      name: 'Escolhas',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(signup.status, 200);
    user = signup.data.user.id;
    cookie = signup.headers
      .getSetCookie()
      .map((s) => s.split(';')[0])
      .join('; ');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user]);
    const hero = await createLegacyTestCharacter(user),
      f = originFixture('Guerreiro');
    f.choices.options.style = ['Arquearia'];
    const d = deriveSheet(f.character, f.choices);
    await pool.query(
      'UPDATE characters SET race=$2,class=$3,stats=$4,hp=$5,armor_class=$6,gold_cp=9876 WHERE id=$1',
      [
        hero.id,
        f.character.race,
        f.character.class,
        JSON.stringify(f.character.stats),
        d.hp,
        d.armorClass,
      ],
    );
    await pool.query(
      'INSERT INTO character_sheets(character_id,choices,finalized_at,current_hp,rolls,assignment)VALUES($1,$2,now(),$3,$4,$5)',
      [
        hero.id,
        JSON.stringify(f.choices),
        d.hp,
        JSON.stringify(Array(6).fill([4, 4, 4, 4])),
        JSON.stringify([0, 1, 2, 3, 4, 5]),
      ],
    );
    const path = `/characters/${hero.id}/sheet`,
      style = { classLevel: 1, from: 'Arquearia', to: 'Defesa', requestId: randomUUID() };
    for (const r of await Promise.all([
      req(path + '/fighting-style', style),
      req(path + '/fighting-style', style),
    ]))
      assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(
      (await req(path + '/fighting-style', { ...style, to: 'Proteção', requestId: randomUUID() }))
        .status,
      409,
    );
    for (let lv = 2; lv <= 4; lv++) {
      const current = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0],
        sheet = (await req(path)).data.sheet;
      const body = {
        expectedLevel: lv - 1,
        grant: true,
        requestId: randomUUID(),
        choice: legalAdvance(current, sheet.choices),
      };
      const results = await Promise.all([
        req(path + '/advance', body),
        req(path + '/advance', body),
      ]);
      results.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
      const saved = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0];
      assert.equal(saved.progression_missions, MISSION_THRESHOLDS[lv - 1]);
      assert.equal(saved.gold_cp, 9876);
    }
    await pool.query('UPDATE characters SET progression_missions=100 WHERE id=$1', [hero.id]);
    const current = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0],
      sheet = (await req(path)).data.sheet;
    assert.equal(
      (
        await req(path + '/advance', {
          expectedLevel: 4,
          grant: true,
          requestId: randomUUID(),
          choice: legalAdvance(current, sheet.choices),
        })
      ).status,
      200,
    );
    assert.equal(
      (await pool.query('SELECT progression_missions FROM characters WHERE id=$1', [hero.id]))
        .rows[0].progression_missions,
      100,
    );
    assert.equal(
      (
        await pool.query('SELECT count(*)::int n FROM mission_rewards WHERE character_id=$1', [
          hero.id,
        ])
      ).rows[0].n,
      0,
    );
    await pool.query('UPDATE characters SET progression_missions=0 WHERE id=$1', [hero.id]);
    const migration = await readFile('db/migrations/106_admin_level_mission_credits.sql', 'utf8');
    await pool.query(migration);
    await pool.query(migration);
    assert.equal(
      (await pool.query('SELECT progression_missions FROM characters WHERE id=$1', [hero.id]))
        .rows[0].progression_missions,
      MISSION_THRESHOLDS[4],
    );
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user]);
    const state = { prepared: [], notes: 'Anotação', inspiration: false, slots_used: 0 };
    assert.equal((await req(path + '/state', { ...state, temp_hp: 99 })).status, 403);
    await pool.query(
      'UPDATE character_sheets SET current_hp=2,temp_hp=3,hit_dice_used=1 WHERE character_id=$1',
      [hero.id],
    );
    assert.equal((await req(path + '/state', state)).status, 200);
    const saved = (await req(path)).data;
    assert.equal(saved.sheet.current_hp, 2);
    assert.equal(saved.sheet.temp_hp, 3);
    assert.equal(saved.sheet.hit_dice_used, 1);
    assert.equal(saved.capabilities.can_manage_resources, false);
    assert.equal((await req(path + '/long-rest', {})).status, 403);
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user]);
    const rested = await req(path + '/long-rest', {});
    assert.equal(rested.status, 200);
    assert.equal(rested.data.sheet.current_hp, rested.data.derived.hp);
    assert.equal(rested.data.sheet.temp_hp, 0);
    assert.equal(rested.data.sheet.hit_dice_used, 0);
    await createLegacyTestCharacter(user, 'Segundo');
    await createLegacyTestCharacter(user, 'Terceiro');
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available)VALUES(true,now(),true)ON CONFLICT(id)DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const creation = {
        name: 'Quarto',
        race: 'Orc',
        class: 'Guerreiro',
        choices: defaultChoices('Orc', 'Guerreiro'),
      },
      reference = (await testArtImage()).toString('base64');
    const jobs = await Promise.all(
      Array.from({ length: 3 }, () =>
        req('/character-art', { creation, reference, idempotency_key: randomUUID() }),
      ),
    );
    assert.deepEqual(jobs.map((r) => r.status).sort(), [202, 409, 409]);
    assert.equal((await req('/character-art')).data.character_limit, 4);
    await finishTestArt(jobs.find((r) => r.status === 202)!.data.id);
    assert.equal((await req('/characters')).data.length, 4);
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user]);
    assert.equal((await req('/character-art')).data.character_limit, 2);
    assert.equal(
      (await req('/character-art', { creation, reference, idempotency_key: randomUUID() })).status,
      409,
    );
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user]);
    const celestial = originFixture('Bruxo');
    for (let lv = 2; lv <= 10; lv++)
      advanceFixture(
        celestial.character,
        celestial.choices,
        legalAdvance(celestial.character, celestial.choices, 'Bruxo', 'celestial'),
      );
    const cd = deriveSheet(celestial.character, celestial.choices);
    await pool.query('UPDATE characters SET class=$2,stats=$3,hp=$4,level=10 WHERE id=$1', [
      hero.id,
      'Bruxo',
      JSON.stringify(celestial.character.stats),
      cd.hp,
    ]);
    await pool.query('UPDATE character_sheets SET choices=$2,temp_hp=0 WHERE character_id=$1', [
      hero.id,
      JSON.stringify(celestial.choices),
    ]);
    const blessed = await req(path + '/long-rest', {});
    assert.equal(blessed.status, 200);
    assert.equal(blessed.data.sheet.temp_hp, 12);
    await pool.query('UPDATE character_sheets SET temp_hp=3 WHERE character_id=$1', [hero.id]);
    assert.equal((await req(path)).data.sheet.temp_hp, 3);
    assert.equal((await req(path + '/long-rest', {})).data.sheet.temp_hp, 12);
  } finally {
    if (user) await pool.query('DELETE FROM "user" WHERE id=$1', [user]);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
