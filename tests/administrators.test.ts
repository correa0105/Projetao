import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';

test('administradores: cadastro não concede acesso, permissões antigas não contornam a coluna e revogação é imediata', async () => {
  const database = new URL(process.env.DATABASE_URL!);
  assert.match(database.pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const trustedOrigin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown) {
    const response = await fetch(origin + '/api' + path, {
      method,
      headers: { Origin: trustedOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  async function signup() {
    const response = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Fiscal de permissões',
      email: `permissions-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
      administrador: 1,
      role: 'admin',
      canEditKingdom: true,
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id as string,
      cookie: response.headers
        .getSetCookie()
        .map((part) => part.split(';')[0])
        .join('; '),
    };
  }
  try {
    const author = await signup(),
      otherAdmin = await signup();
    assert.equal((await req('/me', author.cookie)).data.administrador, 0);
    await req('/auth/update-user', author.cookie, 'POST', {
      name: 'Tentativa',
      administrador: 1,
      role: 'admin',
    });
    assert.equal((await req('/me', author.cookie)).data.administrador, 0);
    await pool.query("INSERT INTO guild_staff(user_id,role) VALUES($1,'admin')", [author.id]);
    await pool.query('INSERT INTO lore_folder_managers(user_id) VALUES($1)', [author.id]);
    assert.equal((await req('/me', author.cookie)).data.canEditKingdom, false);
    assert.equal((await req('/me', author.cookie)).data.role, 'player');
    await assert.rejects(pool.query('UPDATE "user" SET administrador=2 WHERE id=$1', [author.id]), {
      code: '23514',
    });
    await assert.rejects(
      pool.query('UPDATE "user" SET administrador=NULL WHERE id=$1', [author.id]),
      { code: '23502' },
    );

    const unknown = randomUUID();
    const blocked: [string, string][] = [
      ['/lore/folders', 'POST'],
      [`/lore/folders/${unknown}`, 'PUT'],
      [`/lore/folders/${unknown}`, 'DELETE'],
      [`/lore/folder-trash/${unknown}/restore`, 'POST'],
      ['/lore/pages', 'POST'],
      [`/lore/pages/${unknown}`, 'PUT'],
      [`/lore/pages/${unknown}`, 'DELETE'],
      [`/lore/pages/${unknown}/images`, 'POST'],
      ['/rulebook', 'PUT'],
      ['/lore-timeline', 'PUT'],
      ['/rulebook/images', 'POST'],
      ['/home-updates', 'POST'],
      [`/home-updates/${unknown}`, 'PUT'],
      [`/home-updates/${unknown}`, 'DELETE'],
      ['/home-images', 'POST'],
      ['/kingdom/editor-draft', 'PUT'],
      ['/kingdom/editor-background', 'POST'],
      ['/kingdom/editor-background', 'DELETE'],
      ['/kingdom/editor-view', 'PUT'],
      ['/kingdom/editor-view', 'DELETE'],
    ];
    for (const [path, method] of blocked) {
      assert.equal((await req(path, '', method, {})).status, 401, `${method} ${path} anonymous`);
      assert.equal(
        (await req(path, author.cookie, method, { administrador: 1 })).status,
        403,
        `${method} ${path} player`,
      );
    }
    assert.equal((await req('/lore', author.cookie)).data.can_manage_folders, false);
    assert.equal((await req('/rulebook', author.cookie)).data.can_edit, false);
    assert.equal((await req('/rulebook/history', author.cookie)).status, 403);

    await pool.query('UPDATE "user" SET administrador=1 WHERE id=ANY($1::text[])', [
      [author.id, otherAdmin.id],
    ]);
    assert.equal((await req('/me', author.cookie)).data.administrador, 1);
    assert.equal((await req('/me', author.cookie)).data.role, 'admin');
    const index = (await req('/lore', author.cookie)).data;
    const folder = index.folders[0];
    const initialTimeline = (await req('/lore-timeline', author.cookie)).data;
    assert.equal(initialTimeline.can_edit, true);
    assert.equal(
      initialTimeline.document.eras.filter((era: { revealed: boolean }) => era.revealed).length,
      1,
    );
    const timelineDocument = structuredClone(initialTimeline.document);
    timelineDocument.eras[0].folder_ids = [folder.id];
    timelineDocument.eras[0].title = 'Nome ainda secreto';
    const timelineWrite = { revision: 0, document: timelineDocument };
    assert.equal((await req('/lore-timeline', author.cookie, 'PUT', timelineWrite)).status, 200);
    assert.equal(
      (await req('/lore-timeline', otherAdmin.cookie, 'PUT', timelineWrite)).status,
      409,
    );
    const invalidTimeline = structuredClone(timelineDocument);
    invalidTimeline.eras[1].folder_ids = [folder.id];
    assert.equal(
      (
        await req('/lore-timeline', author.cookie, 'PUT', {
          revision: 1,
          document: invalidTimeline,
        })
      ).status,
      400,
    );
    invalidTimeline.eras[1].folder_ids = [randomUUID()];
    assert.equal(
      (
        await req('/lore-timeline', author.cookie, 'PUT', {
          revision: 1,
          document: invalidTimeline,
        })
      ).status,
      400,
    );
    const pageInput = {
      title: 'Crônica compartilhada',
      subtitle: '',
      region_id: folder.region_id,
      folder_id: folder.id,
      published: true,
      blocks: [
        {
          id: randomUUID(),
          type: 'text',
          title: '',
          text: 'Texto da guilda.',
          style: 'prose',
          alignment: 'left',
        },
      ],
    };
    const page = await req('/lore/pages', author.cookie, 'POST', pageInput);
    assert.equal(page.status, 201);
    const publication = await req('/home-updates', author.cookie, 'POST', {
      title: 'Aviso da guilda',
      body: 'Texto compartilhado.',
    });
    assert.equal(publication.status, 201);
    assert.equal(
      (
        await req('/home-updates/' + publication.data.id, otherAdmin.cookie, 'PUT', {
          ...publication.data,
          title: 'Revisado por outro administrador',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req('/lore/pages/' + page.data.id, otherAdmin.cookie, 'PUT', {
          ...pageInput,
          revision: page.data.revision,
          title: 'Crônica revisada',
        })
      ).status,
      200,
    );
    await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [author.id]);
    const me = (await req('/me', author.cookie)).data;
    assert.equal(me.administrador, 0);
    assert.equal(me.canEditKingdom, false);
    const publicTimeline = (await req('/lore-timeline', author.cookie)).data;
    assert.equal(publicTimeline.can_edit, false);
    assert.equal(publicTimeline.document.eras[0].title, '');
    assert.equal(
      (
        await req('/lore-timeline', author.cookie, 'PUT', {
          revision: 1,
          document: timelineDocument,
        })
      ).status,
      403,
    );
    assert.equal(
      (await req('/lore-timeline', otherAdmin.cookie)).data.document.eras[0].title,
      'Nome ainda secreto',
    );
    assert.equal((await req('/lore/pages/' + page.data.id, author.cookie)).data.can_edit, false);
    assert.ok(
      (await req('/home-updates', author.cookie)).data.every(
        (item: { can_edit: boolean }) => !item.can_edit,
      ),
    );
    assert.equal(
      (await req('/home-updates/' + publication.data.id, author.cookie, 'DELETE')).status,
      403,
    );
    assert.equal(
      (await req('/lore/pages/' + page.data.id, author.cookie, 'DELETE', { revision: 1 })).status,
      403,
    );
    assert.equal((await req('/rulebook', author.cookie)).data.can_edit, false);
    assert.equal((await req('/kingdom/editor-draft', author.cookie)).status, 403);
    assert.equal(
      (await req('/home-updates/' + publication.data.id, otherAdmin.cookie, 'DELETE')).status,
      200,
    );
    assert.equal(
      (await req('/lore/pages/' + page.data.id, otherAdmin.cookie, 'DELETE', { revision: 1 }))
        .status,
      200,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
