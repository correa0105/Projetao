import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { pool, transaction } from '../server/db';
import { migrate } from '../server/migrate';
import { createLegacyTestCharacter } from './character-fixtures';
test('Vilarejo: preservar casas, móveis, compras e mais de doze terrenos adquiridos', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  try {
    await transaction(async (db) => {
      await db.query(
        'CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
      );
      for (const name of (await readdir('db/migrations'))
        .filter((n) => n.endsWith('.sql') && n < '100_')
        .sort()) {
        await db.query(await readFile('db/migrations/' + name, 'utf8'));
        await db.query('INSERT INTO schema_migrations(name)VALUES($1)', [name]);
      }
    });
    const user = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email)VALUES($1,$2,$3)', [
      user,
      'Morador antigo',
      user + '@example.test',
    ]);
    const c = await createLegacyTestCharacter(user, 'Aurora');
    const neighborhoods = (await pool.query('SELECT id FROM house2_neighborhoods ORDER BY name'))
      .rows;
    const lone = (
      await pool.query('SELECT * FROM house2_plots WHERE neighborhood_id=$1 AND number=13', [
        neighborhoods[0].id,
      ])
    ).rows[0];
    await pool.query(
      'UPDATE house2_plots SET character_id=$2,house_id=$3,house_x=x+6.2,house_y=y+5.7,house_rotation=90 WHERE id=$1',
      [lone.id, c.id, 'house-empty-001'],
    );
    await pool.query(
      'UPDATE house2_plots SET character_id=$2,house_id=$3,house_x=x+6,house_y=y+6 WHERE neighborhood_id=$1 AND number<=18',
      [neighborhoods[1].id, c.id, 'house-empty-002'],
    );
    const item = (
      await pool.query(
        'INSERT INTO house2_items(user_id,catalog_id,plot_id,x,y,rotation)VALUES($1,$2,$3,$4,$5,90)RETURNING *',
        [user, 'furniture-001', lone.id, lone.x + 5.23, lone.y + 6.49],
      )
    ).rows[0];
    await pool.query('INSERT INTO house2_accounts(user_id,balance)VALUES($1,15231)', [user]);
    const before = (
      await pool.query(
        'SELECT id,character_id,x,y,width,height,house_id,house_x,house_y,house_rotation FROM house2_plots WHERE character_id IS NOT NULL ORDER BY id',
      )
    ).rows;
    await migrate();
    const after = (
      await pool.query(
        'SELECT id,character_id,x,y,width,height,house_id,house_x,house_y,house_rotation FROM house2_plots WHERE character_id IS NOT NULL ORDER BY id',
      )
    ).rows;
    assert.deepEqual(
      after,
      before.map((p, i) =>
        after[i].width === 18
          ? {
              ...p,
              x: Math.max(0, Math.min(182, p.x - 3)),
              y: Math.max(0, Math.min(182, p.y - 3)),
              width: 18,
              height: 18,
            }
          : p,
      ),
    );
    assert(
      (
        await pool.query(
          'SELECT count(*)::int n FROM house2_plots WHERE retired_at IS NULL AND width=18',
        )
      ).rows[0].n > 0,
    );
    const stored = (await pool.query('SELECT * FROM house2_items WHERE id=$1', [item.id])).rows[0];
    delete stored.scale;
    assert.deepEqual(stored, item);
    assert.equal(
      (await pool.query('SELECT balance FROM house2_accounts WHERE user_id=$1', [user])).rows[0]
        .balance,
      15231,
    );
    const counts = (
      await pool.query(
        'SELECT neighborhood_id,count(*)::int n FROM house2_plots WHERE retired_at IS NULL GROUP BY neighborhood_id',
      )
    ).rows;
    assert.equal(counts.length, 4);
    assert(counts.every((n) => n.n === 12));
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM house2_plots WHERE character_id IS NOT NULL AND retired_at IS NOT NULL',
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await pool.query('SELECT count(*)::int n FROM house2_village_layout_backups')).rows[0].n,
      108,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM house2_plots a JOIN house2_plots b ON a.neighborhood_id=b.neighborhood_id AND a.id<b.id AND a.retired_at IS NULL AND b.retired_at IS NULL AND a.x<b.x+b.width AND a.x+a.width>b.x AND a.y<b.y+b.height AND a.y+a.height>b.y',
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await pool.end();
  }
});
