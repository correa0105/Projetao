import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  }),
  visitor = await browser.newContext({
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
  for (const phase of ['morning', 'afternoon', 'dusk', 'night']) {
    await page.getByLabel('Horário do cenário').selectOption(phase);
    await expect(page.locator('[data-house2-day-phase]')).toHaveAttribute(
      'data-house2-day-phase',
      phase,
    );
    shadowDirections.push(await page.locator('#h2-shadow-tree feDropShadow').getAttribute('dx'));
    await page.screenshot({ path: `test-results/house2/light-${phase}.png` });
  }
  expect(new Set(shadowDirections).size).toBe(4);
  await page.getByLabel('Horário do cenário').selectOption('afternoon');
  await page.getByRole('button', { name: 'Fechar Vizinhança', exact: true }).click();
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
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(page.getByText(/já foi adquirida para este terreno/)).toBeVisible();
  await expect(page.locator('[data-house2-interior="orthographic"]')).toHaveCount(1);
  await tool('Mobília');
  await expect(page.locator('.h2-catalog button')).toHaveCount(100);
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
  const box = (await item.boundingBox())!;
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
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
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
