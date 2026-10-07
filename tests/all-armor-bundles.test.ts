import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { purchase } from '../server/services.js';
import {
  armorBundles,
  armorBundle,
  purchaseContents,
  shopWeight,
} from '../shared/armor-bundles.js';
import { equipmentArtReference } from '../server/equipment-art-reference.js';
import { compatibleSlots } from '../shared/equipment.js';
import { compatibleCompanionSlots } from '../shared/companion-equipment.js';
import sharp from 'sharp';

test('todas as armaduras: peças reais, compras/replay, peso e equipar conjunto atômico por alvo', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function request(path: string, account?: Account, body?: unknown, method?: string) {
    const response = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        Origin: origin,
        Cookie: account?.cookie || '',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const response = await request('/auth/sign-up/email', undefined, {
      name: 'Conjuntos de armadura',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup(),
      outsider = await signup(),
      hero = await createLegacyTestCharacter(owner.id, 'Armadureiro');
    await pool.query('UPDATE characters SET gold_cp=20000000 WHERE id=$1', [hero.id]);
    const bundles = armorBundles();
    const source = new Map(
      JSON.parse(await readFile('data/emporium-expansion.json', 'utf8')).items.map((item: any) => [
        item.id,
        item,
      ]),
    );
    let magicalBundles = 0;
    assert.equal(bundles.length, 266);
    for (const bundle of bundles) {
      const { rows } = await pool.query('SELECT * FROM catalog_items WHERE id=ANY($1::text[])', [
        purchaseContents(bundle.id),
      ]);
      assert.equal(rows.length, bundle.target === 'mount' ? 1 : 6, bundle.id);
      assert.equal(
        Math.round(rows.reduce((sum, row) => sum + Number(row.weight_lb), 0) * 100),
        Math.round(bundle.weight_lb * 100),
        bundle.id,
      );
      assert.equal(shopWeight(rows.find((row) => row.id === bundle.id)), bundle.weight_lb);
      const parent = rows.find((row) => row.id === bundle.id);
      if (parent.raw_data.magic_family) {
        magicalBundles++;
        assert.equal(parent.image_path, (source.get(bundle.id) as any).image_path);
        for (const row of rows) {
          assert.equal(row.raw_data.armor_bundle_model_image, parent.image_path);
          assert.equal(equipmentArtReference(row).path, parent.image_path);
        }
      }
      for (const row of rows) {
        assert.ok(row.id.length <= 100);
        assert.equal(row.raw_data.equipment_target, bundle.target);
        if (bundle.target === 'mount') {
          assert.equal(row.raw_data.armor_complete, true);
          assert.equal(row.raw_data.piece_slot, undefined);
        } else assert.equal(row.raw_data.armor_bundle_parent, bundle.id);
        if (row.id !== bundle.id) {
          assert.equal(row.active, false);
          assert.equal(row.price_cp, null);
          if (bundle.id !== 'plate-armor') assert.match(row.image_path, /armor-piece-.*\.svg$/);
          if (bundle.target !== 'human')
            assert.ok(row.image_path.includes(`armor-piece-${bundle.target}-`));
        }
      }
    }
    assert.equal(magicalBundles, 238);
    assert.deepEqual(purchaseContents('shield'), ['shield']);
    assert.deepEqual(purchaseContents('animated-shield'), ['animated-shield']);
    const basic = [
      'padded-armor',
      'leather-armor',
      'studded-leather',
      'hide-armor',
      'chain-shirt',
      'scale-mail',
      'breastplate',
      'half-plate-armor',
      'ring-mail',
      'chain-mail',
      'splint-armor',
      'plate-armor',
    ];
    const offered = [
      ...basic,
      ...basic.map((id) => 'barding-' + id),
      'magic-armor',
      'magic-armor-leather-armor-plus-1',
      'pet-armor-padded',
      'pet-armor-leather',
      'pet-armor-chain',
      'pet-armor-scales',
    ];
    const checkout = {
      character_id: hero.id,
      idempotency_key: randomUUID(),
      items: offered.map((item_id) => ({ item_id, quantity: 1 })),
    };
    const bought = await Promise.all([
      request('/shop/checkout', owner, checkout),
      request('/shop/checkout', owner, checkout),
    ]);
    assert.deepEqual(bought.map((row) => row.status).sort(), [200, 201]);
    const expectedPrice = (
      await pool.query(
        'SELECT SUM(price_cp)::int AS total FROM catalog_items WHERE id=ANY($1::text[])',
        [offered],
      )
    ).rows[0].total;
    assert.equal(bought[0].data.total_cp, expectedPrice);
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
      20000000 - expectedPrice,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1',
          [hero.id],
        )
      ).rows[0].n,
      offered.reduce((sum, id) => sum + purchaseContents(id).length, 0),
    );
    const weight = (
      await pool.query(
        'SELECT SUM(c.weight_lb*i.quantity)::numeric AS weight FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1',
        [hero.id],
      )
    ).rows[0].weight;
    assert.equal(
      Number(weight),
      offered.reduce((sum, id) => sum + armorBundle(id)!.weight_lb, 0),
    );
    assert.equal(
      (
        await request('/shop/checkout', owner, {
          ...checkout,
          idempotency_key: randomUUID(),
          items: [{ item_id: 'leather-armor--head', quantity: 1 }],
        })
      ).status,
      409,
    );
    const equip = (id: string, account = owner) =>
      request('/inventory/equipment-set', account, { character_id: hero.id, item_id: id });
    assert.equal(
      (
        await request('/inventory/equipment-set', undefined, {
          character_id: hero.id,
          item_id: 'leather-armor',
        })
      ).status,
      401,
    );
    assert.equal((await equip('leather-armor', outsider)).status, 404);
    assert.equal(
      (
        await request('/inventory/equipment-set', owner, {
          character_id: hero.id,
          item_id: 'leather-armor',
          pieces: ['forged'],
        })
      ).status,
      400,
    );
    assert.equal((await equip('shield')).status, 400);
    assert.equal((await equip('barding-ring-mail')).status, 400);
    assert.equal((await equip('pet-armor-leather')).status, 400);
    let result = await equip('leather-armor');
    assert.equal(result.status, 200);
    assert.equal(result.data.equipped.length, 6);
    assert.ok(
      result.data.equipped.every(
        (item: any) => item.raw_data.armor_bundle_parent === 'leather-armor',
      ),
    );
    const initialEquipped = await pool.query(
      'SELECT slot,item_id,equipped_at FROM character_equipment WHERE character_id=$1 ORDER BY slot',
      [hero.id],
    );
    assert.equal((await equip('leather-armor')).status, 200);
    assert.deepEqual(
      (
        await pool.query(
          'SELECT slot,item_id,equipped_at FROM character_equipment WHERE character_id=$1 ORDER BY slot',
          [hero.id],
        )
      ).rows,
      initialEquipped.rows,
    );
    const missing = 'chain-mail--feet';
    assert.equal(
      (
        await request('/inventory/transfers', owner, {
          character_id: hero.id,
          item_id: missing,
          direction: 'to_vault',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      201,
    );
    assert.equal((await equip('chain-mail')).status, 409);
    assert.deepEqual(
      (
        await pool.query(
          'SELECT slot,item_id,equipped_at FROM character_equipment WHERE character_id=$1 ORDER BY slot',
          [hero.id],
        )
      ).rows,
      initialEquipped.rows,
    );
    await request('/inventory/transfers', owner, {
      character_id: hero.id,
      item_id: missing,
      direction: 'to_backpack',
      quantity: 1,
      idempotency_key: randomUUID(),
    });
    assert.equal((await equip('magic-armor')).status, 200);
    assert.equal((await equip('magic-armor-leather-armor-plus-1')).status, 200);
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const artBase = await sharp({
      create: { width: 512, height: 768, channels: 4, background: '#eee' },
    })
      .png()
      .toBuffer();
    const humanJob = await request('/character-art', owner, {
      character_id: hero.id,
      reference: artBase.toString('base64'),
      equipment_slots: ['armor', 'head', 'bracers', 'legs', 'feet', 'shoulders'],
      idempotency_key: randomUUID(),
    });
    assert.equal(humanJob.status, 202, JSON.stringify(humanJob.data));
    const humanRefs = (
      await pool.query('SELECT slot,name,image FROM character_art_equipment WHERE job_id=$1', [
        humanJob.data.id,
      ])
    ).rows;
    assert.equal(humanRefs.length, 6);
    assert.ok(humanRefs.every((row) => /somente a peça/.test(row.name)));
    for (const row of humanRefs) assert.equal((await sharp(row.image).metadata()).format, 'png');
    await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1", [
      humanJob.data.id,
    ]);
    assert.equal((await equip('plate-armor')).status, 200);
    const mount = async (name: string) =>
      (
        await request('/stable/purchase', owner, {
          character_id: hero.id,
          mount_id: 'warhorse',
          name,
          idempotency_key: randomUUID(),
        })
      ).data.mount;
    const one = await mount('Um'),
      two = await mount('Dois');
    const pet = async (pet_id: string, name: string) =>
      (
        await request('/pets/purchase', owner, {
          character_id: hero.id,
          pet_id,
          name,
          idempotency_key: randomUUID(),
        })
      ).data.pet;
    const dog = await pet('dog', 'Pingo'),
      snake = await pet('snake', 'Fita'),
      bird = await pet('owl', 'Brisa');
    const companionPath = `/companions/${hero.id}/equipment`;
    const animalSet = (kind: string, companion_id: string, item_id: string, account = owner) =>
      request(companionPath + '-set', account, { kind, companion_id, item_id }, 'PUT');
    const animalPiece = (
      kind: string,
      companion_id: string,
      slot: string,
      item_id: string | null,
    ) => request(companionPath, owner, { kind, companion_id, slot, item_id }, 'PUT');
    assert.equal((await animalSet('mount', one.id, 'leather-armor')).status, 400);
    assert.equal((await animalSet('pet', dog.id, 'barding-ring-mail')).status, 400);
    assert.equal((await animalSet('mount', one.id, 'pet-armor-leather')).status, 400);
    assert.equal((await animalSet('mount', one.id, 'barding-ring-mail', outsider)).status, 404);
    assert.equal((await animalPiece('mount', one.id, 'armor', 'leather-armor')).status, 400);
    assert.equal((await animalPiece('pet', dog.id, 'head', 'plate-helmet')).status, 400);
    const race = await Promise.all([
      animalSet('mount', one.id, 'barding-ring-mail'),
      animalSet('mount', two.id, 'barding-ring-mail'),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    const winner = race[0].status === 200 ? one : two,
      loser = winner === one ? two : one;
    let outfits = (await request(companionPath, owner)).data;
    let winning = outfits.companions.find((a: any) => a.id === winner.id);
    assert.equal(winning.equipped.length, 1);
    assert.equal(winning.equipment_revision, 1);
    assert.equal(outfits.companions.find((a: any) => a.id === loser.id).equipped.length, 0);
    const again = await Promise.all([
      animalSet('mount', winner.id, 'barding-ring-mail'),
      animalSet('mount', winner.id, 'barding-ring-mail'),
    ]);
    assert.ok(again.every((r) => r.status === 200));
    assert.equal(
      again[0].data.companions.find((a: any) => a.id === winner.id).equipment_revision,
      1,
    );
    assert.equal(
      (await animalPiece('mount', winner.id, 'armor', 'barding-leather-armor')).status,
      200,
    );
    assert.equal((await animalSet('mount', winner.id, 'barding-ring-mail')).status, 200);
    const animalJob = await request(`/companions/${hero.id}/art`, owner, {
      kind: 'mount',
      companion_id: winner.id,
      idempotency_key: randomUUID(),
    });
    assert.equal(animalJob.status, 202, JSON.stringify(animalJob.data));
    const animalRefs = (
      await pool.query('SELECT slot,name,image FROM companion_art_equipment WHERE job_id=$1', [
        animalJob.data.id,
      ])
    ).rows;
    assert.equal(animalRefs.length, 1);
    assert.match(animalRefs[0].name, /Armadura completa da montaria/);
    for (const row of animalRefs) assert.equal((await sharp(row.image).metadata()).format, 'png');
    await pool.query("UPDATE companion_art_jobs SET status='failed' WHERE id=$1", [
      animalJob.data.id,
    ]);
    assert.equal(
      (
        await request('/inventory/transfers', owner, {
          character_id: hero.id,
          item_id: 'barding-ring-mail',
          direction: 'to_vault',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    for (const id of purchaseContents('barding-ring-mail'))
      assert.equal(
        (
          await request('/inventory/equipment', owner, {
            character_id: hero.id,
            slot: (await pool.query('SELECT raw_data FROM catalog_items WHERE id=$1', [id])).rows[0]
              .raw_data.piece_slot,
            item_id: id,
          })
        ).status,
        400,
      );
    assert.equal((await animalSet('pet', dog.id, 'pet-armor-leather')).status, 200);
    assert.equal((await animalSet('pet', snake.id, 'pet-armor-padded')).status, 200);
    assert.equal((await animalSet('pet', bird.id, 'pet-armor-chain')).status, 200);
    outfits = (await request(companionPath, owner)).data;
    assert.deepEqual(
      outfits.companions
        .find((a: any) => a.id === snake.id)
        .equipped.map((i: any) => i.slot)
        .sort(),
      ['armor', 'head'],
    );
    assert.deepEqual(
      outfits.companions
        .find((a: any) => a.id === bird.id)
        .equipped.map((i: any) => i.slot)
        .sort(),
      ['armor', 'feet', 'head'],
    );
    assert.equal(outfits.companions.find((a: any) => a.id === dog.id).equipped.length, 6);
    const before = (
      await pool.query(
        'SELECT slot,item_id FROM companion_equipment WHERE wardrobe_id=$1 ORDER BY slot',
        [dog.id],
      )
    ).rows;
    await request('/inventory/transfers', owner, {
      character_id: hero.id,
      item_id: 'pet-armor-scales--legs',
      direction: 'to_vault',
      quantity: 1,
      idempotency_key: randomUUID(),
    });
    assert.equal((await animalSet('pet', dog.id, 'pet-armor-scales')).status, 409);
    assert.deepEqual(
      (
        await pool.query(
          'SELECT slot,item_id FROM companion_equipment WHERE wardrobe_id=$1 ORDER BY slot',
          [dog.id],
        )
      ).rows,
      before,
    );
    // New strict taxonomy repairs only invalid old reservations, never owned units.
    await pool.query(
      "INSERT INTO companion_equipment(wardrobe_id,character_id,slot,item_id) VALUES($1,$2,'back','leather-armor') ON CONFLICT(wardrobe_id,slot) DO UPDATE SET item_id=EXCLUDED.item_id",
      [loser.id, hero.id],
    );
    const unitsBefore = (
      await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
        hero.id,
        'leather-armor',
      ])
    ).rows[0].quantity;
    await request(companionPath, owner);
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM companion_equipment WHERE wardrobe_id=$1 AND item_id='leather-armor'",
          [loser.id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
          hero.id,
          'leather-armor',
        ])
      ).rows[0].quantity,
      unitsBefore,
    );
    const whole = (await pool.query("SELECT * FROM catalog_items WHERE id='barding-ring-mail'"))
      .rows[0];
    const ref = equipmentArtReference(whole);
    assert.equal(ref.path, whole.image_path);
    assert.match(ref.name, /Armadura completa da montaria/);
    assert.deepEqual(compatibleSlots(whole), []);
    assert.deepEqual(compatibleCompanionSlots(whole, 'mount', 'warhorse'), ['armor']);
    assert.deepEqual(compatibleCompanionSlots(whole, 'pet', 'dog'), []);
    // Ownership checks remain strict even if an administrator loses that role.
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [outsider.id]);
    assert.equal((await equip('leather-armor', outsider)).status, 404);
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [outsider.id]);
    assert.equal((await animalSet('pet', dog.id, 'pet-armor-leather', outsider)).status, 404);
    // A legacy direct purchase remains idempotent and grants every physical piece.
    const directKey = randomUUID();
    await purchase(owner.id, hero.id, 'leather-armor', 1, directKey);
    await purchase(owner.id, hero.id, 'leather-armor', 1, directKey);
    assert.ok(
      (
        await pool.query(
          'SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=ANY($2::text[])',
          [hero.id, purchaseContents('leather-armor')],
        )
      ).rows.every((r) => r.quantity === 2),
    );
    // Old whole suits in both stores are expanded by one captured snapshot only.
    const legacy = await createLegacyTestCharacter(owner.id, 'Armadura antiga');
    await pool.query(
      "INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,'chain-mail',2)",
      [legacy.id],
    );
    await pool.query(
      "INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,'barding-chain-mail',1)",
      [owner.id],
    );
    await pool.query(
      "INSERT INTO armor_bundle_backfills(character_id,item_id,quantity) VALUES($1,'chain-mail',2)",
      [legacy.id],
    );
    await pool.query(
      "INSERT INTO armor_bundle_backfills(user_id,item_id,quantity) VALUES($1,'barding-chain-mail',1)",
      [owner.id],
    );
    const ledgerBefore = (
      await pool.query('SELECT id,total_cp FROM purchases WHERE character_id=$1 ORDER BY id', [
        hero.id,
      ])
    ).rows;
    await seed();
    await seed();
    const oldStock = (
      await pool.query(
        'SELECT i.quantity,c.weight_lb FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1',
        [legacy.id],
      )
    ).rows;
    assert.equal(oldStock.length, 6);
    assert.ok(oldStock.every((row) => row.quantity === 2));
    assert.equal(
      Math.round(oldStock.reduce((sum, row) => sum + row.quantity * Number(row.weight_lb), 0)),
      110,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT 1 FROM account_vault WHERE user_id=$1 AND item_id=ANY($2::text[])',
          [owner.id, purchaseContents('barding-chain-mail')],
        )
      ).rowCount,
      1,
    );
    assert.deepEqual(
      (
        await pool.query('SELECT id,total_cp FROM purchases WHERE character_id=$1 ORDER BY id', [
          hero.id,
        ])
      ).rows,
      ledgerBefore,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
