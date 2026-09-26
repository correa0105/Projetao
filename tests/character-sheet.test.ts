import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import {
  defaultChoices,
  validateChoices,
  deriveSheet,
  racialBonuses,
} from '../shared/character-sheet.js';
import { races, classes } from '../shared/rules.js';

test('ficha: escolhas válidas, bônus raciais e regras de nível 1', () => {
  for (const race of races)
    for (const cls of classes) validateChoices(race, cls, defaultChoices(race, cls));
  const c = defaultChoices('Halfling', 'Ladino');
  const stats = [10, 16, 14, 12, 13, 9];
  const d = deriveSheet({ race: 'Halfling', class: 'Ladino', stats, level: 1 }, c);
  assert.equal(d.hp, 10);
  assert.equal(d.armorClass, 14);
  assert.equal(d.speed, 7.5);
  assert.equal(d.size, 'Pequeno');
  assert.deepEqual(racialBonuses('Halfling', c), [0, 2, 0, 0, 0, 1]);
  const elf = defaultChoices('Meio-elfo', 'Mago');
  assert.deepEqual(racialBonuses('Meio-elfo', elf), [1, 1, 0, 0, 0, 2]);
  assert.throws(() =>
    validateChoices('Halfling', 'Ladino', {
      ...c,
      classSkills: ['Arcanismo', 'Religião', 'Medicina', 'Natureza'],
    }),
  );
  assert.throws(() => validateChoices('Halfling', 'Ladino', { ...c, cantrips: ['fire-bolt'] }));
  assert.throws(() =>
    validateChoices('Halfling', 'Ladino', { ...c, options: { dragon: ['Ouro'] } }),
  );
  const cleric = defaultChoices('Anão', 'Clérigo');
  assert.equal(deriveSheet({ race: 'Anão', class: 'Clérigo', stats, level: 1 }, cleric).hp, 11);
});

test('ficha API: titularidade, rolagem única concorrente, distribuição definitiva e persistência', async () => {
  await migrate();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0],
    users: string[] = [];
  async function req(path: string, cookie = '', body?: unknown, customOrigin = origin) {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Origin: customOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', {
      name: 'Ficha teste',
      email: `sheet-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(r.status, 200);
    users.push(r.data.user.id);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup(),
      character = await createLegacyTestCharacter(alice.id),
      path = `/characters/${character.id}/sheet`;
    assert.equal((await req(path)).status, 401);
    assert.equal((await req(path, bob.cookie)).status, 404);
    assert.equal((await req(path, alice.cookie)).data.sheet, null);
    for (const suffix of ['choices', 'roll', 'finalize', 'state'])
      assert.equal(
        (
          await req(
            path + '/' + suffix,
            bob.cookie,
            suffix === 'finalize'
              ? { assignment: [0, 1, 2, 3, 4, 5] }
              : suffix === 'state'
                ? {
                    prepared: [],
                    notes: '',
                    current_hp: 1,
                    temp_hp: 0,
                    inspiration: false,
                    death_success: 0,
                    death_failure: 0,
                    slots_used: 0,
                    hit_dice_used: 0,
                  }
                : {},
          )
        ).status,
        404,
      );
    assert.equal((await req(path + '/roll', alice.cookie, {})).status, 409);
    const choices = defaultChoices(character.race, character.class);
    assert.equal(
      (await req(path + '/choices', alice.cookie, choices, 'https://evil.example')).status,
      403,
    );
    assert.equal(
      (await req(path + '/choices', alice.cookie, { ...choices, classSkills: ['bogus'] })).status,
      400,
    );
    assert.equal((await req(path + '/choices', alice.cookie, choices)).status, 200);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => req(path + '/roll', alice.cookie, {})),
    );
    const rolls = results[0].data.sheet.rolls;
    assert.equal(rolls.length, 6);
    for (const result of results) {
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.sheet.rolls, rolls);
    }
    for (const row of rolls) {
      assert.equal(row.length, 4);
      for (const n of row) assert.ok(Number.isInteger(n) && n >= 1 && n <= 6);
    }
    assert.equal((await req(path + '/choices', alice.cookie, choices)).status, 409);
    assert.equal(
      (await req(path + '/finalize', alice.cookie, { assignment: [0, 0, 0, 0, 0, 0] })).status,
      400,
    );
    const assignment = [5, 4, 3, 2, 1, 0];
    const done = await req(path + '/finalize', alice.cookie, {
      assignment,
      stats: [99, 99, 99, 99, 99, 99],
      hp: 999,
    });
    assert.equal(done.status, 200);
    const expected = assignment.map(
      (j, i) =>
        rolls[j].reduce((a: number, b: number) => a + b, 0) -
        Math.min(...rolls[j]) +
        racialBonuses(character.race, choices)[i],
    );
    const db = (await pool.query('SELECT * FROM characters WHERE id=$1', [character.id])).rows[0];
    assert.deepEqual(db.stats, expected);
    assert.equal(db.gold_cp, character.gold_cp);
    assert.equal(db.hp, done.data.derived.hp);
    assert.equal((await req(path + '/finalize', alice.cookie, { assignment })).status, 200);
    assert.equal(
      (await req(path + '/finalize', alice.cookie, { assignment: [0, 1, 2, 3, 4, 5] })).status,
      409,
    );
    const state = {
      prepared: [],
      notes: 'Anotação preservada',
      current_hp: 1,
      temp_hp: 2,
      inspiration: true,
      death_success: 1,
      death_failure: 0,
      slots_used: 0,
      hit_dice_used: 1,
    };
    assert.equal(
      (await req(path + '/state', alice.cookie, { ...state, current_hp: 999 })).status,
      400,
    );
    assert.equal((await req(path + '/state', alice.cookie, state)).status, 200);
    const reload = await req(path, alice.cookie);
    assert.equal(reload.data.sheet.notes, state.notes);
    assert.deepEqual(reload.data.sheet.rolls, rolls);
    await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1', [character.id]);
    assert.equal((await req(path, alice.cookie)).status, 404);
  } finally {
    if (users.length) await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
