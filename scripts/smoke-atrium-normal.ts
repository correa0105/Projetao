import 'dotenv/config';
import { chromium, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import express from 'express';
import { resolve } from 'node:path';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3026';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const client = resolve(process.env.ATRIUM_CLIENT_DIR || '.local/atrium-normal-client-20261031');
const app = express();
app.get('/', (_req, res) => res.sendFile(resolve(client, 'index.html'), { dotfiles: 'allow' }));
app.use('/assets', express.static(resolve(client, 'assets')));
app.use(express.static(resolve('public')));
app.use(createApp());
const server = app.listen(3026, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'no-preference',
});
await context.addInitScript('window.__name = (fn) => fn;');
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-volume', '.23');
  localStorage.setItem('alvorada-music-muted', 'false');
  localStorage.setItem('alvorada-effects-volume', '.31');
  localStorage.setItem('alvorada-effects-muted', 'false');
});
const page = await context.newPage();
const root = process.env.ATRIUM_QA_DIR || '.local/atrio-normal-20261031';
const errors: string[] = [],
  missing: string[] = [],
  writes: string[] = [],
  checks: string[] = [];
await mkdir(root, { recursive: true });
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && /\/(events|tower|audio)\//.test(new URL(r.url()).pathname))
    missing.push(r.url());
});
page.on('request', (r) => {
  if (r.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method()))
    writes.push(new URL(r.url()).pathname);
});
const mediaRequests: string[] = [];
page.on('request', (r) => {
  if (/crimson|corridor-wind/.test(r.url())) mediaRequests.push(r.url());
});
const removed =
  '.events-reaction-room,.events-ground-fog,.events-intimidation-scene,.events-darkness,.npc-eye-glow,[data-atrium-wind]';
const music = () => page.locator('audio[data-site-music]');
async function normal() {
  await expect(page.locator(removed)).toHaveCount(0);
  expect(await page.locator('.events-venue').getAttribute('data-reaction')).toBeNull();
  expect(await page.locator('.events-venue').getAttribute('data-intimidating')).toBeNull();
  await expect(
    page.getByRole('button', {
      name: /causar problemas|porteiro fantasiado|tão insignificante|me tirar daqui|Passei do ponto/,
    }),
  ).toHaveCount(0);
  await expect.poll(() => music().evaluate((el: HTMLAudioElement) => !el.paused)).toBe(true);
}
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Átrio normal',
      email: 'normal-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  await createLegacyTestCharacter((await signup.json()).user.id, 'Bruma');
  writes.length = 0;
  await page.goto(origin + '/#events');
  await expect(page.locator('.events-venue')).toBeVisible();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 20000 });
  await page.getByRole('heading', { name: 'Átrio', exact: true }).click();
  const background = await page.locator('.events-backdrop').getAttribute('style');
  expect(background).toContain('antechamber-20261030.webp');
  await normal();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .getByRole('button', { name: 'Conversar com o anfitrião dos eventos', exact: true })
      .click();
    for (const question of [
      'Quem é você?',
      'Você recebe todo mundo desse jeito?',
      'O que faz você ficar no átrio?',
      'Quais são os próximos eventos?',
      'Como participo de um encontro?',
      'Onde encontro as histórias passadas?',
    ]) {
      if (await page.getByRole('button', { name: 'Outras perguntas', exact: true }).count())
        await page.getByRole('button', { name: 'Outras perguntas', exact: true }).click();
      await page.getByRole('button', { name: question, exact: true }).click();
      await normal();
      expect(await page.locator('.events-backdrop').getAttribute('style')).toBe(background);
    }
    await expect(
      page.getByRole('button', { name: 'Fechar conversa', exact: true }),
    ).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: root + '/normal-dialogue-' + width + '.png' });
    await page.getByRole('button', { name: 'Fechar conversa', exact: true }).click();
    await normal();
    await page.screenshot({ path: root + '/normal-reception-' + width + '.png' });
  }
  await page.waitForTimeout(5500);
  await normal();
  checks.push(
    'todas as conversas normais, sem provocações, transição, nevoeiro, vermelho, brilho no olho ou efeitos atrasados',
  );
  await page.evaluate(() => {
    location.hash = 'tower';
  });
  await expect(page.locator('.tower-page')).toBeVisible();
  await expect(music()).toHaveAttribute('src', '/audio/tower-beyond-the-veil-20261031.ogg');
  await page.evaluate(() => {
    location.hash = 'events';
  });
  await expect(page.locator('.events-venue')).toBeVisible();
  await expect(music()).toHaveAttribute('src', '/audio/atrium-lantern-vigil-20261031.ogg');
  await expect(music()).toHaveCount(1);
  await normal();
  expect(await music().evaluate((el: HTMLAudioElement) => el.volume)).toBe(0.23);
  expect(mediaRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  expect(writes.filter((path) => /events|tower|board/.test(path))).toEqual([]);
  checks.push(
    'música contínua no diálogo, navegação e preferências preservadas; nenhuma solicitação de cenário vermelho ou vento',
  );
  await writeFile(
    root + '/result.json',
    JSON.stringify({ passed: true, checks, errors, missing, writes, mediaRequests }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} catch (error) {
  await page.screenshot({ path: root + '/failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
