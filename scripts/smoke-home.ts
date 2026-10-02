import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco descartável obrigatório');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Cronista',
      email: `home-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const user = (await signup.json()).user;
  const other = await browser.newContext();
  const outsider = await other.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Leitor',
      email: `reader-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(outsider.ok()).toBe(true);
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(origin + '/api/home-updates')).status()).toBe(401);
  await anonymous.close();
  const invalid = await page.request.post(origin + '/api/home-updates', {
    headers: { Origin: origin },
    data: { title: 'Inseguro', link: 'javascript:alert(1)' },
  });
  expect(invalid.status()).toBe(400);
  expect(
    (
      await page.request.post(origin + '/api/home-updates', {
        headers: { Origin: origin },
        data: { title: 'Reunião sem horário', kind: 'meeting' },
      })
    ).status(),
  ).toBe(400);
  const privateImage = await page.request.post(origin + '/api/home-images', {
    headers: { Origin: origin, 'Content-Type': 'image/png' },
    data: await sharp({ create: { width: 80, height: 80, channels: 3, background: '#8e7351' } })
      .png()
      .toBuffer(),
  });
  expect(privateImage.status()).toBe(201);
  const imagePath = (await privateImage.json()).path;
  expect((await other.request.get(origin + imagePath)).status()).toBe(404);
  expect(
    (
      await other.request.post(origin + '/api/home-updates', {
        headers: { Origin: origin },
        data: { title: 'Imagem alheia', image_path: imagePath },
      })
    ).status(),
  ).toBe(400);
  await page.goto(origin + '/#overview');
  await expect(page.getByRole('heading', { name: 'O Diário da Alvorada' })).toBeVisible();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/home-journal-default.png', fullPage: true });
  await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
  const editor = page.locator('.journal-editor');
  await expect(editor).toBeVisible();
  await editor.getByLabel('Título', { exact: true }).fill('Novas histórias nas terras da Alvorada');
  await editor
    .locator('textarea')
    .fill(
      '## A jornada continua\nUma **nova atualização** para a guilda.\n> Toda trilha guarda uma história.\n- Reúna seus companheiros.\n<script>alert(1)</script>',
    );
  await editor.getByLabel('Ao clicar na imagem, abrir').fill('#world');
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(editor.locator('.journal-preview strong')).toContainText('nova atualização');
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const updates = await (await page.request.get(origin + '/api/home-updates')).json();
  const item = updates[0];
  expect(item.can_edit).toBe(true);
  expect(
    (
      await other.request.put(origin + '/api/home-updates/' + item.id, {
        headers: { Origin: origin },
        data: { ...item, title: 'Invadido' },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.request.delete(origin + '/api/home-updates/' + item.id, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.put(origin + '/api/home-updates/' + item.id, {
        headers: { Origin: origin },
        data: { ...item, revision: 999 },
      })
    ).status(),
  ).toBe(409);
  expect(
    await page.evaluate(() => document.querySelector('.journal-rich-text script') === null),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Novas histórias nas terras da Alvorada', exact: true }),
  ).toBeVisible();
  await page.locator('.journal-card').getByRole('button', { name: 'Editar', exact: true }).click();
  await editor.locator('input[type=file]').setInputFiles({
    name: 'cena.png',
    mimeType: 'image/png',
    buffer: await sharp('public/alvorada-dawn-banner.png').resize(900).png().toBuffer(),
  });
  await expect(editor.getByRole('button', { name: 'Publicar', exact: true })).toBeEnabled();
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const changed = (await (await page.request.get(origin + '/api/home-updates')).json())[0];
  expect(changed.image_path).toMatch(/^\/api\/home-images/);
  expect((await other.request.get(origin + changed.image_path)).status()).toBe(200);
  await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
  await editor.getByLabel('Título', { exact: true }).fill('Encontro dos viajantes');
  await editor.getByLabel('Tipo', { exact: true }).selectOption('meeting');
  await editor.getByLabel('Formato', { exact: true }).selectOption('portrait');
  await editor.getByLabel('Data e horário').fill('2026-10-12T20:00');
  await editor.getByLabel('Local / plataforma').fill('Taverna da Alvorada');
  await editor.locator('textarea').fill('Uma noite para planejar a próxima aventura.');
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Adicionar ao calendário' }).click();
  expect((await download).suggestedFilename()).toBe('reuniao-alvorada.ics');
  await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
  await editor.getByLabel('Título', { exact: true }).fill('Pelas trilhas do mundo');
  await editor.getByLabel('Formato', { exact: true }).selectOption('landscape');
  await editor.getByLabel('Imagem', { exact: true }).selectOption('/character-camp-v2.png');
  await editor.locator('textarea').fill('Notícias do acampamento e histórias para compartilhar.');
  await editor.getByLabel('Ao clicar na imagem, abrir').fill('#characters');
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.screenshot({ path: 'test-results/home-journal-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/home-journal-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
  await expect(editor).toBeVisible();
  expect(await editor.evaluate((d) => d.getBoundingClientRect().width <= innerWidth)).toBe(true);
  await editor.getByRole('button', { name: 'Fechar editor' }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.journal-image[href="#characters"]').click();
  await expect.poll(() => new URL(page.url()).hash).toBe('#characters');
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Arden');
  await page.goto(origin + '/#achievements');
  await page.reload();
  await expect(page.locator('.fantasy-cabinet')).toBeVisible();
  const shadow = await page.locator('.fantasy-cabinet').evaluate((el) => {
    const style = getComputedStyle(el, '::after'),
      rect = el.getBoundingClientRect();
    return {
      bottom: parseFloat(style.bottom) / rect.height,
      height: parseFloat(style.height) / rect.height,
    };
  });
  expect(shadow.bottom).toBeCloseTo(0.046, 2);
  expect(shadow.height).toBeCloseTo(0.018, 2);
  await page.screenshot({
    path: 'test-results/cabinet-contact-shadow-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/cabinet-contact-shadow-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await other.close();
  console.log(
    'Início: publicação, formatação segura, upload, autoria, revisão, reuniões/calendário, links, persistência e mobile OK. Estante: sombra de contato e mobile OK.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
