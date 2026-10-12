import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { classes } from '../shared/rules.js';
import {
  classProfile,
  combinedSlots,
  multiclassReason,
  levelPlan,
  validateAdvance,
  subclassRules,
  defaultAdvanceChoice,
} from '../shared/character-advancement.js';
import { deriveSheet, spells, sheetAttacks } from '../shared/character-sheet.js';
import { featureNames } from '../shared/class-advancement-text.js';
import tables from '../shared/class-advancement-tables.json';
import { legalAdvance, advanceFixture, originFixture } from './advancement-fixtures.js';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

test('SRD: tabelas completas, escolhas até nível 20 e magias das subclasses', () => {
  for (const cls of classes) {
    assert.equal(tables.classes[cls].rows.length, 20);
    const { character, choices } = originFixture(cls);
    for (let level = 2; level <= 20; level++) {
      const d = advanceFixture(character, choices, legalAdvance(character, choices));
      assert.equal(d.classLevels[0].level, level);
      assert.equal(d.pendingLevels, 0);
      assert.ok(Number.isFinite(d.hp));
      for (const raw of classProfile(cls, level)
        .features.split(',')
        .map((s) => s.trim()))
        if (raw && raw !== '—' && !raw.includes('Subclass')) assert.ok(featureNames[raw], raw);
    }
    for (const sub of subclassRules[cls])
      for (const ids of Object.values(sub.spells || {}))
        for (const id of ids)
          assert.ok(
            spells.some((s) => s.id === id),
            id,
          );
  }
  assert.equal(spells.length, 338);
  assert.equal(new Set(spells.map((s) => s.id)).size, 338);
  assert.ok(
    spells.some((s) => s.id === 'fireball' && s.level === 3 && s.classes.includes('wizard')),
  );
});
test('multiclasse: PV médios, requisitos, círculos por classe, meio-conjurador e pacto separado', () => {
  const a = originFixture('Mago');
  const d = advanceFixture(
    a.character,
    a.choices,
    legalAdvance(a.character, a.choices, 'Guerreiro'),
  );
  assert.equal(d.hp, 16);
  assert.deepEqual(d.hitDiceByType, { d6: 1, d10: 1 });
  assert.equal(d.saves[0], 2);
  assert.ok(d.proficiencies.includes('Armas marciais'));
  assert.equal(
    sheetAttacks(
      a.character.race,
      a.character.class,
      a.character.stats,
      a.choices,
      ['Espada longa'],
      5,
    )[0].attack,
    5,
  );
  a.character.stats[3] = 12;
  assert.match(multiclassReason(a.character, a.choices, 'Paladino'), /Mago/);
  const b = originFixture('Mago');
  advanceFixture(b.character, b.choices, legalAdvance(b.character, b.choices));
  advanceFixture(b.character, b.choices, legalAdvance(b.character, b.choices, 'Paladino'));
  advanceFixture(b.character, b.choices, legalAdvance(b.character, b.choices, 'Patrulheiro'));
  assert.deepEqual(combinedSlots(b.character, b.choices), [4, 3, 0, 0, 0, 0, 0, 0, 0]);
  const p = levelPlan(b.character, b.choices, defaultAdvanceChoice('Mago'));
  assert.equal(p.profile.maxSpell, 2);
  assert.ok(!p.spellOptions.includes('fireball'));
  const c = originFixture('Mago');
  advanceFixture(c.character, c.choices, legalAdvance(c.character, c.choices, 'Bruxo'));
  assert.deepEqual(combinedSlots(c.character, c.choices), [2, 0, 0, 0, 0, 0, 0, 0, 0]);
  const m = deriveSheet(c.character, c.choices).magicClasses.find((m) => m.class === 'Bruxo')!;
  assert.equal(m.pactSlots, 1);
  assert.equal(m.pactLevel, 1);
});
test('evolução: Constituição retroativa, proficiência e escolha ilegal de magia/subclasse', () => {
  const a = originFixture('Guerreiro');
  for (let i = 2; i <= 5; i++)
    advanceFixture(a.character, a.choices, legalAdvance(a.character, a.choices));
  assert.equal(deriveSheet(a.character, a.choices).attacksPerAction, 2);
  const b = originFixture('Mago');
  for (let i = 2; i <= 3; i++)
    advanceFixture(b.character, b.choices, legalAdvance(b.character, b.choices));
  const next = legalAdvance(b.character, b.choices);
  next.boosts = [0, 0, 2, 0, 0, 0];
  const d = advanceFixture(b.character, b.choices, next);
  assert.equal(d.hp, 30);
  assert.equal(b.character.stats[2], 16);
  assert.equal(d.proficiency, 2);
  assert.throws(() =>
    validateAdvance(b.character, b.choices, {
      ...legalAdvance(b.character, b.choices),
      newSpells: ['wish', 'fireball'],
    }),
  );
  assert.throws(() =>
    validateAdvance(b.character, b.choices, {
      ...legalAdvance(b.character, b.choices),
      subclass: 'thief',
    }),
  );
});
test('API: admin vigente, ownership, idempotência, concorrência e preservação da origem/economia', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', body?: unknown) {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', {
      name: 'Evolução',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((s) => s.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup();
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [alice.id]);
    const hero = await createLegacyTestCharacter(alice.id),
      f = originFixture('Mago');
    Object.assign(hero, f.character);
    const initial = deriveSheet(hero, f.choices);
    await pool.query(
      'UPDATE characters SET race=$2,class=$3,stats=$4,hp=$5,armor_class=$6,gold_cp=45678,progression_missions=3 WHERE id=$1',
      [hero.id, hero.race, hero.class, JSON.stringify(hero.stats), initial.hp, initial.armorClass],
    );
    await pool.query(
      'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,current_hp,slots_used) VALUES($1,$2,$3,$4,now(),$5,1)',
      [
        hero.id,
        JSON.stringify({ ...f.choices, advancement: undefined }),
        JSON.stringify(Array(6).fill([4, 4, 4, 4])),
        JSON.stringify([0, 1, 2, 3, 4, 5]),
        initial.hp - 2,
      ],
    );
    const path = `/characters/${hero.id}/sheet`,
      before = (await req(path, alice.cookie)).data.sheet;
    function body() {
      return {
        expectedLevel: hero.level,
        requestId: randomUUID(),
        grant: true,
        choice: legalAdvance(hero, f.choices),
      };
    }
    assert.equal((await req(path + '/advance', '', body())).status, 401);
    assert.equal((await req(path + '/advance', bob.cookie, body())).status, 404);
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [alice.id]);
    assert.equal((await req(path, alice.cookie)).data.capabilities.can_grant_level, false);
    assert.equal((await req(path + '/advance', alice.cookie, body())).status, 403);
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [alice.id]);
    assert.equal(
      (await req(path + '/advance', alice.cookie, { ...body(), administrador: 1 })).status,
      400,
    );
    assert.equal(
      (
        await req(path + '/advance', alice.cookie, {
          ...body(),
          choice: { ...body().choice, level: 20 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req(path + '/advance', alice.cookie, {
          ...body(),
          choice: { ...body().choice, newSpells: ['wish', 'wish'] },
        })
      ).status,
      400,
    );
    const request = body(),
      responses = await Promise.all(
        Array.from({ length: 4 }, () => req(path + '/advance', alice.cookie, request)),
      );
    for (const r of responses) {
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.derived.classLevels[0].level, 2);
    }
    const persisted = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0];
    assert.equal(persisted.level, 2);
    assert.equal(persisted.gold_cp, 45678);
    assert.equal(persisted.progression_missions, 3);
    assert.deepEqual(persisted.stats, hero.stats);
    assert.equal(responses[0].data.sheet.current_hp, persisted.hp - 2);
    assert.equal(responses[0].data.sheet.choices.advancement.slotsUsed[0], 1);
    assert.deepEqual(responses[0].data.sheet.rolls, before.rolls);
    assert.deepEqual(responses[0].data.sheet.assignment, before.assignment);
    assert.equal(
      (
        await req(path + '/advance', alice.cookie, {
          ...request,
          choice: { ...request.choice, newSpells: ['shield', 'sleep'] },
        })
      ).status,
      409,
    );
    hero.level = 2;
    f.choices = responses[0].data.sheet.choices;
    const concurrent = await Promise.all(
      [body(), body()].map((b) => req(path + '/advance', alice.cookie, b)),
    );
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const response = concurrent.find((r) => r.status === 200)!.data;
    assert.equal(response.derived.classLevels[0].subclass, 'evoker');
    const chosen = response.derived.magicClasses[0].known.find(
      (id: string) => spells.find((s) => s.id === id)?.level === 2,
    );
    assert.ok(chosen);
    assert.equal(
      (
        await req(path + '/magic-state', alice.cookie, {
          prepared: { Mago: [chosen] },
          slotsUsed: [1, 1, 0, 0, 0, 0, 0, 0, 0],
          pactUsed: 0,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req(path + '/magic-state', alice.cookie, {
          prepared: { Mago: ['wish'] },
          slotsUsed: Array(9).fill(0),
          pactUsed: 0,
        })
      ).status,
      400,
    );
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [alice.id]);
    hero.level = 3;
    f.choices = response.sheet.choices;
    assert.equal((await req(path + '/advance', alice.cookie, body())).status, 403);
    assert.equal(
      (await req(path + '/advance', alice.cookie, { ...body(), grant: false })).status,
      409,
    );
    await pool.query('UPDATE characters SET level=4 WHERE id=$1', [hero.id]);
    hero.level = 4;
    const pending = await req(path + '/advance', alice.cookie, { ...body(), grant: false });
    assert.equal(pending.status, 200, JSON.stringify(pending.data));
    assert.equal(pending.data.derived.classLevels[0].level, 4);
    assert.equal(pending.data.derived.pendingLevels, 0);
    assert.equal(
      (await pool.query('SELECT level FROM characters WHERE id=$1', [hero.id])).rows[0].level,
      4,
    );
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [alice.id]);
    await pool.query('UPDATE characters SET level=20 WHERE id=$1', [hero.id]);
    assert.equal(
      (await req(path + '/advance', alice.cookie, { ...body(), expectedLevel: 20 })).status,
      409,
    );
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
      45678,
    );
    assert.equal(
      (
        await pool.query('SELECT count(*)::int n FROM mission_rewards WHERE character_id=$1', [
          hero.id,
        ])
      ).rows[0].n,
      0,
    );
  } finally {
    await new Promise<void>((r, e) => server.close((err) => (err ? e(err) : r())));
    await pool.end();
  }
});
