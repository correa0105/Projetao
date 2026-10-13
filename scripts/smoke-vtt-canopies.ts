import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
import sharp from 'sharp';
import { rockAssets } from '../shared/vtt-rock-assets';
import { pets } from '../shared/pets';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable DB only');
const origin = 'http://localhost:3064';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const bundle = await build({
  stdin: {
    contents:
      "import {renderVtt} from './src/vtt-canvas';import {newScene,newToken} from './shared/vtt';import {treeCanopyOccupied} from './src/vtt-canopies-canvas';window.canopyQA={renderVtt,newScene,newToken,treeCanopyOccupied};",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
});
await cp('public/vtt/rocks-20261013', 'dist/client/vtt/rocks-20261013', { recursive: true });
const { createApp } = await import('../server/app');
const env = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const app = createApp();
await mkdir('dist/client/__qa', { recursive: true });
await writeFile('dist/client/__qa/renderer.js', bundle.outputFiles[0].text);
const petFixture = await sharp(
  Buffer.from(
    '<svg width="800" height="800"><ellipse cx="480" cy="510" rx="170" ry="100" fill="#b1a38b"/></svg>',
  ),
)
  .png()
  .toBuffer();
await writeFile('dist/client/__qa/pet.png', petFixture);
const server = app.listen(3064, '127.0.0.1');
process.env.NODE_ENV = env;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await ctx.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
await ctx.addInitScript('globalThis.__name = (fn) => fn;');
await mkdir('test-results/canopies', { recursive: true });
const request = async (path: string, data?: unknown, method?: string) => {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method: method || 'POST',
    data,
    headers: { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
};
try {
  const account = (
    await request('/auth/sign-up/email', {
      name: 'Guardião',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [account.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  const hero = await createLegacyTestCharacter(account.id, 'Guardião');
  await pool.query('UPDATE characters SET gold_cp=9000000 WHERE id=$1', [hero.id]);
  // Every species must occupy the same ground anchor, at all supported widths.
  const animals = [];
  for (const p of pets)
    animals.push(
      (
        await request('/pets/purchase', {
          character_id: hero.id,
          pet_id: p.id,
          name: p.name,
          idempotency_key: randomUUID(),
        })
      ).pet,
    );
  const anchors = new Map<number, number>();
  await page.goto(origin + '/#characters');
  for (const animal of animals) {
    await request(`/pets/${hero.id}/display`, { pet_id: animal.id }, 'PUT');
    await page.reload();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        () =>
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          ),
      );
      const pet = page.locator('.camp-pet');
      await expect(pet).toHaveAttribute('data-pet-id', animal.id);
      await expect
        .poll(() => pet.evaluate((e) => getComputedStyle(e).right))
        .not.toBe('auto');
      const geometry = await pet.evaluate((e) => {
        const r = e.getBoundingClientRect(),
          art = e.querySelector('.pet-art')!.getBoundingClientRect();
        return { x: r.x + r.width / 2, bottom: art.bottom };
      });
      if (!anchors.has(width)) anchors.set(width, geometry.x);
      else expect(Math.abs(geometry.x - anchors.get(width)!)).toBeLessThan(2);
      expect(geometry.x).toBeLessThan(width);
      expect(geometry.x).toBeGreaterThan(0);
      if (animal.pet_id === 'guinea-pig')
        await page.screenshot({ path: `test-results/canopies/pet-${width}.png` });
    }
  }
  // Generated equipment canvases may have large transparent margins.
  const last = animals.find((p) => p.pet_id === 'guinea-pig');
  await page.route('**/api/pets/' + hero.id, async (route) => {
    const r = await route.fetch();
    const data = await r.json();
    await route.fulfill({
      response: r,
      json: data.map((p: any) =>
        p.id === last.id ? { ...p, image_url: '/__qa/pet.png' } : p,
      ),
    });
  });
  await request(`/pets/${hero.id}/display`, { pet_id: last.id }, 'PUT');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator('.camp-pet .owned-pet-art img')
        .evaluate((e) => getComputedStyle(e).position),
    )
    .toBe('absolute');
  expect(
    await page.locator('.camp-pet .pet-art').evaluate((e) => e.getBoundingClientRect().width),
  ).toBeCloseTo(90, 0);
  await page.screenshot({ path: 'test-results/canopies/pet-equipped.png' });
  await page.unroute('**/api/pets/' + hero.id);
  // New rock collection uses the same placing and dragging workflow as trees.
  for (const a of rockAssets) {
    const r = await ctx.request.get(origin + a.image),
      b = await r.body(),
      meta = await sharp(b).metadata(),
      stats = await sharp(b).stats();
    expect(r.status()).toBe(200);
    expect(meta.hasAlpha).toBe(true);
    expect(stats.channels[3].min).toBe(0);
    expect(createHash('sha256').update(b).digest('hex')).toBe(
      createHash('sha256')
        .update(await readFile('public' + a.image))
        .digest('hex'),
    );
  }
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Copas e pedras');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  const panel = page.locator('.vtt-panel-content');
  await panel.getByRole('button', { name: 'Assets', exact: true }).click();
  await panel.getByRole('button', { name: /Pedras/ }).click();
  await expect(panel.locator('.vtt-tree-card')).toHaveCount(25);
  await panel.getByRole('button', { name: 'Asset: Rocha de granito', exact: true }).click();
  await panel.getByLabel('Escala da pedra', { exact: true }).selectOption('1.5');
  await panel.getByRole('button', { name: 'Colocar no mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  const room = (
    await pool.query('SELECT id,document FROM vtt_rooms WHERE owner_id=$1', [account.id])
  ).rows[0];
  await expect.poll(async () => (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document.scenes[0].tokens[0]?.image).toBe(rockAssets[0].image);
  const canvas = page.getByLabel('Tabuleiro da mesa', { exact: true }),
    rect = (await canvas.boundingBox())!;
  const transfer = await page.evaluateHandle(
    ({ id }) => {
      const d = new DataTransfer();
      d.setData('application/x-alvorada-tree', JSON.stringify({ id, scale: 1 }));
      return d;
    },
    { id: rockAssets[18].id },
  );
  await canvas.dispatchEvent('drop', {
    dataTransfer: transfer,
    clientX: rect.x + rect.width * 0.4,
    clientY: rect.y + rect.height * 0.5,
  });
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0]
          .document.scenes[0].tokens.length,
    )
    .toBe(2);
  await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('seixos');
  await expect(panel.locator('.vtt-tree-card')).toHaveCount(1);
  await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    ).toBe(true);
    await page.screenshot({ path: `test-results/canopies/rocks-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Áreas de transparência', { exact: true }).click();
  const editor = page.getByLabel('Editor de áreas de transparência', { exact: true });
  await expect(editor).toBeVisible();
  const select = editor.getByLabel('Selecionar partes do mapa', { exact: true }),
    box = (await select.boundingBox())!;
  await editor.getByRole('button', { name: 'Nova área', exact: true }).click();
  for (const p of [
    [0.2, 0.3],
    [0.4, 0.3],
    [0.4, 0.55],
    [0.2, 0.55],
  ])
    await page.mouse.click(box.x + box.width * p[0], box.y + box.height * p[1]);
  await editor.getByRole('button', { name: 'Concluir seleção', exact: true }).click();
  await expect(editor.locator('[data-corner]')).toHaveCount(4);
  await editor.getByLabel('Nome da área transparente').fill('Copa desenhada');
  await editor.getByLabel('Opacidade da área').focus();
  await editor.getByLabel('Opacidade da área').press('Home');
  await editor.getByLabel('Opacidade da área').press('ArrowRight');
  await editor.getByLabel('Opacidade da área').press('ArrowRight');
  const handle = editor.locator('[data-corner="0"]'),
    h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 17, h.y + h.height / 2 + 9);
  await page.mouse.up();
  await editor.getByRole('button', { name: 'Salvar áreas', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0]
          .document.scenes[0].canopyAreas?.length,
    )
    .toBe(1);
  const stored = (
    await pool.query('SELECT document,revision FROM vtt_rooms WHERE id=$1', [room.id])
  ).rows[0];
  expect(stored.document.scenes[0].canopyAreas[0]).toMatchObject({
    name: 'Copa desenhada',
    opacity: 0.2,
    enabled: true,
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `test-results/canopies/editor-${width}.png` });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    ).toBe(true);
  }
  await page.reload();
  await page.getByLabel('Áreas de transparência', { exact: true }).click();
  await expect(page.getByLabel('Áreas do mapa')).toContainText('Copa desenhada');
  // Owner API persists areas; ordinary players cannot edit them. Old draft saves retain them.
  const guest = await browser.newContext();
  const signup = await guest.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Jogador',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  const detail = await request('/vtt/rooms/' + room.id, undefined, 'GET');
  expect(
    (
      await guest.request.post(origin + '/api/vtt/join', {
        headers: { Origin: origin },
        data: { invite: detail.invite },
      })
    ).ok(),
  ).toBe(true);
  const denied = await guest.request.put(origin + '/api/vtt/rooms/' + room.id, {
    headers: { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
    data: { document: stored.document, revision: stored.revision },
  });
  expect(denied.status()).toBe(403);
  const legacy = structuredClone(stored.document);
  delete legacy.scenes[0].canopyAreas;
  await request(
    '/vtt/rooms/' + room.id,
    { document: legacy, revision: stored.revision },
    'PUT',
  );
  expect(
    (await request('/vtt/rooms/' + room.id, undefined, 'GET')).document.scenes[0].canopyAreas,
  ).toEqual(stored.document.scenes[0].canopyAreas);
  await guest.close();
  // Real Canvas renderer: alpha follows the silhouette, not empty PNG corners.
  await page.addScriptTag({ url: origin + '/__qa/renderer.js' });
  const rendering = await page.evaluate(async () => {
    const { renderVtt, newScene, newToken, treeCanopyOccupied } = (window as any).canopyQA;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    const make = async (color: string, margin = 0) => {
      const el = document.createElement('canvas');
      el.width = el.height = 128;
      const ctx = el.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(margin, margin, 128 - 2 * margin, 128 - 2 * margin);
      const img = new Image();
      img.src = el.toDataURL();
      await img.decode();
      return img;
    };
    const scene = newScene(crypto.randomUUID());
    Object.assign(scene, {
      width: 512,
      height: 512,
      backgroundColor: '#181818',
      lighting: false,
      fog: false,
    });
    scene.grid.type = 'none';
    const tree = {
      ...newToken(crypto.randomUUID(), scene),
      image: '/vtt/trees-20261013/test.png',
      x: 256,
      y: 256,
      width: 256,
      height: 256,
      layer: 'map',
      bleeds: false,
    };
    const actor = {
      ...newToken(crypto.randomUUID(), scene),
      image: '/api/vtt/assets/' + crypto.randomUUID(),
      x: 256,
      y: 256,
      width: 50,
      height: 50,
      name: 'Hero',
    };
    const green = await make('#00ff00', 16),
      red = await make('#ff0000'),
      images = new Map([
        [tree.image, green],
        [actor.image, red],
      ]);
    const options = {
      camera: { x: 256, y: 256, zoom: 1 },
      width: 512,
      height: 512,
      dpr: 1,
      images,
      selected: [],
      gm: true,
      preview: false,
      viewer: null,
      layer: 'tokens',
      ruler: [],
      draft: null,
      showWalls: false,
      ping: null,
      visualEffects: false,
    };
    scene.tokens = [tree, actor];
    renderVtt(c, scene, options);
    const under = Array.from(c.getImageData(256, 256, 1, 1).data);
    actor.x = 50;
    renderVtt(c, scene, options);
    const outside = Array.from(c.getImageData(256, 256, 1, 1).data);
    const margin = treeCanopyOccupied(tree, green, [
      { ...actor, x: 139, y: 139, width: 8, height: 8 },
    ]);
    const hidden = treeCanopyOccupied(tree, green, [
      { ...actor, x: 256, y: 256, hidden: true },
    ]);
    tree.rotation = 90;
    tree.flipX = true;
    actor.x = 256;
    const rotated = treeCanopyOccupied(tree, green, [actor]);
    scene.tokens = [actor];
    scene.background = 'test';
    images.set('test', await make('#00ff00'));
    const area = {
      id: crypto.randomUUID(),
      name: 'Roof',
      points: [
        { x: 180, y: 180 },
        { x: 330, y: 180 },
        { x: 330, y: 330 },
        { x: 180, y: 330 },
      ],
      opacity: 0.25,
      enabled: true,
    };
    scene.canopyAreas = [
      area,
      { ...area, id: crypto.randomUUID(), opacity: 0.5 },
      { ...area, id: crypto.randomUUID(), opacity: 0.6 },
    ];
    renderVtt(c, scene, options);
    const roofUnder = Array.from(c.getImageData(256, 256, 1, 1).data),
      untouched = Array.from(c.getImageData(90, 90, 1, 1).data);
    actor.x = 50;
    renderVtt(c, scene, options);
    const roofOutside = Array.from(c.getImageData(256, 256, 1, 1).data);
    return { under, outside, margin, hidden, rotated, roofUnder, untouched, roofOutside };
  });
  expect(rendering.under[0]).toBeGreaterThan(150);
  expect(rendering.under[1]).toBeGreaterThan(70);
  expect(rendering.under[1]).toBeLessThan(110);
  expect(rendering.outside.slice(0, 3)).toEqual([0, 255, 0]);
  expect(rendering.margin).toBe(false);
  expect(rendering.hidden).toBe(false);
  expect(rendering.rotated).toBe(true);
  expect(rendering.roofUnder[0]).toBeGreaterThan(180);
  expect(rendering.roofUnder[1]).toBeLessThan(70);
  expect(rendering.untouched.slice(0, 3)).toEqual([0, 255, 0]);
  expect(rendering.roofOutside.slice(0, 3)).toEqual([0, 255, 0]);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/canopies/result.json',
    JSON.stringify({
      passed: true,
      rocks: 25,
      petSpecies: 10,
      viewports: [1440, 768, 390, 320],
      areasSaved: true,
      ownerPermission: true,
      legacyDraftPreserved: true,
      rendering,
      errors,
    }),
  );
  console.log('Canopies, 25 rocks and all pet positions browser QA passed.');
} catch (error) {
  await page.screenshot({ path: 'test-results/canopies/failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
