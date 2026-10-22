import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from '../server/db';
import { migrate } from '../server/migrate';
import { defaultChoices, deriveSheet, racialBonuses } from '../shared/character-sheet';
import { abilityRollResult } from '../shared/ability-rolls';
import { raiseCharacterAbilityFloor } from '../server/ability-roll-floor';
import { createLegacyTestCharacter } from './character-fixtures';

test('correção explícita: preserva dados, distribuição, bônus e outras fichas; ajusta PV sem reviver', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const port = (server.address() as { port: number }).port;
  const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
  let uid = '';
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mínimo de atributos',
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      }),
    });
    assert.equal(response.status, 200);
    uid = (await response.json()).user.id;
    const rolls = [
      [6, 3, 4, 4],
      [3, 1, 2, 1],
      [5, 4, 6, 1],
      [6, 3, 6, 1],
      [2, 1, 3, 5],
      [3, 5, 1, 5],
    ];
    const choices = defaultChoices('Elfo', 'Guerreiro'),
      assignment = [2, 3, 1, 0, 4, 5];
    const heroes: { id: string; name: string; stats: number[]; hp: number }[] = [];
    for (const name of ['Pendente', 'Finalizada', 'Caído', 'Preservada']) {
      const c = await createLegacyTestCharacter(uid, name);
      const stats = assignment.map(
        (r, i) => abilityRollResult(rolls[r], 0) + racialBonuses(c.race, choices)[i],
      );
      const derived = deriveSheet({ ...c, stats }, choices);
      await pool.query('UPDATE characters SET stats=$2,hp=$3,armor_class=$4 WHERE id=$1', [
        c.id,
        JSON.stringify(stats),
        derived.hp,
        derived.armorClass,
      ]);
      const finalized = name !== 'Pendente';
      await pool.query(
        'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,current_hp,notes,temp_hp)VALUES($1,$2,$3,$4,$5,$6,$7,2)',
        [
          c.id,
          JSON.stringify(choices),
          JSON.stringify(rolls),
          finalized ? JSON.stringify(assignment) : null,
          finalized ? new Date() : null,
          finalized ? (name === 'Caído' ? 0 : derived.hp - 3) : null,
          'Preservar anotações',
        ],
      );
      heroes.push({ ...c, stats, hp: derived.hp });
    }
    const snapshot = async (id: string) =>
      (
        await pool.query(
          'SELECT to_jsonb(c) AS c,to_jsonb(s) AS s FROM characters c JOIN character_sheets s ON s.character_id=c.id WHERE c.id=$1',
          [id],
        )
      ).rows[0];
    const untouched = await snapshot(heroes[3].id),
      pendingBefore = await snapshot(heroes[0].id);
    await assert.rejects(
      transaction((db) => raiseCharacterAbilityFloor(db, heroes[0].id, 'other-owner')),
      /não encontrada/,
    );
    const change = await transaction((db) => raiseCharacterAbilityFloor(db, heroes[0].id, uid));
    assert.deepEqual(change.before, [14, 6, 15, 15, 10, 13]);
    assert.deepEqual(change.after, [14, 8, 15, 15, 10, 13]);
    const pending = await snapshot(heroes[0].id);
    assert.deepEqual(pending.c, pendingBefore.c);
    assert.deepEqual(pending.s.rolls, rolls);
    assert.equal(pending.s.assignment, null);
    assert.equal(pending.s.ability_roll_floor, 8);
    for (const hero of heroes.slice(1, 3)) {
      const before = await snapshot(hero.id);
      await transaction((db) => raiseCharacterAbilityFloor(db, hero.id, uid));
      const after = await snapshot(hero.id);
      assert.deepEqual(
        after.c.stats,
        hero.stats.map((n: number, i: number) => n + (i === 2 ? 2 : 0)),
      );
      assert.equal(after.c.hp, hero.hp + 1);
      assert.equal(after.s.current_hp, hero.name === 'Caído' ? 0 : before.s.current_hp + 1);
      assert.deepEqual(after.s.rolls, rolls);
      assert.deepEqual(after.s.assignment, assignment);
      assert.deepEqual(after.s.choices, before.s.choices);
      assert.equal(after.s.notes, before.s.notes);
      assert.equal(after.c.gold_cp, before.c.gold_cp);
      assert.equal(after.s.temp_hp, 2);
      assert.equal(
        (await transaction((db) => raiseCharacterAbilityFloor(db, hero.id, uid))).changed,
        false,
      );
      assert.deepEqual(await snapshot(hero.id), after);
    }
    assert.deepEqual(await snapshot(heroes[3].id), untouched);
  } finally {
    if (uid) await pool.query('DELETE FROM "user" WHERE id=$1', [uid]);
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
