import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import {
  houseTemplates,
  houseCatalog,
  initialHouseRooms,
  placementSchema,
} from '../shared/house.js';
test('House: propriedade, economia, decoração, presentes e RP em PostgreSQL isolado', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function request(path: string, a?: Account, method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: a?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: r.headers.get('content-type')?.includes('json')
        ? await r.json()
        : await r.arrayBuffer(),
      headers: r.headers,
    };
  }
  async function signup(name: string) {
    const r = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: `house-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup('Dona'),
      guest = await signup('Visitante'),
      admin = await signup('Administrador'),
      other = admin;
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    const hero = await createLegacyTestCharacter(owner.id, 'Aurora'),
      visitor = await createLegacyTestCharacter(guest.id, 'Bruma'),
      outsider = await createLegacyTestCharacter(other.id, 'Pedra');
    await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [hero.id]);
    await pool.query(
      "INSERT INTO achievements(character_id,code)VALUES($1,'first_character') ON CONFLICT DO NOTHING",
      [hero.id],
    );
    let home: any,
      guestHome: any,
      letterId = '',
      frameId = '',
      variantId = '';
    const load = async (a = owner, id = home.id) => (await request(`/house/${id}`, a)).data;
    const layout = () => ({
      revision: home.revision,
      name: home.name,
      rooms: structuredClone(home.rooms),
    });
    await t.test('dezesseis ambientes e casa exclusiva por personagem', async () => {
      assert.equal(houseTemplates.length, 16);
      for (const k of ['sala', 'cozinha', 'varanda', 'jardim'])
        assert.equal(houseTemplates.filter((t) => t.kind === k).length, 4);
      assert.equal((await request('/house')).status, 401);
      assert.equal((await request('/house', guest, 'POST', { character_id: hero.id })).status, 404);
      const r = await request('/house', owner, 'POST', { character_id: hero.id });
      assert.equal(r.status, 201);
      home = await load(owner, r.data.id);
      const duplicate = await request('/house', owner, 'POST', { character_id: hero.id });
      assert.equal(duplicate.data.id, home.id);
      assert.equal(home.rooms.length, 4);
      assert.equal((await request(`/house/${home.id}`, admin)).status, 404);
      guestHome = (await request('/house', guest, 'POST', { character_id: visitor.id })).data;
    });
    await t.test('preço servidor, débito único e recusa de saldo arbitrário', async () => {
      const input = { character_id: hero.id, catalog_id: 'rug', idempotency_key: randomUUID() };
      const results = await Promise.all([
        request('/house/purchase', owner, 'POST', input),
        request('/house/purchase', owner, 'POST', input),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
      assert.equal(results[0].data.item_id, results[1].data.item_id);
      assert.equal(
        (await request('/house/purchase', owner, 'POST', { ...input, price_cp: 1 })).status,
        400,
      );
      assert.equal(
        (await request('/house/purchase', owner, 'POST', { ...input, catalog_id: 'sofa' })).status,
        409,
      );
      assert.equal(
        (
          await request('/house/purchase', guest, 'POST', {
            ...input,
            idempotency_key: randomUUID(),
          })
        ).status,
        404,
      );
      assert.equal(
        Number(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
            .gold_cp,
        ),
        97500,
      );
      home = await load();
    });
    await t.test('geometria, duplicação, ownership e revisão com rollback', async () => {
      const input = layout(),
        item = home.inventory[0];
      input.rooms[0].placements.push({
        id: randomUUID(),
        kind: 'item',
        ref: item.id,
        x: 0.42,
        y: 0.84,
        scale: 0.21,
        rotation: 15,
        layer: 1,
        facing: 7,
        distortion: [
          { x: 0.08, y: -0.05 },
          { x: 0, y: 0 },
          { x: 0, y: 0.12 },
          { x: 0, y: 0 },
        ],
      });
      assert.equal((await request(`/house/${home.id}`, owner, 'PUT', input)).status, 200);
      assert.equal((await request(`/house/${home.id}`, owner, 'PUT', input)).status, 409);
      home = await load();
      assert.equal(home.rooms[0].placements[0].facing, 7);
      assert.deepEqual(
        home.rooms[0].placements[0].distortion,
        input.rooms[0].placements[0].distortion,
      );
      for (const invalid of [
        [
          { x: 0.13, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        [
          { x: 0, y: -0.13 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        [{ x: 0, y: 0 }],
      ]) {
        const invalidWarp = layout();
        invalidWarp.rooms[0].placements[0].distortion = invalid;
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', invalidWarp)).status, 400);
        assert.equal((await load()).revision, home.revision);
      }
      for (const invalid of [-1, 16, 1.5]) {
        const invalidView = layout();
        invalidView.rooms[0].placements[0].facing = invalid;
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', invalidView)).status, 400);
        assert.equal((await load()).revision, home.revision);
      }
      const next = layout();
      next.rooms[1].placements.push({ ...next.rooms[0].placements[0], id: randomUUID() });
      assert.equal((await request(`/house/${home.id}`, owner, 'PUT', next)).status, 400);
      next.rooms[1].placements = [];
      next.rooms[0].placements[0].ref = randomUUID();
      assert.equal((await request(`/house/${home.id}`, owner, 'PUT', next)).status, 400);
      assert.equal((await load()).revision, 1);
      next.rooms[0].placements = [];
      next.rooms[0].template = 'garden-moon';
      assert.equal((await request(`/house/${home.id}`, owner, 'PUT', next)).status, 400);
    });
    await t.test('carta e quadro com imagem própria, sem endereço externo', async () => {
      const image = (
        await sharp({ create: { width: 50, height: 50, channels: 4, background: '#70624b' } })
          .png()
          .toBuffer()
      ).toString('base64');
      let r = await request('/house/purchase', owner, 'POST', {
        character_id: hero.id,
        catalog_id: 'letter',
        idempotency_key: randomUUID(),
        content: { title: 'Primeira viagem', text: 'Guarde esta lembrança do caminho.' },
      });
      assert.equal(r.status, 201);
      letterId = r.data.item_id;
      r = await request('/house/purchase', owner, 'POST', {
        character_id: hero.id,
        catalog_id: 'frame',
        idempotency_key: randomUUID(),
        content: { title: 'A ponte', text: 'Onde nos encontramos.' },
        image,
      });
      assert.equal(r.status, 201);
      frameId = r.data.item_id;
      assert.equal((await request(`/house/items/${frameId}/image`, owner)).status, 200);
      assert.equal((await request(`/house/items/${frameId}/image`, guest)).status, 404);
      assert.equal(
        (
          await request('/house/purchase', owner, 'POST', {
            character_id: hero.id,
            catalog_id: 'frame',
            idempotency_key: randomUUID(),
            image: 'https://bad.test/secret',
          })
        ).status,
        400,
      );
      home = await load();
    });
    await t.test('convite pendente não libera a casa; aceite libera só visita e RP', async () => {
      assert.equal(
        (await request(`/house/${home.id}/invites`, owner, 'POST', { user_id: guest.id })).status,
        200,
      );
      assert.equal((await request(`/house/${home.id}`, guest)).status, 404);
      assert.equal(
        (
          await request(`/house/${home.id}/invites/${guest.id}`, other, 'PUT', {
            status: 'accepted',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(`/house/${home.id}/invites/${guest.id}`, guest, 'PUT', {
            status: 'accepted',
          })
        ).status,
        200,
      );
      const view = await load(guest);
      assert.equal(view.is_owner, false);
      assert.deepEqual(view.inventory, []);
      assert.deepEqual(view.invites, []);
      assert.equal(view.gold_cp, undefined);
      assert.equal(view.items.length, 1);
      assert.equal((await request(`/house/${home.id}`, guest, 'PUT', layout())).status, 404);
      assert.equal((await request(`/house/${home.id}/rewards`, guest, 'POST', {})).status, 404);
    });
    await t.test(
      'perspectiva por objeto persiste, valida limites e conserva layouts antigos',
      async () => {
        const chair = await request('/house/purchase', owner, 'POST', {
          character_id: hero.id,
          catalog_id: 'chair',
          idempotency_key: randomUUID(),
        });
        assert.equal(chair.status, 201);
        home = await load();
        const input = layout();
        input.rooms[0].placements[0].perspective_pitch = 13.25;
        input.rooms[0].placements[0].perspective_yaw = -8.5;
        input.rooms[1].placements.push({
          id: randomUUID(),
          kind: 'item',
          ref: chair.data.item_id,
          x: 0.35,
          y: 0.78,
          scale: 0.2,
          rotation: 0,
          layer: 0,
          perspective_pitch: 4,
          perspective_yaw: 9,
        });
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', input)).status, 200);
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', input)).status, 409);
        home = await load();
        assert.equal(home.rooms[0].placements[0].perspective_pitch, 13.25);
        assert.equal(home.rooms[0].placements[0].perspective_yaw, -8.5);
        assert.equal(home.rooms[1].placements[0].perspective_pitch, 4);
        assert.equal(home.rooms[1].placements[0].perspective_yaw, 9);
        const unchanged = structuredClone(home.rooms);
        const revision = home.revision;
        for (const [field, value] of [
          ['perspective_pitch', -0.1],
          ['perspective_pitch', 20.1],
          ['perspective_pitch', null],
          ['perspective_pitch', '8'],
          ['perspective_yaw', -20.1],
          ['perspective_yaw', 20.1],
          ['perspective_yaw', null],
        ]) {
          const invalid = layout();
          invalid.rooms[0].placements[0][field as string] = value;
          assert.equal((await request(`/house/${home.id}`, owner, 'PUT', invalid)).status, 400);
        }
        for (const field of ['perspective_pitch', 'perspective_yaw'])
          for (const value of [Infinity, -Infinity, NaN])
            assert.equal(
              placementSchema.safeParse({ ...home.rooms[0].placements[0], [field]: value }).success,
              false,
            );
        const guestAttempt = layout();
        guestAttempt.rooms[0].placements[0].perspective_pitch = 0;
        assert.equal((await request(`/house/${home.id}`, guest, 'PUT', guestAttempt)).status, 404);
        assert.equal((await request(`/house/${home.id}`, admin, 'PUT', guestAttempt)).status, 404);
        const afterRejected = await load();
        assert.equal(afterRejected.revision, revision);
        assert.deepEqual(afterRejected.rooms, unchanged);
        const legacy = layout();
        for (const room of legacy.rooms)
          for (const placement of room.placements) {
            delete placement.perspective_pitch;
            delete placement.perspective_yaw;
          }
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', legacy)).status, 200);
        home = await load();
        for (const room of home.rooms)
          for (const placement of room.placements) {
            assert.equal(placement.perspective_pitch, undefined);
            assert.equal(placement.perspective_yaw, undefined);
          }
      },
    );
    await t.test(
      'fundo do quadro é opcional, persistente e visível somente a visitantes autorizados',
      async () => {
        const frame = await request('/house/purchase', owner, 'POST', {
          character_id: hero.id,
          catalog_id: 'frame',
          idempotency_key: randomUUID(),
        });
        assert.equal(frame.status, 201);
        home = await load();
        const placementId = randomUUID();
        const initial = layout();
        initial.rooms[0].placements.push({
          id: placementId,
          kind: 'item',
          ref: frame.data.item_id,
          x: 0.62,
          y: 0.24,
          scale: 0.1,
          rotation: 0,
          layer: 3,
        });
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', initial)).status, 200);
        home = await load();
        const placed = (state: any) =>
          state.rooms[0].placements.find((piece: any) => piece.id === placementId);
        assert.equal(placed(home).frame_backing, undefined);
        assert.equal(placed(await load(guest)).frame_backing, undefined);
        for (const frame_backing of [true, false]) {
          const updated = layout();
          placed(updated).frame_backing = frame_backing;
          assert.equal((await request(`/house/${home.id}`, owner, 'PUT', updated)).status, 200);
          assert.equal((await request(`/house/${home.id}`, owner, 'PUT', updated)).status, 409);
          home = await load();
          assert.equal(placed(home).frame_backing, frame_backing);
          const visitorView = await load(guest);
          assert.equal(placed(visitorView).frame_backing, frame_backing);
          assert.equal(visitorView.inventory.length, 0);
          assert.equal(
            visitorView.items.find((item: any) => item.id === frame.data.item_id).has_image,
            false,
          );
        }
        const unchanged = structuredClone(home.rooms);
        const revision = home.revision;
        for (const value of [null, 'true', 'false', 0, 1, {}, []]) {
          const invalid = layout();
          placed(invalid).frame_backing = value;
          assert.equal((await request(`/house/${home.id}`, owner, 'PUT', invalid)).status, 400);
        }
        const attempted = layout();
        placed(attempted).frame_backing = true;
        assert.equal((await request(`/house/${home.id}`, guest, 'PUT', attempted)).status, 404);
        assert.equal((await request(`/house/${home.id}`, admin, 'PUT', attempted)).status, 404);
        const afterRejected = await load();
        assert.equal(afterRejected.revision, revision);
        assert.deepEqual(afterRejected.rooms, unchanged);
        assert.equal((await request(`/house/${home.id}`, other)).status, 404);
        const legacy = layout();
        delete placed(legacy).frame_backing;
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', legacy)).status, 200);
        home = await load();
        assert.equal(placed(home).frame_backing, undefined);
        assert.equal(placed(await load(guest)).frame_backing, undefined);
        const cleared = layout();
        cleared.rooms[0].placements = cleared.rooms[0].placements.filter(
          (piece: any) => piece.id !== placementId,
        );
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', cleared)).status, 200);
        home = await load();
      },
    );
    await t.test('presente transfere a peça uma única vez e preserva conteúdo', async () => {
      assert.equal(
        (
          await request(`/house/items/${letterId}/gift`, owner, 'POST', {
            character_id: visitor.id,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(`/house/items/${letterId}/gift`, owner, 'POST', {
            character_id: outsider.id,
          })
        ).status,
        404,
      );
      const collection = await load(guest, guestHome.id);
      assert.equal(collection.inventory.length, 1);
      assert.equal(collection.inventory[0].content.text, 'Guarde esta lembrança do caminho.');
      assert.equal(collection.inventory[0].sender_name, 'Dona');
      assert.equal(
        (
          await pool.query('SELECT count(*)::int AS n FROM house_gift_audit WHERE item_id=$1', [
            letterId,
          ])
        ).rows[0].n,
        1,
      );
      const draft = layout();
      draft.rooms[0].placements.push({
        id: randomUUID(),
        kind: 'item',
        ref: frameId,
        x: 0.7,
        y: 0.25,
        scale: 0.1,
        rotation: 0,
        layer: 2,
      });
      assert.equal((await request(`/house/${home.id}`, owner, 'PUT', draft)).status, 200);
      home = await load();
      assert.equal(
        (await request(`/house/items/${frameId}/gift`, owner, 'POST', { character_id: visitor.id }))
          .status,
        409,
      );
      assert.equal((await request(`/house/items/${frameId}/image`, guest)).status, 200);
    });
    await t.test('versões privadas, presença própria e RP idempotente', async () => {
      const image = (
        await sharp({ create: { width: 70, height: 120, channels: 4, background: '#897354' } })
          .webp()
          .toBuffer()
      ).toString('base64');
      let r = await request('/house/variants', guest, 'POST', {
        character_id: visitor.id,
        name: 'Ao fogo',
        image,
      });
      assert.equal(r.status, 201);
      variantId = r.data.id;
      assert.equal((await request(`/house/variants/${variantId}/image`, owner)).status, 404);
      const input = {
        character_id: visitor.id,
        variant_id: variantId,
        room: 'sala',
        x: 0.4,
        y: 0.8,
        scale: 0.18,
      };
      assert.equal((await request(`/house/${home.id}/presence`, guest, 'PUT', input)).status, 200);
      assert.equal((await request(`/house/variants/${variantId}/image`, owner)).status, 200);
      assert.equal((await request(`/house/${home.id}/presence`, owner, 'PUT', input)).status, 404);
      const message = {
        character_id: visitor.id,
        body: 'Bruma aproxima-se da lareira.',
        idempotency_key: randomUUID(),
      };
      const sent = await Promise.all([
        request(`/house/${home.id}/messages`, guest, 'POST', message),
        request(`/house/${home.id}/messages`, guest, 'POST', message),
      ]);
      assert.equal(sent[0].data.id, sent[1].data.id);
      assert.equal((await load()).messages.length, 1);
      assert.equal(
        (
          await request(`/house/${home.id}/messages`, guest, 'POST', {
            ...message,
            body: 'Outra mensagem.',
          })
        ).status,
        409,
      );
    });
    await t.test('concessões administrativas e conquistas não duplicam recompensas', async () => {
      const grant = {
        character_id: hero.id,
        catalog_id: 'books',
        reason: 'Prêmio de decoração',
        idempotency_key: randomUUID(),
      };
      assert.equal((await request('/house/admin/grants', owner, 'POST', grant)).status, 403);
      const pair = await Promise.all([
        request('/house/admin/grants', admin, 'POST', grant),
        request('/house/admin/grants', admin, 'POST', grant),
      ]);
      assert.ok(pair.every((r) => r.status === 201));
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM house_items WHERE character_id=$1 AND source='admin'",
            [hero.id],
          )
        ).rows[0].n,
        1,
      );
      const r = await request('/house/admin/rewards', admin, 'POST', {
        catalog_id: 'chest',
        achievement_code: 'first_character',
      });
      assert.equal(r.status, 201);
      assert.equal((await request('/house/admin/rewards', owner)).status, 403);
      const grants = await Promise.all([
        request(`/house/${home.id}/rewards`, owner, 'POST', {}),
        request(`/house/${home.id}/rewards`, owner, 'POST', {}),
      ]);
      assert.equal(
        grants.reduce((s, r) => s + r.data.granted, 0),
        1,
      );
      assert.equal((await request(`/house/${home.id}/rewards`, owner, 'POST', {})).data.granted, 0);
      await request('/house/admin/rewards/' + r.data.id, admin, 'PUT', { active: false });
    });
    await t.test(
      'recompensa exige missão concluída real; dados arbitrários recusados',
      async () => {
        const m = (
          await pool.query(
            "INSERT INTO board_posts(author_id,kind,status,title,description,location,difficulty,mission_rank)VALUES($1,'mission','active','Missão da casa','Uma jornada da guilda.','Vigília','Tranquila','Ferro')RETURNING id",
            [admin.id],
          )
        ).rows[0];
        await request('/house/admin/rewards', admin, 'POST', {
          catalog_id: 'lantern',
          mission_id: m.id,
        });
        assert.equal(
          (await request(`/house/${home.id}/rewards`, owner, 'POST', {})).data.granted,
          0,
        );
        await pool.query('INSERT INTO mission_participants(post_id,character_id)VALUES($1,$2)', [
          m.id,
          hero.id,
        ]);
        await pool.query(
          'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by,gold_cp)VALUES($1,$2,0,$3,15000)',
          [m.id, hero.id, admin.id],
        );
        assert.equal(
          (await request(`/house/${home.id}/rewards`, owner, 'POST', {})).data.granted,
          0,
        );
        await pool.query("UPDATE board_posts SET status='completed' WHERE id=$1", [m.id]);
        assert.equal(
          (await request(`/house/${home.id}/rewards`, owner, 'POST', {})).data.granted,
          1,
        );
        assert.equal(
          (await request(`/house/${home.id}/rewards`, owner, 'POST', { mission_count: 999 }))
            .status,
          400,
        );
      },
    );
    await t.test(
      'consulta administrativa de recompensas usa ordem estável e permissão vigente',
      async () => {
        assert.equal((await request('/house/admin/rewards')).status, 401);
        assert.equal((await request('/house/admin/rewards', owner)).status, 403);
        assert.equal((await request('/house/admin/rewards', guest)).status, 403);
        const response = await request('/house/admin/rewards', admin);
        assert.equal(response.status, 200);
        const rules = response.data.rules;
        assert.equal(rules.length, 2);
        assert.ok(rules.some((rule: any) => rule.catalog_id === 'chest' && !rule.active));
        assert.ok(rules.some((rule: any) => rule.catalog_id === 'lantern' && rule.active));
        const ids = rules.map((rule: any) => rule.id);
        assert.deepEqual(ids, [...ids].sort());
        assert.deepEqual((await request('/house/admin/rewards', admin)).data.rules, rules);
        assert.ok(
          response.data.missions.some((mission: any) => mission.title === 'Missão da casa'),
        );
        assert.ok(
          response.data.achievements.some(
            (achievement: any) => achievement.code === 'first_character',
          ),
        );
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
        try {
          assert.equal((await request('/house/admin/rewards', admin)).status, 403);
        } finally {
          await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
        }
      },
    );
    await t.test('revogação retira presença e acesso inclusive às imagens', async () => {
      assert.equal(
        (
          await request(`/house/${home.id}/invites/${guest.id}`, owner, 'PUT', {
            status: 'revoked',
          })
        ).status,
        200,
      );
      assert.equal((await request(`/house/${home.id}`, guest)).status, 404);
      assert.equal((await request(`/house/items/${frameId}/image`, guest)).status, 404);
      assert.equal((await request(`/house/variants/${variantId}/image`, owner)).status, 404);
      assert.equal((await load()).presence.length, 0);
      assert.equal(
        (
          await request(`/house/${home.id}/messages`, guest, 'POST', {
            character_id: visitor.id,
            body: 'Tentativa',
            idempotency_key: randomUUID(),
          })
        ).status,
        404,
      );
      assert.equal((await load()).messages.length, 1);
    });
    await t.test(
      'camada da presença é privada, persiste no arraste legado e valida limites',
      async () => {
        const input = {
          character_id: hero.id,
          variant_id: null,
          room: 'sala',
          x: 0.5,
          y: 0.84,
          scale: 0.19,
          layer: 0,
        };
        assert.equal(
          (await request(`/house/${home.id}/presence`, owner, 'PUT', input)).status,
          200,
        );
        assert.equal((await load()).presence.find((p: any) => p.user_id === owner.id).layer, 0);
        assert.equal(
          (await load()).presence.find((p: any) => p.user_id === owner.id).flip_x,
          false,
        );
        assert.equal(
          (await request(`/house/${home.id}/presence`, owner, 'PUT', { ...input, flip_x: true }))
            .status,
          200,
        );
        assert.equal((await load()).presence.find((p: any) => p.user_id === owner.id).flip_x, true);
        for (const invalid of ['true', 1, null])
          assert.equal(
            (
              await request(`/house/${home.id}/presence`, owner, 'PUT', {
                ...input,
                flip_x: invalid,
              })
            ).status,
            400,
          );
        const { layer, ...legacy } = input;
        assert.equal(
          (await request(`/house/${home.id}/presence`, owner, 'PUT', { ...legacy, x: 0.6 })).status,
          200,
        );
        assert.equal((await load()).presence.find((p: any) => p.user_id === owner.id).layer, 0);
        assert.equal((await load()).presence.find((p: any) => p.user_id === owner.id).flip_x, true);
        assert.equal(
          (await request(`/house/${home.id}/presence`, guest, 'PUT', { ...input, flip_x: false }))
            .status,
          404,
        );
        assert.equal((await load()).presence.find((p: any) => p.user_id === owner.id).flip_x, true);
        assert.equal(
          (await request(`/house/${home.id}/presence`, owner, 'PUT', { ...input, flip_x: false }))
            .status,
          200,
        );
        assert.equal(
          (await load()).presence.find((p: any) => p.user_id === owner.id).flip_x,
          false,
        );
        for (const invalid of [-1, 603, 0.5])
          assert.equal(
            (
              await request(`/house/${home.id}/presence`, owner, 'PUT', {
                ...input,
                layer: invalid,
              })
            ).status,
            400,
          );
        assert.equal(
          (await request(`/house/${home.id}/presence`, guest, 'PUT', input)).status,
          404,
        );
        assert.equal(
          (await request(`/house/${home.id}/presence`, owner, 'PUT', { ...input, layer: 602 }))
            .status,
          200,
        );
        for (const depth_layer of [1, 2, 3, 4, 5, 6]) {
          assert.equal(
            (await request(`/house/${home.id}/presence`, owner, 'PUT', { ...input, depth_layer }))
              .status,
            200,
          );
          assert.equal(
            (await load()).presence.find((p: any) => p.user_id === owner.id).depth_layer,
            depth_layer,
          );
        }
        assert.equal(
          (await request(`/house/${home.id}/presence`, owner, 'PUT', legacy)).status,
          200,
        );
        assert.equal(
          (await load()).presence.find((p: any) => p.user_id === owner.id).depth_layer,
          6,
        );
        for (const depth_layer of [0, 7, 1.5])
          assert.equal(
            (await request(`/house/${home.id}/presence`, owner, 'PUT', { ...input, depth_layer }))
              .status,
            400,
          );
      },
    );
    await t.test(
      'excluir item exige dono e arquiva sem alterar ouro, compras ou replays',
      async () => {
        const input = { character_id: hero.id, catalog_id: 'frame', idempotency_key: randomUUID() };
        const purchase = await request('/house/purchase', owner, 'POST', input);
        assert.equal(purchase.status, 201);
        const id = purchase.data.item_id;
        home = await load();
        const next = layout();
        next.rooms[0].placements.push(
          placementSchema.parse({
            id: randomUUID(),
            kind: 'item',
            ref: id,
            x: 0.4,
            y: 0.6,
            scale: 0.2,
            rotation: 0,
            layer: 3,
            facing: 0,
          }),
        );
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', next)).status, 200);
        home = await load();
        const original = structuredClone(home);
        const gold = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
          .rows[0].gold_cp;
        assert.equal((await request(`/house/items/${id}`, undefined, 'DELETE')).status, 401);
        for (const account of [guest, admin]) {
          assert.equal((await request(`/house/items/${id}`, account, 'DELETE')).status, 404);
        }
        assert.equal((await request(`/house/items/${id}`, owner, 'DELETE')).status, 200);
        home = await load();
        assert.equal(home.revision, original.revision + 1);
        assert.ok(!home.inventory.some((i: any) => i.id === id));
        assert.ok(home.rooms.every((r: any) => r.placements.every((p: any) => p.ref !== id)));
        assert.equal((await request(`/house/items/${id}/image`, owner)).status, 404);
        assert.equal(
          (await request(`/house/items/${id}/gift`, owner, 'POST', { character_id: visitor.id }))
            .status,
          404,
        );
        const readd = { ...layout(), rooms: original.rooms };
        assert.equal((await request(`/house/${home.id}`, owner, 'PUT', readd)).status, 400);
        assert.equal((await request(`/house/items/${id}`, owner, 'DELETE')).status, 200);
        assert.equal((await load()).revision, home.revision);
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
            .gold_cp,
          gold,
        );
        const replay = await request('/house/purchase', owner, 'POST', input);
        assert.equal(replay.status, 200);
        assert.equal(replay.data.item_id, id);
        assert.ok(!(await load()).inventory.some((i: any) => i.id === id));
        assert.ok(
          (await pool.query('SELECT deleted_at FROM house_items WHERE id=$1', [id])).rows[0]
            .deleted_at,
        );
        assert.equal(
          (
            await pool.query('SELECT count(*)::int AS total FROM house_orders WHERE item_id=$1', [
              id,
            ])
          ).rows[0].total,
          1,
        );
      },
    );
    await t.test('bloqueio social impede convites e presentes', async () => {
      await pool.query('INSERT INTO social_blocks(blocker_id,blocked_id)VALUES($1,$2)', [
        other.id,
        owner.id,
      ]);
      assert.equal(
        (await request(`/house/${home.id}/invites`, owner, 'POST', { user_id: other.id })).status,
        403,
      );
      const letter = await request('/house/purchase', owner, 'POST', {
        character_id: hero.id,
        catalog_id: 'letter',
        idempotency_key: randomUUID(),
      });
      assert.equal(
        (
          await request(`/house/items/${letter.data.item_id}/gift`, owner, 'POST', {
            character_id: outsider.id,
          })
        ).status,
        403,
      );
    });
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await pool.end();
  }
});
