import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const host = process.env.BETA_TEST_HOST || process.env.BETA_BIND_IP;
if (!host || ['localhost', '127.0.0.1'].includes(host))
  throw Error(
    'BETA_TEST_HOST requires a local non-loopback IPv4 to test HTTP browser restrictions',
  );
const origin = 'http://' + host + ':3076';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { auth } = await import('../server/auth');
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3076, '0.0.0.0');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors: string[] = [],
  checks: any[] = [];
await mkdir('test-results/beta-network', { recursive: true });
try {
  for (let i = 0; i < 8; i++) {
    const context = await browser.newContext({
      viewport: { width: i === 7 ? 390 : 1440, height: 960 },
    });
    await context.addInitScript(() => {
      localStorage.setItem('alvorada-music-muted', 'true');
      localStorage.setItem('alvorada-effects-muted', 'true');
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const created = await auth.api.signUpEmail({
      body: {
        name: 'Beta ' + (i + 1),
        email: randomUUID() + '@example.test',
        password: 'Testing-' + randomUUID(),
      },
      returnHeaders: true,
    });
    for (const header of created.headers.getSetCookie()) {
      const first = header.split(';')[0],
        at = first.indexOf('=');
      await context.addCookies([
        {
          name: first.slice(0, at),
          value: first.slice(at + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/catalog', async (route) => {
      await gate;
      await route.continue().catch(() => {});
    });
    const begin = Date.now();
    await page.goto(origin + '/#characters', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.character-camp')).toBeVisible({
      timeout: 12000,
    });
    expect(await page.evaluate(() => isSecureContext)).toBe(false);
    expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('function');
    const campMs = Date.now() - begin;
    expect(await page.getByText('Preparando sua mesa…').count()).toBe(0);
    let releaseArt!: () => void;
    let artOnline = false;
    const artGate = new Promise<void>((r) => (releaseArt = r));
    if (i === 0)
      await page.route('**/api/character-art', async (route) => {
        await artGate;
        await route.fulfill({
          json: { available: artOnline, jobs: [], pending_new: 0 },
        });
      });
    await page.getByRole('button', { name: 'Criar personagem', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    if (i === 0) {
      await expect(page.locator('[data-illustrator-status="checking"]')).toHaveText(
        'Consultando o ilustrador…',
      );
      await expect(
        page.getByText('O ilustrador está offline. Volte quando ele estiver disponível.', {
          exact: true,
        }),
      ).toHaveCount(0);
      releaseArt();
      await expect(page.locator('[data-illustrator-status="offline"]')).toBeVisible();
      artOnline = true;
      await expect(page.locator('[data-illustrator-status="online"]')).toHaveText(
        'Ilustrador disponível.',
        { timeout: 7000 },
      );
      checks.push({
        noFalseOfflineWarning: true,
        automaticIllustratorRecovery: true,
      });
    }
    if (i === 0) {
      const dialog = page.getByRole('dialog');
      await page.getByLabel('Nome do personagem').fill('História preservada');
      await expect(page.locator('.ability-boost-choices')).toHaveCount(0);
      await page.getByLabel('Alinhamento', { exact: true }).selectOption('Caótico e bom');
      await page.getByLabel('Antecedente', { exact: true }).selectOption('Guia');
      await expect(page.getByLabel('Antecedente', { exact: true }).locator('option')).toHaveCount(
        16,
      );
      await page
        .getByLabel('Classe de Iniciado em Magia do antecedente', { exact: true })
        .selectOption('Druida');
      await page.getByLabel('Classe', { exact: true }).selectOption('Mago');
      await expect(page.getByLabel('Alinhamento', { exact: true })).toHaveValue('Caótico e bom');
      await expect(page.getByLabel('Antecedente', { exact: true })).toHaveValue('Guia');
      await expect(page.getByLabel('Nome do personagem')).toHaveValue('História preservada');
      await expect(
        page.getByLabel('Classe de Iniciado em Magia do antecedente', { exact: true }),
      ).toHaveValue('Druida');
      await expect(
        page.getByRole('combobox', { name: /^Atributo de Iniciado em Magia/ }),
      ).toHaveCount(0);
      await page.getByLabel('Espécie', { exact: true }).selectOption('Elfo');
      await expect(page.getByLabel('Alinhamento', { exact: true })).toHaveValue('Caótico e bom');
      await expect(page.getByLabel('Antecedente', { exact: true })).toHaveValue('Guia');
      checks.push({ boostsDeferredUntilRolls: true });
      await page.mouse.click(4, 4);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel('Nome do personagem')).toHaveValue('História preservada');
      checks.push({
        backdropProtected: true,
        escapeProtected: true,
        preservesChoices: true,
        backgrounds: 16,
        magicInitiateClassChoice: true,
        automaticFeatAbility: true,
      });
    }
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    if (i === 0) await page.unroute('**/api/character-art');
    const catalogueArrived = page.waitForResponse(
      (r) => r.url().endsWith('/api/catalog') && r.status() === 200,
    );
    release();
    await catalogueArrived;
    await page.unroute('**/api/catalog');
    if (i === 0) {
      const transitions = [];
      for (const hash of ['overview', 'cards', 'rules', 'lore', 'characters']) {
        const at = Date.now();
        await page.evaluate((hash) => (location.hash = hash), hash);
        await expect(page.locator('.app-shell[data-page="' + hash + '"]')).toBeVisible();
        await expect(page.locator('body')).not.toBeEmpty();
        await page.waitForTimeout(120);
        transitions.push({ page: hash, ms: Date.now() - at });
      }
      await page.screenshot({ path: 'test-results/beta-network/after.png' });
      checks.push({
        account: i + 1,
        campBeforeCatalog: true,
        campMs,
        transitions,
      });
      const gzip = await context.request.get(origin + '/api/catalog', {
          headers: { 'Accept-Encoding': 'gzip' },
        }),
        plain = await context.request.get(origin + '/api/catalog', {
          headers: { 'Accept-Encoding': 'identity' },
        });
      expect(gzip.headers()['content-encoding']).toBe('gzip');
      expect(gzip.headers()['cache-control']).toBe('no-store');
      expect(await gzip.json()).toEqual(await plain.json());
      const wire = Number(gzip.headers()['content-length']),
        raw = (await plain.body()).length;
      expect(wire).toBeLessThan(raw * 0.25);
      checks.push({
        catalogueRaw: raw,
        catalogueGzip: wire,
        reduction: 1 - wire / raw,
      });
      const index = await context.request.get(origin),
        bundle = (await index.text()).match(/src="([^"]+\.js)"/)![1],
        script = await context.request.get(origin + bundle, {
          headers: { 'Accept-Encoding': 'gzip' },
        });
      expect(script.headers()['content-encoding']).toBe('gzip');
      expect(script.headers()['cache-control']).toContain('immutable');
      expect(script.headers()['vary']).toContain('Accept-Encoding');
      expect((await script.text()).length).toBeGreaterThan(10000);
    } else checks.push({ account: i + 1, campBeforeCatalog: true, campMs });
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/beta-network/result.json',
    JSON.stringify(
      {
        passed: true,
        accounts: 8,
        insecureHttp: true,
        noBlankScreen: true,
        campBeforeCatalog: true,
        creationForm: true,
        compressedCatalogue: true,
        cachedBundles: true,
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, accounts: 8, checks, errors }));
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
