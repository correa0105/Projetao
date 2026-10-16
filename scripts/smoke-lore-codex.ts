import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable DB required');
const origin = 'http://localhost:3083';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3083, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const admin = await browser.newContext({ reducedMotion: 'reduce' }),
  basic = await browser.newContext({ reducedMotion: 'reduce' });
for (const context of [admin, basic])
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
const page = await admin.newPage(),
  basicPage = await basic.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
basicPage.on('pageerror', (e) => errors.push(e.message));
async function request(context: typeof admin, path: string, data?: unknown, method = 'POST') {
  const r = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function signup(context: typeof admin) {
  return (
    await request(context, '/auth/sign-up/email', {
      name: 'Leitor do arquivo',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
}
async function openIndex() {
  const button = page.getByRole('button', { name: 'Abrir sumário', exact: true });
  if (await button.isVisible()) await button.click();
}
async function openViewMenu() {
  const trigger = page.getByRole('button', { name: 'Menu de visualização da conta', exact: true });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('complementary', { name: 'Visualização da conta', exact: true }),
  ).toBeVisible();
}
async function archiveScreenshot(name: string) {
  await page
    .locator('.lore-archive')
    .evaluate((e) => scrollTo(0, e.getBoundingClientRect().top + scrollY - 130));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/lore-codex/' + name + '.png' });
}
await mkdir('test-results/lore-codex', { recursive: true });
await writeFile('test-results/lore-codex/result.json', JSON.stringify({ passed: false }));
try {
  const user = await signup(admin);
  await signup(basic);
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const index = await request(admin, '/lore', undefined, 'GET');
  const folder = index.folders.find(
    (f: any) => f.region_id === 'reino-do-norte' && f.name === 'História',
  );
  const draft = await request(admin, '/lore/pages', {
    region_id: 'reino-do-norte',
    folder_id: folder.id,
    title: 'Rascunho reservado do arquivo',
    subtitle: 'Somente administradores',
    published: false,
    blocks: [],
  });
  const published = await request(admin, '/lore/pages', {
    region_id: 'reino-do-norte',
    folder_id: folder.id,
    title: 'Os guardiões das passagens antigas do Reino do Norte',
    subtitle: 'Um registro para testar a leitura do arquivo',
    published: true,
    blocks: [
      {
        id: randomUUID(),
        type: 'text',
        title: 'A vigília',
        text: 'Os guardiões preservam a memória das estradas e acolhem quem chega à Alvorada.',
        style: 'prose',
        alignment: 'left',
      },
    ],
  });
  const results = [];
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 960 },
    { width: 1024, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + '/#lore');
    await page.reload();
    await expect(page.locator('.lore-page-row')).toHaveCount(4);
    const sceneBox = (await page.locator('.lore-scene').boundingBox())!;
    const titleBox = (await page
      .locator('.lore-timeline-heading > div:first-child')
      .boundingBox())!;
    expect(titleBox.y - sceneBox.y).toBeGreaterThan(20);
    expect(titleBox.y - sceneBox.y).toBeLessThan(90);
    expect(titleBox.x - sceneBox.x).toBeGreaterThan(15);
    expect(titleBox.x - sceneBox.x).toBeLessThan(65);
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(sceneBox.x + sceneBox.width);
    await page.screenshot({ path: 'test-results/lore-codex/heading-' + viewport.width + '.png' });
    await expect(page.locator('.lore-view-switch')).toHaveCount(0);
    await openViewMenu();
    const menu = (await page
      .getByRole('complementary', { name: 'Visualização da conta', exact: true })
      .boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width + 1);
    await page.screenshot({ path: 'test-results/lore-codex/view-menu-' + viewport.width + '.png' });
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Menu de visualização da conta', exact: true }),
    ).toBeFocused();
    await openViewMenu();
    await page.mouse.click(1, viewport.height - 100);
    await expect(
      page.getByRole('complementary', { name: 'Visualização da conta', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar eras', exact: true })).toBeVisible();
    await archiveScreenshot('archive-' + viewport.width);
    await openIndex();
    await expect(page.locator('.lore-sidebar .lore-folder-emblem')).toHaveCount(6);
    if (viewport.width === 1440) {
      const rows = await page
        .locator('.lore-folder-row')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      expect(Math.min(...rows)).toBeGreaterThanOrEqual(68);
      expect(Math.max(...rows)).toBeLessThanOrEqual(90);
      expect(
        (await page.locator('.lore-page-row').first().boundingBox())!.height,
      ).toBeLessThanOrEqual(110);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const folderButton = page.locator('[data-folder-choice]').first();
      await folderButton.hover();
      await expect
        .poll(() =>
          folderButton.locator('.rb-emblem').evaluate((e) => getComputedStyle(e).transform),
        )
        .not.toBe('none');
      await expect(folderButton.locator('.rb-emblem-sheen')).toHaveCSS(
        'animation-name',
        'lore-metal-glint',
      );
      const row = page.locator('.lore-page-row').first();
      await row.hover();
      await expect(row.locator('.lore-page-art')).toHaveCSS('opacity', '0.35');
      await row.locator('.lore-page-art').evaluate(async (e) => {
        const src = getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+)/)![1];
        const img = new Image();
        img.src = src;
        await img.decode();
      });
      await row.screenshot({ path: 'test-results/lore-codex/row-hover-1440.png' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    await archiveScreenshot('index-' + viewport.width);
    await page.locator('[data-folder-choice="' + folder.id + '"]').click();
    await expect(page.locator('.lore-stage-toolbar h2')).toHaveText('História');
    if (viewport.width <= 720)
      await expect(page.getByRole('button', { name: 'Abrir sumário', exact: true })).toBeVisible();
    await page.getByLabel('Buscar crônica', { exact: true }).fill('guardiões');
    await expect(page.locator('.lore-page-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Limpar busca de crônicas', exact: true }).click();
    await expect(page.locator('.lore-page-row')).toHaveCount(4);
    await page.locator('.lore-page-link').filter({ hasText: published.title }).click();
    await expect(page.locator('.lore-reader-title h2')).toHaveText(published.title);
    await expect(page.locator('.lore-blocks')).toContainText('memória das estradas');
    await archiveScreenshot('reader-' + viewport.width);
    await page.getByRole('button', { name: 'Voltar ao arquivo', exact: true }).click();
    await openViewMenu();
    await page.getByRole('button', { name: 'Ver como conta básica', exact: true }).click();
    await expect(page.locator('.lore-page-row')).toHaveCount(3);
    await expect(page.locator('.lore-folder-actions,.lore-page-actions')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar eras', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova crônica', exact: true })).toHaveCount(0);
    await expect(page.getByText(draft.title, { exact: true })).toHaveCount(0);
    const publicIndex = await request(basic, '/lore', undefined, 'GET');
    expect(await page.locator('.lore-page-copy strong').allTextContents()).toEqual(
      publicIndex.pages.map((p: any) => p.title),
    );
    await archiveScreenshot('basic-preview-' + viewport.width);
    await page.locator('.lore-page-link').filter({ hasText: published.title }).click();
    await expect(page.getByRole('button', { name: 'Editar crônica', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Excluir crônica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Voltar ao arquivo', exact: true }).click();
    await openViewMenu();
    await page
      .getByRole('button', { name: 'Voltar à visão de administrador', exact: true })
      .click();
    await expect(page.locator('.lore-page-row')).toHaveCount(4);
    await expect(page.locator('.lore-page-edit')).toHaveCount(4);
    if (viewport.width === 1440) {
      await page
        .getByRole('button', { name: 'Editar crônica ' + published.title, exact: true })
        .click();
      await expect(page.getByRole('region', { name: 'Editor de crônica' })).toBeVisible();
      await openViewMenu();
      await expect(
        page.getByRole('button', { name: 'Ver como conta básica', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: 'Fechar edição', exact: true }).click();
      await page.getByRole('button', { name: 'Voltar ao arquivo', exact: true }).click();
      await page
        .getByRole('button', { name: 'Excluir crônica ' + published.title, exact: true })
        .click();
      await expect(page.getByRole('dialog')).toContainText(published.title);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
    results.push(viewport);
  }
  await basicPage.goto(origin + '/#lore');
  await expect(basicPage.locator('.lore-page-row')).toHaveCount(3);
  await expect(
    basicPage.getByRole('button', { name: 'Menu de visualização da conta', exact: true }),
  ).toHaveCount(0);
  await expect(
    basicPage.locator('.lore-page-edit,.lore-folder-edit,.lore-timeline-edit'),
  ).toHaveCount(0);
  await basicPage
    .getByLabel('Buscar crônica', { exact: true })
    .fill('nenhuma crônica com este nome');
  await expect(
    basicPage.getByRole('heading', { name: 'Nenhuma crônica encontrada' }),
  ).toBeVisible();
  await expect(
    basicPage.getByRole('button', { name: 'Escrever a primeira crônica', exact: true }),
  ).toHaveCount(0);
  expect(
    (await request(admin, '/lore', undefined, 'GET')).pages.some(
      (p: any) => p.id === draft.id && !p.published,
    ),
  ).toBe(true);
  expect(
    (await pool.query('SELECT administrador FROM "user" WHERE id=$1', [user.id])).rows[0]
      .administrador,
  ).toBe(1);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/lore-codex/result.json',
    JSON.stringify({
      passed: true,
      results,
      previewMatchesBasic: true,
      adminUnchanged: true,
      draftPreserved: true,
      errors,
    }),
  );
  console.log(
    'Lore codex passed: six widths, sumário/search/reader/editor/cancel, admin/basic preview parity, drafts preserved, timeline controls and actual basic account.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/lore-codex/failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
