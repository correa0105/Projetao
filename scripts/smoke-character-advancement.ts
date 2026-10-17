import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { legalAdvance, originFixture } from '../tests/advancement-fixtures';
import { deriveSheet, spells, type SheetResponse } from '../shared/character-sheet';
import { levelPlan, type AdvanceChoice } from '../shared/character-advancement';
declare global {
  interface Window {
    __screenRecorderTest: { picks: number; cancel: boolean; stream?: MediaStream };
  }
}
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável requerido.');
const origin = 'http://localhost:3054';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
const qaEnvironment = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const server = createApp().listen(3054, '127.0.0.1');
process.env.NODE_ENV = qaEnvironment;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function req(path: string, data?: unknown) {
  const r = await context.request.fetch(origin + '/api' + path, {
    method: data ? 'POST' : 'GET',
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function bounds() {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
try {
  const pageHeaders = await page.request.get(origin);
  expect(pageHeaders.headers()['content-security-policy']).toContain("media-src 'self' blob:");
  const u = (
    await req('/auth/sign-up/email', {
      name: 'Evolução visual',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [u.id]);
  const hero = await createLegacyTestCharacter(u.id, 'Liora'),
    f = originFixture('Mago');
  Object.assign(hero, f.character);
  const d = deriveSheet(hero, f.choices);
  await pool.query(
    'UPDATE characters SET race=$2,class=$3,stats=$4,hp=$5,armor_class=$6,gold_cp=100000 WHERE id=$1',
    [hero.id, hero.race, hero.class, JSON.stringify(hero.stats), d.hp, d.armorClass],
  );
  await pool.query(
    'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,current_hp) VALUES($1,$2,$3,$4,now(),$5)',
    [
      hero.id,
      JSON.stringify(f.choices),
      JSON.stringify(Array(6).fill([4, 4, 4, 4])),
      JSON.stringify([0, 1, 2, 3, 4, 5]),
      d.hp,
    ],
  );
  await mkdir('test-results/advancement', { recursive: true });
  await page.goto(origin + '/#profile');
  await expect(
    page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }),
  ).toBeVisible();
  async function evolve(cls: string, boostCon = false) {
    const sheet: SheetResponse = await req(`/characters/${hero.id}/sheet`);
    const current = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0];
    const next = legalAdvance(current, sheet.sheet!.choices!, cls);
    if (boostCon) next.boosts = [0, 0, 2, 0, 0, 0];
    await page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('Classe deste nível').selectOption(cls);
    if (next.subclass)
      await modal.getByLabel('Subclasse', { exact: true }).selectOption(next.subclass);
    const plan = levelPlan(current, sheet.sheet!.choices!, next);
    async function checks(label: string, values: string[]) {
      const group = modal
        .locator('.sheet-choice')
        .filter({ has: page.locator('legend').filter({ hasText: label }) });
      for (const v of values)
        await group
          .getByRole('checkbox', { name: spells.find((s) => s.id === v)?.label || v, exact: true })
          .check();
    }
    for (const field of plan.fields) await checks(field.label, next.choices[field.key] || []);
    if (plan.asi)
      for (let i = 0; i < 6; i++)
        await modal
          .getByLabel(
            `Melhoria de ${['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'][i]}`,
            { exact: true },
          )
          .selectOption(String(next.boosts[i]));
    if (plan.newCantrips) await checks('Novos truques', next.newCantrips);
    if (plan.newSpells) await checks('Novas magias', next.newSpells);
    if (plan.bonusCount) await checks('Magias adicionais da subclasse', next.bonusSpells);
    await bounds();
    await page.screenshot({
      path: `test-results/advancement/level-${current.level + 1}-${cls}.png`,
    });
    await modal.getByRole('button', { name: 'Confirmar evolução', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.sheet-rank-level')).toContainText(String(current.level + 1));
    return (await req(`/characters/${hero.id}/sheet`)) as SheetResponse;
  }
  await evolve('Mago');
  const third = await evolve('Mago');
  expect(third.derived!.classLevels[0].subclass).toBe('evoker');
  await evolve('Guerreiro');
  const fifth = await evolve('Mago', true);
  expect(fifth.derived!.classLevels.map((s) => [s.class, s.level])).toEqual([
    ['Mago', 4],
    ['Guerreiro', 1],
  ]);
  expect(fifth.derived!.proficiency).toBe(3);
  expect(fifth.derived!.hp).toBe(39);
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  const prepared = page
    .locator('.sheet-choice')
    .filter({ has: page.locator('legend').filter({ hasText: 'Preparadas de Mago' }) });
  const tier2 = fifth.derived!.magicClasses[0].known.find(
    (id) => spells.find((s) => s.id === id)?.level === 2,
  )!;
  await prepared
    .getByRole('checkbox', { name: spells.find((s) => s.id === tier2)!.label, exact: true })
    .check();
  await page.getByLabel('Espaços gastos de círculo 2', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Salvar magias e espaços', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Magias e espaços salvos.' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  await expect(page.getByLabel('Espaços gastos de círculo 2', { exact: true })).toHaveValue('1');
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await bounds();
    await page.screenshot({ path: `test-results/advancement/dialog-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: `test-results/advancement/magic-${width}.png`, fullPage: true });
  }
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [u.id]);
  await page.reload();
  await expect(page.locator('.sheet-advancement')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true })).toHaveCount(
    0,
  );
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [u.id]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#character-cards');
  await expect(page.locator('.card-folio')).toBeVisible();
  await page.screenshot({ path: 'test-results/advancement/empty-collection.png' });
  await page.goto(origin + '/#cards');
  await page.getByRole('button', { name: 'Comprar carta', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Equipar no espaço 1', exact: true }).click();
  await expect(page.locator('.cards-equipped')).toContainText('A Vigília');
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['cards', 'character-cards']) {
      await page.goto(origin + '/#' + route);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-page', route);
      await page.evaluate(() => document.fonts.ready);
      await bounds();
      if (route === 'cards') {
        if (width > 650)
          expect(
            await page.evaluate(() => document.documentElement.scrollHeight),
          ).toBeLessThanOrEqual(1001);
        const heading = await page.locator('.cards-room-content > header').boundingBox();
        const playset = await page.locator('.cards-playset').boundingBox();
        expect(heading!.y + heading!.height).toBeLessThanOrEqual(playset!.y);
      }
      await page.screenshot({
        path: `test-results/advancement/${route}-${width}.png`,
        fullPage: width <= 650,
      });
    }
  }
  await page.setViewportSize({ width: 1898, height: 1000 });
  await page.goto(origin + '/#shop');
  await expect(page.locator('.shop-scene')).toBeVisible();
  const categories = page.getByRole('navigation', { name: 'Categorias da loja' });
  const mundane = categories.getByRole('button', { name: /^Itens mundanos/ });
  await expect(mundane).toHaveAttribute('aria-pressed', 'true');
  await categories.getByRole('button', { name: /^Acessórios para pet/ }).click();
  await expect(page.locator('.shop-showcase')).toContainText('Armadura acolchoada para mascote');
  await page.setViewportSize({ width: 1898, height: 1250 });
  await expect(async () => {
    const images = await page
      .locator('.shop-product-art img[src*="pet-armor-"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          loaded: (element as HTMLImageElement).complete,
          width: (element as HTMLImageElement).naturalWidth,
        })),
      );
    expect(images).toHaveLength(4);
    expect(images.every((image) => image.loaded && image.width > 0)).toBe(true);
  }).toPass();
  await page.screenshot({ path: 'test-results/advancement/pet-armors.png' });
  await page.goto(origin + '/#cards');
  await page.goto(origin + '/#shop');
  await expect(mundane).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(mundane).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Abrir menu de/ }).click();
  await page.getByRole('button', { name: 'Gravar tela', exact: true }).click();
  const recordingPanel = page.getByRole('dialog', { name: 'Gravação de tela', exact: true });
  await expect(recordingPanel).toBeVisible();
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await bounds();
    await page.screenshot({ path: `test-results/advancement/recorder-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Replace only the native chooser with a synthetic test source; encode a real video.
  await page.evaluate('globalThis.__name = fn => fn');
  await page.evaluate(() => {
    const fixture = (window.__screenRecorderTest = {
      picks: 0,
      cancel: false,
      stream: undefined as MediaStream | undefined,
    });
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: async () => {
        fixture.picks++;
        if (fixture.cancel) throw new DOMException('Canceled by test', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const context = canvas.getContext('2d')!;
        const draw = () => {
          context.fillStyle = '#181e29';
          context.fillRect(0, 0, 640, 360);
          context.fillStyle = '#ddbf83';
          context.font = '28px serif';
          context.fillText('Gravação de teste — ' + Date.now(), 24, 170);
        };
        draw();
        const timer = window.setInterval(draw, 50);
        const captured = canvas.captureStream(20);
        for (const track of captured.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            window.clearInterval(timer);
            stop();
          };
        }
        fixture.stream = captured;
        return captured;
      },
    });
  });
  await recordingPanel.getByRole('button', { name: 'Iniciar gravação', exact: true }).click();
  await expect(recordingPanel.getByRole('status')).toContainText('Gravando');
  await page.waitForTimeout(1200);
  for (const route of ['cards', 'character-cards', 'profile', 'vtt', 'shop']) {
    await page.goto(origin + '/#' + route);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-page', route);
    await expect(recordingPanel.getByRole('status')).toContainText('Gravando');
  }
  expect(await page.evaluate(() => window.__screenRecorderTest.picks)).toBe(1);
  await recordingPanel.getByRole('button', { name: 'Minimizar painel de gravação' }).click();
  await expect(page.locator('.admin-recorder-dock')).toBeVisible();
  await page
    .locator('.admin-recorder-dock')
    .getByRole('button', { name: 'Abrir painel de gravação' })
    .click();
  await recordingPanel.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(recordingPanel.getByRole('status')).toContainText('Pausada');
  await recordingPanel.getByRole('button', { name: 'Retomar', exact: true }).click();
  await expect(recordingPanel.getByRole('status')).toContainText('Gravando');
  await recordingPanel.getByRole('button', { name: 'Finalizar', exact: true }).click();
  const downloadLink = recordingPanel.getByRole('link', { name: 'Baixar vídeo', exact: true });
  await expect(downloadLink).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__screenRecorderTest
        .stream!.getTracks()
        .every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  const video = recordingPanel.getByLabel('Vídeo gravado');
  await expect(async () =>
    expect(
      await video.evaluate((element) => (element as HTMLVideoElement).readyState),
    ).toBeGreaterThanOrEqual(2),
  ).toPass();
  const downloading = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.webm$/);
  await download.saveAs('test-results/advancement/recording.webm');
  expect((await stat('test-results/advancement/recording.webm')).size).toBeGreaterThan(1000);
  const savedClip = await downloadLink.getAttribute('href');
  await page.evaluate(() => {
    window.__screenRecorderTest.cancel = true;
  });
  await recordingPanel.getByRole('button', { name: 'Nova gravação', exact: true }).click();
  await expect(recordingPanel.getByRole('alert')).toContainText('Compartilhamento cancelado');
  await expect(downloadLink).toHaveAttribute('href', savedClip!);
  await page.evaluate(() => {
    window.__screenRecorderTest.cancel = false;
  });
  await recordingPanel.getByRole('button', { name: 'Nova gravação', exact: true }).click();
  await expect(recordingPanel.getByRole('status')).toContainText('Gravando');
  await page.waitForTimeout(1200);
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [u.id]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(recordingPanel.getByRole('alert')).toContainText(
    'permissão de administrador foi removida',
  );
  await expect(downloadLink).toBeVisible();
  await expect(
    recordingPanel.getByRole('button', { name: 'Nova gravação', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /^Abrir menu de/ }).click();
  await expect(page.getByRole('button', { name: 'Gravar tela', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/advancement/result.json',
    JSON.stringify({
      passed: true,
      evolutions: 4,
      classes: ['Mago 4', 'Guerreiro 1'],
      viewports: 5,
      cardViews: 10,
      recording: { encodedVideo: true, continuousPages: 5, cancellation: true, revocation: true },
      errors: [],
    }),
  );
  console.log(
    'Browser QA passed: evolution, subclass, spells, multiclass, Constitution, persistence, permissions and card scenes in five widths.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
