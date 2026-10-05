import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3003';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3003, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Conquistas',
      email: 'achievements-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  const uid = (await signup.json()).user.id;
  const first = await createLegacyTestCharacter(uid, 'Arden');
  await createLegacyTestCharacter(uid, 'Mira');
  await pool.query("INSERT INTO achievements(character_id,code) VALUES($1,'first_character')", [
    first.id,
  ]);
  await pool.query(
    "INSERT INTO achievement_shelves(character_id,material,medal_frame,slots,positions,rows) VALUES($1,'ebony','bronze','[\"first_character\"]','[40]','[2]')",
    [first.id],
  );
  await page.goto(origin + '/#achievements');
  await page.reload();
  await page.locator('.profile-avatar').click();
  await page.getByRole('option', { name: 'Arden', exact: true }).click();
  await expect(page.locator('.catalog-achievement')).toHaveCount(5);
  await expect(page.locator('.fantasy-cabinet')).toHaveCount(1);
  await expect(page.locator('.cabinet-slot.occupied')).toHaveCount(1);
  await expect(page.locator('.cabinet-art')).toHaveClass(/material-ebony/);
  await expect(page.getByRole('button', { name: 'Editar conquista', exact: true })).toHaveCount(0);
  const honor = page
    .locator('.title-hall-cards article')
    .filter({ hasText: 'O Primeiro Capítulo' });
  await honor.getByRole('button', { name: 'Exibir título', exact: true }).click();
  await page.goto(origin + '/#characters');
  await expect(page.locator('.character-title-label')).toContainText('O Primeiro Capítulo');
  await page.goto(origin + '/#inventory');
  await expect(page.locator('.character-title-label')).toHaveCount(0);
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [uid]);
  await page.goto(origin + '/#titles');
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-page', 'achievements');
  const entry = page.locator('.catalog-achievement[data-code="first_character"]');
  await entry.getByRole('button', { name: 'Criar título', exact: true }).click();
  let titleEditor = page.getByRole('dialog', { name: 'Administrar títulos', exact: true });
  await expect(titleEditor.getByLabel('Conquista vinculada', { exact: true })).toHaveValue(
    'first_character',
  );
  await titleEditor.getByLabel('Nome do título', { exact: true }).fill('Guardião do Começo');
  await titleEditor.getByRole('button', { name: 'Salvar título', exact: true }).click();
  await expect(titleEditor.getByText('Título salvo.', { exact: true })).toBeVisible();
  await titleEditor.getByRole('button', { name: 'Fechar', exact: true }).click();
  await entry.getByRole('button', { name: 'Editar conquista', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar conquista', exact: true });
  await editor.getByLabel('Nome da conquista', { exact: true }).fill('O começo da jornada');
  await editor
    .getByLabel('Descrição da conquista', { exact: true })
    .fill('Crie seu primeiro personagem.');
  await editor
    .getByLabel('Título concedido', { exact: true })
    .selectOption({ label: 'Guardião do Começo' });
  await editor.getByRole('button', { name: 'Salvar conquista', exact: true }).click();
  await expect(entry).toContainText('O começo da jornada');
  await expect(entry).toContainText('Guardião do Começo');
  await page.reload();
  await expect(entry).toContainText('O começo da jornada');
  await expect(page.locator('.cabinet-slot.occupied')).toHaveCount(1);
  const shelf = await page.request
    .get(origin + '/api/characters/' + first.id + '/achievements')
    .then((r) => r.json());
  expect(shelf.shelf.rows).toEqual([2]);
  expect(shelf.shelf.positions).toEqual([40]);
  await page
    .locator('.title-hall-cards article')
    .filter({ hasText: 'Guardião do Começo' })
    .getByRole('button', { name: 'Exibir título', exact: true })
    .click();
  await page.goto(origin + '/#characters');
  await expect(page.locator('.character-title-label')).toContainText('Guardião do Começo');
  await page.goto(origin + '/#achievements');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/conquistas-mobile.png', fullPage: true });
  await page.locator('.profile-avatar').click();
  await page.getByRole('option', { name: 'Mira', exact: true }).click();
  await expect(page.locator('.catalog-achievement[data-earned="true"]')).toHaveCount(0);
  await expect(page.locator('.cabinet-slot.occupied')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Conquistas restauradas: estante salva preservada, edição/título no catálogo, rota antiga de títulos, exibição, troca de personagem e mobile OK.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
