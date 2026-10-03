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
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
