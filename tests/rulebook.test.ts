import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { ensureInitialRulebook } from '../server/rulebook.js';
import {
  INITIAL_RULEBOOK,
  RULEBOOK_EDITOR_EMAIL,
  RULEBOOK_MAX_IMAGE_BYTES,
  rulebookDocumentSchema,
  type RulebookDocument,
} from '../shared/rulebook.js';

test('regras: autorização, revisão, histórico, importação, exclusão e imagens privadas', async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  if (
    !['localhost', '127.0.0.1'].includes(databaseUrl.hostname) ||
    !/^\/alvorada_test_[0-9a-f]{32}$/.test(databaseUrl.pathname)
  )
    throw new Error('Banco local descartável obrigatório.');
  await migrate();
  await seed();
  const previousRules = (
    await pool.query("SELECT * FROM world_entries WHERE section='rules' ORDER BY id")
  ).rows;
  const { createApp } = await import('../server/app.js');
  let server = createApp().listen(0, '127.0.0.1');
  let base = '';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0].trim();
  async function listening() {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}/api`;
  }
  await listening();
  async function req(path: string, cookie = '', method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = response.headers.get('Content-Type')?.includes('json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  }
  async function signup(email = `rules-${randomUUID()}@example.test`) {
    const response = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Leitor das regras',
      email,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((item) => item.split(';')[0])
        .join('; '),
    };
  }
  let revision = 0;
  let document: RulebookDocument = structuredClone(INITIAL_RULEBOOK);
  try {
    const reader = await signup(),
      editor = await signup(RULEBOOK_EDITOR_EMAIL),
      staff = await signup();
    // Respect Better Auth's real limit of three signups per ten seconds.
    await delay(10_100);
    const admin = await signup(),
      manager = await signup('limawelsn@gmail.com');
    assert.equal((await req('/rulebook', manager.cookie)).data.can_edit, false);
    await pool.query('INSERT INTO lore_folder_managers(user_id) VALUES($1)', [manager.id]);
    await pool.query("INSERT INTO guild_staff(user_id,role) VALUES($1,'staff'),($2,'admin')", [
      staff.id,
      admin.id,
    ]);
    assert.equal((await req('/rulebook')).status, 401);
    assert.equal((await req('/rulebook/history')).status, 401);
    assert.equal((await req('/rulebook/images/' + randomUUID())).status, 401);
    const first = await req('/rulebook', reader.cookie);
    assert.equal(first.status, 200);
    assert.equal(first.data.can_edit, false);
    assert.equal(first.data.revision, 0);
    assert.deepEqual(first.data.document, rulebookDocumentSchema.parse(INITIAL_RULEBOOK));
    assert.equal(first.data.document.cover_image, '/rules/rulebook-desk.webp');
    assert.equal(first.data.document.chapters.length, 6);
    for (const allowed of [editor, staff, admin, manager])
      assert.equal((await req('/rulebook', allowed.cookie)).data.can_edit, true);
    assert.equal(
      (await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [manager.id])).rowCount,
      0,
    );
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM guild_staff WHERE user_id=$1', [editor.id]))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await req('/rulebook', reader.cookie, 'PUT', { revision, document, can_edit: true })).status,
      403,
    );
    assert.equal((await req('/rulebook', '', 'PUT', { revision, document })).status, 401);
    assert.equal((await req('/rulebook/history', reader.cookie)).status, 403);
    assert.equal((await req('/rulebook/history/0', reader.cookie)).status, 403);
    assert.equal(
      (
        await req('/rulebook/images', reader.cookie, 'POST', {
          name: 'negada',
          data: 'data:image/png;base64,AA==',
        })
      ).status,
      403,
    );
    assert.deepEqual(
      (await req('/rulebook/history', editor.cookie)).data.revisions.map(
        (item: { revision: number }) => item.revision,
      ),
      [0],
    );
    assert.deepEqual(
      (await req('/rulebook/history/0', editor.cookie)).data.document,
      first.data.document,
    );
    assert.equal((await req('/rulebook/history/999', editor.cookie)).status, 404);
    assert.equal((await req('/rulebook/history/1.2', editor.cookie)).status, 400);

    const uploads = [];
    for (const format of ['png', 'jpeg', 'webp'] as const) {
      const imageData = await sharp({
        create: { width: 96, height: 64, channels: 3, background: '#57422c' },
      })
        [format]()
        .toBuffer();
      const upload = await req('/rulebook/images', editor.cookie, 'POST', {
        name: `Mapa de teste.${format}`,
        data: `data:image/${format};base64,${imageData.toString('base64')}`,
      });
      assert.equal(upload.status, 201);
      assert.equal(upload.data.width, 96);
      assert.equal(upload.data.height, 64);
      assert.equal(upload.data.src, `/api/rulebook/images/${upload.data.id}`);
      uploads.push(upload.data);
      assert.equal((await req(upload.data.src.slice(4), reader.cookie)).status, 404);
      const preview = await req(upload.data.src.slice(4), staff.cookie);
      assert.equal(preview.status, 200);
      assert.match(preview.headers.get('Content-Type')!, /^image\/webp/);
      assert.equal(preview.headers.get('Cache-Control'), 'no-store');
      assert.equal((await sharp(preview.data).metadata()).width, 96);
    }
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#222' } })
      .png()
      .toBuffer();
    for (const data of [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:image/png;base64,broken',
      `data:image/jpeg;base64,${png.toString('base64')}`,
      'data:image/png;base64,AA=',
    ])
      assert.equal(
        (await req('/rulebook/images', editor.cookie, 'POST', { name: 'inválida', data })).status,
        400,
      );
    const wide = await sharp({
      create: { width: 8193, height: 1, channels: 3, background: '#111' },
    })
      .png()
      .toBuffer();
    assert.equal(
      (
        await req('/rulebook/images', editor.cookie, 'POST', {
          name: 'larga',
          data: `data:image/png;base64,${wide.toString('base64')}`,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req('/rulebook/images', editor.cookie, 'POST', {
          name: 'grande',
          data: `data:image/png;base64,${Buffer.alloc(RULEBOOK_MAX_IMAGE_BYTES + 1).toString('base64')}`,
        })
      ).status,
      413,
    );
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM rulebook_images')).rows[0].n, 3);
    await pool.query(
      `INSERT INTO rulebook_images(uploaded_by,name,image_data,mime_type,width,height)
       SELECT $1,'Fixture quota',i.image_data,i.mime_type,i.width,i.height
       FROM rulebook_images i CROSS JOIN generate_series(1,497) WHERE i.id=$2`,
      [editor.id, uploads[0].id],
    );
    assert.equal(
      (
        await req('/rulebook/images', editor.cookie, 'POST', {
          name: 'Limite atingido',
          data: `data:image/png;base64,${png.toString('base64')}`,
        })
      ).status,
      409,
    );
    await pool.query("DELETE FROM rulebook_images WHERE name='Fixture quota' AND uploaded_by=$1", [
      editor.id,
    ]);

    document.title = 'Regras editadas pelos responsáveis';
    document.cover_image = uploads[0].src;
    document.chapters.push({
      id: 'chapter-edited',
      title: 'Capítulo recuperável',
      description: 'Exemplo do editor',
      symbol: 'swords',
      articles: [
        {
          id: 'article-edited',
          title: 'Todos os blocos',
          summary: 'Documento importado',
          tag: 'Consulta',
          blocks: [
            {
              id: 'block-text',
              type: 'text',
              text: '<script>texto literal</script>\nSegunda linha',
            },
            {
              id: 'block-callout',
              type: 'callout',
              title: 'Atenção',
              text: 'Observação',
              tone: 'warning',
            },
            { id: 'block-list', type: 'list', items: ['Primeiro', 'Segundo'], ordered: true },
            {
              id: 'block-table',
              type: 'table',
              columns: ['Nome', 'Valor'],
              rows: [['Uma regra', '1']],
            },
            {
              id: 'block-image',
              type: 'image',
              src: uploads[1].src.toUpperCase(),
              caption: 'Mapa privado publicado',
            },
            {
              id: 'block-remote-image',
              type: 'image',
              src: 'https://example.test/map.webp',
              caption: 'Referência HTTPS',
            },
          ],
        },
      ],
    });
    // Export/import uses a pure document; the authoritative validator runs again on publication.
    const imported = JSON.parse(JSON.stringify(document));
    const published = await req('/rulebook', editor.cookie, 'PUT', {
      revision,
      document: imported,
    });
    assert.equal(published.status, 200);
    revision = published.data.revision;
    document = published.data.document;
    assert.equal(document.chapters.at(-1)!.symbol, 'swords');
    assert.equal(revision, 1);
    assert.equal(document.chapters.at(-1)!.articles[0].blocks.at(-2)!.type, 'image');
    assert.deepEqual((await req('/rulebook', reader.cookie)).data.document, document);
    assert.equal((await req(uploads[0].src.slice(4), reader.cookie)).status, 200);
    assert.equal((await req(uploads[1].src.slice(4), reader.cookie)).status, 200);
    assert.equal((await req(uploads[2].src.slice(4), reader.cookie)).status, 404);
    const history = (await req('/rulebook/history', staff.cookie)).data;
    assert.deepEqual(
      history.revisions.map((item: { revision: number }) => item.revision),
      [1, 0],
    );
    assert.ok(
      history.revisions.every(
        (item: object) => Object.keys(item).sort().join(',') === 'revision,title,updated_at',
      ),
    );
    assert.deepEqual(
      (await req('/rulebook/history/0', admin.cookie)).data.document,
      first.data.document,
    );
    assert.deepEqual((await req('/rulebook/history/1', editor.cookie)).data.document, document);
    assert.equal(
      (await req('/rulebook', staff.cookie, 'PUT', { revision: 0, document })).status,
      409,
    );
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM rulebook_versions')).rows[0].n,
      1,
    );

    for (const invalid of [
      { ...document, version: 2 },
      { ...document, extra: true },
      { ...document, cover_image: 'javascript:alert(1)' },
      { ...document, cover_image: 'data:image/png;base64,AA==' },
      { ...document, cover_image: '/rules/../private.webp' },
      { ...document, cover_image: 'http://example.test/map.webp' },
      { ...document, cover_image: 'https://user:secret@example.test/map.webp' },
      { ...document, cover_image: `/api/rulebook/images/${randomUUID()}` },
      { ...document, chapters: [document.chapters[0], document.chapters[0]] },
      { ...document, chapters: [{ ...document.chapters[0], symbol: 'invalid-symbol' }] },
      {
        ...document,
        chapters: [
          {
            id: 'bad-table-chapter',
            title: 'Tabela',
            description: '',
            articles: [
              {
                id: 'bad-table-article',
                title: 'Tabela',
                summary: '',
                tag: '',
                blocks: [
                  {
                    id: 'bad-table-block',
                    type: 'table',
                    columns: ['Uma'],
                    rows: [['Duas', 'células']],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
      assert.equal(
        (await req('/rulebook', editor.cookie, 'PUT', { revision, document: invalid })).status,
        400,
      );
    assert.equal(
      (await req('/rulebook', editor.cookie, 'PUT', { revision, document, can_edit: true })).status,
      400,
    );
    assert.equal(
      (await req('/rulebook', editor.cookie, 'PUT', { revision: -1, document })).status,
      400,
    );
    const oversized = {
      ...document,
      chapters: [
        {
          id: 'large-chapter',
          title: 'Livro grande',
          description: '',
          articles: Array.from({ length: 2 }, (_, article) => ({
            id: `large-article-${article}`,
            title: 'Artigo',
            summary: '',
            tag: '',
            blocks: Array.from({ length: 55 }, (_, block) => ({
              id: `large-block-${article}-${block}`,
              type: 'text',
              text: 'x'.repeat(20_000),
            })),
          })),
        },
      ],
    };
    const tooLarge = await req('/rulebook', editor.cookie, 'PUT', {
      revision,
      document: oversized,
    });
    assert.equal(tooLarge.status, 400);
    assert.ok(tooLarge.data.details.includes('O livro deve ocupar no máximo 2 MB.'));

    // Concurrent publishers must serialize; one wins and the other retains a conflict.
    const concurrent = await Promise.all([
      req('/rulebook', staff.cookie, 'PUT', {
        revision,
        document: { ...document, subtitle: 'Publicação staff' },
      }),
      req('/rulebook', admin.cookie, 'PUT', {
        revision,
        document: { ...document, subtitle: 'Publicação admin' },
      }),
    ]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
    const winner = concurrent.find((result) => result.status === 200)!;
    revision = winner.data.revision;
    document = winner.data.document;
    assert.equal(revision, 2);
    assert.deepEqual(
      (await req('/rulebook/history/1', editor.cookie)).data.document,
      published.data.document,
    );

    // Removing chapters and cover is a reversible publication; images and full snapshots survive.
    const deleted = { ...document, chapters: [], cover_image: null };
    const removed = await req('/rulebook', editor.cookie, 'PUT', { revision, document: deleted });
    assert.equal(removed.status, 200);
    revision = removed.data.revision;
    assert.equal(revision, 3);
    const withoutCover = (await req('/rulebook', reader.cookie)).data;
    assert.equal(withoutCover.document.cover_image, null);
    assert.deepEqual(withoutCover.document.chapters, []);
    assert.equal((await req(uploads[0].src.slice(4), reader.cookie)).status, 404);
    assert.equal((await req(uploads[1].src.slice(4), reader.cookie)).status, 404);
    assert.equal((await req(uploads[1].src.slice(4), editor.cookie)).status, 200);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM rulebook_images')).rows[0].n, 3);
    assert.deepEqual((await req('/rulebook/history/2', editor.cookie)).data.document, document);
    // Merely opening a snapshot must not publish it. Recover through a normal PUT at the current revision.
    assert.equal((await req('/rulebook', reader.cookie)).data.revision, revision);
    const recovered = await req('/rulebook', editor.cookie, 'PUT', { revision, document });
    assert.equal(recovered.status, 200);
    revision = recovered.data.revision;
    assert.equal(revision, 4);
    assert.equal((await req(uploads[1].src.slice(4), reader.cookie)).status, 200);

    await ensureInitialRulebook();
    await seed();
    assert.deepEqual((await req('/rulebook', reader.cookie)).data.document, document);
    assert.equal((await req('/rulebook', reader.cookie)).data.revision, 4);
    assert.deepEqual(
      (await pool.query("SELECT * FROM world_entries WHERE section='rules' ORDER BY id")).rows,
      previousRules,
    );
    assert.deepEqual(
      (await pool.query('SELECT revision FROM rulebook_versions ORDER BY revision')).rows.map(
        (row) => row.revision,
      ),
      [0, 1, 2, 3],
    );
    // Roles are checked in PostgreSQL on each request, without promoting the owner account.
    await pool.query('DELETE FROM guild_staff WHERE user_id=$1', [staff.id]);
    assert.equal((await req('/rulebook', staff.cookie)).data.can_edit, false);
    assert.equal((await req('/rulebook/history', staff.cookie)).status, 403);
    assert.equal((await req('/rulebook', staff.cookie, 'PUT', { revision, document })).status, 403);
    assert.equal((await req(uploads[2].src.slice(4), staff.cookie)).status, 404);
    await pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
      editor.id,
      `former-${randomUUID()}@example.test`,
    ]);
    assert.equal((await req('/rulebook', editor.cookie)).data.can_edit, false);
    assert.equal((await req('/rulebook/history', editor.cookie)).status, 403);
    assert.equal(
      (await req('/rulebook', editor.cookie, 'PUT', { revision, document })).status,
      403,
    );

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    server = createApp().listen(0, '127.0.0.1');
    await listening();
    assert.equal((await req('/rulebook', reader.cookie)).data.revision, 4);
    assert.deepEqual((await req('/rulebook', reader.cookie)).data.document, document);
    assert.deepEqual(
      (await req('/rulebook/history', admin.cookie)).data.revisions.map(
        (item: { revision: number }) => item.revision,
      ),
      [4, 3, 2, 1, 0],
    );
    // Existing lore management grants the whole book without changing guild roles.
    // The manager can revise text another editor published, including initial entries.
    const managedDocument = structuredClone(document);
    const otherEditorText = managedDocument.chapters
      .at(-1)!
      .articles[0].blocks.find((block) => block.id === 'block-text');
    assert.ok(otherEditorText?.type === 'text');
    otherEditorText.text = 'Texto de outro editor revisado pela gestão da lore.';
    managedDocument.introduction = 'Apresentação inicial revisada pela gestão da lore.';
    const managerPublication = await req('/rulebook', manager.cookie, 'PUT', {
      revision,
      document: managedDocument,
    });
    assert.equal(managerPublication.status, 200);
    revision = managerPublication.data.revision;
    assert.equal(revision, 5);
    assert.equal(managerPublication.data.can_edit, true);
    assert.deepEqual((await req('/rulebook', reader.cookie)).data.document, managedDocument);
    assert.equal(
      (await pool.query('SELECT updated_by FROM rulebook_documents WHERE id=1')).rows[0].updated_by,
      manager.id,
    );
    assert.deepEqual((await req('/rulebook/history/4', manager.cookie)).data.document, document);
    assert.deepEqual(
      (await req('/rulebook/history/5', manager.cookie)).data.document,
      managedDocument,
    );

    const managerImage = await req('/rulebook/images', manager.cookie, 'POST', {
      name: 'Rascunho privado da gestão.png',
      data: `data:image/png;base64,${png.toString('base64')}`,
    });
    assert.equal(managerImage.status, 201);
    assert.equal((await req(managerImage.data.src.slice(4), manager.cookie)).status, 200);
    assert.equal((await req(managerImage.data.src.slice(4), reader.cookie)).status, 404);
    const managerDeletion = await req('/rulebook', manager.cookie, 'PUT', {
      revision,
      document: { ...managedDocument, chapters: [], cover_image: null },
    });
    assert.equal(managerDeletion.status, 200);
    revision = managerDeletion.data.revision;
    assert.equal(revision, 6);
    assert.deepEqual((await req('/rulebook', reader.cookie)).data.document.chapters, []);
    assert.deepEqual(
      (await req('/rulebook/history/5', manager.cookie)).data.document,
      managedDocument,
    );
    const managerRecovery = await req('/rulebook', manager.cookie, 'PUT', {
      revision,
      document: managedDocument,
    });
    assert.equal(managerRecovery.status, 200);
    revision = managerRecovery.data.revision;
    assert.equal(revision, 7);
    assert.deepEqual((await req('/rulebook', reader.cookie)).data.document, managedDocument);
    assert.deepEqual(
      (await req('/rulebook/history', manager.cookie)).data.revisions.map(
        (item: { revision: number }) => item.revision,
      ),
      [7, 6, 5, 4, 3, 2, 1, 0],
    );
    assert.equal(
      (await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [manager.id])).rowCount,
      0,
    );

    await pool.query('DELETE FROM lore_folder_managers WHERE user_id=$1', [manager.id]);
    assert.equal((await req('/rulebook', manager.cookie)).data.can_edit, false);
    assert.equal(
      (await req('/rulebook', manager.cookie, 'PUT', { revision, document: managedDocument }))
        .status,
      403,
    );
    assert.equal(
      (
        await req('/rulebook/images', manager.cookie, 'POST', {
          name: 'Sem autorização.png',
          data: `data:image/png;base64,${png.toString('base64')}`,
        })
      ).status,
      403,
    );
    assert.equal((await req('/rulebook/history', manager.cookie)).status, 403);
    assert.equal((await req('/rulebook/history/5', manager.cookie)).status, 403);
    assert.equal((await req(managerImage.data.src.slice(4), manager.cookie)).status, 404);
    assert.equal((await req(uploads[0].src.slice(4), manager.cookie)).status, 200);
    await seed();
    assert.equal((await req('/rulebook', manager.cookie)).data.can_edit, false);
    assert.equal(
      (await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [manager.id])).rowCount,
      0,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
