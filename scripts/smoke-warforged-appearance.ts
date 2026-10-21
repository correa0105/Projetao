import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { defaultChoices } from '../shared/character-sheet';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/warforged-appearance', { recursive: true });
try {
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Warforged beta',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const { user } = await signup.json();
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  const hero = await createLegacyTestCharacter(user.id, 'Forjado');
  await pool.query("UPDATE characters SET race='Warforged' WHERE id=$1", [hero.id]);
  await pool.query('INSERT INTO character_sheets(character_id,choices) VALUES($1,$2)', [
    hero.id,
    defaultChoices('Warforged', 'Guerreiro'),
  ]);
  await page.goto(origin + '/#profile');
  const design = page.getByRole('region', { name: 'Aparência do Warforged' });
  await expect(design).toBeVisible({ timeout: 60000 });
  const bodies = design.getByRole('group', { name: 'Estrutura do corpo', exact: true });
  const heads = design.getByRole('group', { name: 'Formato da cabeça', exact: true });
  await expect(bodies.getByRole('radio')).toHaveCount(6);
  await expect(heads.getByRole('radio')).toHaveCount(6);
  await bodies.getByRole('radio', { name: /Braços reforçados/ }).check();
  await heads.getByRole('radio', { name: /^Angular/ }).check();
  await design.getByLabel('Cor metálica principal', { exact: true }).selectOption('copper');
  await design.getByLabel('Acabamento', { exact: true }).selectOption('rusted');
  await design.getByRole('button', { name: 'Detalhes em Azul', exact: true }).click();
  await design.getByLabel('Cor secundária personalizada', { exact: true }).fill('#123abc');
  await bodies.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/warforged-appearance/desktop-bodies.png' });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await heads.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/warforged-appearance/heads-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const label of await design.locator('.warforged-design-options label').all()) {
      const box = await label.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/choices') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Salvar escolhas', exact: true }).click(),
  ]);
  expect(saved.status()).toBe(200);
  const persisted = (
    await pool.query('SELECT choices FROM character_sheets WHERE character_id=$1', [hero.id])
  ).rows[0].choices.warforgedAppearance;
  expect(persisted).toEqual({
    body: 'reinforced-arms',
    head: 'angular',
    metal: 'copper',
    finish: 'rusted',
    accentEnabled: true,
    accentColor: '#123abc',
  });
  await page.reload();
  await expect(design.getByRole('radio', { name: /Braços reforçados/ })).toBeChecked({
    timeout: 60000,
  });
  await expect(design.getByRole('radio', { name: /^Angular/ })).toBeChecked();
  await expect(design.getByLabel('Cor secundária personalizada', { exact: true })).toHaveValue(
    '#123abc',
  );
  await design.getByLabel('Usar cor secundária', { exact: true }).uncheck();
  await expect(design.getByLabel('Cor secundária personalizada', { exact: true })).toHaveCount(0);
  await design.getByLabel('Usar cor secundária', { exact: true }).check();
  await expect(design.getByLabel('Cor secundária personalizada', { exact: true })).toHaveValue(
    '#123abc',
  );
  expect(errors).toEqual([]);
  console.log(
    'PASS: seis corpos, seis cabeças, metais/acabamentos/cor personalizada, salvar/recarregar e layout em quatro larguras.',
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
