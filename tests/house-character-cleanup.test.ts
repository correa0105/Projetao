import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool,transaction } from '../server/db';
import { migrate } from '../server/migrate';
import { createLegacyTestCharacter } from './character-fixtures';

test('casas: reset pontual, exclusão futura e limpeza retroativa preservam vizinhos, coleção e auditoria', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const user=randomUUID();
  await pool.query('INSERT INTO "user"(id,name,email)VALUES($1,$2,$3)',[user,'Morador',user+'@example.test']);
  try {
    const owner=await createLegacyTestCharacter(user,'Dono'), neighbor=await createLegacyTestCharacter(user,'Vizinho');
    const plots=(await pool.query('SELECT * FROM house2_plots WHERE retired_at IS NULL ORDER BY id LIMIT 3')).rows;
    for(const [i,p] of plots.entries())await pool.query("UPDATE house2_plots SET character_id=$2,house_id='house-empty-002',house_x=x+6,house_y=y+6,purchased_at=now(),finishes='{\"roof\":\"roof-red\"}',door_open=true WHERE id=$1",[p.id,i<2?owner.id:neighbor.id]);
    const items: Record<string, unknown>[]=[];
    for(const p of plots)items.push((await pool.query("INSERT INTO house2_items(user_id,catalog_id,plot_id,x,y,light_on)VALUES($1,'candle',$2,6,6,true)RETURNING *",[user,p.id])).rows[0]);
    await pool.query('INSERT INTO house2_accounts(user_id,balance)VALUES($1,7777)',[user]);
    const orderKey=randomUUID();await pool.query("INSERT INTO house2_orders(user_id,idempotency_key,fingerprint,amount,result)VALUES($1,$2,'original',1200,'{}')",[user,orderKey]);
    const protectedPlot=(await pool.query('SELECT * FROM house2_plots WHERE id=$1',[plots[2].id])).rows[0];
    const protectedItem=items[2];
    assert.equal((await pool.query('SELECT release_house2_plots($1::uuid[]) n',[[plots[0].id]])).rows[0].n,1);
    assert.equal((await pool.query('SELECT release_house2_plots($1::uuid[]) n',[[plots[0].id]])).rows[0].n,0);
    assert.equal((await pool.query('SELECT character_id FROM house2_plots WHERE id=$1',[plots[1].id])).rows[0].character_id,owner.id,'outra casa do mesmo dono preservada');
    const stored=(await pool.query('SELECT * FROM house2_items WHERE id=$1',[items[0].id])).rows[0];
    assert.deepEqual(stored,{...items[0],plot_id:null,x:null,y:null,light_on:false,light_revision:1});
    const legacy=(await pool.query("INSERT INTO house_homes(character_id,name,rooms)VALUES($1,'Casa antiga','{}')RETURNING id",[owner.id])).rows[0];
    await pool.query("INSERT INTO house_items(character_id,catalog_id,source)VALUES($1,'keepsake','purchase')",[owner.id]);
    await pool.query("INSERT INTO house_invites(home_id,user_id,status)VALUES($1,$2,'accepted')",[legacy.id,user]);
    await pool.query("INSERT INTO house_messages(home_id,user_id,character_id,body,idempotency_key)VALUES($1,$2,$3,'record', $4)",[legacy.id,user,neighbor.id,randomUUID()]);
    await pool.query('INSERT INTO house2_tokens(neighborhood_id,character_id,x,y)VALUES($1,$2,50,50)',[plots[1].neighborhood_id,owner.id]);
    await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1',[owner.id]);
    for(const p of plots.slice(0,2)){
      const r=(await pool.query('SELECT * FROM house2_plots WHERE id=$1',[p.id])).rows[0];
      assert.equal(r.character_id,null);assert.equal(r.house_id,null);assert.equal(r.purchased_at,null);assert.deepEqual(r.ground,[]);assert.deepEqual(r.finishes,{});assert.equal(r.door_open,false);assert.equal(r.retired_at,null);assert.equal(r.village_slot,p.village_slot);
    }
    assert.equal((await pool.query('SELECT 1 FROM house_homes WHERE id=$1',[legacy.id])).rowCount,0);
    assert.equal((await pool.query('SELECT 1 FROM house2_tokens WHERE character_id=$1',[owner.id])).rowCount,0);
    assert.equal((await pool.query('SELECT 1 FROM house_items WHERE character_id=$1',[owner.id])).rowCount,1);
    assert.equal((await pool.query('SELECT balance FROM house2_accounts WHERE user_id=$1',[user])).rows[0].balance,7777);
    assert.equal((await pool.query('SELECT 1 FROM house2_orders WHERE user_id=$1 AND idempotency_key=$2',[user,orderKey])).rowCount,1);
    assert.deepEqual((await pool.query('SELECT * FROM house2_plots WHERE id=$1',[plots[2].id])).rows[0],protectedPlot);
    assert.deepEqual((await pool.query('SELECT * FROM house2_items WHERE id=$1',[items[2].id])).rows[0],protectedItem);

    // Simulate a pre-upgrade deletion, then run the actual migration's backfill.
    await transaction(async db=>{
      await db.query('DROP TRIGGER character_housing_deleted ON characters');
      await db.query('DROP FUNCTION character_housing_deleted(); DROP FUNCTION remove_character_housing(uuid); DROP FUNCTION release_house2_plots(uuid[])');
      await db.query('UPDATE characters SET deleted_at=now() WHERE id=$1',[neighbor.id]);
      await db.query(await readFile('db/migrations/125_character_housing_cleanup.sql','utf8'));
      assert.equal((await db.query('SELECT character_id FROM house2_plots WHERE id=$1',[plots[2].id])).rows[0].character_id,null);
      assert.equal((await db.query('SELECT plot_id FROM house2_items WHERE id=$1',[items[2].id])).rows[0].plot_id,null);
    });
  } finally { await pool.end(); }
});
