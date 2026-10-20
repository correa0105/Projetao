import { rpDecor } from '../shared/rp-lobby';
import { houseDefaultFacing } from '../shared/house';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { guildDocumentSchema } from '../shared/guilds';
import { guildFacilities, guildFacilityCost } from '../shared/guild-facilities';

test('Lobby de RP e instalações: acesso, edição, presença, convites e economia isolados', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const base = 'http://127.0.0.1:' + addr.port + '/api';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function request(path: string, who?: Account, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: who?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  async function signup(name: string) {
    const id = randomUUID(),
      token = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [
      id,
      name,
      id + '@example.test',
    ]);
    await pool.query(
      'INSERT INTO session(id,token,"userId","expiresAt") VALUES($1,$2,$3,now()+interval \'1 hour\')',
      [randomUUID(), token, id],
    );
    const signed =
      token +
      '.' +
      createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');
    return { id, cookie: 'better-auth.session_token=' + encodeURIComponent(signed) };
  }
  try {
    const owner = await signup('Anfitrião'),
      friend = await signup('Amigo'),
      outsider = await signup('Visitante'),
      admin = await signup('Administrador');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    const hero = await createLegacyTestCharacter(owner.id, 'Arden'),
      guest = await createLegacyTestCharacter(friend.id, 'Mira'),
      stranger = await createLegacyTestCharacter(outsider.id, 'Bran');
    const pair = [owner.id, friend.id].sort();
    await pool.query(
      "INSERT INTO social_friendships(user_a,user_b,requested_by,status) VALUES($1,$2,$1,'accepted')",
      pair,
    );
    const index = await request('/rp-lobby', owner);
    assert.equal(index.status, 200);
    assert.equal(index.data.rooms.filter((r: any) => r.kind === 'fixed').length, 4);
    const fixed = index.data.rooms[0];
    let privateId = '';
    await t.test('salas fixas abertas com decoração do sistema e sem edição por jogadores', async () => {
      const scene = await request('/rp-lobby/' + fixed.id, outsider);
      assert.equal(scene.status, 200);
      assert.deepEqual(scene.data.document.placements, []);
      const input = { name: fixed.name, document: fixed.document, revision: fixed.revision };
      assert.equal((await request('/rp-lobby/' + fixed.id, owner, 'PUT', input)).status, 403);
      assert.equal((await request('/rp-lobby/' + fixed.id, admin, 'PUT', input)).status, 403);
      assert.equal(
        (await request('/rp-lobby/' + fixed.id + '/close', admin, 'POST', {})).status,
        403,
      );
    });
    await t.test(
      'sala privada temporária, uma por anfitrião, convite somente entre amigos',
      async () => {
        assert.equal(
          (
            await request('/rp-lobby', owner, 'POST', {
              name: 'Sala alheia',
              scene: 'beach',
              hours: 2,
              character_id: stranger.id,
            })
          ).status,
          404,
        );
        const created = await request('/rp-lobby', owner, 'POST', {
          name: 'Encontro na praia',
          scene: 'beach',
          hours: 2,
          character_id: hero.id,
        });
        assert.equal(created.status, 201);
        privateId = created.data.id;
        assert.equal(
          (
            await request('/rp-lobby', owner, 'POST', {
              name: 'Outra sala',
              scene: 'market',
              character_id: hero.id,
            })
          ).status,
          409,
        );
        assert.equal((await request('/rp-lobby/' + privateId, outsider)).status, 404);
        assert.equal(
          (await request('/rp-lobby/' + privateId, admin)).status,
          404,
          'administrator has no private-room bypass',
        );
        assert.equal(
          (
            await request('/rp-lobby/' + privateId + '/invites', owner, 'POST', {
              user_id: outsider.id,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request('/rp-lobby/' + privateId + '/invites', owner, 'POST', {
              user_id: friend.id,
            })
          ).status,
          200,
        );
        assert.equal((await request('/rp-lobby/' + privateId, friend)).status, 404);
        assert.equal(
          (await request('/rp-lobby/' + privateId + '/invite', friend, 'PUT', { accept: true }))
            .status,
          200,
        );
        assert.equal((await request('/rp-lobby/' + privateId, friend)).data.can_edit, false);
      },
    );
    await t.test('edição por permissão, revisão concorrente e validação de layout', async () => {
      const room = (await request('/rp-lobby/' + privateId, owner)).data,
        input = { name: room.name, document: room.document, revision: room.revision };
      assert.equal((await request('/rp-lobby/' + privateId, friend, 'PUT', input)).status, 403);
      await request('/rp-lobby/' + privateId + '/invites', owner, 'POST', {
        user_id: friend.id,
        can_edit: true,
      });
      assert.equal((await request('/rp-lobby/' + privateId, friend)).data.can_edit, true);
      const results = await Promise.all([
        request('/rp-lobby/' + privateId, owner, 'PUT', input),
        request('/rp-lobby/' + privateId, friend, 'PUT', input),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const fresh = (await request('/rp-lobby/' + privateId, owner)).data;
      assert.equal(
        (
          await request('/rp-lobby/' + privateId, owner, 'PUT', {
            ...input,
            revision: fresh.revision,
            document: { scene: 'javascript:bad', placements: [] },
          })
        ).status,
        400,
      );
    });
    await t.test(
      'públicos sem móveis pessoais, acompanhantes próprios, camadas e privados sem limite',
      async () => {
        const position = {
          character_id: hero.id,
          x: 0.5,
          y: 0.84,
          scale: 0.16,
          flip_x: false,
          depth_layer: 2,
        };
        assert.equal(
          (await request('/rp-lobby/' + fixed.id + '/presence', owner, 'PUT', position)).status,
          200,
        );
        const spec = rpDecor[0];
        const make = () => ({
          id: randomUUID(),
          kind: 'prop',
          catalog: spec.id,
          x: 0.5,
          y: 0.84,
          scale: 0.15,
          facing: houseDefaultFacing(spec.id),
          rotation: 0,
          layer: 4,
        });
        const items = Array.from({ length: 4 }, make),
          url = '/rp-lobby/' + fixed.id + '/scene-items';
        assert.equal(
          (await request(url, owner, 'PUT', { character_id: hero.id, items })).status,
          403,
        );
        assert.equal(
          (await request(url, owner, 'PUT', { character_id: hero.id, items: [...items, make()] }))
            .status,
          403,
        );
        assert.equal(
          (await request(url, friend, 'PUT', { character_id: hero.id, items: [] })).status,
          404,
        );
        const animal = (
          await pool.query(
            "INSERT INTO character_pets(character_id,pet_id,name,appearance,price_cp,idempotency_key) VALUES($1,'dog','Lobo','original',1000,$2) RETURNING id",
            [hero.id, randomUUID()],
          )
        ).rows[0];
        const pet = { ...make(), kind: 'pet', wardrobe_id: animal.id };
        assert.equal(
          (await request(url, owner, 'PUT', { character_id: hero.id, items: [pet] })).status,
          200,
        );
        assert.equal(
          (
            await request(url, owner, 'PUT', {
              character_id: hero.id,
              items: [{ ...pet, wardrobe_id: randomUUID() }],
            })
          ).status,
          404,
        );
        const state = (await request('/rp-lobby/' + fixed.id, friend)).data.presence.find(
          (p: any) => p.user_id === owner.id,
        );
        assert.equal(state.depth_layer, 2);
        assert.equal(state.scene_items.length, 1);
        assert.equal(state.scene_items[0].name, 'Lobo');
        const image = await fetch(base + state.scene_items[0].image.replace('/api', ''), {
          headers: { Cookie: friend.cookie },
        });
        assert.equal(image.status, 200);
        assert.match(image.headers.get('content-type') || '', /image/);
        const library = (
          await request('/rp-lobby/companion-library?character_id=' + hero.id, owner)
        ).data;
        assert(library.sources.some((s: any) => s.id === animal.id));
        assert.equal(
          (await request('/rp-lobby/companion-library?character_id=' + hero.id, friend)).status,
          404,
        );
        assert.equal(
          (await request('/rp-lobby/' + privateId + '/presence', owner, 'PUT', position)).status,
          200,
        );
        const room = (await request('/rp-lobby/' + privateId, owner)).data;
        const placements = Array.from({ length: 65 }, () => {
          const { kind, ...i } = make();
          return i;
        });
        assert.equal(
          (
            await request('/rp-lobby/' + privateId, owner, 'PUT', {
              name: room.name,
              revision: room.revision,
              document: { ...room.document, placements },
            })
          ).status,
          200,
        );
        assert.equal(
          (await request('/rp-lobby/' + privateId, owner)).data.document.placements.length,
          65,
        );
      },
    );
    await t.test(
      'presença e RP usam personagem próprio, com replay sem mensagem duplicada',
      async () => {
        const position = { character_id: hero.id, x: 0.5, y: 0.84, scale: 0.16, flip_x: false };
        assert.equal(
          (await request('/rp-lobby/' + privateId + '/presence', friend, 'PUT', position)).status,
          404,
        );
        assert.equal(
          (await request('/rp-lobby/' + privateId + '/presence', owner, 'PUT', position)).status,
          200,
        );
        const msg = {
          character_id: guest.id,
          body: 'Mira chega à praia.',
          request_id: randomUUID(),
        };
        assert.equal(
          (await request('/rp-lobby/' + privateId + '/messages', friend, 'POST', msg)).status,
          409,
        );
        await request('/rp-lobby/' + privateId + '/presence', friend, 'PUT', {
          ...position,
          character_id: guest.id,
          x: 0.6,
        });
        const first = await request('/rp-lobby/' + privateId + '/messages', friend, 'POST', msg),
          replay = await request('/rp-lobby/' + privateId + '/messages', friend, 'POST', msg);
        assert.equal(first.status, 200);
        assert.equal(replay.data.id, first.data.id);
        assert.equal(replay.data.replayed, true);
        const state = (await request('/rp-lobby/' + privateId, owner)).data;
        assert.equal(state.presence.length, 2);
        assert.equal(state.messages.length, 1);
        assert.equal(state.messages[0].name, 'Mira');
        await request('/rp-lobby/' + privateId + '/invites/' + friend.id, owner, 'DELETE');
        assert.equal((await request('/rp-lobby/' + privateId, friend)).status, 404);
        assert.equal((await request('/rp-lobby/' + privateId, owner)).data.presence.length, 1);
      },
    );
    await t.test('bloqueio, expiração e encerramento revogam acesso', async () => {
      await request('/rp-lobby/' + privateId + '/invites', owner, 'POST', { user_id: friend.id });
      await request('/rp-lobby/' + privateId + '/invite', friend, 'PUT', { accept: true });
      await pool.query('INSERT INTO social_blocks(blocker_id,blocked_id) VALUES($1,$2)', [
        owner.id,
        friend.id,
      ]);
      assert.equal((await request('/rp-lobby/' + privateId, friend)).status, 404);
      await pool.query('DELETE FROM social_blocks WHERE blocker_id=$1 AND blocked_id=$2', [
        owner.id,
        friend.id,
      ]);
      await pool.query("UPDATE rp_rooms SET expires_at=now()-interval '1 minute' WHERE id=$1", [
        privateId,
      ]);
      assert.equal((await request('/rp-lobby/' + privateId, owner)).status, 404);
      const created = await request('/rp-lobby', owner, 'POST', {
        name: 'Reencontro',
        scene: 'market',
        hours: 1,
        character_id: hero.id,
      });
      assert.equal(created.status, 201);
      assert.equal(
        (await request('/rp-lobby/' + created.data.id + '/close', owner, 'POST', {})).status,
        200,
      );
      assert.equal((await request('/rp-lobby/' + created.data.id, owner)).status, 404);
    });
    await t.test(
      'oito instalações estáveis, melhoria serial, tesouro e ledger sem benefícios automáticos',
      async () => {
        assert.equal(guildFacilities.length, 8);
        const id = randomUUID();
        await pool.query(
          'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,prestige,founding_cp,request_id) VALUES($1,$2,$3,1000000,1000,0,$4)',
          [
            id,
            owner.id,
            JSON.stringify(guildDocumentSchema.parse({ name: 'Companhia da Aurora' })),
            randomUUID(),
          ],
        );
        await pool.query(
          'INSERT INTO player_guild_members(guild_id,user_id,character_id) VALUES($1,$2,$3),($1,$4,$5)',
          [id, owner.id, hero.id, friend.id, guest.id],
        );
        const path = '/guilds/' + id + '/facilities/main/upgrade',
          input = { level: 2 };
        assert.equal((await request(path, friend, 'POST', input)).status, 403);
        assert.equal((await request(path, admin, 'POST', input)).status, 403);
        const before = (
          await pool.query('SELECT gold_cp,armor_class FROM characters WHERE id=$1', [hero.id])
        ).rows[0];
        const concurrent = await Promise.all([
          request(path, owner, 'POST', input),
          request(path, owner, 'POST', input),
        ]);
        assert(concurrent.every((r) => r.status === 200));
        assert.equal(concurrent.filter((r) => r.data.replayed).length, 1);
        assert.equal(
          Number(
            (await pool.query('SELECT treasury_cp FROM player_guilds WHERE id=$1', [id])).rows[0]
              .treasury_cp,
          ),
          1000000 - guildFacilityCost(1),
        );
        assert.equal(
          (
            await pool.query(
              "SELECT * FROM player_guild_ledger WHERE guild_id=$1 AND reference='facility:main:2'",
              [id],
            )
          ).rowCount,
          1,
        );
        assert.equal((await request(path, owner, 'POST', { level: 5 })).status, 409);
        await pool.query('UPDATE player_guilds SET treasury_cp=0 WHERE id=$1', [id]);
        assert.equal((await request(path, owner, 'POST', { level: 3 })).status, 409);
        await pool.query('UPDATE player_guilds SET treasury_cp=1000000,prestige=0 WHERE id=$1', [
          id,
        ]);
        assert.equal(
          (await request('/guilds/' + id + '/facilities/library/upgrade', owner, 'POST', input))
            .status,
          403,
        );
        await pool.query('UPDATE player_guilds SET prestige=1000 WHERE id=$1', [id]);
        for (const f of guildFacilities.filter((f) => f.room !== 'main'))
          assert.equal(
            (
              await request(
                '/guilds/' + id + '/facilities/' + f.room + '/upgrade',
                owner,
                'POST',
                input,
              )
            ).status,
            200,
          );
        const state = (await request('/guilds/' + id, owner)).data;
        assert.equal(state.facilities.length, 8);
        assert(state.facilities.every((x: any) => x.level === 2));
        assert.deepEqual(
          (await pool.query('SELECT gold_cp,armor_class FROM characters WHERE id=$1', [hero.id]))
            .rows[0],
          before,
        );
      },
    );
    await t.test(
      'textos e posição das oito instalações: só administrador vigente, revisão e seed preservados',
      async () => {
        const catalog = await request('/community/facilities', admin);
        assert.equal(catalog.status, 200);
        assert.equal(catalog.data.can_edit, true);
        assert.equal(catalog.data.items.length, 8);
        assert.equal((await request('/community/facilities', owner)).data.can_edit, false);
        for (const definition of catalog.data.items) {
          const { room, ...input } = definition,
            path = '/community/facilities/' + room;
          const changed = {
            ...input,
            name: input.name + ' revisado',
            description: 'Texto editável do administrador.',
            upgrade_description: 'Benefício futuro da instalação.',
          };
          assert.equal((await request(path, owner, 'PUT', changed)).status, 403);
          assert.equal((await request(path, admin, 'PUT', { ...changed, x: 2 })).status, 400);
          const replies = await Promise.all([
            request(path, admin, 'PUT', changed),
            request(path, admin, 'PUT', changed),
          ]);
          assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
          assert.equal(
            (await request('/community/facilities', friend)).data.items.find(
              (x: any) => x.room === room,
            ).name,
            changed.name,
          );
        }
        const saved = (await request('/community/facilities', admin)).data.items;
        await seed();
        assert.deepEqual((await request('/community/facilities', admin)).data.items, saved);
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
        const { room, ...input } = saved[0];
        assert.equal(
          (await request('/community/facilities/' + room, admin, 'PUT', input)).status,
          403,
        );
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
