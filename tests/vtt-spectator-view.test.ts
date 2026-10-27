import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { newToken, newScene } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';

test('espectador acompanha automaticamente personagem do mestre sem acesso aos seus segredos', async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.match(url.pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  assert.notEqual(url.port, '5437');
  await migrate();
  await seed();
  const { createApp } = await import('../server/app'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`,
    trustedOrigin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie: string, method = 'GET', body?: unknown) {
    const r = await fetch(origin + '/api' + path, {
      method,
      headers: {
        Origin: trustedOrigin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id as string,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const master = await signup('Mestre com personagem'),
      spectator = await signup('Espectador'),
      player = await signup('Jogador com personagem'),
      character = await createLegacyTestCharacter(master.id, 'Personagem do mestre');
    let room = (await req('/vtt', master.cookie, 'POST', { name: 'Visão do espectador' })).data;
    const path = '/vtt/rooms/' + room.id;
    const imported = await req(path + '/characters/' + character.id, master.cookie, 'POST', {});
    assert.equal(imported.status, 201);
    room = imported.data;
    const scene = room.document.scenes[0],
      hero = scene.tokens.find((t: { characterId: string }) => t.characterId === character.id);
    assert(hero);
    scene.fog = true;
    scene.fogMode = 'vision';
    scene.lighting = false;
    scene.ambient = 1;
    Object.assign(hero, { x: 500, y: 500, notes: 'Ficha privada do mestre' });
    const secret = newToken(randomUUID(), scene);
    Object.assign(secret, { name: 'Segredo invisível', layer: 'gm', hidden: true, x: 550, y: 500 });
    scene.tokens.push(secret);
    const publicToken = newToken(randomUUID(), scene);
    Object.assign(publicToken, { name: 'Objeto próximo', x: 550, y: 500 });
    scene.tokens.push(publicToken);
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#81a478' } })
      .png()
      .toBuffer();
    const upload = await fetch(origin + '/api' + path + '/assets?name=Token', {
      method: 'POST',
      headers: {
        Origin: trustedOrigin,
        Cookie: master.cookie,
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
        'Content-Type': 'image/png',
      },
      body: png,
    });
    assert.equal(upload.status, 201);
    const art = await upload.json();
    hero.image = art.path;
    // Asset upload changed the room revision; preserve the fresh revision with our prepared map.
    room.revision = (await req(path, master.cookie)).data.revision;
    const save = async () => {
      const r = await req(path, master.cookie, 'PUT', {
        revision: room.revision,
        document: room.document,
      });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      room = r.data;
    };
    await save();
    const join = await req('/vtt/join', spectator.cookie, 'POST', {
      invite: room.invite,
      role: 'spectator',
    });
    assert.equal(join.status, 200);
    let view = join.data;
    assert.equal(view.role, 'spectator');
    assert.equal(view.is_gm, false);
    assert.equal(view.viewingUser, master.id);
    assert.deepEqual(
      view.viewpoints.map((v: { id: string }) => v.id),
      [master.id],
    );
    assert(view.document.scenes[0].tokens.some((t: { id: string }) => t.id === hero.id));
    assert(view.document.scenes[0].tokens.some((t: { id: string }) => t.id === publicToken.id));
    assert(!view.document.scenes[0].tokens.some((t: { id: string }) => t.id === secret.id));
    assert.equal(
      view.document.scenes[0].tokens.find((t: { id: string }) => t.id === hero.id).notes,
      '',
    );
    assert.equal(
      view.document.scenes[0].tokens.find((t: { id: string }) => t.id === hero.id).sheet,
      null,
    );
    assert.equal(
      (
        await fetch(origin + art.path, {
          headers: { Cookie: spectator.cookie, 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
        })
      ).status,
      200,
    );
    assert.equal(
      (await req(path + '/viewpoint', spectator.cookie, 'PUT', { userId: master.id })).status,
      200,
    );
    assert.equal(
      (
        await req(path, spectator.cookie, 'PUT', {
          revision: room.revision,
          document: room.document,
        })
      ).status,
      403,
    );
    assert.equal(
      (await req(path + '/combat', spectator.cookie, 'POST', { kind: 'end' })).status,
      403,
    );
    assert.equal(
      (await req(path + '/viewpoint', spectator.cookie, 'PUT', { userId: player.id })).status,
      400,
    );
    await req('/vtt/join', player.cookie, 'POST', { invite: room.invite, role: 'player' });
    room = (await req(path, master.cookie)).data;
    const second = newToken(randomUUID(), room.document.scenes[0]);
    Object.assign(second, { name: 'Personagem do jogador', controller: player.id, x: 550, y: 500 });
    room.document.scenes[0].tokens.push(second);
    await save();
    view = (await req(path, spectator.cookie)).data;
    assert.equal(view.viewingUser, master.id);
    assert.equal(view.viewpoints.length, 2);
    room.document.scenes[0].tokens.find((t: { id: string }) => t.id === hero.id).hidden = true;
    await save();
    view = (await req(path, spectator.cookie)).data;
    assert.equal(view.viewingUser, player.id);
    assert(!view.viewpoints.some((v: { id: string }) => v.id === master.id));
    assert.equal(
      (await req(path + '/viewpoint', spectator.cookie, 'PUT', { userId: master.id })).status,
      400,
    );
    const next = newScene(randomUUID(), 'Mapa sem personagens');
    room.document.scenes.push(next);
    room.document.activeScene = next.id;
    await save();
    view = (await req(path, spectator.cookie)).data;
    assert.equal(view.viewingUser, null);
    assert.deepEqual(view.viewpoints, []);
    const later = newToken(randomUUID(), next);
    Object.assign(later, { controller: master.id, x: 500, y: 500 });
    room.document.scenes.find((s: { id: string }) => s.id === next.id).tokens.push(later);
    await save();
    view = (await req(path, spectator.cookie)).data;
    assert.equal(view.viewingUser, master.id);
    assert.equal(view.is_gm, false);
    assert.equal(
      (
        await pool.query('SELECT 1 FROM vtt_members WHERE room_id=$1 AND user_id=$2', [
          room.id,
          master.id,
        ])
      ).rowCount,
      0,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
