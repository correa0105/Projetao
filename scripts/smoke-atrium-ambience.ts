import 'dotenv/config';
import { chromium, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import express from 'express';
import { resolve } from 'node:path';
import { atriumBlackoutMs, atriumCrimsonMs } from '../src/AtriumAmbience';

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
const client = resolve(process.env.ATRIUM_CLIENT_DIR || '.local/atrium-ambient-client-20261031');
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
const root = '.local/atrio-ambientacao-20261031';
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
const music = () => page.locator('audio[data-site-music]');
const wind = () => page.locator('audio[data-atrium-wind]');
const room = () => page.locator('.events-venue');
const isPlaying = (target = music()) => target.evaluate((el: HTMLAudioElement) => !el.paused);
async function navigate(route: string) {
  await page.evaluate((route) => {
    location.hash = route;
  }, route);
  await expect(page.locator('.app-shell')).toHaveAttribute('data-page', route);
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 20000 });
}
async function threaten(target: Page = page) {
  if (!(await target.locator('.events-host-conversation').count()))
    await target
      .getByRole('button', { name: 'Conversar com o anfitrião dos eventos', exact: true })
      .click();
  else if (await target.getByRole('button', { name: 'Outras perguntas', exact: true }).count())
    await target.getByRole('button', { name: 'Outras perguntas', exact: true }).click();
  await target.getByRole('button', { name: 'E se eu causar problemas aqui?', exact: true }).click();
  await expect(target.locator('.events-venue')).toHaveAttribute('data-reaction', 'fading');
}
async function closeTalk() {
  await page.getByRole('button', { name: 'Fechar conversa', exact: true }).click();
}
async function hidden(value: boolean) {
  // Simulates the visibility event in headless Edge; real media/CSS still execute.
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (value ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Ambientação',
      email: 'ambience-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  await createLegacyTestCharacter((await signup.json()).user.id, 'Bruma');
  writes.length = 0;
  await page.goto(origin + '/#events');
  await expect(room()).toBeVisible();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 20000 });
  await page.getByRole('heading', { name: 'Átrio', exact: true }).click();
  await expect.poll(() => isPlaying()).toBe(true);
  await expect(music()).toHaveAttribute('src', '/audio/atrium-lantern-vigil-20261031.ogg');
  await page.screenshot({ path: root + '/01-normal-1440.png' });
  await threaten();
  await expect.poll(() => isPlaying(wind())).toBe(true);
  expect(await wind().evaluate((el: HTMLAudioElement) => el.volume)).toBe(0.31);
  await expect.poll(() => isPlaying()).toBe(true);
  await expect(page.locator('.npc-eye-glow')).toHaveCount(0);
  await page.waitForTimeout(2000);
  expect(await music().evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0.2);
  await page.screenshot({ path: root + '/02-apagando-1440.png' });
  await expect(room()).toHaveAttribute('data-reaction', 'dark', { timeout: atriumBlackoutMs });
  await expect.poll(() => isPlaying()).toBe(false);
  await expect.poll(() => isPlaying(wind())).toBe(false);
  const pausedAt = await music().evaluate((el: HTMLAudioElement) => el.currentTime);
  await expect(page.locator('.events-darkness-near')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: root + '/03-escuro-1440.png' });
  await expect(room()).toHaveAttribute('data-reaction', 'crimson');
  await expect(page.locator('.events-ground-fog')).toBeVisible();
  const eye = page.locator('.npc-eye-glow');
  await expect(eye).toHaveCount(1);
  expect(
    await eye.evaluate((el) => ['cx', 'cy', 'rx', 'ry'].map((name) => el.getAttribute(name))),
  ).toEqual(['459', '263', '24', '13']);
  const opacity = await eye.evaluate((el) => getComputedStyle(el).opacity);
  await page.waitForTimeout(1100);
  expect(await eye.evaluate((el) => getComputedStyle(el).opacity)).not.toBe(opacity);
  await expect.poll(() => isPlaying()).toBe(false);
  expect(await music().evaluate((el: HTMLAudioElement) => el.currentTime)).toBeCloseTo(pausedAt, 1);
  await page.screenshot({ path: root + '/04-vermelho-nevoeiro-1440.png' });
  await page
    .locator('.events-host .npc-portrait')
    .screenshot({ path: root + '/olho-corpo-aprovado.png' });
  await page.getByRole('heading', { name: 'Átrio', exact: true }).click();
  await expect.poll(() => isPlaying()).toBe(false);
  checks.push(
    'apagamento progressivo, silêncio no escuro, vento estéreo, olho único com geometria preservada e pulsação, luz vermelha e nevoeiro',
  );
  await hidden(true);
  expect(
    await page
      .locator('.events-ground-fog')
      .evaluate((el) => getComputedStyle(el, '::before').animationPlayState),
  ).toBe('paused');
  await hidden(false);
  await page.getByRole('button', { name: 'Quem é você?', exact: true }).click();
  await expect(room()).toHaveAttribute('data-reaction', 'idle');
  await expect.poll(() => isPlaying()).toBe(true);
  expect(await music().evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThanOrEqual(
    pausedAt,
  );
  await expect(page.locator('.events-reaction-room,.events-ground-fog,.npc-eye-glow')).toHaveCount(
    0,
  );
  expect(await music().evaluate((el: HTMLAudioElement) => el.volume)).toBe(0.23);
  expect(
    await page.evaluate(() => [
      localStorage.getItem('alvorada-music-volume'),
      localStorage.getItem('alvorada-effects-volume'),
    ]),
  ).toEqual(['0.23', '0.31']);
  await closeTalk();
  checks.push(
    'retomada da mesma posição da música e preferências preservadas ao trocar de pergunta e fechar',
  );

  await threaten();
  await page.waitForTimeout(500);
  await closeTalk();
  await page.waitForTimeout(atriumCrimsonMs);
  await expect(room()).toHaveAttribute('data-reaction', 'idle');
  await expect(page.locator('.events-ground-fog,.npc-eye-glow')).toHaveCount(0);
  checks.push('cancelamento antes do escuro sem disparo tardio');

  await threaten();
  await page.waitForTimeout(900);
  await hidden(true);
  await expect.poll(() => isPlaying(wind())).toBe(false);
  await expect.poll(() => isPlaying()).toBe(false);
  await page.waitForTimeout(atriumCrimsonMs);
  await expect(room()).toHaveAttribute('data-reaction', 'fading');
  await hidden(false);
  await expect.poll(() => isPlaying(wind())).toBe(true);
  await expect(room()).toHaveAttribute('data-reaction', 'dark', { timeout: atriumBlackoutMs });
  await expect(room()).toHaveAttribute('data-reaction', 'crimson');
  await closeTalk();
  checks.push('relógio, animações e áudio pausam na aba oculta e retomam juntos');

  for (const phase of ['fading', 'dark', 'crimson']) {
    await threaten();
    await expect(room()).toHaveAttribute('data-reaction', phase, {
      timeout: atriumCrimsonMs + 1000,
    });
    const detachedWind = await wind().elementHandle();
    await navigate('tower');
    await expect(page.locator('.tower-page')).toBeVisible();
    await expect(music()).toHaveAttribute('src', '/audio/tower-beyond-the-veil-20261031.ogg');
    await expect.poll(() => isPlaying()).toBe(true);
    expect(
      await detachedWind!.evaluate((el: HTMLAudioElement) => el.paused && el.currentTime === 0),
    ).toBe(true);
    await expect(page.locator('audio[data-site-music]')).toHaveCount(1);
    await expect(
      page.locator('[data-atrium-wind],.events-ground-fog,.events-reaction-room'),
    ).toHaveCount(0);
    await navigate('events');
  }
  await navigate('shop');
  await expect(music()).toHaveAttribute('src', '/audio/medieval-market.ogg');
  await navigate('overview');
  await expect(music()).toHaveAttribute('src', '/audio/medieval-travelers-journey.ogg');
  await navigate('events');
  checks.push(
    'saída em todas as fases, torre com faixa distinta, loja e demais rotas preservadas, reprodutor único',
  );

  await page.locator('.profile-avatar').click();
  await page.getByRole('button', { name: 'Configurações de som', exact: true }).click();
  await page.getByRole('button', { name: 'Silenciar efeitos sonoros', exact: true }).click();
  await page.keyboard.press('Escape');
  await threaten();
  await expect.poll(() => isPlaying(wind())).toBe(false);
  await expect.poll(() => isPlaying()).toBe(true);
  await closeTalk();
  checks.push('mute independente do vento sem alterar música');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await threaten();
    await expect(room()).toHaveAttribute('data-reaction', 'dark', {
      timeout: atriumBlackoutMs + 500,
    });
    await expect(page.locator('.events-darkness-near')).toHaveCSS('opacity', '1');
    await expect(room()).toHaveAttribute('data-reaction', 'crimson');
    expect(await eye.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    expect(
      await page
        .locator('.events-ground-fog')
        .evaluate((el) => getComputedStyle(el, '::before').animationName),
    ).toBe('none');
    await expect(
      page.getByRole('button', { name: 'Fechar conversa', exact: true }),
    ).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${root}/05-vermelho-reduzido-${width}.png` });
    await closeTalk();
  }
  checks.push(
    '320 e 390 px, sem transbordamento, movimento reduzido sem pulsação ou nevoeiro móvel',
  );
  const assets = JSON.parse(await readFile('data/atrium-tower-audio-20261031.json', 'utf8'));
  expect(assets.assets).toHaveLength(3);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  expect(writes.filter((path) => /events|tower|board/.test(path))).toEqual([]);
  await writeFile(
    root + '/result.json',
    JSON.stringify(
      {
        passed: true,
        checks,
        errors,
        missing,
        writes,
        visibilityTest:
          'synthetic visibilitychange in headless Edge; actual media playback and CSS checked',
      },
      null,
      2,
    ),
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
