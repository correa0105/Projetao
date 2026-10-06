import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { newToken } from '../shared/vtt.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3006';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3006, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': '2' },
  }),
  page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  const signup = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre premium',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1,vtt_premium=true WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Arden');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Bestiário particular');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const {
    rows: [r],
  } = await pool.query('SELECT id,document FROM vtt_rooms WHERE owner_id=$1', [user.id]);
  const scene = r.document.scenes[0];
  scene.lighting = false;
  scene.fog = false;
  scene.ambient = 1;
  const token = newToken(randomUUID(), scene);
  token.name = 'Alvo';
  token.hp = 100;
  token.maxHp = 100;
  token.x = 650;
  token.y = 875;
  scene.tokens.push(token);
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    r.id,
    JSON.stringify(r.document),
  ]);
  const now = new Date();
  for (let i = 0; i < 55; i++)
    await pool.query(
      'INSERT INTO vtt_messages(room_id,author_id,author,text,roll,created_at)VALUES($1,$2,$3,$4,$5,$6)',
      [
        r.id,
        user.id,
        user.name,
        'Histórico ' + i,
        JSON.stringify({ formula: '1d6', dice: [3], total: 3 }),
        new Date(now.getTime() + i),
      ],
    );
  await page.reload();
  const panel = page.locator('.vtt-panel-content');
  await expect(page.locator('.vtt-chat-log article')).toHaveCount(55);
  const log = page.locator('.vtt-chat-log');
  const bottom = () => log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
  expect(await bottom()).toBeLessThan(3);
  async function externalMessage(text: string) {
    const x = await ctx.request.post(origin + `/api/vtt/rooms/${r.id}/messages`, {
      headers: { Origin: origin },
      data: { text, formula: '1d6' },
    });
    expect(x.status()).toBe(201);
    await expect(log).toContainText(text, { timeout: 10000 });
  }
  await externalMessage('Rolagem no rodapé');
  expect(await bottom()).toBeLessThan(3);
  await log.evaluate((el) => {
    el.scrollTop = 100;
    el.dispatchEvent(new Event('scroll'));
  });
  const before = await log.evaluate((el) => el.scrollTop);
  await externalMessage('Preservar leitura');
  expect(await log.evaluate((el) => el.scrollTop)).toBe(before);
  await log.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });
  await externalMessage('Voltou ao final');
  expect(await bottom()).toBeLessThan(3);
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Premium', exact: true }).click();
  const assets = JSON.parse(await readFile('data/vtt/premium-art/manifest.json', 'utf8')).assets;
  await expect(panel.locator('.vtt-premium-grid > button')).toHaveCount(assets.length);
  await panel.getByRole('button', { name: /Aboleth/ }).click();
  await panel.getByRole('button', { name: 'Trazer token premium à mesa' }).click();
  await expect(panel.getByRole('button', { name: 'Abrir folha completa' })).toBeVisible();
  await panel.getByRole('button', { name: 'Abrir folha completa' }).click();
  let sheet = page.getByRole('dialog', { name: 'Ficha · Aboleth', exact: true });
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  await sheet.getByLabel('Nome', { exact: true }).fill('Aboleth da aurora');
  await sheet.getByLabel('Classe de armadura', { exact: true }).fill('24');
  await sheet.getByLabel('PV máximos', { exact: true }).fill('250');
  const matching = sheet
    .locator('.vtt-monster-edit-action')
    .filter({ has: page.locator('input[value="Tentacle"]') });
  await expect(matching).toHaveCount(1);
  const actionIndex = await matching.evaluate((el) =>
    [...el.parentElement!.querySelectorAll('.vtt-monster-edit-action')].indexOf(el),
  );
  const tentacle = sheet.locator('.vtt-monster-edit-action').nth(actionIndex);
  await tentacle.getByLabel('Rolagem de ataque', { exact: true }).fill('1d20+25');
  await tentacle.locator('textarea').nth(1).fill('7');
  await tentacle.getByLabel('Nome da ação', { exact: true }).fill('Tentáculo da aurora');
  await sheet.getByRole('button', { name: 'Salvar ficha e preset' }).click();
  sheet = page.getByRole('dialog', { name: 'Ficha · Aboleth da aurora', exact: true });
  await expect(
    sheet.getByRole('heading', { name: 'Aboleth da aurora', exact: true }),
  ).toBeVisible();
  await expect(
    sheet.getByRole('heading', { name: 'Tentáculo da aurora', exact: true }),
  ).toBeVisible();
  await sheet
    .getByRole('button', { name: 'Fechar Ficha · Aboleth da aurora', exact: true })
    .click();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Presets de monstros', exact: true }).click();
  await expect(panel.locator('.vtt-premium-grid')).toContainText('Aboleth da aurora');
  await page.screenshot({ path: 'test-results/vtt-private-presets-desktop.png' });
  await panel.getByRole('button', { name: 'Trazer à mesa', exact: true }).click();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  // Select the ordinary target, then apply the actual server roll from chat.
  const canvas = page.locator('canvas[data-camera-x]');
  const rect = await canvas.boundingBox();
  expect(rect).toBeTruthy();
  const cx = Number(await canvas.getAttribute('data-camera-x')),
    cy = Number(await canvas.getAttribute('data-camera-y')),
    zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  await page.mouse.click(
    rect!.x + rect!.width / 2 + (650 - cx) * zoom,
    rect!.y + rect!.height / 2 + (875 - cy) * zoom,
  );
  await externalMessage('Dano de teste');
  const row = log
    .locator('article')
    .filter({ has: page.getByText('Dano de teste', { exact: true }) });
  await expect(
    row.getByRole('button', { name: 'Aplicar dano em Alvo', exact: true }),
  ).toBeVisible();
  await row.getByRole('button', { name: 'Aplicar dano em Alvo', exact: true }).click();
  await expect(
    row.getByRole('button', { name: 'Dano aplicado em Alvo', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Premium', exact: true }).click();
  await expect(panel.locator('.vtt-premium-grid > button')).toHaveCount(assets.length);
  await expect
    .poll(() =>
      panel
        .locator('.vtt-premium-grid img')
        .first()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `test-results/vtt-premium-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  expect(errors).toEqual([]);
  console.log(
    `VTT premium: ${assets.length} artes disponíveis, chat segue final/preserva leitura, arte inteira, editor/presets privados, dano e quatro larguras aprovados.`,
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/vtt-premium-failure.png' });
  console.log(
    await page
      .locator('.vtt-monster-editor')
      .textContent()
      .catch(() => ''),
  );
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
