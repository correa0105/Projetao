import { pool } from '../server/db';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { migrate } from '../server/migrate';
export async function verifySlotMigration() {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await pool.query(
    'CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir('db/migrations'))
    .filter((n) => n.endsWith('.sql') && n < '127')
    .sort()) {
    await pool.query(await readFile('db/migrations/' + name, 'utf8'));
    await pool.query('INSERT INTO schema_migrations(name)VALUES($1)', [name]);
  }
  const uid = randomUUID(),
    pending = randomUUID();
  await pool.query(
    "INSERT INTO \"user\"(id,name,email)VALUES($1,'Antigo',$1||'@example.test'),($2,'Pendente',$2||'@example.test')",
    [uid, pending],
  );
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  await pool.query(
    `INSERT INTO characters(id,user_id,name,race,class,hp,level,created_at,deleted_at)VALUES($1,$4,'Excluído','Humano','Guerreiro',10,1,'2026-01-01','2026-01-03'),($2,$4,'Veterano','Humano','Guerreiro',40,4,'2026-01-02',NULL),($3,$4,'Atual','Humano','Guerreiro',10,1,'2026-01-04',NULL)`,
    [...ids, uid],
  );
  const dice = Array.from({ length: 6 }, () => [1, 3, 5, 6]);
  await pool.query(
    "INSERT INTO character_sheets(character_id,choices,rolls,ability_roll_floor)VALUES($1,'{}',$4,0),($2,'{}',$4,8),($3,'{}',NULL,0)",
    [...ids, JSON.stringify(dice)],
  );
  await pool.query(
    "INSERT INTO character_art_jobs(user_id,creation,status,idempotency_key)VALUES($1,'{}','queued',$2)",
    [pending, randomUUID()],
  );
  const resetUser = randomUUID(),
    veteran = randomUUID(),
    unrolled = randomUUID();
  await pool.query("INSERT INTO \"user\"(id,name,email)VALUES($1,'Recomeço',$1||'@example.test')", [
    resetUser,
  ]);
  await pool.query(
    `INSERT INTO characters(id,user_id,name,race,class,hp,level,created_at,deleted_at)VALUES($1,$3,'Atingiu quatro','Humano','Guerreiro',40,4,'2026-01-01','2026-01-02'),($2,$3,'Nova criação','Humano','Guerreiro',10,1,'2026-01-03',NULL)`,
    [veteran, unrolled, resetUser],
  );
  await pool.query(
    "INSERT INTO character_sheets(character_id,choices,rolls,ability_roll_floor)VALUES($1,'{}',$3,0),($2,'{}',NULL,0)",
    [veteran, unrolled, JSON.stringify(dice)],
  );
  const snapshot = async () => ({
    characters: (
      await pool.query(
        "SELECT to_jsonb(c)-'creation_slot'-'sheet_overrides' AS c FROM characters c WHERE user_id=$1 ORDER BY id",
        [uid],
      )
    ).rows,
    sheets: (
      await pool.query(
        "SELECT to_jsonb(s)-'rolls_revealed' AS s FROM character_sheets s JOIN characters c ON c.id=s.character_id WHERE user_id=$1 ORDER BY c.id",
        [uid],
      )
    ).rows,
  });
  const before = await snapshot();
  await migrate();
  assert.deepEqual(await snapshot(), before);
  const slots = (
    await pool.query('SELECT * FROM character_slot_rolls WHERE user_id=$1 ORDER BY slot', [uid])
  ).rows;
  assert.equal(slots[0].character_id, ids[2]);
  assert.deepEqual(slots[0].rolls, dice);
  assert.equal(slots[0].minimum, 0);
  assert.equal(slots[0].revealed, 6);
  assert.equal(slots[1].character_id, ids[1]);
  assert.deepEqual(slots[1].rolls, dice);
  assert.equal(slots[1].revealed, 6);
  assert.equal(slots[1].matured, true);
  const job = (
    await pool.query(
      'SELECT creation_slot,roll_generation FROM character_art_jobs WHERE user_id=$1',
      [pending],
    )
  ).rows[0];
  assert.deepEqual(job, { creation_slot: 1, roll_generation: 1 });
  const reset = (
    await pool.query(
      'SELECT rolls,minimum,revealed FROM character_slot_rolls WHERE user_id=$1 AND slot=1',
      [resetUser],
    )
  ).rows[0];
  assert.deepEqual(reset, { rolls: null, minimum: 8, revealed: 0 });
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [[uid, pending, resetUser]]);
}
