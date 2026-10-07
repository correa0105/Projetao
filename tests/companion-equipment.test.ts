import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { completeCompanionArt, trustedCompanionBase } from '../server/companion-equipment.js';
import { compatibleCompanionSlots } from '../shared/companion-equipment.js';

test('animais: propriedade, bens legados, cópias reservadas e arte privada por revisão', async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function request(path: string, cookie = '', body?: unknown, method?: string) {
    const response = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const result = await request('/auth/sign-up/email', '', {
      name: 'Vestir animais',
      email: `companion-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(result.status, 200);
    return {
      id: result.data.user.id,
      cookie: result.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup(),
      outsider = await signup(),
      hero = await createLegacyTestCharacter(owner.id, 'Guardião');
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
    const mount = (
      await request('/stable/purchase', owner.cookie, {
        character_id: hero.id,
        mount_id: 'warhorse',
        name: 'Brasa',
        equipment: ['barding-leather', 'saddle-riding'],
        idempotency_key: randomUUID(),
      })
    ).data.mount;
    const otherMount = (
      await request('/stable/purchase', owner.cookie, {
        character_id: hero.id,
        mount_id: 'pony',
        name: 'Farol',
        idempotency_key: randomUUID(),
      })
    ).data.mount;
    const dog = (
      await request('/pets/purchase', owner.cookie, {
        character_id: hero.id,
        pet_id: 'dog',
        name: 'Pingo',
        idempotency_key: randomUUID(),
      })
    ).data.pet;
    const snake = (
      await request('/pets/purchase', owner.cookie, {
        character_id: hero.id,
        pet_id: 'snake',
        name: 'Fita',
        idempotency_key: randomUUID(),
      })
    ).data.pet;
    for (const [item, quantity] of [
      ['plate-armor', 1],
      ['barding-leather-armor', 1],
      ['horseshoes-of-speed', 1],
      ['backpack', 2],
      ['cosmetic-cape', 1],
    ] as const) {
      if ((await pool.query('SELECT 1 FROM catalog_items WHERE id=$1', [item])).rowCount)
        await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3)', [
          hero.id,
          item,
          quantity,
        ]);
    }
    const path = `/companions/${hero.id}/equipment`,
      state = () => request(path, owner.cookie),
      equip = (kind: string, companion_id: string, slot: string, item_id: string | null) =>
        request(path, owner.cookie, { kind, companion_id, slot, item_id }, 'PUT');
    assert.equal((await request(path)).status, 401);
    assert.equal((await request(path, outsider.cookie)).status, 404);
    let result = (await state()).data;
    assert.equal(result.companions.length, 4);
    const initial = result.companions.find((animal: any) => animal.id === mount.id);
    assert.deepEqual(initial.equipped.map((item: any) => item.item_id).sort(), [
      'legacy:barding-leather',
      'legacy:saddle-riding',
    ]);
    assert.equal(initial.image_revision, 0);
    assert.equal(initial.equipment_revision, 0);
    assert.equal(
      (await equip('mount', otherMount.id, 'armor', 'legacy:barding-leather')).status,
      409,
    );
    assert.equal((await equip('pet', dog.id, 'armor', 'legacy:barding-leather')).status, 409);
    assert.equal((await equip('pet', snake.id, 'feet', 'plate-boots')).status, 400);
    assert.equal((await equip('mount', mount.id, 'armor', 'longsword')).status, 409);
    assert.equal(
      (
        await request(
          path,
          outsider.cookie,
          { kind: 'mount', companion_id: mount.id, slot: 'armor', item_id: null },
          'PUT',
        )
      ).status,
      404,
    );
    assert.equal((await equip('mount', mount.id, 'armor', null)).status, 200);
    assert.equal((await equip('mount', mount.id, 'armor', 'legacy:barding-leather')).status, 200);
    assert.deepEqual(
      (await pool.query('SELECT equipment FROM character_mounts WHERE id=$1', [mount.id])).rows[0]
        .equipment,
      ['barding-leather', 'saddle-riding'],
    );
    assert.equal((await equip('mount', mount.id, 'armor', 'plate-armor')).status, 400);
    assert.equal((await equip('mount', mount.id, 'armor', 'barding-leather-armor')).status, 200);
    assert.equal(
      (
        await request('/inventory/equipment', owner.cookie, {
          character_id: hero.id,
          slot: 'armor',
          item_id: 'barding-leather-armor',
        })
      ).status,
      400,
    );
    assert.equal((await equip('pet', dog.id, 'armor', 'plate-armor')).status, 400);
    const storage = (await request(`/characters/${hero.id}/storage`, owner.cookie)).data;
    assert.equal(storage.companion_allocated['barding-leather-armor'], 1);
    assert.equal(
      (
        await request('/inventory/transfers', owner.cookie, {
          character_id: hero.id,
          item_id: 'barding-leather-armor',
          direction: 'to_vault',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal((await equip('mount', mount.id, 'armor', null)).status, 200);
    assert.equal(
      (
        await request('/inventory/equipment', owner.cookie, {
          character_id: hero.id,
          slot: 'armor',
          item_id: 'plate-armor',
        })
      ).status,
      200,
    );
    assert.equal((await equip('mount', mount.id, 'armor', 'plate-armor')).status, 400);
    await request('/inventory/equipment', owner.cookie, {
      character_id: hero.id,
      slot: 'armor',
      item_id: null,
    });
    const concurrent = await Promise.all([
      equip('mount', mount.id, 'belt', 'horseshoes-of-speed'),
      equip('pet', dog.id, 'feet', 'horseshoes-of-speed'),
      equip('mount', otherMount.id, 'belt', 'horseshoes-of-speed'),
    ]);
    assert.equal(concurrent.filter((entry) => entry.status === 200).length, 1);
    assert.equal(concurrent.filter((entry) => entry.status === 409).length, 1);
    assert.equal(concurrent.filter((entry) => entry.status === 400).length, 1);
    assert.equal((await equip('mount', mount.id, 'back', 'backpack')).status, 400);
    assert.equal((await equip('pet', dog.id, 'back', 'backpack')).status, 400);
    assert.equal(
      (await state()).data.inventory.find((item: any) => item.id === 'horseshoes-of-speed')
        .available,
      0,
    );
    assert.deepEqual(
      compatibleCompanionSlots(
        { id: 'horseshoes-of-speed', name: 'Ferraduras', category: 'Mágicos' },
        'mount',
        'warhorse',
      ),
      ['belt'],
    );
    assert.deepEqual(
      compatibleCompanionSlots(
        { id: 'longsword', name: 'Espada longa', category: 'Armas' },
        'mount',
        'warhorse',
      ),
      [],
    );
    const baseBytes = await trustedCompanionBase({
        kind: 'pet',
        species_id: 'dog',
        appearance: 'original',
      }),
      baseMeta = await sharp(baseBytes).metadata();
    assert.equal(baseMeta.width, 673);
    assert.equal(baseMeta.height, 650);
    const baseUrl = `/companions/${hero.id}/pet/${dog.id}/base-image`;
    assert.equal((await fetch(base + baseUrl, { headers: { Cookie: owner.cookie } })).status, 200);
    assert.equal(
      (await fetch(base + baseUrl, { headers: { Cookie: outsider.cookie } })).status,
      404,
    );
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const artPath = `/companions/${hero.id}/art`,
      artInput = { kind: 'mount', companion_id: mount.id, idempotency_key: randomUUID() };
    assert.equal(
      (await request(artPath, owner.cookie, { ...artInput, reference: 'forged' })).status,
      400,
    );
    const job = await request(artPath, owner.cookie, artInput);
    assert.equal(job.status, 202);
    assert.equal((await request(artPath, owner.cookie, artInput)).data.id, job.data.id);
    assert.equal(
      (await request(artPath, owner.cookie, { ...artInput, companion_id: otherMount.id })).status,
      409,
    );
    assert.equal(
      (await request(artPath, owner.cookie, { ...artInput, idempotency_key: randomUUID() })).status,
      409,
    );
    const reference = (
      await pool.query('SELECT reference FROM companion_art_jobs WHERE id=$1', [job.data.id])
    ).rows[0].reference;
    const trusted = await trustedCompanionBase({
      kind: 'mount',
      species_id: 'warhorse',
      appearance: 'original',
    });
    assert.deepEqual(reference, trusted);
    const humanCountBefore = (
      await pool.query('SELECT count(*) FROM character_art_jobs WHERE character_id=$1', [hero.id])
    ).rows[0].count;
    await pool.query("UPDATE companion_art_jobs SET status='running' WHERE id=$1", [job.data.id]);
    await equip('mount', mount.id, 'armor', 'barding-leather-armor');
    assert.equal((await completeCompanionArt(job.data.id, reference)).status, 'stale');
    assert.equal(
      (await state()).data.companions.find((animal: any) => animal.id === mount.id).art_used,
      0,
    );
    assert.equal(
      (await pool.query('SELECT 1 FROM companion_artworks WHERE wardrobe_id=$1', [mount.id]))
        .rowCount,
      0,
    );
    const fresh = await request(artPath, owner.cookie, {
      ...artInput,
      idempotency_key: randomUUID(),
    });
    assert.equal(fresh.status, 202);
    const snapshot = (
      await pool.query(
        'SELECT slot,item_id,image FROM companion_art_equipment WHERE job_id=$1 ORDER BY slot',
        [fresh.data.id],
      )
    ).rows;
    assert.ok(
      snapshot.some((item) => item.item_id === 'barding-leather-armor' && item.image.length > 0),
    );
    assert.ok(snapshot.some((item) => item.item_id === 'legacy:saddle-riding'));
    await pool.query("UPDATE companion_art_jobs SET status='running' WHERE id=$1", [fresh.data.id]);
    assert.equal((await completeCompanionArt(fresh.data.id, reference)).status, 'completed');
    await completeCompanionArt(fresh.data.id, reference);
    let animal = (await state()).data.companions.find((entry: any) => entry.id === mount.id);
    assert.equal(animal.image_revision, 1);
    assert.equal(animal.art_equipment_revision, animal.equipment_revision);
    const imagePath = animal.image_url.replace('/api', '');
    assert.equal(
      (await fetch(base + imagePath, { headers: { Cookie: owner.cookie } })).status,
      200,
    );
    assert.equal(
      (await fetch(base + imagePath, { headers: { Cookie: outsider.cookie } })).status,
      404,
    );
    await equip('mount', mount.id, 'armor', null);
    animal = (await state()).data.companions.find((entry: any) => entry.id === mount.id);
    assert.equal(animal.image_revision, 1);
    assert.notEqual(animal.art_equipment_revision, animal.equipment_revision);
    assert.equal(
      (await fetch(base + imagePath, { headers: { Cookie: owner.cookie } })).status,
      200,
    );
    const home = (await request('/house', owner.cookie, { character_id: hero.id })).data;
    const homeId = home.id || home.home?.id,
      draft = (await request(`/house/${homeId}`, owner.cookie)).data;
    draft.rooms[0].placements = [
      {
        id: randomUUID(),
        kind: 'mount',
        ref: mount.id,
        x: 0.5,
        y: 0.85,
        scale: 0.4,
        rotation: 0,
        layer: 0,
      },
    ];
    await request(
      `/house/${homeId}`,
      owner.cookie,
      { revision: draft.revision, name: draft.name, rooms: draft.rooms },
      'PUT',
    );
    await request(`/house/${homeId}/invites`, owner.cookie, { user_id: outsider.id });
    await request(
      `/house/${homeId}/invites/${outsider.id}`,
      outsider.cookie,
      { status: 'accepted' },
      'PUT',
    );
    assert.equal(
      (await fetch(base + imagePath, { headers: { Cookie: outsider.cookie } })).status,
      200,
    );
    assert.equal(
      (await request(`/house/${homeId}`, outsider.cookie)).data.companions[0].image_revision,
      1,
    );
    await request(
      `/house/${homeId}/invites/${outsider.id}`,
      owner.cookie,
      { status: 'revoked' },
      'PUT',
    );
    assert.equal(
      (await fetch(base + imagePath, { headers: { Cookie: outsider.cookie } })).status,
      404,
    );
    assert.equal(
      (await request(`/stable/${hero.id}`, owner.cookie)).data.find(
        (entry: any) => entry.id === mount.id,
      ).image_revision,
      1,
    );
    assert.equal(
      (await pool.query('SELECT count(*) FROM character_art_jobs WHERE character_id=$1', [hero.id]))
        .rows[0].count,
      humanCountBefore,
    );
    const second = await request(artPath, owner.cookie, {
      kind: 'pet',
      companion_id: dog.id,
      idempotency_key: randomUUID(),
    });
    assert.equal(second.status, 202);
    assert.equal(
      (
        await request(artPath, owner.cookie, {
          kind: 'pet',
          companion_id: snake.id,
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    const human = await request('/character-art', owner.cookie, {
      character_id: hero.id,
      reference: baseBytes.toString('base64'),
      idempotency_key: randomUUID(),
    });
    assert.equal(human.status, 409);
    assert.equal(
      (await request(`/characters/${hero.id}`, owner.cookie, { name: hero.name }, 'DELETE')).status,
      409,
    );
    assert.equal((await request(`/companions/${hero.id}/art/jobs`, outsider.cookie)).status, 404);
    assert.equal(
      (await request(`/companions/${hero.id}/art/jobs`, owner.cookie)).data.jobs.length,
      3,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
