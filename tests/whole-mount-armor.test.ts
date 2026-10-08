import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter, testArtImage } from './character-fixtures.js';
import { compatibleCompanionSlots } from '../shared/companion-equipment.js';

test('upgrade 078 consolidates horse armor without multiplying copies; art uses whole armor and accessories', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  let cookie = '';
  async function request(path: string, body?: unknown, method?: string) {
    const response = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  try {
    const account = await request('/auth/sign-up/email', {
      name: 'Barda inteira',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(account.status, 200);
    cookie = account.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const hero = await createLegacyTestCharacter(account.data.user.id, 'Barda');
    const second = await createLegacyTestCharacter(account.data.user.id, 'Outro inventário');
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
    const mount = (
      await request('/stable/purchase', {
        character_id: hero.id,
        mount_id: 'warhorse',
        name: 'Firme',
        idempotency_key: randomUUID(),
      })
    ).data.mount;
    const path = `/companions/${hero.id}/equipment`;
    assert.equal((await request(path)).status, 200);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM mount_armor_consolidation_archive')).rows[0]
        .n,
      0,
    );
    await pool.query('DROP TABLE mount_armor_consolidation_archive');
    await pool.query("DELETE FROM schema_migrations WHERE name='078_whole_mount_armor.sql'");
    for (const parent of ['barding-ring-mail', 'barding-splint-armor', 'barding-padded-armor']) {
      for (const slot of ['head', 'shoulders', 'feet']) {
        await pool.query(
          `INSERT INTO catalog_items(id,name,original_name,source,source_url,category,description,weight_lb,price_cp,raw_data,image_path,active)
          SELECT $2,name||' parte antiga',original_name,source,source_url,category,description,weight_lb/6,price_cp,
          jsonb_build_object('armor_bundle_parent',id,'piece_slot',$3::text,'equipment_target','mount'),image_path,true FROM catalog_items WHERE id=$1`,
          [parent, parent + '--' + slot, slot],
        );
      }
    }
    for (const [character, id, quantity] of [
      [hero.id, 'barding-ring-mail', 2],
      [hero.id, 'barding-ring-mail--head', 2],
      [second.id, 'barding-ring-mail--feet', 2],
      [hero.id, 'barding-ring-mail--shoulders', 2],
      [second.id, 'barding-splint-armor--head', 3],
      [hero.id, 'horseshoes-of-speed', 1],
      [hero.id, 'mount-ornate-bridle', 1],
      [hero.id, 'saddle-riding', 1],
    ] as const)
      await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3)', [
        character,
        id,
        quantity,
      ]);
    for (const [id, quantity] of [
      ['barding-splint-armor--feet', 3],
      ['barding-padded-armor--head', 2],
    ] as const)
      await pool.query('INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,$2,$3)', [
        account.data.user.id,
        id,
        quantity,
      ]);
    for (const [slot, id] of [
      ['armor', 'barding-ring-mail'],
      ['head', 'barding-ring-mail--head'],
      ['shoulders', 'barding-ring-mail--shoulders'],
      ['feet', 'horseshoes-of-speed'],
      ['neck', 'mount-ornate-bridle'],
      ['saddle', 'saddle-riding'],
    ] as const)
      await pool.query(
        'INSERT INTO companion_equipment(wardrobe_id,character_id,slot,item_id) VALUES($1,$2,$3,$4)',
        [mount.id, hero.id, slot, id],
      );
    await pool.query('UPDATE companion_wardrobes SET revision=6,image_revision=3 WHERE id=$1', [
      mount.id,
    ]);
    const previousArt = await testArtImage();
    await pool.query(
      'INSERT INTO companion_artworks(wardrobe_id,equipment_revision,image) VALUES($1,6,$2)',
      [mount.id, previousArt],
    );
    const goldBefore = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
      .rows[0].gold_cp;
    const purchasesBefore = (
      await pool.query('SELECT * FROM character_mounts WHERE character_id=$1 ORDER BY id', [
        hero.id,
      ])
    ).rows;
    await migrate();
    await seed();
    await seed();
    assert.equal(
      (
        await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
          hero.id,
          'barding-ring-mail',
        ])
      ).rows[0].quantity,
      2,
    );
    assert.equal(
      (
        await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
          second.id,
          'barding-splint-armor',
        ])
      ).rows[0].quantity,
      3,
    );
    assert.equal(
      (
        await pool.query('SELECT quantity FROM account_vault WHERE user_id=$1 AND item_id=$2', [
          account.data.user.id,
          'barding-padded-armor',
        ])
      ).rows[0].quantity,
      2,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM inventory WHERE item_id LIKE 'barding-%--%' ",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM account_vault WHERE item_id LIKE 'barding-%--%' ",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM catalog_items WHERE id LIKE 'barding-%--%' AND active",
        )
      ).rows[0].n,
      0,
    );
    assert.ok(
      (await pool.query('SELECT count(*)::int AS n FROM mount_armor_consolidation_archive')).rows[0]
        .n > 8,
    );
    const wardrobe = (
      await pool.query('SELECT revision,image_revision FROM companion_wardrobes WHERE id=$1', [
        mount.id,
      ])
    ).rows[0];
    assert.deepEqual(wardrobe, { revision: 7, image_revision: 3 });
    assert.deepEqual(
      (await pool.query('SELECT image FROM companion_artworks WHERE wardrobe_id=$1', [mount.id]))
        .rows[0].image,
      previousArt,
    );
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
      goldBefore,
    );
    assert.deepEqual(
      (
        await pool.query('SELECT * FROM character_mounts WHERE character_id=$1 ORDER BY id', [
          hero.id,
        ])
      ).rows,
      purchasesBefore,
    );
    const equipped = (
      await pool.query(
        'SELECT slot,item_id FROM companion_equipment WHERE wardrobe_id=$1 ORDER BY slot',
        [mount.id],
      )
    ).rows;
    assert.deepEqual(equipped, [
      { slot: 'armor', item_id: 'barding-ring-mail' },
      { slot: 'belt', item_id: 'horseshoes-of-speed' },
      { slot: 'neck', item_id: 'mount-ornate-bridle' },
      { slot: 'saddle', item_id: 'saddle-riding' },
    ]);
    const state = (await request(path)).data;
    const animal = state.companions.find((a: any) => a.id === mount.id);
    assert.deepEqual(animal.slots, ['head', 'armor', 'neck', 'cloak', 'back', 'belt', 'saddle']);
    const armor = state.inventory.find((i: any) => i.id === 'barding-ring-mail');
    assert.equal(Number(armor.weight_lb), 80);
    assert.deepEqual(compatibleCompanionSlots(armor, 'mount', 'warhorse'), ['armor']);
    assert.equal(
      (
        await request(
          path,
          { kind: 'mount', companion_id: mount.id, slot: 'feet', item_id: 'horseshoes-of-speed' },
          'PUT',
        )
      ).status,
      400,
    );
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const job = await request(`/companions/${hero.id}/art`, {
      kind: 'mount',
      companion_id: mount.id,
      idempotency_key: randomUUID(),
    });
    assert.equal(job.status, 202);
    assert.deepEqual(job.data.barding_parts, [
      'head',
      'neck',
      'chest',
      'body',
      'front_legs',
      'hind_legs',
    ]);
    const partialInput = {
      kind: 'mount',
      companion_id: mount.id,
      idempotency_key: randomUUID(),
      barding_parts: ['body', 'chest'],
    };
    assert.equal(
      (await request(`/companions/${hero.id}/art`, { ...partialInput, barding_parts: ['wing'] }))
        .status,
      400,
    );
    assert.equal(
      (
        await request(`/companions/${hero.id}/art`, {
          ...partialInput,
          barding_parts: ['head', 'head'],
        })
      ).status,
      400,
    );
    const refs = (
      await pool.query(
        'SELECT slot,item_id,name,image FROM companion_art_equipment WHERE job_id=$1 ORDER BY slot',
        [job.data.id],
      )
    ).rows;
    assert.equal(refs.length, 4);
    assert.match(refs.find((r) => r.slot === 'armor').name, /Armadura completa da montaria/);
    assert.doesNotMatch(refs.find((r) => r.slot === 'armor').name, /somente.*peça/i);
    assert.ok(refs.every((r) => r.image.length > 1000));
    assert.deepEqual(
      refs.map((r) => r.item_id),
      equipped.map((r) => r.item_id),
    );
    await pool.query(
      "UPDATE companion_art_jobs SET status='failed',error='Isolated fixture; provider not invoked' WHERE id=$1",
      [job.data.id],
    );
    const partial = await request(`/companions/${hero.id}/art`, partialInput);
    assert.equal(partial.status, 202);
    assert.deepEqual(partial.data.barding_parts, ['chest', 'body']);
    assert.equal(
      (await request(`/companions/${hero.id}/art`, partialInput)).data.id,
      partial.data.id,
    );
    assert.equal(
      (await request(`/companions/${hero.id}/art`, { ...partialInput, barding_parts: ['head'] }))
        .status,
      409,
    );
    assert.deepEqual(
      (await request(path)).data.companions.find((a: any) => a.id === mount.id).barding_parts,
      ['chest', 'body'],
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT slot,item_id FROM companion_equipment WHERE wardrobe_id=$1 ORDER BY slot',
          [mount.id],
        )
      ).rows,
      equipped,
    );
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
      goldBefore,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
