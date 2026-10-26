import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { defaultChoices } from '../shared/character-sheet';
import { finishTestArt, createLegacyTestCharacter, testArtImage } from './character-fixtures';
import { vehicleIds, vehicleSize, vehicleOccupied, vehiclePoint } from '../shared/vtt-vehicles';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { newScene, newToken } from '../shared/vtt';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { verifySlotMigration } from './slot-migration-fixture';

test('veículos: escala em pés/metros, rotação, ocupação e originais completos', async () => {
  const s = newScene(randomUUID(), 'Veículos'),
    boat = newToken(randomUUID(), s),
    hero = newToken(randomUUID(), s);
  s.grid.size = 70;
  s.grid.scale = 5;
  s.grid.unit = 'ft';
  assert.equal(vehicleSize('rowboat', s).height, 140);
  assert.equal(vehicleSize('galley', s).height, 1820);
  s.grid.scale = 1.524;
  s.grid.unit = 'm';
  assert.ok(Math.abs(vehicleSize('rowboat', s).height - 140) < 0.0001);
  for (const scale of [0.1, 1000]) {
    s.grid.scale = scale;
    s.grid.size = 500;
    const size = vehicleSize('galley', s);
    assert.ok(size.width >= 8 && size.height <= 8000);
    assert.ok(Math.abs(size.height / size.width - 130 / 50) < 0.0001);
  }
  Object.assign(boat, { x: 500, y: 500, width: 200, height: 500, rotation: 90 });
  Object.assign(hero, { x: 600, y: 500, width: 30, height: 30, layer: 'tokens' });
  assert.equal(
    vehicleOccupied(boat, [hero], () => true),
    true,
  );
  assert.equal(
    vehicleOccupied(boat, [{ ...hero, hidden: true }], () => true),
    false,
  );
  assert.equal(
    vehicleOccupied(boat, [hero], () => false),
    false,
  );
  assert.equal(
    vehicleOccupied(boat, [{ ...hero, x: 900 }], () => true),
    false,
  );
  assert.equal(vehiclePoint(boat, { x: 500, y: 500 }).x, 0.5);
  const manifest = JSON.parse(await readFile('data/vtt/vehicles-20261026.json', 'utf8'));
  assert.equal(manifest.assets.length, vehicleIds.length);
  for (const id of vehicleIds) {
    const a = manifest.assets.find((a: any) => a.id === id);
    assert.ok(a);
    const bytes = await readFile('public' + a.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
    const meta = await sharp(bytes).metadata();
    assert.ok(meta.hasAlpha);
    assert.ok(a.clearFraction > 0.25);
  }
});

test('slots e veículos em banco descartável: exclusão, retomada, nível 4, compra e autorização', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await verifySlotMigration();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Who = { id: string; cookie: string };
  const users: Who[] = [];
  async function req(
    path: string,
    who?: Who,
    body?: unknown,
    method = body === undefined ? 'GET' : 'POST',
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: who?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await req('/auth/sign-up/email', undefined, {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    const user = {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
    users.push(user);
    return user;
  }
  const choices = {
    ...defaultChoices('Humano', 'Guerreiro'),
    physicalTraits: { height: 'average', build: 'average', age: 'adult', gender: 'male' },
  };
  let c1 = '',
    c2 = '';
  try {
    const owner = await signup('Dono dos dados'),
      gm = await signup('Mestre dos veículos'),
      other = await signup('Visitante'),
      spectator = other;
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now()) ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
    );
    const reference = (await testArtImage()).toString('base64');
    const creation = (slot: number, name = 'Heroi do slot') => ({
      name,
      race: 'Humano',
      class: 'Guerreiro',
      creation_slot: slot,
      choices,
    });
    const art = (slot: number) => ({
      creation: creation(slot),
      reference,
      idempotency_key: randomUUID(),
    });
    await t.test('dados são privados, idempotentes e não podem pular confirmação', async () => {
      assert.equal((await req('/character-slots')).status, 401);
      assert.equal((await req('/character-art', owner, art(1))).status, 409);
      const [a, b] = await Promise.all([
        req('/character-slots/1/roll', owner, {}),
        req('/character-slots/1/roll', owner, {}),
      ]);
      assert.equal(a.status, 200);
      assert.deepEqual(a.data.rolls, b.data.rolls);
      assert.equal((await req('/character-slots/1/reveal', owner, { revealed: 6 })).status, 409);
      assert.equal((await req('/character-slots/1/reveal', owner, { revealed: 1 })).status, 200);
      assert.equal((await req('/character-slots/1/reveal', owner, { revealed: 2 })).status, 200);
      const after = (await req('/character-slots', owner)).data;
      assert.deepEqual(after[0].rolls, a.data.rolls);
      assert.equal(after[0].revealed, 2);
      assert.equal((await req('/character-slots', other)).data[0].rolls, null);
    });
    await t.test(
      'excluir antes de 4 conserva dados e progresso parcial no mesmo slot',
      async () => {
        // A legacy pending illustration can finish while new clients now roll before art.
        const dice = (await req('/character-slots', owner)).data[0].rolls;
        const j = randomUUID();
        const old = { ...creation(1) };
        delete (old as any).creation_slot;
        await pool.query(
          "INSERT INTO character_art_jobs(id,user_id,creation,reference,status,idempotency_key,creation_slot,roll_generation)VALUES($1,$2,$3,$4,'queued',$1,1,1)",
          [j, owner.id, JSON.stringify(old), Buffer.from(reference, 'base64')],
        );
        c1 = await finishTestArt(j);
        assert.equal((await req('/character-slots/1/roll', owner, {})).status, 409);
        const sheet = (await req(`/characters/${c1}/sheet`, owner)).data.sheet;
        assert.deepEqual(sheet.rolls, dice);
        assert.equal(sheet.rolls_revealed, 2);
        const dress = await req('/character-art', owner, {
          character_id: c1,
          reference,
          idempotency_key: randomUUID(),
        });
        assert.equal(dress.status, 409);
        assert.match(dress.data.error, /atributos antes de Vestir/);
        assert.equal(
          (await req(`/characters/${c1}`, owner, { name: 'Heroi do slot' }, 'DELETE')).status,
          200,
        );
        const saved = (await req('/character-slots/1/roll', owner, {})).data;
        assert.deepEqual(saved.rolls, dice);
        assert.equal(saved.revealed, 2);
        for (let n = 3; n <= 6; n++)
          assert.equal(
            (await req('/character-slots/1/reveal', owner, { revealed: n })).status,
            200,
          );
        const r = await req('/character-art', owner, art(1));
        assert.equal(r.status, 202, JSON.stringify(r.data));
        c2 = await finishTestArt(r.data.id);
        const s = (await req(`/characters/${c2}/sheet`, owner)).data.sheet;
        assert.deepEqual(s.rolls, dice);
        assert.equal(s.rolls_revealed, 6);
        assert.deepEqual(
          (await req(`/characters/${c2}/sheet/roll`, owner, {})).data.sheet.rolls,
          dice,
        );
      },
    );
    await t.test('nível 4 libera somente a próxima criação e conserva a outra vaga', async () => {
      const second = (await req('/character-slots/2/roll', owner, {})).data;
      const before = (await pool.query('SELECT stats FROM characters WHERE id=$1', [c2])).rows[0]
        .stats;
      await pool.query('UPDATE characters SET level=4 WHERE id=$1', [c2]);
      assert.deepEqual(
        (await pool.query('SELECT stats FROM characters WHERE id=$1', [c2])).rows[0].stats,
        before,
      );
      assert.equal((await req('/character-slots/1/roll', owner, {})).status, 409);
      await req(`/characters/${c2}`, owner, { name: 'Heroi do slot' }, 'DELETE');
      const slots = (await req('/character-slots', owner)).data;
      assert.equal(slots[0].rolls, null);
      assert.equal(slots[0].revealed, 0);
      assert.equal(slots[0].generation, 2);
      assert.deepEqual(slots[1].rolls, second.rolls);
      const fresh = (await req('/character-slots/1/roll', owner, {})).data;
      assert.equal(fresh.generation, 2);
      assert.equal(fresh.revealed, 0);
      assert.deepEqual((await req('/character-slots/1/roll', owner, {})).data.rolls, fresh.rolls);
    });
    await t.test('compra entra na lista do mestre, com escala e limite de exemplares', async () => {
      const hero = await createLegacyTestCharacter(owner.id, 'Capitão'),
        outsider = await createLegacyTestCharacter(other.id, 'Fora da mesa'),
        watcher = await createLegacyTestCharacter(spectator.id, 'Só observa');
      await pool.query('UPDATE characters SET gold_cp=9000000 WHERE id=$1', [hero.id]);
      const buy = await req('/purchases', owner, {
        character_id: hero.id,
        item_id: 'airship',
        quantity: 2,
        idempotency_key: randomUUID(),
      });
      assert.equal(buy.status, 201, JSON.stringify(buy.data));
      await pool.query(
        "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'galley',1),($2,'warship',1)",
        [outsider.id, watcher.id],
      );
      const room = (await req('/vtt', gm, { name: 'Veículos' })).data;
      assert.ok(room.id, JSON.stringify(room));
      assert.equal((await req(`/vtt/rooms/${room.id}/vehicles`, other)).status, 404);
      await req('/vtt/join', owner, { invite: room.invite, role: 'player' });
      await req('/vtt/join', spectator, { invite: room.invite, role: 'spectator' });
      const path = `/vtt/rooms/${room.id}/vehicles`,
        body = { characterId: hero.id, itemId: 'airship', copy: 0, position: { x: 500, y: 500 } };
      assert.equal((await req(path, owner)).status, 403);
      const denied = await req(path, spectator, body);
      assert.equal(denied.status, 403, JSON.stringify(denied));
      const owned = (await req(path, gm)).data.vehicles;
      assert.equal(owned.length, 1);
      assert.equal(owned[0].quantity, 2);
      assert.equal(owned[0].characterId, hero.id);
      assert.ok(!('gold_cp' in owned[0]));
      assert.equal(
        (await req(path, gm, { characterId: outsider.id, itemId: 'galley' })).status,
        404,
      );
      assert.equal((await req(path, gm, { ...body, copy: 2 })).status, 404);
      const imported = await req(path, gm, body);
      assert.equal(imported.status, 201, JSON.stringify(imported.data));
      let s = imported.data.document.scenes.find(
          (s: any) => s.id === imported.data.document.activeScene,
        ),
        token = s.tokens.find((t: any) => t.vehicle);
      assert.deepEqual({ width: token.width, height: token.height }, vehicleSize('airship', s));
      assert.equal(token.layer, 'map');
      assert.equal(token.bleeds, false);
      const again = await req(path, gm, body);
      s = again.data.document.scenes.find((s: any) => s.id === again.data.document.activeScene);
      assert.equal(s.tokens.filter((t: any) => t.vehicle).length, 1);
      const next = await req(path, gm, { ...body, copy: 1 });
      s = next.data.document.scenes.find((s: any) => s.id === next.data.document.activeScene);
      assert.equal(s.tokens.filter((t: any) => t.vehicle).length, 2);
      const base = s.tokens.find((t: any) => t.id === token.id),
        rider = newToken(randomUUID(), s);
      Object.assign(rider, {
        name: 'Passageiro no assento',
        x: base.x + 31,
        y: base.y + 47,
        rotation: 37,
        controller: owner.id,
      });
      s.tokens.push(rider);
      const roomPath = `/vtt/rooms/${room.id}`,
        attachmentPath = `${roomPath}/tokens/${rider.id}/attachment`;
      assert.equal(
        (
          await req(
            roomPath,
            gm,
            { revision: next.data.revision, document: next.data.document },
            'PUT',
          )
        ).status,
        200,
      );
      assert.equal((await req(attachmentPath, owner, { tokenId: base.id })).status, 403);
      const linked = await req(attachmentPath, gm, { tokenId: base.id });
      assert.equal(linked.status, 200, JSON.stringify(linked.data));
      const linkedScene = linked.data.document.scenes.find(
          (s: any) => s.id === linked.data.document.activeScene,
        ),
        passenger = linkedScene.tokens.find((t: any) => t.id === rider.id);
      assert.deepEqual([passenger.x, passenger.y, passenger.rotation], [rider.x, rider.y, 37]);
      assert.deepEqual([passenger.attachment.offsetX, passenger.attachment.offsetY], [31, 47]);
      assert.equal(linkedScene.tokens.find((t: any) => t.id === base.id).layer, 'map');
      const moving = linkedScene.tokens.find((t: any) => t.id === base.id);
      moving.x += 100;
      moving.y += 50;
      moving.rotation = 90;
      const moved = await req(
        roomPath,
        gm,
        { revision: linked.data.revision, document: linked.data.document },
        'PUT',
      );
      assert.equal(moved.status, 200, JSON.stringify(moved.data));
      const after = moved.data.document.scenes
        .find((s: any) => s.id === moved.data.document.activeScene)
        .tokens.find((t: any) => t.id === rider.id);
      assert.ok(Math.abs(after.x - (moving.x - 47)) < 0.00001);
      assert.ok(Math.abs(after.y - (moving.y + 31)) < 0.00001);
      assert.equal(after.rotation, 127);
      const unlinked = await req(attachmentPath, gm, { tokenId: null });
      assert.equal(unlinked.status, 200);
      const free = unlinked.data.document.scenes
        .find((s: any) => s.id === unlinked.data.document.activeScene)
        .tokens.find((t: any) => t.id === rider.id);
      assert.deepEqual([free.x, free.y, free.rotation], [after.x, after.y, after.rotation]);
      assert.equal(free.attachment, null);
      assert.equal(
        (
          await pool.query(
            "SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='airship'",
            [hero.id],
          )
        ).rows[0].quantity,
        2,
      );
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
