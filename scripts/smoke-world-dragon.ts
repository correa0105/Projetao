import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório');
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
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(origin);
  const loginMap = page.locator('.entry-map--world .world-map__viewport');
  await expect(loginMap).toHaveAttribute('data-status', 'ready', { timeout: 40000 });
  await expect(page.locator('.entry-map--world canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Aproximar mapa', exact: true })).toHaveCount(0);
  await expect
    .poll(async () => Number(await loginMap.getAttribute('data-animation-seconds')))
    .toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Pausar animação', exact: true }).click();
  const pausedTime = await loginMap.getAttribute('data-animation-seconds');
  await page.waitForTimeout(500);
  expect(await loginMap.getAttribute('data-animation-seconds')).toBe(pausedTime);
  await page.getByRole('button', { name: 'Retomar animação', exact: true }).click();
  await expect
    .poll(async () => Number(await loginMap.getAttribute('data-animation-seconds')))
    .toBeGreaterThan(Number(pausedTime));
  const music = page.locator('audio[data-site-music]');
  await expect(page.locator('.entry-music')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar volume da música', exact: true }).click();
  const volume = page.getByRole('slider', { name: 'Volume da música', exact: true });
  await expect(volume).toHaveAttribute('aria-orientation', 'vertical');
  const sliderBox = (await volume.boundingBox())!;
  expect(sliderBox.height).toBeGreaterThan(sliderBox.width * 3);
  await expect(volume).toHaveValue('40');
  await volume.fill('0');
  expect(await music.evaluate((a: HTMLAudioElement) => a.volume)).toBe(0);
  await volume.fill('100');
  expect(await music.evaluate((a: HTMLAudioElement) => a.volume)).toBe(1);
  await volume.fill('23');
  await page.reload();
  await page.getByRole('button', { name: 'Ajustar volume da música', exact: true }).click();
  await expect(volume).toHaveValue('23');
  expect(await music.evaluate((a: HTMLAudioElement) => a.volume)).toBe(0.23);
  await page.getByRole('button', { name: 'Iniciar aventura', exact: true }).click();
  await expect(page.locator('.login-form')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pausar animação', exact: true })).toBeVisible();
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0))
    .toBe(true);
  await page.getByRole('button', { name: 'Ajustar volume da música', exact: true }).click();
  await volume.fill('40');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/login-music-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(loginMap).toHaveAttribute('data-status', 'ready', { timeout: 40000 });
  await page.screenshot({ path: 'test-results/login-music-desktop.png' });
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mapa teste',
      email: `dragon-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto(origin + '/#world');
  await page.reload();

  await expect(music).toHaveCount(1);
  expect(await music.evaluate((a: HTMLAudioElement) => a.volume)).toBe(0.4);
  await page.getByRole('button', { name: 'Abrir menu de personagem e conta', exact: true }).click();
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0))
    .toBe(true);
  await page.getByRole('button', { name: 'Ajustar volume da música', exact: true }).click();
  await volume.fill('65');
  expect(await music.evaluate((a: HTMLAudioElement) => a.volume)).toBe(0.65);
  await page.screenshot({ path: 'test-results/profile-music-volume.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/profile-music-volume-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await volume.fill('40');
  await page.setViewportSize({ width: 1440, height: 900 });
  const range = await page.request.get(origin + '/audio/medieval-travelers-journey.ogg', {
    headers: { Range: 'bytes=0-1023' },
  });
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(1024);
  await page.getByRole('button', { name: 'Mutar música', exact: true }).click();
  expect(await music.evaluate((a: HTMLAudioElement) => a.muted)).toBe(true);
  await page.reload();
  expect(await music.evaluate((a: HTMLAudioElement) => a.muted)).toBe(true);
  await page.getByRole('button', { name: 'Abrir menu de personagem e conta', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustar volume da música', exact: true }).click();
  await page.getByRole('button', { name: 'Ativar música', exact: true }).click();
  expect(await music.evaluate((a: HTMLAudioElement) => a.muted)).toBe(false);
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(0.2);
  const before = await music.evaluate((a: HTMLAudioElement) => a.currentTime);
  await page.evaluate(() => {
    location.hash = 'lore';
  });
  await expect(music).toHaveCount(1);
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => a.currentTime))
    .toBeGreaterThan(before);
  await page.evaluate(() => {
    location.hash = 'world';
  });
  await page.evaluate(() => {
    location.hash = 'shop';
  });
  await expect(music).toHaveAttribute('src', '/audio/medieval-market.ogg');
  const bell = page.locator('audio[data-shop-door-bell]');
  await expect.poll(() => bell.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0);
  expect(await bell.evaluate((a: HTMLAudioElement) => a.loop)).toBe(false);
  expect(await bell.evaluate((a: HTMLAudioElement) => a.volume)).toBeCloseTo(0.32, 2);
  await expect
    .poll(() => music.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0))
    .toBe(true);
  await expect.poll(() => bell.evaluate((a: HTMLAudioElement) => a.ended)).toBe(true);
  // Interacting inside the store must not replay the entry bell.
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  expect(await bell.evaluate((a: HTMLAudioElement) => a.ended)).toBe(true);
  await page.evaluate(() => {
    location.hash = 'world';
  });
  await expect(music).toHaveAttribute('src', '/audio/medieval-travelers-journey.ogg');
  console.log(
    'Música: faixa servida em partes, login, ajuste 0–100%, volume persistido, reprodução, mute persistido, faixa exclusiva da loja, sino único por entrada e continuidade entre páginas OK.',
  );
  const viewport = page.locator('.world-map__viewport');
  await expect(viewport).toHaveAttribute('data-dragon-x', /.+/, { timeout: 45000 });
  const x = await viewport.getAttribute('data-dragon-x');
  await expect.poll(() => viewport.getAttribute('data-dragon-x')).not.toBe(x);
  await expect(viewport).toHaveAttribute('data-dragon-flapping', 'true', { timeout: 15000 });
  await expect(viewport).toHaveAttribute('data-dragon-flapping', 'false', { timeout: 15000 });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/world-dragon-desktop.png' });
  await page.getByRole('button', { name: 'Aproximar mapa', exact: true }).click();
  await page.screenshot({ path: 'test-results/world-dragon-zoom.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(viewport).toHaveAttribute('data-dragon-flapping', 'false');
  await page.waitForTimeout(300);
  const frozen = await viewport.getAttribute('data-dragon-x');
  await page.waitForTimeout(300);
  expect(await viewport.getAttribute('data-dragon-x')).toBe(frozen);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/world-dragon-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log('Dragão: voo, asas, planar, zoom, movimento reduzido e mobile OK.');
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
