import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { loreDescendants, loreFolderPath, type LoreFolder } from '../shared/lore.js';

test('lore: regiões, subpastas, uploads, rascunhos privados, publicação, ownership e conflitos', async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
    throw new Error('Banco isolado obrigatório.');
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(
    path: string,
    cookie = '',
    method = 'GET',
    body?: unknown,
    mime = 'application/json',
  ) {
    const response = await fetch(base + path, {
      method,
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': mime },
      ...(body
        ? { body: Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body) }
        : {}),
    });
    const data = response.headers.get('Content-Type')?.includes('json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, data, headers: response.headers };
  }
  async function signup() {
    const result = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Escriba teste',
      email: `lore-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(result.status, 200);
    return {
      id: result.data.user.id,
      cookie: result.headers
        .getSetCookie()
        .map((item) => item.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup();
    assert.equal((await req('/lore')).status, 401);
    const initial = (await req('/lore', alice.cookie)).data;
    assert.equal(initial.regions.length, 22);
    assert.equal(initial.folders.length, 132);
    assert.equal(initial.pages.length, 2);
    assert.ok(
      initial.pages.every(
        (page: { published: boolean; can_edit: boolean }) => page.published && !page.can_edit,
      ),
    );
    await seed();
    assert.equal((await req('/lore', alice.cookie)).data.pages.length, 2);
    const root = initial.folders.find(
      (folder: LoreFolder) => folder.region_id === 'reino-do-norte' && folder.name === 'Cidades',
    );
    const child = await req('/lore/folders', alice.cookie, 'POST', {
      name: 'Portos',
      region_id: root.region_id,
      parent_id: root.id,
    });
    assert.equal(child.status, 201);
    assert.equal(
      (
        await req('/lore/folders', alice.cookie, 'POST', {
          name: 'Portos',
          region_id: root.region_id,
          parent_id: root.id,
        })
      ).status,
      409,
    );
    const otherRegion = initial.regions.find(
      (region: { id: string }) => region.id !== root.region_id,
    );
    assert.equal(
      (
        await req('/lore/folders', alice.cookie, 'POST', {
          name: 'Errada',
          region_id: otherRegion.id,
          parent_id: root.id,
        })
      ).status,
      400,
    );
    const block = {
      id: randomUUID(),
      type: 'text',
      title: 'Memórias',
      text: '<script>não executar</script>\n\nUma cidade entre muralhas.',
      style: 'parchment',
      alignment: 'left',
    };
    const data = {
      title: 'Porto da lua',
      subtitle: 'Crônica de teste',
      region_id: root.region_id,
      folder_id: child.data.id,
      published: false,
      blocks: [block],
    };
    const created = await req('/lore/pages', alice.cookie, 'POST', data);
    assert.equal(created.status, 201);
    assert.equal(created.data.can_edit, true);
    const id = created.data.id;
    assert.equal((await req(`/lore/pages/${id}`, bob.cookie)).status, 404);
    assert.equal((await req('/lore', bob.cookie)).data.pages.length, 2);
    const png = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#675936' },
    })
      .png()
      .toBuffer();
    assert.equal(
      (await req(`/lore/pages/${id}/images`, bob.cookie, 'POST', png, 'image/png')).status,
      404,
    );
    assert.equal(
      (
        await req(
          `/lore/pages/${id}/images`,
          alice.cookie,
          'POST',
          Buffer.from('not an image'),
          'image/png',
        )
      ).status,
      400,
    );
    const image = await req(`/lore/pages/${id}/images`, alice.cookie, 'POST', png, 'image/png');
    assert.equal(image.status, 201);
    assert.equal(image.data.width, 800);
    assert.equal((await req(`/lore/images/${image.data.id}`, bob.cookie)).status, 404);
    const ownImage = await req(`/lore/images/${image.data.id}`, alice.cookie);
    assert.equal(ownImage.status, 200);
    assert.equal((await sharp(ownImage.data).metadata()).format, 'webp');
    const imageBlock = {
      id: randomUUID(),
      type: 'image',
      asset_id: image.data.id,
      alt: 'Porto',
      caption: 'O porto',
      format: 'portrait',
      alignment: 'right',
      fit: 'contain',
      effect: 'cinematic',
    };
    const updated = { ...data, revision: 0, published: true, blocks: [imageBlock, block] };
    assert.equal((await req(`/lore/pages/${id}`, bob.cookie, 'PUT', updated)).status, 404);
    const published = await req(`/lore/pages/${id}`, alice.cookie, 'PUT', updated);
    assert.equal(published.status, 200);
    assert.equal(published.data.revision, 1);
    assert.equal((await req(`/lore/pages/${id}`, alice.cookie, 'PUT', updated)).status, 409);
    assert.equal((await req(`/lore/pages/${id}`, bob.cookie)).data.can_edit, false);
    assert.equal((await req(`/lore/images/${image.data.id}`, bob.cookie)).status, 200);
    assert.equal(
      (
        await req(`/lore/pages/${id}`, alice.cookie, 'PUT', {
          ...updated,
          revision: 1,
          region_id: otherRegion.id,
        })
      ).status,
      400,
    );
    const other = await req('/lore/pages', alice.cookie, 'POST', {
      ...data,
      title: 'Outra página',
    });
    assert.equal(
      (await req(`/lore/pages/${other.data.id}`, alice.cookie, 'PUT', updated)).status,
      400,
    );
    const largeBlocks = Array.from({ length: 50 }, () => ({
      ...block,
      id: randomUUID(),
      text: 'á'.repeat(12000),
    }));
    assert.equal(
      (
        await req(`/lore/pages/${other.data.id}`, alice.cookie, 'PUT', {
          ...data,
          revision: 0,
          blocks: largeBlocks,
        })
      ).status,
      200,
    );
    const longText = { ...block, text: 'Texto longo '.repeat(1000) };
    assert.equal(
      (
        await req(`/lore/pages/${id}`, alice.cookie, 'PUT', {
          ...updated,
          revision: 1,
          published: false,
          blocks: [imageBlock, longText],
        })
      ).status,
      200,
    );
    assert.equal((await req(`/lore/images/${image.data.id}`, bob.cookie)).status, 404);
    assert.equal(
      (await pool.query('SELECT * FROM lore_page_versions WHERE page_id=$1', [id])).rowCount,
      2,
    );
    const folders = (await req('/lore', alice.cookie)).data.folders;
    assert.equal(loreFolderPath(child.data.id, folders), 'Cidades / Portos');
    assert.ok(loreDescendants(root.id, folders).has(child.data.id));
    await pool.query('INSERT INTO guild_staff(user_id,role) VALUES($1,$2)', [bob.id, 'staff']);
    assert.equal((await req(`/lore/pages/${id}`, bob.cookie)).data.can_edit, true);
    // Folder management is a separate permission, including for existing staff.
    assert.equal((await req('/lore', alice.cookie)).data.can_manage_folders, false);
    assert.equal(
      (await req(`/lore/folders/${root.id}`, bob.cookie, 'DELETE', { destination_id: null }))
        .status,
      403,
    );
    assert.equal(
      (
        await req(`/lore/folders/${root.id}`, alice.cookie, 'PUT', {
          name: 'Renomeada',
          parent_id: null,
          revision: 0,
        })
      ).status,
      403,
    );
    assert.equal((await req('/lore/folder-trash', bob.cookie)).status, 403);
    await pool.query('INSERT INTO lore_folder_managers(user_id) VALUES($1)', [alice.id]);
    assert.equal((await req('/lore', alice.cookie)).data.can_manage_folders, true);
    // The authorized account manages every region and edits lore without gaining guild staff.
    assert.equal(
      (await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [alice.id])).rowCount,
      0,
    );
    for (const region of initial.regions) {
      const capital = initial.folders.find(
        (folder: LoreFolder) => folder.region_id === region.id && folder.name === 'Capital',
      );
      assert.equal(
        (
          await req(`/lore/folders/${capital.id}`, alice.cookie, 'PUT', {
            name: capital.name,
            parent_id: null,
            revision: capital.revision,
          })
        ).status,
        200,
      );
    }
    const legacy = (await req(`/lore/pages/${initial.pages[0].id}`, alice.cookie)).data;
    assert.equal(legacy.can_edit, true);
    assert.equal(
      (
        await req(`/lore/pages/${legacy.id}`, alice.cookie, 'PUT', {
          title: legacy.title,
          subtitle: legacy.subtitle,
          region_id: legacy.region_id,
          folder_id: legacy.folder_id,
          published: legacy.published,
          blocks: legacy.blocks,
          revision: legacy.revision,
        })
      ).status,
      200,
    );
    const charlie = await signup();
    assert.equal((await req(`/lore/pages/${legacy.id}`, charlie.cookie)).data.can_edit, false);
    const distantFolder = initial.folders.find(
      (folder: LoreFolder) => folder.region_id === 'coroa-da-geada' && folder.name === 'Capital',
    );
    const privatePage = await req('/lore/pages', charlie.cookie, 'POST', {
      ...data,
      region_id: distantFolder.region_id,
      folder_id: distantFolder.id,
    });
    assert.equal(privatePage.status, 201);
    const sharedDraft = (await req(`/lore/pages/${privatePage.data.id}`, alice.cookie)).data;
    assert.equal(sharedDraft.can_edit, true);
    const sharedImage = await req(
      `/lore/pages/${sharedDraft.id}/images`,
      alice.cookie,
      'POST',
      png,
      'image/png',
    );
    assert.equal(sharedImage.status, 201);
    assert.equal(
      (
        await req(`/lore/pages/${sharedDraft.id}`, alice.cookie, 'PUT', {
          ...data,
          region_id: distantFolder.region_id,
          folder_id: distantFolder.id,
          title: 'Crônica revisada pela gestão da lore',
          revision: sharedDraft.revision,
          blocks: [block, { ...imageBlock, asset_id: sharedImage.data.id }],
        })
      ).status,
      200,
    );
    assert.equal(
      (await pool.query('SELECT author_id FROM lore_pages WHERE id=$1', [sharedDraft.id])).rows[0]
        .author_id,
      charlie.id,
    );
    assert.equal((await req(`/lore/pages/${id}`, charlie.cookie)).status, 404);
    assert.equal((await req(`/lore/images/${image.data.id}`, charlie.cookie)).status, 404);
    const history = initial.folders.find(
      (folder: LoreFolder) => folder.region_id === root.region_id && folder.name === 'História',
    );
    assert.equal(
      (
        await req(`/lore/folders/${history.id}`, alice.cookie, 'PUT', {
          name: 'Crônicas antigas',
          parent_id: null,
          revision: 0,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req(`/lore/folders/${history.id}`, alice.cookie, 'PUT', {
          name: 'Outro nome',
          parent_id: null,
          revision: 0,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await req(`/lore/folders/${root.id}`, alice.cookie, 'PUT', {
          name: 'Cidades',
          parent_id: child.data.id,
          revision: 0,
        })
      ).status,
      400,
    );
    const nested = await req('/lore/folders', alice.cookie, 'POST', {
      name: 'Faróis',
      region_id: root.region_id,
      parent_id: child.data.id,
    });
    assert.equal(nested.status, 201);
    assert.equal(
      (
        await req(`/lore/folders/${child.data.id}`, alice.cookie, 'DELETE', {
          destination_id: null,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await req(`/lore/folders/${child.data.id}`, alice.cookie, 'DELETE', {
          destination_id: nested.data.id,
        })
      ).status,
      400,
    );
    const deletion = await req(`/lore/folders/${child.data.id}`, alice.cookie, 'DELETE', {
      destination_id: history.id,
    });
    assert.equal(deletion.status, 200);
    const deletedIndex = (await req('/lore', alice.cookie)).data;
    assert.ok(
      !deletedIndex.folders.some(
        (folder: LoreFolder) => folder.id === child.data.id || folder.id === nested.data.id,
      ),
    );
    const moved = (await req(`/lore/pages/${id}`, alice.cookie)).data;
    assert.equal(moved.folder_id, history.id);
    assert.equal(moved.published, false);
    assert.equal((await req(`/lore/images/${image.data.id}`, bob.cookie)).status, 200); // Staff access remains unchanged.
    assert.equal((await req('/lore/pages', alice.cookie, 'POST', data)).status, 400);
    await seed();
    assert.ok(
      !(await req('/lore', alice.cookie)).data.folders.some(
        (folder: LoreFolder) => folder.id === child.data.id,
      ),
    );
    assert.equal((await req('/lore/folder-trash', alice.cookie)).data.length, 1);
    assert.equal(
      (await req(`/lore/folder-trash/${deletion.data.deletion_id}/restore`, bob.cookie, 'POST', {}))
        .status,
      403,
    );
    assert.equal(
      (
        await req(
          `/lore/folder-trash/${deletion.data.deletion_id}/restore`,
          alice.cookie,
          'POST',
          {},
        )
      ).status,
      200,
    );
    assert.equal((await req(`/lore/pages/${id}`, alice.cookie)).data.folder_id, child.data.id);
    assert.ok(
      (await req('/lore', alice.cookie)).data.folders.some(
        (folder: LoreFolder) => folder.id === nested.data.id,
      ),
    );
    assert.equal((await req('/lore/folder-trash', alice.cookie)).data.length, 0);
    // Moving an existing parent must also preserve the depth limit when restoring its trash.
    const religion = initial.folders.find(
      (folder: LoreFolder) => folder.region_id === root.region_id && folder.name === 'Religião',
    );
    const newParent = await req('/lore/folders', alice.cookie, 'POST', {
      name: 'Arquivo dos cultos',
      region_id: root.region_id,
      parent_id: religion.id,
    });
    const secondDeletion = await req(`/lore/folders/${child.data.id}`, alice.cookie, 'DELETE', {
      destination_id: history.id,
    });
    assert.equal(secondDeletion.status, 200);
    assert.equal(
      (
        await req(`/lore/folders/${root.id}`, alice.cookie, 'PUT', {
          name: root.name,
          parent_id: newParent.data.id,
          revision: 0,
        })
      ).status,
      200,
    );
    const secondRestore = `/lore/folder-trash/${secondDeletion.data.deletion_id}/restore`;
    assert.equal((await req(secondRestore, alice.cookie, 'POST', {})).status, 409);
    assert.equal(
      (
        await req(`/lore/folders/${root.id}`, alice.cookie, 'PUT', {
          name: root.name,
          parent_id: null,
          revision: 1,
        })
      ).status,
      200,
    );
    const movedAgain = (await req(`/lore/pages/${id}`, alice.cookie)).data;
    assert.equal(
      (
        await req(`/lore/pages/${id}`, alice.cookie, 'PUT', {
          ...data,
          folder_id: history.id,
          title: 'Crônica revisada após a exclusão',
          blocks: movedAgain.blocks,
          revision: movedAgain.revision,
        })
      ).status,
      200,
    );
    assert.equal((await req(secondRestore, alice.cookie, 'POST', {})).status, 200);
    const revised = (await req(`/lore/pages/${id}`, alice.cookie)).data;
    assert.equal(revised.title, 'Crônica revisada após a exclusão');
    assert.equal(revised.folder_id, history.id);
    // Deletion respects permissions and concurrent edits, and hides both page and image.
    assert.equal(
      (await req(`/lore/pages/${id}`, '', 'DELETE', { revision: revised.revision })).status,
      401,
    );
    assert.equal(
      (await req(`/lore/pages/${id}`, charlie.cookie, 'DELETE', { revision: revised.revision }))
        .status,
      404,
    );
    assert.equal(
      (await req(`/lore/pages/${id}`, alice.cookie, 'DELETE', { revision: revised.revision - 1 }))
        .status,
      409,
    );
    assert.equal((await req(`/lore/pages/${id}`, alice.cookie)).status, 200);
    assert.equal(
      (await req(`/lore/pages/${id}`, alice.cookie, 'DELETE', { revision: revised.revision }))
        .status,
      200,
    );
    for (const user of [alice, bob, charlie]) {
      assert.equal((await req(`/lore/pages/${id}`, user.cookie)).status, 404);
      assert.equal((await req(`/lore/images/${image.data.id}`, user.cookie)).status, 404);
      assert.ok(
        !(await req('/lore', user.cookie)).data.pages.some(
          (page: { id: string }) => page.id === id,
        ),
      );
    }
    assert.equal(
      (await req(`/lore/pages/${id}`, alice.cookie, 'DELETE', { revision: revised.revision }))
        .status,
      404,
    );
    assert.equal(
      (await req(`/lore/pages/${id}/images`, alice.cookie, 'POST', png, 'image/png')).status,
      404,
    );
    assert.equal(
      (
        await req(`/lore/pages/${id}`, alice.cookie, 'PUT', {
          ...updated,
          revision: revised.revision + 1,
        })
      ).status,
      404,
    );
    const pageDeletion = (
      await pool.query('SELECT deleted_at,deleted_by FROM lore_pages WHERE id=$1', [id])
    ).rows[0];
    assert.ok(pageDeletion.deleted_at);
    assert.equal(pageDeletion.deleted_by, alice.id);
    assert.equal(
      (
        await pool.query('SELECT 1 FROM lore_page_versions WHERE page_id=$1 AND revision=$2', [
          id,
          revised.revision,
        ])
      ).rowCount,
      1,
    );
    // The lore manager can delete another author's draft.
    const managed = (await req(`/lore/pages/${sharedDraft.id}`, alice.cookie)).data;
    assert.equal(
      (
        await req(`/lore/pages/${managed.id}`, alice.cookie, 'DELETE', {
          revision: managed.revision,
        })
      ).status,
      200,
    );
    assert.equal((await req(`/lore/pages/${managed.id}`, charlie.cookie)).status, 404);
    // Staff can delete; ordinary accounts cannot delete published legacy pages.
    assert.equal(
      (
        await req(`/lore/pages/${legacy.id}`, charlie.cookie, 'DELETE', {
          revision: legacy.revision + 1,
        })
      ).status,
      404,
    );
    const beforeDelete = (await req(`/lore/pages/${legacy.id}`, bob.cookie)).data;
    assert.equal(
      (
        await req(`/lore/pages/${legacy.id}`, bob.cookie, 'DELETE', {
          revision: beforeDelete.revision,
        })
      ).status,
      200,
    );
    await seed();
    assert.equal((await req(`/lore/pages/${legacy.id}`, alice.cookie)).status, 404);
    // Authors can remove their own drafts without management permissions.
    const ownDraft = await req('/lore/pages', charlie.cookie, 'POST', {
      ...data,
      folder_id: history.id,
    });
    assert.equal(ownDraft.status, 201);
    assert.equal(
      (await req(`/lore/pages/${ownDraft.data.id}`, charlie.cookie, 'DELETE', { revision: 0 }))
        .status,
      200,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
