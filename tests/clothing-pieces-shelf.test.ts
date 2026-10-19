import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { clothingBundles, clothingPieceAppearance } from '../shared/clothing-bundles.js';
import { purchaseContents, shopWeight } from '../shared/armor-bundles.js';
import { compatibleSlots } from '../shared/equipment.js';
import { equipmentArtReference } from '../server/equipment-art-reference.js';
import { reorderShelfPiece } from '../shared/shelf-layout.js';
import { emptyShelf } from '../shared/achievements.js';

test('sobreposição preserva posição/prateleira e escolha da peça ao enviar para frente ou trás', () => {
  const initial = {
    ...emptyShelf(),
    slots: ['first_character', 'first_purchase', 'first_mission'],
    positions: [10, 10, 50],
    rows: [0, 0, 2],
  };
  const front = reorderShelfPiece(initial, 0, 'front');
  assert.deepEqual(front.config.slots, ['first_purchase', 'first_mission', 'first_character']);
  assert.deepEqual(front.config.positions, [10, 50, 10]);
  assert.deepEqual(front.config.rows, [0, 2, 0]);
  assert.equal(front.selected, 2);
  assert.deepEqual(reorderShelfPiece(front.config, 2, 'back').config, initial);
  assert.deepEqual(initial.slots, ['first_character', 'first_purchase', 'first_mission']);
});

test('trajes: quatro peças reais, replay, rollback, migração antiga, ícones, equipamento e estante persistidos', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  let cookie = '';
  const req = async (path: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  try {
    const signup = await req('/auth/sign-up/email', {
      name: 'Trajes',
      email: `pieces-${randomUUID()}@example.test`,
      password: 'Test-' + randomUUID(),
    });
    assert.equal(signup.status, 200);
    const uid = signup.data.user.id;
    cookie = signup.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const character = await createLegacyTestCharacter(uid),
      other = await createLegacyTestCharacter(uid, 'Outro');
    await pool.query("INSERT INTO achievements(character_id,code) VALUES($1,'first_character')", [character.id]);
    await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [character.id]);

    // Simulate the exact old database state and execute the real migration again.
    await pool.query('DROP TABLE clothing_bundle_backfills');
    await pool.query("DELETE FROM schema_migrations WHERE name='112_clothing_pieces.sql'");
    await pool.query(
      "INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,'cosmetic-outfit-traveler-blue',2)",
      [other.id],
    );
    await pool.query(
      "INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,'cosmetic-outfit-traveler-wine',3)",
      [uid],
    );
    await pool.query(
      "INSERT INTO character_equipment(character_id,slot,item_id) VALUES($1,'armor','cosmetic-outfit-traveler-blue')",
      [other.id],
    );
    await migrate();
    await seed();
    await seed();
    const before = await req(`/characters/${other.id}/storage`);
    assert.equal(before.data.inventory.length, 4);
    assert(before.data.inventory.every((i: any) => i.quantity === 2));
    assert.equal(before.data.vault.length, 4);
    assert(before.data.vault.every((i: any) => i.quantity === 3));
    assert.equal(before.data.equipped[0].id, 'cosmetic-outfit-traveler-blue');
    assert.match(before.data.equipped[0].name, /Túnica.*Azul-anil/);
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM clothing_bundle_backfills WHERE applied_at IS NOT NULL',
        )
      ).rows[0].n,
      2,
    );

    const catalog = (await req('/catalog')).data;
    for (const bundle of clothingBundles()) {
      const offer = catalog.find((i: any) => i.id === bundle.id);
      assert(offer.image_path.includes('cosmetic-outfit-traveler'));
      assert.equal(shopWeight(offer), 5);
      assert.equal(offer.price_cp, 1200);
      assert.deepEqual(
        purchaseContents(bundle.id),
        bundle.pieces.map((p) => p.id),
      );
      const input = {
        character_id: character.id,
        idempotency_key: randomUUID(),
        items: [{ item_id: bundle.id, quantity: 2 }],
      };
      const result = await Promise.all([
        req('/shop/checkout', input),
        req('/shop/checkout', input),
      ]);
      assert.deepEqual(result.map((r) => r.status).sort(), [200, 201]);
      for (const piece of bundle.pieces) {
        const stock = (await req(`/characters/${character.id}/storage`)).data.inventory.find(
          (i: any) => i.id === piece.id,
        );
        assert.equal(stock.quantity, 2);
        assert.equal(stock.image_path, piece.image_path);
        assert.equal(stock.name, piece.name);
        assert.equal(Number(stock.weight_lb), piece.weight_lb);
        assert.deepEqual(compatibleSlots(stock), [piece.slot]);
        assert.deepEqual(clothingPieceAppearance(stock), stock);
        assert.equal(equipmentArtReference(stock).path, piece.image_path);
        assert.match(equipmentArtReference(stock).name, new RegExp(piece.name.split(' (')[0]));
        assert.equal(
          (
            await req('/inventory/equipment', {
              character_id: character.id,
              item_id: piece.id,
              slot: piece.slot,
            })
          ).status,
          200,
        );
        if (piece.id !== bundle.id) {
          assert(!catalog.some((i: any) => i.id === piece.id));
          assert.equal(
            (
              await req('/purchases', {
                character_id: character.id,
                item_id: piece.id,
                quantity: 1,
                idempotency_key: randomUUID(),
              })
            ).status,
            404,
          );
        }
      }
    }
    const stock = (await req(`/characters/${character.id}/storage`)).data.inventory;
    assert.equal(stock.length, 20);
    assert.equal(
      stock.reduce((s: number, i: any) => s + Number(i.weight_lb) * i.quantity, 0),
      50,
    );
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [character.id])).rows[0]
        .gold_cp,
      88000,
    );
    const grants = (
      await pool.query(
        'SELECT g.* FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1',
        [character.id],
      )
    ).rows;
    assert.equal(grants.length, 20);
    assert(grants.every((g) => g.quantity === 2));
    assert.equal(
      (await req(`/characters/${character.id}/details`)).data.inventory.find(
        (i: any) => i.id === 'cosmetic-outfit-traveler',
      ).image_path,
      '/shop/clothing-pieces-20261019/tunic-forest.webp',
    );
    await seed();
    assert.deepEqual((await req(`/characters/${character.id}/storage`)).data.inventory, stock);

    // Force failure after a component was inserted: debit, purchase and partial delivery all roll back.
    await pool.query(
      `CREATE FUNCTION fail_outfit_piece() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.item_id='cosmetic-outfit-traveler--legs' THEN RAISE EXCEPTION 'simulated grant failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      'CREATE TRIGGER test_fail_outfit BEFORE INSERT ON inventory FOR EACH ROW EXECUTE FUNCTION fail_outfit_piece()',
    );
    assert.equal(
      (
        await req('/purchases', {
          character_id: character.id,
          item_id: 'cosmetic-outfit-traveler',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      500,
    );
    await pool.query('DROP TRIGGER test_fail_outfit ON inventory');
    await pool.query('DROP FUNCTION fail_outfit_piece()');
    assert.deepEqual((await req(`/characters/${character.id}/storage`)).data.inventory, stock);
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [character.id])).rows[0]
        .gold_cp,
      88000,
    );
    assert.equal(
      (
        await pool.query('SELECT count(*)::int n FROM purchases WHERE character_id=$1', [
          character.id,
        ])
      ).rows[0].n,
      5,
    );

    const path = `/characters/${character.id}/achievements`;
    const initial = {
      ...emptyShelf(),
      slots: ['first_character', 'first_purchase'],
      positions: [10, 10],
      rows: [0, 0],
    };
    assert.equal((await req(path, initial)).status, 200);
    const layered = reorderShelfPiece(initial, 0, 'front').config;
    assert.equal((await req(path, layered)).status, 200);
    assert.deepEqual((await req(path)).data.shelf, layered);
    const removed = {
      ...layered,
      slots: layered.slots.slice(1),
      positions: layered.positions!.slice(1),
      rows: layered.rows!.slice(1),
    };
    assert.equal((await req(path, removed)).status, 200);
    assert.deepEqual((await req(path)).data.shelf, removed);
    assert.equal((await req(`/characters/${randomUUID()}/achievements`, removed)).status, 404);
    assert(
      (await req(path)).data.unlocked.some((i: any) => i.code === 'first_purchase'),
      'removing from shelf keeps the earned achievement',
    );
    const manifest = JSON.parse(await readFile('data/clothing-pieces-art-20261019.json', 'utf8'));
    assert.equal(manifest.assets.length, 8);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
