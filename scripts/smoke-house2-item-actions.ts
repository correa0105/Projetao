import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável obrigatório.');
const origin = 'http://localhost:3083';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3083, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const owner = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  reducedMotion: 'reduce',
});
const visitor = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  reducedMotion: 'reduce',
});
for (const ctx of [owner, visitor])
  await ctx.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
const page = await owner.newPage(),
  peer = await visitor.newPage(),
  errors: string[] = [];
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/house2-item-actions', { recursive: true });
async function req(
  ctx: BrowserContext,
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data: body,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
try {
  const account = await req(owner, '/auth/sign-up/email', {
    name: 'Luminária',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const hero = await createLegacyTestCharacter(account.user.id, 'Aurora');
  await req(visitor, '/auth/sign-up/email', {
    name: 'Visitante',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const d = await req(owner, '/house-v2'),
    n = d.neighborhoods[0].id;
  let scene = await req(owner, '/house-v2/neighborhoods/' + n),
    lot = scene.plots[0];
  const purchase = { character_id: hero.id, idempotency_key: randomUUID() };
  await req(owner, `/house-v2/plots/${lot.id}/purchase`, purchase);
  await req(owner, `/house-v2/plots/${lot.id}/house`, {
    ...purchase,
    idempotency_key: randomUUID(),
    catalog_id: 'house-empty-001',
  });
  const lamp = await req(owner, '/house-v2/furniture', {
    character_id: hero.id,
    plot_id: lot.id,
    catalog_id: 'furniture-031',
    idempotency_key: randomUUID(),
  });
  const table = await req(owner, '/house-v2/furniture', {
    character_id: hero.id,
    plot_id: lot.id,
    catalog_id: 'furniture-006',
    idempotency_key: randomUUID(),
  });
  const fire = await req(owner, '/house-v2/furniture', {
    character_id: hero.id,
    plot_id: lot.id,
    catalog_id: 'h2-firepit',
    idempotency_key: randomUUID(),
  });
  scene = await req(owner, '/house-v2/neighborhoods/' + n);
  lot = scene.plots.find((p: any) => p.id === lot.id);
  const at = { x: lot.x + 3, y: lot.y + 13 };
  await req(
    owner,
    `/house-v2/plots/${lot.id}/layout`,
    {
      revision: lot.revision,
      house: { x: lot.house_x, y: lot.house_y, rotation: 0 },
      items: [
        { id: lamp.item_id, ...at, rotation: 0, scale: 1 },
        { id: table.item_id, ...at, rotation: 0, scale: 1 },
        { id: fire.item_id, x: lot.x + 15, y: lot.y + 15, rotation: 0, scale: 1 },
      ],
    },
    'PUT',
  );
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [account.user.id]);
  const clock = await req(owner, '/world-clock');
  await req(owner, '/world-clock', { time: '22:00', revision: clock.revision });
  async function enter(p = page) {
    await p.goto(origin + '/#house2');
    await p.locator('.h2-neighborhood-card').first().click();
    await p.locator(`[data-house2-plot="${lot.id}"] rect.h2-plot`).focus();
    await p.keyboard.press('Enter');
  }
  await enter();
  const item = page.locator(`[data-house2-piece="${lamp.item_id}"]`),
    popup = page.locator('[data-house2-item-actions]');
  const pt = await item.evaluate((el) => {
    const p = new DOMPoint(0, 0).matrixTransform((el as SVGGraphicsElement).getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(pt.x, pt.y);
  await expect(popup).toBeVisible();
  await expect(page.locator('.h2-piece-controls')).toHaveCount(0);
  expect(
    await page
      .locator(`[data-house2-piece="${table.item_id}"]`)
      .evaluate(
        (el, id) =>
          !!(
            el.compareDocumentPosition(document.querySelector(`[data-house2-piece="${id}"]`)!) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
        lamp.item_id,
      ),
  ).toBe(true);
  await popup.getByRole('button', { name: 'Acender luz', exact: true }).click();
  const glow = page.locator(`[data-house2-light="${lamp.item_id}"]`);
  await expect(glow).toHaveCount(1);
  await expect(glow.locator('circle:not(.h2-light-wave),[data-house2-flame]')).toHaveCount(0);
  expect(Number(await glow.locator('stop').first().getAttribute('stop-opacity'))).toBeLessThan(
    0.15,
  );
  await expect(popup.getByRole('button', { name: 'Apagar luz', exact: true })).toBeEnabled();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await item.focus();
    await page.keyboard.press('Enter');
    const box = (await popup.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThan(900);
    await page.screenshot({ path: `test-results/house2-item-actions/light-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(item).toBeFocused();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await item.focus();
  await page.keyboard.press('Space');
  await popup.getByRole('button', { name: 'Apagar luz', exact: true }).click();
  await expect(glow).toHaveCount(0);
  await popup.getByRole('button', { name: 'Acender luz', exact: true }).click();
  await expect(glow).toHaveCount(1);
  await popup.getByRole('button', { name: 'Editar objeto', exact: true }).click();
  await expect(page.locator('.h2-piece-controls')).toBeVisible();
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Acender luz', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
  await item.focus();
  await page.keyboard.press('Enter');
  const dragAt = await item.evaluate((el) => {
    const p = new DOMPoint(0, 0).matrixTransform((el as SVGGraphicsElement).getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(dragAt.x, dragAt.y);
  await page.mouse.down();
  await page.mouse.move(dragAt.x + 22, dragAt.y + 12, { steps: 5 });
  await page.mouse.up();
  await expect(popup).toHaveCount(0);
  await page.reload();
  await page.locator('.h2-neighborhood-card').first().click();
  await page.locator(`[data-house2-plot="${lot.id}"] rect.h2-plot`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-house2-light="${lamp.item_id}"]`)).toHaveCount(1);
  await enter(peer);
  await expect(peer.locator('[data-house2-item-actions]')).toHaveCount(0);
  await expect(peer.locator('g[aria-label="Ações de Lamparina"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/house2-item-actions/result.json',
    JSON.stringify(
      {
        passed: true,
        directClick: true,
        lampAboveTable: true,
        noOpaqueCore: true,
        inlineActions: true,
        keyboard: true,
        drag: true,
        responsive: [1440, 768, 390, 320],
        persistent: true,
        visitorReadOnly: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS ações no objeto, camada, luz suave, teclado, arraste, persistência e 4 larguras.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/house2-item-actions/failure.png', fullPage: true });
  throw e;
} finally {
  await owner.close();
  await visitor.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
