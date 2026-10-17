import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { referenceGrassTextures, house2DefaultGrassImage } from '../shared/reference-grass';
import { terrainTextures } from '../shared/vtt-terrain';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3074';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3074, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  }),
  visitor = await browser.newContext({
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
for (const c of [context, visitor])
  await c.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
const page = await context.newPage(),
  peer = await visitor.newPage(),
  errors: string[] = [];
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/house2', { recursive: true });
await writeFile('test-results/house2/result.json', JSON.stringify({ passed: false }));
async function request(c: BrowserContext, path: string, data?: unknown, method = 'POST') {
  const r = await c.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function signup(c: BrowserContext, name: string) {
  const a = await request(c, '/auth/sign-up/email', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const hero = await createLegacyTestCharacter(a.user.id, name);
  await pool.query('UPDATE characters SET gold_cp=12345,portrait_revision=1 WHERE id=$1', [
    hero.id,
  ]);
  await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
    hero.id,
    await readFile('public/character-silhouette-v2.png'),
  ]);
  return hero;
}
const trigger = page.getByRole('button', { name: 'House 2.0', exact: true });
async function tool(name: string) {
  await trigger.click();
  await page
    .getByRole('navigation', { name: 'Controles da vizinhança' })
    .getByRole('button', { name, exact: true })
    .click();
}
try {
  const hero = await signup(context, 'Aurora'),
    other = await signup(visitor, 'Bruma');
  await pool.query(
    'UPDATE "user" SET administrador=1 WHERE id=(SELECT user_id FROM characters WHERE id=$1)',
    [hero.id],
  );
  await page.goto(origin + '/#house2');
  await expect(page.locator('.h2-neighborhood-card')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'Pesquisar vizinhanças' }).fill('Bosque');
  await expect(page.locator('.h2-neighborhood-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Pesquisar vizinhanças' }).fill('');
  await page.screenshot({ path: 'test-results/house2/directory.png' });
  await page.locator('.h2-neighborhood-card').first().click();
  await expect(page.locator('.h2-plot')).toHaveCount(12);
  await page.locator('.h2-village-landscape image').evaluateAll(async (nodes) => {
    const sources = [...new Set(nodes.map((n) => n.getAttribute('href')!))];
    await Promise.all(
      sources.map((src) => {
        const image = new Image();
        image.src = src;
        return image.decode();
      }),
    );
  });
  await expect(page.locator('[data-grass-variant]')).toHaveCount(3);
  const fieldTrees = page.locator('[data-nature-kind="tree"][data-nature-zone="field"]');
  expect(await fieldTrees.count()).toBeGreaterThanOrEqual(15);
  expect(
    (
      await page
        .locator('[data-nature-kind="tree"]')
        .evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute('href')))])
    ).sort(),
  ).toEqual([
    '/vtt/trees-20261013/birch.png',
    '/vtt/trees-20261013/oak-young.png',
    '/vtt/trees-20261013/spruce.png',
  ]);
  await expect(page.locator('#h2-village-grass image')).toHaveAttribute(
    'href',
    house2DefaultGrassImage,
  );
  await expect(page.locator('[data-house2-well] image')).toHaveAttribute(
    'href',
    '/vtt/medieval-expansion-20261017/outdoor-021.webp',
  );
  expect(
    await page
      .locator('[data-ground-blend] path')
      .evaluateAll((paths) => paths.every((p) => (p.getAttribute('d') || '').includes(' A '))),
  ).toBe(true);
  const originalView = (await page.locator('.h2-map').getAttribute('viewBox'))!;
  const connections = await page.locator('[data-ground-centerline]').evaluateAll((groups) => {
    const lines = groups.map((g) => g.getAttribute('data-ground-centerline')!);
    const lanes = lines.slice(2, 6).map((d) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      return path;
    });
    return lines.slice(6, 19).map((d) => {
      const start = /^M ([\d.e+-]+) ([\d.e+-]+)/.exec(d)!;
      const x = +start[1],
        y = +start[2];
      let distance = Infinity;
      for (const lane of lanes) {
        const length = lane.getTotalLength();
        for (let at = 0; at <= length; at += 0.03) {
          const p = lane.getPointAtLength(at);
          distance = Math.min(distance, Math.hypot(x - p.x, y - p.y));
        }
      }
      return distance;
    });
  });
  expect(connections).toHaveLength(13);
  expect(connections.every((distance) => distance < 0.04)).toBe(true);
  for (const [name, viewBox] of [
    ['river-banks', '122 50 23 38'],
    ['well-and-paths', '47 67 30 20'],
    ['house-paths', '25 25 75 52'],
    ['field-trees', '0 10 120 75'],
  ]) {
    await page
      .locator('.h2-map')
      .evaluate((svg, view) => svg.setAttribute('viewBox', view), viewBox);
    await page.screenshot({ path: `test-results/house2/${name}.png` });
  }
  await page
    .locator('.h2-map')
    .evaluate((svg, view) => svg.setAttribute('viewBox', view), originalView);
  const checkCamera = async () => {
    const [x, y, w, h] = (await page.locator('.h2-map').getAttribute('viewBox'))!
      .split(' ')
      .map(Number);
    expect(x).toBeGreaterThanOrEqual(-50 - 1e-6);
    expect(y).toBeGreaterThanOrEqual(-15 - 1e-6);
    expect(x + w).toBeLessThanOrEqual(150 + 1e-6);
    expect(y + h).toBeLessThanOrEqual(185 + 1e-6);
    expect(w).toBeLessThanOrEqual(140 + 1e-6);
    expect(h).toBeLessThanOrEqual(86 + 1e-6);
  };
  await checkCamera();
  await page.screenshot({ path: 'test-results/house2/village.png' });
  await tool('Vizinhança');
  const shadowDirections = [];
  for (const [phase, time] of [
    ['morning', '08:00'],
    ['afternoon', '14:00'],
    ['dusk', '18:00'],
    ['night', '22:00'],
  ]) {
    await page.getByRole('button', { name: 'Ajustar hora', exact: true }).click();
    await page.getByLabel('Hora do mundo', { exact: true }).fill(time);
    await page.getByRole('button', { name: 'Salvar hora', exact: true }).click();
    await expect(page.locator('[data-house2-day-phase]')).toHaveAttribute(
      'data-house2-day-phase',
      phase,
    );
    shadowDirections.push(await page.locator('#h2-shadow-tree feDropShadow').getAttribute('dx'));
    await page.screenshot({ path: `test-results/house2/light-${phase}.png` });
  }
  expect(new Set(shadowDirections).size).toBe(4);
  await page.getByRole('button', { name: 'Ajustar hora', exact: true }).click();
  await page.getByLabel('Hora do mundo', { exact: true }).fill('14:00');
  await page.getByRole('button', { name: 'Salvar hora', exact: true }).click();
  await expect(page.locator('[data-house2-day-phase]')).toHaveAttribute(
    'data-house2-day-phase',
    'afternoon',
  );
  await page.getByRole('button', { name: 'Fechar Vizinhança', exact: true }).click();
  const printButton = page.getByRole('button', {
    name: 'Print da House 2.0 em alta qualidade',
    exact: true,
  });
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const boxes = await Promise.all(
      [
        page.locator('.h2-world-heading'),
        page.locator('.h2-clock-display'),
        printButton,
        trigger,
      ].map((node) => node.boundingBox()),
    );
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        expect(
          Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
            Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)),
        ).toBe(0);
      }
    await expect(printButton).toBeVisible();
    await page.screenshot({ path: `test-results/house2/header-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  let downloads = 0;
  page.on('download', () => downloads++);
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  await printButton.click();
  const download = await downloadPromise.catch(async (error) => {
    console.error('House 2.0 capture:', await page.locator('.h2-world-notice').textContent());
    throw error;
  });
  await download.saveAs('test-results/house2/capture.png');
  const capture = await sharp('test-results/house2/capture.png').metadata();
  expect([capture.width, capture.height, capture.format]).toEqual([5760, 3600, 'png']);
  expect(
    (await sharp('test-results/house2/capture.png').stats()).channels.some((c) => c.stdev > 10),
  ).toBe(true);
  await pool.query(
    'UPDATE "user" SET administrador=0 WHERE id=(SELECT user_id FROM characters WHERE id=$1)',
    [hero.id],
  );
  await printButton.click();
  await expect(page.locator('.h2-world-notice')).toContainText('exclusiva de administradores');
  expect(downloads).toBe(1);
  const p = page.locator('.h2-plot').first(),
    plotId =
      (await p.getAttribute('data-house2-plot')) ||
      (await p.locator('..').getAttribute('data-house2-plot'))!;
  await p.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Comprar terreno/ }).click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(page.locator('.h2-catalog button')).toHaveCount(25);
  await page.locator('.h2-catalog button').first().click();
  await expect(page.locator('.h2-purchase-confirmation img')).toHaveAttribute(
    'src',
    '/vtt/nadir-20261016/house-001-roof.webp',
  );
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(page.getByText(/já foi adquirida para este terreno/)).toBeVisible();
  await expect(page.locator('[data-house2-interior="orthographic"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sair da casa de Aurora', exact: true }).click();
  await expect(page.locator('[data-house2-interior="orthographic"]')).toHaveCount(0);
  await expect(
    page.locator('[data-house2-fixed="true"] [data-house2-roof="house-empty-001"]'),
  ).toHaveAttribute('href', '/vtt/nadir-20261016/house-001-roof.webp');
  await page.screenshot({ path: 'test-results/house2/matched-roof-closed.png' });
  await page.getByRole('button', { name: 'Entrar na casa de Aurora', exact: true }).click();
  await expect(page.locator('[data-house2-interior="orthographic"]')).toHaveCount(1);
  await expect(
    page.locator('[data-house2-fixed="true"] [data-house2-roof="house-empty-001"]'),
  ).toHaveCount(0);
  await tool('Mobília');
  await expect(page.locator('.h2-catalog button')).toHaveCount(250);
  await page.getByRole('textbox', { name: 'Pesquisar mobília' }).fill('Cadeira de madeira');
  await expect(page.locator('.h2-catalog button')).toHaveCount(1);
  await page.locator('.h2-catalog button').first().click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await request(context, '/house-v2', undefined, 'GET')).inventory.length).toBe(0);
  await page.locator('.h2-catalog button').first().click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Mobília adquirida');
  await tool('Minha coleção');
  await page.getByRole('button', { name: /Cadeira de madeira.*Colocar/ }).click();
  await page.getByRole('button', { name: 'Mover para a direita', exact: true }).click();
  await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('0°');
  await page.getByRole('button', { name: 'Girar peça 90° à esquerda', exact: true }).click();
  await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('270°');
  await page.getByRole('button', { name: 'Girar peça 90° à direita', exact: true }).click();
  await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('0°');
  await page.getByRole('button', { name: 'Girar peça 90° à direita', exact: true }).click();
  await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('90°');
  await page.getByLabel('Tamanho do item', { exact: true }).fill('160');
  await expect(page.getByLabel('Encaixar na grade')).not.toBeChecked();
  const neighborhood = (await request(context, '/house-v2', undefined, 'GET')).neighborhoods[0].id;
  const fixedBefore = (
    await request(context, '/house-v2/neighborhoods/' + neighborhood, undefined, 'GET')
  ).plots.find((p: any) => p.id === plotId);
  await page.getByLabel('Posição X', { exact: true }).fill('9.17');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Terreno salvo');
  const fractional = (await request(context, '/house-v2', undefined, 'GET')).inventory[0];
  expect(fractional.x).toBe(9.17);
  expect(fractional.scale).toBe(1.6);
  await page.getByLabel('Posição X', { exact: true }).fill('9.23');
  const piece = page
    .locator('[data-house2-piece]')
    .filter({ has: page.locator('image') })
    .first();
  const itemId = (await page
    .locator('.h2-map [data-house2-piece]')
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-house2-piece')).find((id) => id !== 'house'),
    ))!;
  expect(itemId).toBeTruthy();
  const item = page.locator(`[data-house2-piece="${itemId}"]`);
  await expect(item).toHaveAttribute('transform', /rotate\(90\)/);
  // Drag far outside the lot: the item must remain fully inside its purchased boundaries.
  const box = (await item.locator('image').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(20, 450, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Terreno salvo');
  const directory = await request(context, '/house-v2', undefined, 'GET'),
    saved = directory.inventory.find((i: any) => i.id === itemId);
  expect(saved.plot_id).toBe(plotId);
  expect(saved.rotation).toBe(90);
  expect(saved.scale).toBe(1.6);
  const n = directory.neighborhoods[0].id,
    state = await request(context, '/house-v2/neighborhoods/' + n, undefined, 'GET'),
    lot = state.plots.find((p: any) => p.id === plotId);
  expect([lot.house_x, lot.house_y, lot.house_rotation]).toEqual([
    fixedBefore.house_x,
    fixedBefore.house_y,
    fixedBefore.house_rotation,
  ]);
  expect(saved.x).toBeGreaterThanOrEqual(lot.x + 0.8);
  expect(saved.x).toBeLessThanOrEqual(lot.x + lot.width - 0.8);
  await page.reload();
  await expect(page.locator('.h2-neighborhood-card')).toHaveCount(3);
  await page.locator('.h2-neighborhood-card').first().click();
  await expect(page.locator('.h2-plot')).toHaveCount(12);
  await page.locator(`g[data-house2-plot="${plotId}"] > .h2-plot`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Entrar na casa', exact: true }).click();
  await tool('Minha coleção');
  await page.getByRole('button', { name: /Cadeira de madeira.*Ajustar/ }).click();
  await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('90°');
  await expect(page.locator(`[data-house2-piece="${itemId}"]`)).toHaveAttribute(
    'transform',
    `translate(${saved.x} ${saved.y}) rotate(90)`,
  );
  // Edit the actual SVG border, including the rotated corner and touch input.
  const border = page.locator(`[data-house2-border-piece="${itemId}"]`);
  await expect(border.locator('[data-house2-handle]')).toHaveCount(9);
  await page.getByLabel('Posição X', { exact: true }).fill(String(lot.x + lot.width / 2));
  await page.getByLabel('Posição Y', { exact: true }).fill(String(lot.y + lot.height / 2));
  await page.getByLabel('Tamanho do item', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
  const image = item.locator('image'),
    corner = border.locator('[data-house2-handle="se"]');
  const naturalWidth = Number(await image.getAttribute('width'));
  const center = async (locator: typeof item) => {
    const b = (await locator.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const from = await center(corner),
    middle = await center(image);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (from.x - middle.x) * 0.5, from.y + (from.y - middle.y) * 0.5, {
    steps: 6,
  });
  await page.mouse.up();
  const enlargedWidth = Number(await image.getAttribute('width'));
  expect(enlargedWidth).toBeGreaterThan(naturalWidth);
  const turnHandle = border.locator('[data-house2-handle="rotate"]');
  const pivot = await center(image),
    turnFrom = await center(turnHandle);
  expect(Math.abs(turnFrom.x - pivot.x)).toBeLessThan(0.5);
  const icon = await center(turnHandle.locator('svg'));
  expect(Math.hypot(icon.x - turnFrom.x, icon.y - turnFrom.y)).toBeLessThan(0.5);
  const angle = (37.25 * Math.PI) / 180,
    vx = turnFrom.x - pivot.x,
    vy = turnFrom.y - pivot.y;
  await page.mouse.move(turnFrom.x, turnFrom.y);
  await page.mouse.down();
  await page.mouse.move(
    pivot.x + vx * Math.cos(angle) - vy * Math.sin(angle),
    pivot.y + vx * Math.sin(angle) + vy * Math.cos(angle),
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  await expect(item).toHaveAttribute('transform', /rotate\(127.25\)/);
  // A real touch gesture must resize without panning the camera.
  const cdp = await context.newCDPSession(page);
  const touchFrom = await center(corner),
    touchMiddle = await center(image);
  const cameraBefore = await page.locator('.h2-map').getAttribute('viewBox');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: touchFrom.x, y: touchFrom.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        x: touchFrom.x + (touchFrom.x - touchMiddle.x) * 0.4,
        y: touchFrom.y + (touchFrom.y - touchMiddle.y) * 0.4,
      },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Number(await image.getAttribute('width'))).toBeGreaterThan(enlargedWidth);
  expect(await page.locator('.h2-map').getAttribute('viewBox')).toBe(cameraBefore);
  await cdp.detach();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Terreno salvo');
  const borderSaved = (await request(context, '/house-v2', undefined, 'GET')).inventory.find(
    (i: any) => i.id === itemId,
  );
  expect(borderSaved.scale).toBeGreaterThan(1);
  expect(borderSaved.rotation).toBe(127.25);
  // Interrupted gestures restore exactly the state from before the gesture.
  const beforeCancel = await image.getAttribute('width'),
    cancelFrom = await center(corner);
  await page.mouse.move(cancelFrom.x, cancelFrom.y);
  await page.mouse.down();
  await page.mouse.move(cancelFrom.x - 35, cancelFrom.y - 35, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(image).toHaveAttribute('width', beforeCancel!);
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  await page.reload();
  await page.locator('.h2-neighborhood-card').first().click();
  await page.locator(`g[data-house2-plot="${plotId}"] > .h2-plot`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Entrar na casa', exact: true }).click();
  await tool('Minha coleção');
  await page.getByRole('button', { name: /Cadeira de madeira.*Ajustar/ }).click();
  await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('127.25°');
  expect(Number(await image.getAttribute('width'))).toBeCloseTo(
    naturalWidth * borderSaved.scale,
    6,
  );
  await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
  await turnHandle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(item).toHaveAttribute('transform', /rotate\(126.25\)/);
  await corner.focus();
  await page.keyboard.press('ArrowUp');
  expect(Number(await image.getAttribute('width'))).toBeGreaterThan(
    naturalWidth * borderSaved.scale,
  );
  await page.screenshot({ path: 'test-results/house2/border-editor.png' });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Terreno salvo');
  await tool('Minha coleção');
  await page.getByRole('button', { name: /Cadeira de madeira.*Ajustar/ }).click();
  await page.getByLabel('Rotação livre do item', { exact: true }).fill('90');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Terreno salvo');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
  await page.getByRole('button', { name: 'Sair da casa de Aurora', exact: true }).click();
  const ownRoof = page.locator('[data-house2-fixed="true"] [data-house2-roof]');
  await expect(ownRoof).toHaveCount(1);
  const roofsBeforePainting = await page.locator('[data-house2-roof]').count();
  await tool('Pintar terreno');
  await expect(ownRoof).toHaveCount(0);
  await expect(page.locator('[data-house2-interior="orthographic"]')).toHaveCount(1);
  await expect(page.locator('[data-house2-roof]')).toHaveCount(roofsBeforePainting - 1);
  await expect(page.locator('.h2-ground-textures button')).toHaveCount(terrainTextures.length);
  await expect(page.locator('.h2-ground-textures button').first()).toHaveAccessibleName(
    'Grama fina clara',
  );
  const textureSearch = page.getByRole('searchbox', {
    name: 'Buscar textura de terreno',
    exact: true,
  });
  await textureSearch.fill('fina clara');
  await expect(page.locator('.h2-ground-textures button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Grama fina clara', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[aria-label="Textura selecionada"]')).toContainText(
    'Grama fina clara',
  );
  await page.screenshot({ path: 'test-results/house2/grass-search.png' });
  await textureSearch.fill('');
  for (const texture of referenceGrassTextures)
    await expect(page.getByRole('button', { name: texture.name, exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Grama fina clara', exact: true }).click();
  const paintAt = await page.locator('.h2-map').evaluate((node, p) => {
    const svg = node as unknown as SVGSVGElement,
      at = svg.createSVGPoint();
    at.x = p.x + 0.6;
    at.y = p.y + 0.6;
    const a = at.matrixTransform(svg.getScreenCTM()!);
    at.x = p.x + 2;
    at.y = p.y + 0.8;
    const b = at.matrixTransform(svg.getScreenCTM()!);
    return { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
  }, lot);
  const brushCursor = page.locator('[data-house2-brush-footprint]');
  await page.mouse.move(paintAt.b.x, paintAt.b.y);
  await expect(brushCursor).toBeVisible();
  await expect(brushCursor).toHaveAttribute('r', '0.5');
  const brushSize = page.getByLabel('Tamanho do pincel', { exact: true });
  await brushSize.fill('2');
  await page.mouse.move(paintAt.b.x, paintAt.b.y);
  await expect(brushCursor).toHaveAttribute('r', '1');
  const cursorGeometry = () =>
    brushCursor.evaluate((node) => {
      const circle = node as SVGCircleElement,
        box = circle.getBoundingClientRect(),
        scale = circle.getScreenCTM()!.a;
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        width: box.width,
        diameter: 2 * circle.r.baseVal.value * scale,
      };
    });
  const beforeZoom = await cursorGeometry();
  expect(Math.abs(beforeZoom.width - beforeZoom.diameter)).toBeLessThan(1);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await cursorGeometry()).width).toBeGreaterThan(beforeZoom.width);
  const afterZoom = await cursorGeometry();
  expect(Math.abs(afterZoom.x - paintAt.b.x)).toBeLessThan(1);
  expect(Math.abs(afterZoom.y - paintAt.b.y)).toBeLessThan(1);
  expect(Math.abs(afterZoom.width - afterZoom.diameter)).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/house2/paint-brush-cursor.png' });
  await page.mouse.wheel(0, 120);
  await brushSize.fill('1');
  await page.mouse.move(paintAt.a.x, paintAt.a.y);
  await page.mouse.down();
  await page.mouse.move(paintAt.b.x, paintAt.b.y, { steps: 6 });
  await page.mouse.up();
  await expect(brushCursor).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.h2-world-notice')).toContainText('Terreno salvo');
  const painted = (
    await request(context, '/house-v2/neighborhoods/' + n, undefined, 'GET')
  ).plots.find((p: any) => p.id === plotId);
  expect(painted.ground.length).toBe(1);
  expect(painted.ground[0].material).toBe('grass-reference-light');
  expect(painted.ground[0].points.length).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Desfazer traço', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.locator('[data-house2-ground-stroke]')).toHaveCount(1);
  await expect(page.locator('[data-house2-ground-blended]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar Pintar terreno', exact: true }).click();
  await expect(brushCursor).toHaveCount(0);
  await expect(ownRoof).toHaveCount(1);
  await page.getByRole('button', { name: 'Entrar na casa de Aurora', exact: true }).click();
  await tool('Pintar terreno');
  await page.getByRole('button', { name: 'Fechar Pintar terreno', exact: true }).click();
  await expect(page.locator('[data-house2-interior="orthographic"]')).toHaveCount(1);
  const results = [];
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await checkCamera();
    expect(await page.locator('.house2-world').boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const b = (await page.locator('.h2-controls').boundingBox())!;
    expect(b.x >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await page.screenshot({ path: `test-results/house2/world-${viewport.width}.png` });
    await tool('Vizinhança');
    const panel = (await page.locator('.scene-panel').boundingBox())!;
    expect(
      panel.x >= 0 &&
        panel.x + panel.width <= viewport.width + 1 &&
        panel.y + panel.height <= viewport.height,
    ).toBe(true);
    await page.getByRole('button', { name: 'Fechar Vizinhança', exact: true }).click();
    await tool('Minha coleção');
    await page.getByRole('button', { name: /Cadeira de madeira.*Ajustar/ }).click();
    await expect(page.getByLabel('Ângulo do objeto', { exact: true })).toHaveText('90°');
    for (const name of ['Girar peça 90° à esquerda', 'Girar peça 90° à direita']) {
      const control = page.getByRole('button', { name, exact: true });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeVisible();
      const r = (await control.boundingBox())!;
      expect(r.x >= 0 && r.x + r.width <= viewport.width + 1).toBe(true);
    }
    await page.screenshot({ path: `test-results/house2/rotation-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);
    results.push(viewport);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Centralizar vizinhança' }).click();
  await checkCamera();
  await page.mouse.move(700, 450);
  for (let i = 0; i < 16; i++) await page.mouse.wheel(0, 300);
  await checkCamera();
  await expect(page.getByRole('button', { name: 'Ver toda a vizinhança' })).toHaveCount(0);
  await page.locator(`g[data-house2-plot="${plotId}"] > .h2-plot`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Fechar Terrenos', exact: true }).click();
  await page
    .locator(`g[data-house2-plot="${plotId}"] > .h2-plot`)
    .hover({ position: { x: 2, y: 2 } });
  await expect(page.locator('.h2-owner-tooltip')).toContainText('Casa de Aurora');
  await page.screenshot({ path: 'test-results/house2/owner-hover.png' });
  await peer.goto(origin + '/#house2');
  await peer.locator('.h2-neighborhood-card').first().click();
  await expect(peer.locator('.h2-plot')).toHaveCount(12);
  await peer.locator(`g[data-house2-plot="${plotId}"] > .h2-plot`).focus();
  await peer.keyboard.press('Enter');
  await expect(peer.getByText(/somente visita/)).toBeVisible();
  await expect(peer.getByRole('button', { name: 'Mover minha casa' })).toHaveCount(0);
  await expect(peer.locator('[data-house2-handle]')).toHaveCount(0);
  await expect(
    peer.getByRole('button', { name: 'Print da House 2.0 em alta qualidade', exact: true }),
  ).toHaveCount(0);
  const forbidden = await visitor.request.put(origin + `/api/house-v2/plots/${plotId}/layout`, {
    headers: { Origin: origin },
    data: {
      revision: lot.revision,
      house: { x: lot.house_x, y: lot.house_y, rotation: 0 },
      items: [],
    },
  });
  expect(forbidden.status()).toBe(403);
  expect(
    (
      await pool.query('SELECT gold_cp FROM characters WHERE id=ANY($1::uuid[])', [
        [hero.id, other.id],
      ])
    ).rows.every((r) => r.gold_cp === 12345),
  ).toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/house2/result.json',
    JSON.stringify(
      {
        passed: true,
        viewports: results,
        errors,
        ownership: true,
        purchase: true,
        drag: true,
        borderResize: true,
        borderRotation: true,
        freeRotation: true,
        connectedLandscape: true,
        referenceGrassBrushes: referenceGrassTextures.length,
        paintingWithoutRoof: true,
        brushCursorMatchesSizeAndZoom: true,
        grassSearchAndPreview: true,
        fieldTreesThreeStyles: true,
        groundMaterialsFeathered: true,
        rotationControlCentered: true,
        headerNoOverlap: true,
        administratorCapture: true,
        capture: { width: capture.width, height: capture.height, format: capture.format },
        touchResize: true,
        borderKeyboard: true,
        borderCancellation: true,
        persistence: true,
        visitorReadOnly: true,
        testCreditsOnly: true,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS House 2.0: busca, compra, casas vazias, mobília VTT, arraste limitado, giro, salvar/recarregar/descartar, hover, visita sem edição e cinco larguras.',
  );
} finally {
  await context.close();
  await visitor.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
