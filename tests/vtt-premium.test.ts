import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { newToken, newScene, documentSchema } from '../shared/vtt.js';
import { monsterActions } from '../shared/vtt-monster-actions.js';

test('VTT: artes básicas, acervo privado e dano verificado', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  type Account = { id: string; cookie: string };
  async function request(path: string, account?: Account, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0],
        Cookie: account?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': '6',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: response.headers.get('Content-Type')?.includes('json')
        ? await response.json()
        : await response.arrayBuffer(),
      headers: response.headers,
    };
  }
  async function signup(name: string): Promise<Account> {
    const response = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const gm = await signup('Mestre'),
      other = await signup('Outro mestre'),
      player = await signup('Jogador'),
      spectator = other;
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=ANY($1::text[])', [
      [gm.id, other.id],
    ]);
    let room = (await request('/vtt', gm, 'POST', { name: 'Acervo privado' })).data;
    const scene = room.document.scenes[0];
    let actor = newToken(randomUUID(), scene),
      target = newToken(randomUUID(), scene);
    actor.name = 'Aboleth';
    actor.sheet = {
      source: 'SRD',
      race: 'aberration',
      class: '',
      level: 0,
      stats: [21, 9, 15, 18, 15, 18],
      speed: 10,
      biography: '',
      details:
        'Tentacle\nMelee Attack Roll: +9, reach 15 ft. Hit: 12 (2d6 + 5) Bludgeoning damage.',
    };
    target.name = 'Jogador';
    target.controller = player.id;
    target.hp = 100;
    target.maxHp = 100;
    target.x = 400;
    scene.tokens.push(actor, target);
    scene.lighting = false;
    scene.fog = false;
    async function put() {
      const r = await request('/vtt/rooms/' + room.id, gm, 'PUT', {
        revision: room.revision,
        document: room.document,
      });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      room = r.data;
      actor = room.document.scenes[0].tokens.find((v: any) => v.id === actor.id);
      target = room.document.scenes[0].tokens.find((v: any) => v.id === target.id);
    }
    await request('/vtt/join', player, 'POST', { invite: room.invite, role: 'player' });
    await request('/vtt/join', spectator, 'POST', { invite: room.invite, role: 'spectator' });
    room = (await request('/vtt/rooms/' + room.id, gm)).data;
    room.document.scenes[0].tokens = [actor, target];
    await put();
    await t.test(
      'toda conta acessa o acervo sem tag; controle antigo de acesso foi aposentado',
      async () => {
        assert.equal((await request('/vtt/premium')).status, 401);
        assert.equal((await request('/vtt/premium', gm)).status, 200);
        assert.equal((await request('/vtt/premium', player)).status, 200);
        assert.equal(
          (await request('/vtt/premium-access/' + player.id, player, 'PUT', { enabled: true }))
            .status,
          403,
        );
        assert.equal(
          (await request('/vtt/premium-access/' + gm.id, gm, 'PUT', { enabled: true })).status,
          410,
        );
        await pool.query('UPDATE "user" SET vtt_premium=true WHERE id=$1', [player.id]);
        assert.equal((await request('/vtt/premium', player)).status, 200);
        await request('/vtt/premium-access/' + player.id, gm, 'PUT', { enabled: false });
        assert.equal((await request('/vtt/premium', player)).status, 200);
        const catalog = await request('/vtt/premium', gm);
        assert.equal(catalog.status, 200);
        assert.equal(catalog.data.total, 330);
        assert.ok(catalog.data.available >= 2);
        const art = await request('/vtt/premium-art/monster-aboleth', gm);
        assert.equal(art.status, 200);
        assert.match(art.headers.get('Cache-Control') || '', /no-store/);
        assert.equal((await request('/vtt/premium-art/monster-aboleth', player)).status, 200);
        actor.image = '/api/vtt/premium-art/monster-aboleth';
        await put();
        assert.equal((await request('/vtt/premium-art/monster-aboleth', player)).status, 200);
        actor.hidden = true;
        await put();
        assert.equal((await request('/vtt/premium-art/monster-aboleth', player)).status, 200);
        const hidden = (await request('/vtt/rooms/' + room.id, player)).data;
        assert.equal(
          hidden.document.scenes[0].tokens.some((t: any) => t.id === actor.id),
          false,
        );
        assert.equal(
          (
            await request('/vtt/rooms/' + room.id, player, 'PUT', {
              revision: room.revision,
              document: room.document,
            })
          ).status,
          403,
        );
        assert.equal((await request('/vtt/premium-access', gm)).status, 410);
        assert.equal((await request('/vtt/premium-access', player)).status, 403);
        actor.hidden = false;
        await put();
        await request('/vtt/premium-access/' + gm.id, gm, 'PUT', { enabled: false });
        assert.equal((await request('/vtt/premium', gm)).status, 200);
        const duplicate = structuredClone(actor);
        duplicate.id = randomUUID();
        room.document.scenes[0].tokens.push(duplicate);
        await put();
        room.document.scenes[0].tokens.pop();
        await put();
      },
    );
    await t.test('rotas antigas de prévia permanecem autenticadas e compatíveis', async () => {
      assert.equal((await request('/vtt/premium-preview')).status, 401);
      assert.equal((await request('/vtt/premium-preview-art/monster-aboleth')).status, 401);
      const preview = await request('/vtt/premium-preview', player);
      assert.equal(preview.status, 200);
      assert.equal(preview.data.groups.length, 2);
      assert.ok(preview.data.groups.every((g: any) => g.monsters.length === 6));
      const samples = preview.data.groups.flatMap((g: any) => g.monsters);
      assert.equal(new Set(samples.map((m: any) => m.id)).size, 12);
      for (const m of samples) {
        assert.equal(m.image, '/api/vtt/premium-preview-art/' + m.id);
        const image = await request('/vtt/premium-preview-art/' + m.id, player);
        assert.equal(image.status, 200);
        assert.equal((await sharp(Buffer.from(image.data)).metadata()).hasAlpha, true);
      }
      assert.equal((await request('/vtt/premium-preview-art/monster-zombie', player)).status, 403);
      assert.equal((await request('/vtt/premium-art/monster-zombie', player)).status, 200);
      assert.equal((await request('/vtt/premium', player)).status, 200);
      assert.equal(
        (await request('/vtt/premium-tokens', player, 'PUT', { enabled: true })).status,
        200,
      );
    });
    await t.test(
      'artes são padrão para todos, mesmo com preferências antigas desativadas, sem mudar mesas',
      async () => {
        const original = await readFile('data/vtt/srd-2024.json', 'utf8');
        const baseline = JSON.parse(original);
        const before = structuredClone((await request('/vtt/rooms/' + room.id, gm)).data.document);
        assert.equal((await request('/vtt/rooms/' + room.id, gm)).data.premiumTokens, true);
        const settings = await request('/vtt/premium-tokens', gm, 'PUT', { enabled: true });
        assert.equal(settings.status, 200);
        assert.equal(settings.data.premiumTokens, true);
        const catalog = (await request('/vtt/compendium', gm)).data;
        assert.equal(catalog.monsters.length, 330);
        for (const m of catalog.monsters) {
          assert.equal(m.image, '/api/vtt/premium-art/' + m.id);
          const { image, ...rules } = m;
          assert.deepEqual(
            rules,
            baseline.monsters.find((o: any) => o.id === m.id),
          );
        }
        assert.equal((await request('/vtt/rooms/' + room.id, gm)).data.premiumTokens, true);
        assert.deepEqual((await request('/vtt/rooms/' + room.id, gm)).data.document, before);
        assert.deepEqual((await request('/vtt/compendium', other)).data, catalog);
        await request('/vtt/premium-tokens', gm, 'PUT', { enabled: false });
        assert.deepEqual((await request('/vtt/compendium', gm)).data, catalog);
        await request('/vtt/premium-access/' + player.id, gm, 'PUT', { enabled: true });
        assert.equal(
          (await request('/vtt/premium-tokens', player, 'PUT', { enabled: true })).status,
          200,
        );
        assert.ok(
          (await request('/vtt/compendium', player)).data.monsters.every(
            (m: any) => m.image === '/api/vtt/premium-art/' + m.id,
          ),
        );
        await request('/vtt/premium-access/' + player.id, gm, 'PUT', { enabled: false });
        assert.deepEqual((await request('/vtt/compendium', player)).data, catalog);
        assert.equal((await request('/vtt/rooms/' + room.id, player)).data.premiumTokens, true);
        await pool.query(
          'UPDATE "user" SET vtt_premium=false,vtt_premium_tokens=false WHERE id=ANY($1::text[])',
          [[gm.id, other.id, player.id]],
        );
        for (const account of [gm, other, player]) {
          assert.deepEqual((await request('/vtt/compendium', account)).data, catalog);
        }
        assert.deepEqual((await request('/vtt/rooms/' + room.id, gm)).data.document, before);
        assert.equal(
          (await request('/vtt/premium-tokens', gm, 'PUT', { enabled: true, user: other.id }))
            .status,
          400,
        );
        assert.equal(await readFile('data/vtt/srd-2024.json', 'utf8'), original);
      },
    );
    await t.test(
      'presets privados preservam alterações, IDs de ataques e biblioteca original',
      async () => {
        const original = await readFile('data/vtt/srd-2024.json', 'utf8');
        const action = monsterActions(actor.sheet!.details)[0];
        actor.name = 'Aboleth ancestral';
        actor.maxHp = 190;
        actor.ac = 22;
        actor.monster = {
          sourceId: 'monster-aboleth',
          size: 'H',
          cr: '12',
          speed: 'natação: 40 ft',
          information: [],
          traits: '### Características\nGuardião\nConhece a torre.',
          actions: [
            {
              ...action,
              name: 'Tentáculo pesado',
              description: 'Ataque +12. Acerto: 3d6+6.',
              attack: '1d20+12',
              damage: ['3d6+6'],
            },
          ],
        };
        await put();
        const presets = await request('/vtt/monster-presets', gm);
        assert.equal(presets.status, 200);
        const preset = presets.data.find((p: any) => p.token.id === actor.id);
        assert.equal(preset.name, actor.name);
        assert.equal(preset.token.ac, 22);
        assert.equal((await request('/vtt/monster-presets', other)).data.length, 0);
        assert.equal((await request('/vtt/monster-presets', player)).status, 403);
        const visible = await request('/vtt/rooms/' + room.id, player);
        assert.equal(
          visible.data.document.scenes[0].tokens.find((t: any) => t.id === actor.id).monster,
          null,
        );
        assert.equal(
          (await request(`/vtt/rooms/${room.id}/hotbar/monster/${actor.id}/${action.id}`, gm)).data
            .action.attack,
          '1d20+12',
        );
        const imported = await request(
          `/vtt/rooms/${room.id}/monster-presets/${preset.id}/import`,
          gm,
          'POST',
          { x: 800, y: 800 },
        );
        assert.equal(imported.status, 200, JSON.stringify(imported.data));
        room = imported.data;
        assert.ok(
          room.document.scenes[0].tokens.some(
            (t: any) => t.id !== actor.id && t.name === actor.name && t.ac === 22,
          ),
        );
        const second = (await request('/vtt', other, 'POST', { name: 'Outra' })).data;
        assert.equal(
          (
            await request(
              `/vtt/rooms/${second.id}/monster-presets/${preset.id}/import`,
              other,
              'POST',
              { x: 1, y: 1 },
            )
          ).status,
          404,
        );
        assert.equal(await readFile('data/vtt/srd-2024.json', 'utf8'), original);
      },
    );
    async function roll(value: string, who = gm, priv = false) {
      const r = await request(`/vtt/rooms/${room.id}/messages`, who, 'POST', {
        text: 'Dano',
        formula: value,
        private: priv,
        damage: { actor_id: actor.id, target_id: target.id },
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      room = r.data;
      return r.data.createdMessageId;
    }
    await t.test(
      'dano usa resultado real, respeita alvo e é idempotente sob concorrência',
      async () => {
        const id = await roll('7');
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, gm, 'POST', {
              token_id: target.id,
              message_ids: [id],
              amount: 999,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, gm, 'POST', {
              token_id: actor.id,
              message_ids: [id],
            })
          ).status,
          400,
        );
        const results = await Promise.all(
          Array.from({ length: 8 }, () =>
            request(`/vtt/rooms/${room.id}/damage`, gm, 'POST', {
              token_id: target.id,
              message_ids: [id],
            }),
          ),
        );
        assert.ok(results.every((r) => r.status === 200));
        room = (await request('/vtt/rooms/' + room.id, gm)).data;
        assert.equal(room.document.scenes[0].tokens.find((t: any) => t.id === target.id).hp, 93);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int AS n FROM vtt_damage_applications WHERE message_id=$1',
              [id],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (await request(`/vtt/rooms/${room.id}/damage/discard`, gm, 'POST', { message_ids: [id] }))
            .status,
          409,
        );
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, spectator, 'POST', {
              token_id: target.id,
              message_ids: [id],
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, player, 'POST', {
              token_id: actor.id,
              message_ids: [id],
            })
          ).status,
          403,
        );
        const discarded = await roll('8');
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage/discard`, gm, 'POST', {
              message_ids: [discarded],
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, gm, 'POST', {
              token_id: target.id,
              message_ids: [discarded],
            })
          ).status,
          400,
        );
        const secret = await roll('3', gm, true);
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, player, 'POST', {
              token_id: target.id,
              message_ids: [secret],
            })
          ).status,
          403,
        );
        const damage = await roll('2');
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, player, 'POST', {
              token_id: target.id,
              message_ids: [damage],
            })
          ).status,
          200,
        );
        const empty = await request(`/vtt/rooms/${room.id}/messages`, gm, 'POST', {
          text: 'Mensagem',
        });
        assert.equal(
          (
            await request(`/vtt/rooms/${room.id}/damage`, gm, 'POST', {
              token_id: target.id,
              message_ids: [empty.data.createdMessageId],
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'efeito em grupo é atômico, deduplica alvos e exige mestre do mapa ativo',
      async () => {
        room = (await request('/vtt/rooms/' + room.id, gm)).data;
        const active = room.document.scenes.find((s: any) => s.id === room.document.activeScene);
        const original = structuredClone(room.document);
        const effect = {
          id: randomUUID(),
          name: 'Fogo em grupo',
          kind: 'fire',
          color: '#d68a44',
          scale: 1,
          duration: 0,
        };
        room.document.effects.push(effect);
        const map = { ...active.tokens[0], id: randomUUID(), layer: 'map' };
        active.tokens.push(map);
        const otherScene = newScene(randomUUID());
        const foreign = newToken(randomUUID(), otherScene);
        otherScene.tokens.push(foreign);
        room.document.scenes.push(otherScene);
        await put();
        const path = `/vtt/rooms/${room.id}/effects/${effect.id}/apply`;
        const before = structuredClone(room);
        for (const invalidId of [randomUUID(), map.id, foreign.id]) {
          assert.equal(
            (await request(path, gm, 'POST', { tokenIds: [actor.id, invalidId] })).status,
            404,
          );
          const after = (await request('/vtt/rooms/' + room.id, gm)).data;
          assert.deepEqual(after.document, before.document);
          assert.equal(after.revision, before.revision);
        }
        for (const account of [other, player])
          assert.equal(
            (await request(path, account, 'POST', { tokenIds: [actor.id, target.id] })).status,
            403,
          );
        assert.equal((await request(path, gm, 'POST', { tokenIds: [] })).status, 400);
        assert.equal(
          (await request(path, gm, 'POST', { tokenId: actor.id, tokenIds: [target.id] })).status,
          400,
        );
        const response = await request(path, gm, 'POST', {
          tokenIds: [actor.id, target.id, actor.id],
        });
        assert.equal(response.status, 200);
        room = response.data;
        assert.equal(room.revision, before.revision + 1);
        const tokens = room.document.scenes.find(
          (s: any) => s.id === room.document.activeScene,
        ).tokens;
        const a = tokens.find((t: any) => t.id === actor.id),
          b = tokens.find((t: any) => t.id === target.id);
        assert.equal(a.effects.filter((e: any) => e.kind === 'fire').length, 1);
        assert.equal(b.effects.filter((e: any) => e.kind === 'fire').length, 1);
        assert.equal(
          a.effects.find((e: any) => e.kind === 'fire').at,
          b.effects.find((e: any) => e.kind === 'fire').at,
        );
        assert.equal(a.hp, before.document.scenes[0].tokens.find((t: any) => t.id === a.id).hp);
        assert.equal(b.hp, before.document.scenes[0].tokens.find((t: any) => t.id === b.id).hp);
        assert.deepEqual(
          tokens.find((t: any) => t.id === map.id),
          map,
        );
        // Existing shortcuts keep the single-token payload and replace the same effect.
        assert.equal((await request(path, gm, 'POST', { tokenId: actor.id })).status, 200);
        room = (await request('/vtt/rooms/' + room.id, gm)).data;
        room.document = original;
        await put();
      },
    );
    await t.test(
      'movimento físico bloqueia paredes/portas/janelas fechadas e valida o percurso completo',
      async () => {
        room = (await request('/vtt/rooms/' + room.id, gm)).data;
        const original = structuredClone(room.document);
        const active = room.document.scenes[0];
        const controlled = active.tokens.find((t: any) => t.id === target.id);
        Object.assign(controlled, { x: 100, y: 100 });
        active.restrictMovement = false;
        active.lighting = false;
        const wall = {
          id: randomUUID(),
          kind: 'wall',
          a: { x: 150, y: 0 },
          b: { x: 150, y: 200 },
          open: false,
        };
        active.walls = [wall];
        await put();
        const path = `/vtt/rooms/${room.id}/tokens/${target.id}`;
        const before = structuredClone(room);
        for (const body of [
          { x: 200, y: 100 },
          { x: 150, y: 100 },
          { x: 200, y: 100, path: [{ x: 200, y: 100 }] },
          { x: 200, y: 100, path: [{ x: 100, y: 250 }] },
          {
            x: 200,
            y: 100,
            path: [
              { x: -10, y: 250 },
              { x: 200, y: 100 },
            ],
          },
        ]) {
          assert.equal((await request(path, player, 'PATCH', body)).status, 400);
          const after = (await request('/vtt/rooms/' + room.id, gm)).data;
          assert.deepEqual(after.document, before.document);
          assert.equal(after.revision, before.revision);
        }
        const around = await request(path, player, 'PATCH', {
          x: 200,
          y: 100,
          path: [
            { x: 100, y: 250 },
            { x: 200, y: 250 },
            { x: 200, y: 100 },
          ],
        });
        assert.equal(around.status, 200);
        room = (await request('/vtt/rooms/' + room.id, gm)).data;
        for (const kind of ['door', 'window']) {
          const s = room.document.scenes[0];
          Object.assign(
            s.tokens.find((t: any) => t.id === target.id),
            { x: 100, y: 100 },
          );
          Object.assign(s.walls[0], { kind, open: false });
          await put();
          assert.equal((await request(path, player, 'PATCH', { x: 200, y: 100 })).status, 400);
          room.document.scenes[0].walls[0].open = true;
          await put();
          assert.equal((await request(path, player, 'PATCH', { x: 200, y: 100 })).status, 200);
          room = (await request('/vtt/rooms/' + room.id, gm)).data;
        }
        room.document = original;
        await put();
      },
    );
    await t.test(
      'mestre rola toda a ordem com dados reais, uma revisão e mensagens atômicas',
      async () => {
        const path = `/vtt/rooms/${room.id}/combat`;
        for (const account of [player, spectator])
          assert.equal((await request(path, account, 'POST', { kind: 'rollAll' })).status, 403);
        assert.equal((await request(path, gm, 'POST', { kind: 'rollAll' })).status, 409);
        const added = await request(path, gm, 'POST', {
          kind: 'add',
          tokenIds: [actor.id, target.id],
        });
        assert.equal(added.status, 200);
        const before = (
          await pool.query('SELECT document,revision,combat FROM vtt_rooms WHERE id=$1', [room.id])
        ).rows[0];
        const messagesBefore = Number(
          (await pool.query('SELECT count(*) FROM vtt_messages WHERE room_id=$1', [room.id]))
            .rows[0].count,
        );
        const rolled = await request(path, gm, 'POST', { kind: 'rollAll' });
        assert.equal(rolled.status, 200, JSON.stringify(rolled.data));
        assert.equal(rolled.data.revision, added.data.revision + 1);
        assert.equal(rolled.data.entries.length, 2);
        for (const e of rolled.data.entries) {
          assert.ok(e.die >= 1 && e.die <= 20);
          const token = before.document.scenes[0].tokens.find((t: any) => t.id === e.tokenId);
          assert.equal(e.bonus, Math.floor(((token.sheet?.stats[1] ?? 10) - 10) / 2));
          assert.equal(e.value, e.die + e.bonus);
        }
        assert.ok(rolled.data.entries[0].value >= rolled.data.entries[1].value);
        const after = (
          await pool.query('SELECT document,revision FROM vtt_rooms WHERE id=$1', [room.id])
        ).rows[0];
        assert.deepEqual(after, { document: before.document, revision: before.revision });
        assert.equal(
          Number(
            (await pool.query('SELECT count(*) FROM vtt_messages WHERE room_id=$1', [room.id]))
              .rows[0].count,
          ),
          messagesBefore + 2,
        );
        assert.equal((await request(path, gm, 'POST', { kind: 'start' })).status, 200);
        const active = (await pool.query('SELECT combat FROM vtt_rooms WHERE id=$1', [room.id]))
          .rows[0];
        assert.equal((await request(path, gm, 'POST', { kind: 'rollAll' })).status, 409);
        assert.deepEqual(
          (await pool.query('SELECT combat FROM vtt_rooms WHERE id=$1', [room.id])).rows[0],
          active,
        );
        assert.equal(
          Number(
            (await pool.query('SELECT count(*) FROM vtt_messages WHERE room_id=$1', [room.id]))
              .rows[0].count,
          ),
          messagesBefore + 2,
        );
        await request(path, gm, 'POST', { kind: 'end' });
      },
    );
    await t.test('artes individuais têm vínculo válido, alpha real e hash registrado', async () => {
      const manifest = JSON.parse(await readFile('data/vtt/premium-art/manifest.json', 'utf8'));
      const catalog = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
      assert.equal(new Set(manifest.assets.map((a: any) => a.id)).size, manifest.assets.length);
      for (const a of manifest.assets) {
        assert.ok(catalog.monsters.some((m: any) => m.id === a.id));
        const bytes = await readFile('data/vtt/premium-art/' + a.filename);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
        assert.equal((await sharp(bytes).metadata()).hasAlpha, true);
        assert.ok(a.transparentPixels > 0);
      }
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
