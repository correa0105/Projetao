import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { vttProtocolVersion } from '../shared/vtt-protocol';
test('pins e histórias: somente admin escreve; rascunhos privados, três prévias, missões e local da mesa preservados', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type User = { id: string; cookie: string };
  async function signup(admin = false): Promise<User> {
    const r = await fetch(base + '/api/auth/sign-up/email', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Viajante',
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      }),
    });
    assert.equal(r.status, 200);
    const { user } = await r.json();
    if (admin) await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
    return {
      id: user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  async function request(
    path: string,
    user: User,
    method = 'GET',
    data?: unknown,
    preview = false,
  ) {
    const r = await fetch(base + '/api' + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: user.cookie,
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
        ...(preview ? { 'X-Account-Preview': 'basic' } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: r.status, data: await r.json() };
  }
  try {
    const admin = await signup(true),
      player = await signup();
    const input = {
      region_id: 'reino-do-norte',
      name: 'Portão das brumas',
      description: 'Local da aventura',
      map_x: 0.5,
      map_y: 0.5,
    };
    assert.equal((await request('/atlas/locations', player, 'POST', input)).status, 403);
    assert.equal((await request('/atlas/locations', admin, 'POST', input, true)).status, 403);
    const created = await request('/atlas/locations', admin, 'POST', input);
    assert.equal(created.status, 201);
    const id = created.data.id;
    const target = { region_id: 'reino-do-norte', location_id: id };
    const story = await request('/atlas/history', admin, 'POST', target);
    assert.equal(story.status, 200);
    const pageId = story.data.page_id;
    assert.equal((await request('/atlas/history', admin, 'POST', target)).data.page_id, pageId);
    assert.equal((await request('/lore/pages/' + pageId, player)).status, 404);
    let atlas = (await request('/atlas', player)).data;
    let place = atlas.locations.find((p: any) => p.id === id);
    assert.equal(place.history_page_id, null);
    assert.deepEqual(place.history_preview, []);
    assert.equal(atlas.can_manage_pins, false);
    let page = (await request('/lore/pages/' + pageId, admin)).data;
    const blocks: any[] = [
      {
        id: randomUUID(),
        type: 'text',
        title: 'O primeiro portão',
        text: 'Uma história para este local.',
        style: 'parchment',
        alignment: 'center',
      },
    ];
    const png = await sharp({
      create: { width: 30, height: 20, channels: 4, background: '#ac8b66' },
    })
      .png()
      .toBuffer();
    for (let i = 0; i < 4; i++) {
      const upload = await fetch(base + '/api/lore/pages/' + pageId + '/images', {
        method: 'POST',
        headers: { Origin: origin, Cookie: admin.cookie, 'Content-Type': 'image/png' },
        body: png,
      });
      assert.equal(upload.status, 201);
      const image = await upload.json();
      blocks.push({
        id: randomUUID(),
        type: 'image',
        asset_id: image.id,
        alt: 'Paisagem ' + i,
        caption: 'O portão ' + i,
        alignment: 'center',
        format: 'landscape',
        fit: 'cover',
        effect: 'cinematic',
      });
    }
    const value = {
      title: page.title,
      subtitle: page.subtitle,
      region_id: page.region_id,
      folder_id: page.folder_id,
      revision: page.revision,
      published: true,
      blocks,
    };
    const published = await request('/lore/pages/' + pageId, admin, 'PUT', value);
    assert.equal(published.status, 200, JSON.stringify(published.data));
    atlas = (await request('/atlas', player)).data;
    place = atlas.locations.find((p: any) => p.id === id);
    assert.equal(place.history_page_id, pageId);
    assert.equal(place.history_preview.length, 3);
    assert.deepEqual(
      place.history_preview.map((b: any) => b.alt),
      ['Paisagem 0', 'Paisagem 1', 'Paisagem 2'],
    );
    assert.equal((await request('/lore/pages/' + pageId, player)).data.blocks.length, 5);
    const image = await fetch(base + '/api/lore/images/' + blocks[1].asset_id, {
      headers: { Cookie: player.cookie },
    });
    assert.equal(image.status, 200);
    const mission = await request('/board', player, 'POST', {
      kind: 'mission',
      title: 'Aventura no portão',
      description: 'Explorar os caminhos próximos ao portão.',
      difficulty: 'Tranquila',
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      location_id: id,
      reward_cp: 0,
    });
    assert.equal(mission.status, 201, JSON.stringify(mission.data));
    const room = await request('/vtt', player, 'POST', { name: 'Mesa do portão', ...target });
    assert.equal(room.status, 201, JSON.stringify(room.data));
    assert.equal(room.data.location_id, id);
    assert.equal(
      (
        await request('/vtt', player, 'POST', {
          name: 'Lugar errado',
          region_id: 'northundria',
          location_id: id,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request('/vtt/rooms/' + room.data.id + '/location', admin, 'PUT', {})).status,
      404,
    );
    assert.equal(
      (await request('/vtt/rooms/' + room.data.id + '/location', player, 'PUT', target)).status,
      200,
    );
    const saved = await request('/atlas/locations/' + id, admin, 'PUT', {
      name: input.name,
      description: 'Local atualizado',
      map_x: 0.55,
      map_y: 0.56,
      pin_visible: false,
      revision: 0,
    });
    assert.equal(saved.status, 200);
    assert.equal(
      (
        await request('/atlas/locations/' + id, admin, 'PUT', {
          name: input.name,
          description: '',
          map_x: 0,
          map_y: 0,
          pin_visible: true,
          revision: 0,
        })
      ).status,
      409,
    );
    const row = (
      await pool.query('SELECT location_id,region_id FROM board_posts WHERE id=$1', [
        mission.data.id,
      ])
    ).rows[0];
    assert.equal(row.location_id, id);
    assert.equal(row.region_id, 'reino-do-norte');
    assert.equal((await request('/board?location_id=' + id, player)).data.length, 1);
    const regionHistory = await request('/atlas/history', admin, 'POST', {
      region_id: 'reino-do-norte',
    });
    assert.equal(regionHistory.status, 200);
    assert.notEqual(regionHistory.data.page_id, pageId);
    const foreignFolder = (
      await pool.query("SELECT id FROM lore_folders WHERE region_id='northundria' LIMIT 1")
    ).rows[0];
    assert.equal(
      (
        await request('/lore/pages/' + pageId, admin, 'PUT', {
          ...value,
          revision: published.data.revision,
          region_id: 'northundria',
          folder_id: foreignFolder.id,
        })
      ).status,
      400,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
