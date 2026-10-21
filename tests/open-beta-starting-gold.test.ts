import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from '../server/db';
import { migrate } from '../server/migrate';
import { grantBetaStartingGold } from '../server/beta-accounts';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
test('beta aberto: novas contas recebem 6000 PO uma vez; contas/saldos antigos e desligamento preservados', async () => {
  await migrate();
  const createUser = async () => {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,\'Beta\',$2,false,now(),now())',
      [id, id + '@example.test'],
    );
    return id;
  };
  const createCharacter = async (user: string) =>
    (
      await pool.query(
        "INSERT INTO characters(user_id,name,race,class,hp,gold_cp) VALUES($1,'Beta','Humano','Guerreiro',10,0) RETURNING id",
        [user],
      )
    ).rows[0].id;
  const old = await createUser(),
    oldCharacter = await createCharacter(old);
  await pool.query('UPDATE characters SET gold_cp=123400 WHERE id=$1', [oldCharacter]);
  await pool.query('UPDATE beta_registration_settings SET enabled=true WHERE singleton=true');
  const fresh = await createUser(),
    first = await createCharacter(fresh),
    second = await createCharacter(fresh);
  assert.deepEqual(
    (
      await pool.query('SELECT initial_gold_cp,granted_at FROM beta_accounts WHERE user_id=$1', [
        fresh,
      ])
    ).rows[0],
    { initial_gold_cp: 600000, granted_at: null },
  );
  const result = await Promise.all([
    transaction((db) => grantBetaStartingGold(db, fresh, first)),
    transaction((db) => grantBetaStartingGold(db, fresh, first)),
  ]);
  assert.deepEqual(result.sort(), [false, true]);
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [first])).rows[0].gold_cp,
    600000,
  );
  assert.equal(await transaction((db) => grantBetaStartingGold(db, fresh, second)), false);
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [second])).rows[0].gold_cp,
    0,
  );
  assert.equal(await transaction((db) => grantBetaStartingGold(db, old, oldCharacter)), false);
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [oldCharacter])).rows[0]
      .gold_cp,
    123400,
  );
  await pool.query('DELETE FROM characters WHERE id=$1', [first]);
  assert.equal(await transaction((db) => grantBetaStartingGold(db, fresh, second)), false);
  await pool.query('UPDATE beta_registration_settings SET enabled=false WHERE singleton=true');
  const later = await createUser();
  assert.equal(
    (await pool.query('SELECT user_id FROM beta_accounts WHERE user_id=$1', [later])).rowCount,
    0,
  );
});
test.after(() => pool.end());
