import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { isAdministrator, administrationFor } from '../server/administrators.js';
import { adminScopes } from '../shared/admin-scopes.js';

test('administração limitada: quatro áreas independentes, uploads, privacidade e revogação', async () => {
  const database = new URL(process.env.DATABASE_URL!);
  assert.match(database.pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  assert.notEqual(database.port, '5437');
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const trustedOrigin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(
    path: string,
    cookie: string,
    method = 'GET',
    body?: unknown,
    preview = false,
  ) {
    const response = await fetch(origin + '/api' + path, {
      method,
      headers: {
        Origin: trustedOrigin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        ...(preview ? { 'X-Account-Preview': 'basic' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Editor restrito',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
      administrador: 1,
      admin_scopes: adminScopes,
      role: 'admin',
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id as string,
      cookie: r.headers
        .getSetCookie()
        .map((p) => p.split(';')[0])
        .join('; '),
    };
  }
  try {
    const limited = await signup(),
      root = await signup(),
      player = await signup();
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [root.id]);
    assert.deepEqual((await req('/me', limited.cookie)).data.admin_scopes, []);
    await req('/auth/update-user', limited.cookie, 'POST', {
      admin_scopes: adminScopes,
      role: 'admin',
      administrador: 1,
    });
    assert.deepEqual((await req('/me', limited.cookie)).data.admin_scopes, []);
    await assert.rejects(
      pool.query("INSERT INTO administrator_scopes(user_id,scope) VALUES($1,'shop')", [limited.id]),
      { code: '23514' },
    );
    const flags = async (cookie: string, preview = false) => {
      const [l, r, h, w, c] = await Promise.all([
        req('/lore', cookie, 'GET', undefined, preview),
        req('/rulebook', cookie, 'GET', undefined, preview),
        req('/calendar?month=2026-10', cookie, 'GET', undefined, preview),
        req('/atlas', cookie, 'GET', undefined, preview),
        req('/world-clock', cookie, 'GET', undefined, preview),
      ]);
      return {
        lore: l.data.can_manage_folders,
        rules: r.data.can_edit,
        home: h.data.can_edit,
        world: w.data.can_manage_pins,
        clock: c.data.canEdit,
        events: h.data.can_edit_events,
      };
    };
    for (const scope of adminScopes) {
      await pool.query('DELETE FROM administrator_scopes WHERE user_id=$1', [limited.id]);
      await pool.query('INSERT INTO administrator_scopes(user_id,scope) VALUES($1,$2)', [
        limited.id,
        scope,
      ]);
      const f = await flags(limited.cookie);
      for (const area of adminScopes) assert.equal(f[area], area === scope, `${scope} -> ${area}`);
      assert.equal(f.clock, scope === 'world');
      assert.equal(f.events, false);
      assert.equal(await isAdministrator(limited.id), false);
      for (const area of adminScopes)
        assert.equal(await administrationFor(area).has(limited.id), area === scope);
    }
    // World editors cannot create/read unpublished Lore through the map.
    assert.equal(
      (await req('/atlas/history', limited.cookie, 'POST', { region_id: 'reino-do-norte' })).status,
      403,
    );
    const loreIndex = (await req('/lore', root.cookie)).data,
      folder = loreIndex.folders.find(
        (f: { region_id: string }) => f.region_id === 'reino-do-norte',
      );
    const pageInput = {
      title: 'História privada',
      subtitle: '',
      region_id: folder.region_id,
      folder_id: folder.id,
      published: false,
      blocks: [],
    };
    const page = await req('/lore/pages', root.cookie, 'POST', pageInput);
    assert.equal(page.status, 201);
    const place = await req('/atlas/locations', limited.cookie, 'POST', {
      region_id: 'reino-do-norte',
      name: 'Porto restrito',
      description: '',
      map_x: 0.4,
      map_y: 0.5,
    });
    assert.equal(place.status, 201);
    await pool.query('UPDATE world_locations SET history_page_id=$1 WHERE id=$2', [
      page.data.id,
      place.data.id,
    ]);
    const hidden = (await req('/atlas', limited.cookie)).data.locations.find(
      (l: { id: string }) => l.id === place.data.id,
    );
    assert.equal(hidden.history_page_id, null);
    assert.equal((await req('/lore/pages/' + page.data.id, limited.cookie)).status, 404);
    await pool.query(
      'INSERT INTO administrator_scopes(user_id,scope) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',
      [limited.id, adminScopes],
    );
    const me = (await req('/me', limited.cookie)).data;
    assert.equal(me.administrador, 0);
    assert.equal(me.gold_unlimited, false);
    assert.equal(me.role, 'content-admin');
    assert.deepEqual([...me.admin_scopes].sort(), [...adminScopes].sort());
    assert.equal(me.canEditKingdom, true);
    assert.equal(
      (
        await req('/lore/pages/' + page.data.id, limited.cookie, 'PUT', {
          ...pageInput,
          revision: page.data.revision,
          title: 'Revisada',
        })
      ).status,
      200,
    );
    const rules = (await req('/rulebook', limited.cookie)).data;
    assert.equal(
      (
        await req('/rulebook', limited.cookie, 'PUT', {
          document: rules.document,
          revision: rules.revision,
        })
      ).status,
      200,
    );
    const home = await req('/home-updates', root.cookie, 'POST', {
      title: 'Aviso',
      body: 'Publicado pelo administrador principal.',
    });
    assert.equal(home.status, 201);
    assert.equal(
      (
        await req('/home-updates/' + home.data.id, limited.cookie, 'PUT', {
          ...home.data,
          title: 'Revisado pela segunda administração',
        })
      ).status,
      200,
    );
    const clock = (await req('/world-clock', limited.cookie)).data;
    assert.equal(
      (
        await req('/world-clock', limited.cookie, 'POST', {
          time: '15:10',
          revision: clock.revision,
        })
      ).status,
      200,
    );
    assert.equal((await req('/kingdom/editor-draft', limited.cookie)).status, 200);
    assert.equal(
      (
        await req('/atlas/locations/' + place.data.id, limited.cookie, 'PUT', {
          name: 'Porto revisado',
          description: '',
          map_x: 0.45,
          map_y: 0.55,
          revision: 0,
        })
      ).status,
      200,
    );
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#817253' } })
      .png()
      .toBuffer();
    const upload = await fetch(origin + '/api/home-images', {
      method: 'POST',
      headers: { Origin: trustedOrigin, Cookie: limited.cookie, 'Content-Type': 'image/png' },
      body: png,
    });
    assert.equal(upload.status, 201);
    const image = await upload.json();
    assert.equal(
      (await fetch(origin + image.path, { headers: { Cookie: player.cookie } })).status,
      404,
    );
    const calendar = (await req('/calendar?month=2026-10', limited.cookie)).data;
    assert.equal(
      (
        await req('/calendar/settings', limited.cookie, 'PUT', {
          revision: calendar.revision,
          document: { ...calendar.document, background: image.path },
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(origin + image.path, { headers: { Cookie: player.cookie } })).status,
      200,
    );
    // Shared calendar must not expose unpublished event media owned by someone else.
    const privateImage = (
      await pool.query('INSERT INTO event_images(author_id,bytes) VALUES($1,$2) RETURNING id', [
        root.id,
        png,
      ])
    ).rows[0];
    assert.equal(
      (
        await req('/calendar/settings', limited.cookie, 'PUT', {
          revision: calendar.revision + 1,
          document: { ...calendar.document, background: '/api/event-images/' + privateImage.id },
        })
      ).status,
      400,
    );
    for (const path of ['/events', '/events-scene', '/event-images'])
      assert.equal(
        (
          await req(path, limited.cookie, path === '/events-scene' ? 'PUT' : 'POST', {
            administrador: 1,
            admin_scopes: adminScopes,
          })
        ).status,
        403,
        path,
      );
    assert.equal(
      (await pool.query('SELECT administrador FROM "user" WHERE id=$1', [limited.id])).rows[0]
        .administrador,
      0,
    );
    assert.equal(
      (await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [limited.id])).rowCount,
      0,
    );
    // The primary administrator and their basic preview still have distinct rights.
    assert.deepEqual(await flags(root.cookie), {
      lore: true,
      rules: true,
      home: true,
      world: true,
      clock: true,
      events: true,
    });
    assert.deepEqual(await flags(root.cookie, true), {
      lore: false,
      rules: false,
      home: false,
      world: false,
      clock: false,
      events: false,
    });
    assert.deepEqual((await req('/me', root.cookie, 'GET', undefined, true)).data.admin_scopes, []);
    for (const [path, method] of [
      ['/lore/pages', 'POST'],
      ['/rulebook', 'PUT'],
      ['/home-updates', 'POST'],
      ['/atlas/locations', 'POST'],
      ['/calendar/settings', 'PUT'],
    ])
      assert.equal((await req(path, root.cookie, method, {}, true)).status, 403, path);
    await pool.query('DELETE FROM administrator_scopes WHERE user_id=$1', [limited.id]);
    assert.deepEqual(await flags(limited.cookie), {
      lore: false,
      rules: false,
      home: false,
      world: false,
      clock: false,
      events: false,
    });
    assert.equal(
      (await req('/home-updates/' + home.data.id, limited.cookie, 'DELETE')).status,
      403,
    );
    assert.equal((await req('/lore/pages/' + page.data.id, limited.cookie)).status, 404);
    assert.equal((await req('/kingdom/editor-draft', limited.cookie)).status, 403);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
