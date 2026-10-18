import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { house2Houses } from '../shared/house-v2';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3076',
  out = 'test-results/house2-mounts-finishes';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3076, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const owner = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  }),
  visitor = await browser.newContext({ extraHTTPHeaders: { 'Accept-Encoding': 'identity' } });
await owner.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
const page = await owner.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
async function req(c: BrowserContext, path: string, data?: unknown, method = 'POST') {
  const r = await c.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function signup(c: BrowserContext, name: string) {
  const a = await req(c, '/auth/sign-up/email', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  return createLegacyTestCharacter(a.user.id, name);
}
async function tool(name: string) {
  await page.getByRole('button', { name: 'House 2.0', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Controles da vizinhança' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function enter() {
  if (page.url() === origin + '/#house2') await page.reload();
  else await page.goto(origin + '/#house2');
  await page.locator('.h2-neighborhood-card').first().click();
}
try {
  await mkdir(out, { recursive: true });
  await writeFile(out + '/result.json', JSON.stringify({ passed: false }));
  const hero = await signup(owner, 'Aurora');
  await signup(visitor, 'Vizinho');
  const mount = (
    await pool.query(
      "INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,coat)VALUES($1,'warhorse','Trovão',100,$2,'alternate')RETURNING id",
      [hero.id, randomUUID()],
    )
  ).rows[0];
  const n = (await req(owner, '/house-v2', undefined, 'GET')).neighborhoods[0].id,
    base = '/house-v2/neighborhoods/' + n,
    lot = (await req(owner, base, undefined, 'GET')).plots[0];
  await req(owner, `/house-v2/plots/${lot.id}/purchase`, {
    character_id: hero.id,
    idempotency_key: randomUUID(),
  });
  await req(owner, `/house-v2/plots/${lot.id}/house`, {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    catalog_id: house2Houses[0].id,
  });
  await enter();
  await tool('Meus tokens');
  await expect(page.getByText('Montaria de Aurora', { exact: true })).toBeVisible();
  await page.locator(`[data-house2-token-source="${mount.id}"]`).dragTo(page.locator('.h2-map'), {
    sourcePosition: { x: 24, y: 24 },
    targetPosition: { x: 650, y: 450 },
  });
  await expect(
    page.getByRole('button', { name: 'Localizar Trovão no mapa', exact: true }),
  ).toBeEnabled();
  let state = (await req(owner, base + '/tokens', undefined, 'GET')).tokens,
    horse = state.find((t: any) => t.kind === 'mount');
  expect(horse.size).toBe(1.9);
  const node = page.locator(`[data-house2-token="${horse.id}"]`);
  await expect(node.locator('image')).toBeVisible();
  await node.locator('image').evaluate(async (el) => {
    const i = new Image();
    i.src = el.getAttribute('href')!;
    await i.decode();
  });
  await page.getByRole('spinbutton', { name: 'Giro do token', exact: true }).fill('127');
  await page.getByRole('spinbutton', { name: 'Giro do token', exact: true }).press('Tab');
  await expect
    .poll(
      async () =>
        (await req(owner, base + '/tokens', undefined, 'GET')).tokens.find(
          (t: any) => t.id === horse.id,
        ).rotation,
    )
    .toBe(127);
  await node.locator('image').click();
  await expect(node).toHaveAttribute('data-token-selected', 'false');
  await node.locator('image').click();
  await expect(node).toHaveAttribute('data-token-selected', 'true');
  await page.screenshot({ path: out + '/mount.png' });
  await enter();
  await tool('Meus tokens');
  await page.getByRole('button', { name: 'Localizar Trovão no mapa', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Giro do token', exact: true })).toHaveValue(
    '127',
  );
  await page.getByRole('button', { name: 'Trazer Aurora para o mapa', exact: true }).click();
  await expect(page.locator('[data-house2-token]')).toHaveCount(2);
  const other = await visitor.request.patch(origin + '/api' + base + '/tokens/' + horse.id, {
    headers: { Origin: origin },
    data: { revision: 1, x: horse.x, y: horse.y, rotation: 90, size: 1.9 },
  });
  expect(other.status()).toBe(403);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText('Montaria de Aurora', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${out}/library-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  await page.locator(`g[data-house2-plot="${lot.id}"] > .h2-plot`).focus();
  await page.keyboard.press('Enter');
  await tool('Mobília');
  const shop = page.getByRole('region', { name: 'Revestimentos da casa' });
  await expect(shop.locator('.h2-finishes-catalog')).toHaveCount(0);
  await expect(shop.locator('.h2-finish-tabs button[aria-pressed="true"]')).toHaveCount(0);
  for (const category of ['Telhados', 'Paredes', 'Pisos']) {
    const button = shop.getByRole('button', { name: category, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(shop.locator('.h2-finishes-catalog > button')).toHaveCount(26);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(shop.locator('.h2-finishes-catalog')).toHaveCount(0);
  }
  await shop.getByRole('button', { name: 'Telhados', exact: true }).click();
  await expect(shop.locator('.h2-finishes-catalog > button')).toHaveCount(26);
  const roof = shop
    .getByRole('button')
    .filter({ has: page.getByText('Telhado · Casa do escriba', { exact: true }) });
  await roof.click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(roof).toContainText('Aplicar na casa');
  await roof.click();
  await expect(roof).toContainText('Em uso');
  await shop.getByRole('button', { name: 'Pisos', exact: true }).click();
  await expect(shop.locator('.h2-finishes-catalog > button')).toHaveCount(26);
  const floor = shop
    .getByRole('button')
    .filter({ has: page.getByText('Pedra com entalhes anões', { exact: true }) });
  await floor.click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(floor).toContainText('Aplicar na casa');
  await floor.click();
  await expect(floor).toContainText('Em uso');
  await expect(page.locator('[data-house2-floor-finish="floor-dwarven-inlay"]')).toHaveCount(1);
  await shop.getByRole('button', { name: 'Paredes', exact: true }).click();
  await expect(shop.locator('.h2-finishes-catalog > button')).toHaveCount(26);
  const wall = shop
    .getByRole('button')
    .filter({ has: page.getByText('Madeira de carvalho', { exact: true }) });
  await wall.click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(wall).toContainText('Aplicar na casa');
  await wall.click();
  await expect(wall).toContainText('Em uso');
  await expect(page.locator('[data-house2-wall-finish="walls-oak"]')).toHaveCount(1);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(shop.locator('.h2-finishes-catalog > button')).toHaveCount(26);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${out}/shop-${width}.png` });
  }
  await enter();
  const applied = (await req(owner, base, undefined, 'GET')).plots.find(
    (p: any) => p.id === lot.id,
  ).finishes;
  expect(applied).toEqual({
    roof: 'roof-style-025',
    floor: 'floor-dwarven-inlay',
    walls: 'walls-oak',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(`g[data-house2-plot="${lot.id}"] > .h2-plot`).focus();
  await page.keyboard.press('Enter');
  await tool('Mobília');
  await expect(shop.locator('.h2-finishes-catalog')).toHaveCount(0);
  await expect(page.locator('[data-house2-floor-finish="floor-dwarven-inlay"]')).toHaveCount(1);
  expect(errors).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        mountDragImport: true,
        mountVisible: true,
        coat: 'alternate',
        rotation: 127,
        persistence: true,
        characterCoexists: true,
        visitorReadOnly: true,
        roofOptions: 25,
        floorOptions: 25,
        wallOptions: 25,
        categoriesStartCollapsed: true,
        clickAgainCollapses: true,
        shopPurchaseAndApply: true,
        viewports: [1440, 768, 390, 320],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS montaria e revestimentos pela interface: arraste, imagem, giro, persistência, compra, aplicação e mobile.',
  );
} finally {
  await owner.close();
  await visitor.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
