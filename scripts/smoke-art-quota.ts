import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3029';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter, testArtImage } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3029, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await context.addInitScript(() => localStorage.setItem('alvorada-music-muted', 'true'));
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Cotas visíveis',
      email: `quota-ui-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  const hero = await createLegacyTestCharacter(uid, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  for (const [path, speciesKey, species] of [
    ['/pets/purchase', 'pet_id', 'dog'],
    ['/stable/purchase', 'mount_id', 'pony'],
  ]) {
    const res = await context.request.post(origin + '/api' + path, {
      headers: { Origin: origin },
      data: {
        character_id: hero.id,
        [speciesKey]: species,
        name: `Amigo ${species}`,
        idempotency_key: randomUUID(),
      },
    });
    expect(res.status()).toBe(201);
  }
  await pool.query(
    'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
  );
  // Historic initial artwork is free; one later completed request has been used.
  await pool.query(
    "INSERT INTO character_art_jobs(user_id,character_id,creation,idempotency_key,status) VALUES($1,$2,$3,$4,'completed'),($1,$2,NULL,$5,'completed')",
    [uid, hero.id, JSON.stringify({ name: hero.name }), randomUUID(), randomUUID()],
  );
  await page.goto(origin + '/#inventory');
  await page.reload();
  const equipment = page.getByRole('region', { name: 'Itens equipados', exact: true });
  await expect(equipment).toBeVisible();
  await equipment.getByRole('button', { name: 'Vestir', exact: true }).click();
  const modal = page.getByRole('dialog');
  const quota = modal.locator('.art-quota-notice');
  await expect(quota).toContainText('Personagem: 10 gerações por mês');
  await expect(quota).toContainText('1 usada · 9 restantes neste mês');
  await expect(quota).toContainText('A arte inicial do personagem não desconta');
  const referenceFile = {
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: await testArtImage(),
  };
  await modal.locator('input[type="file"]').setInputFiles(referenceFile);
  await expect(modal.getByRole('button', { name: 'Vestir', exact: true })).toBeEnabled();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/art-quota-character.png' });
  await page.keyboard.press('Escape');
  const subjects = page.getByRole('navigation', { name: 'Configurar equipamentos de' });
  for (const subject of ['Mascote', 'Montaria']) {
    await subjects.getByRole('button', { name: subject, exact: true }).click();
    const animal = page.locator('.companion-equipment-panel');
    await expect(animal.locator('.art-quota-notice')).toContainText(
      `${subject}: 2 gerações por mês`,
    );
    await expect(animal.locator('.art-quota-notice')).toContainText(
      '0 usadas · 2 restantes neste mês',
    );
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => /\/companions\/[^/]+\/art$/.test(r.url()) && r.request().method() === 'POST',
      ),
      animal.getByRole('button', { name: 'Vestir', exact: true }).click(),
    ]);
    expect(res.status()).toBe(202);
    await expect(animal.locator('.art-quota-notice')).toContainText(
      '1 usada · 1 restante neste mês',
    );
    const job = await res.json();
    // No provider is called in this disposable database.
    await pool.query("UPDATE companion_art_jobs SET status='failed',reference=NULL WHERE id=$1", [
      job.id,
    ]);
    await expect(animal.locator('.art-quota-notice')).toContainText(
      '0 usadas · 2 restantes neste mês',
      { timeout: 10000 },
    );
  }
  await subjects.getByRole('button', { name: 'Personagem', exact: true }).click();
  for (let i = 0; i < 9; i++)
    await pool.query(
      "INSERT INTO character_art_jobs(user_id,character_id,idempotency_key,status) VALUES($1,$2,$3,'completed')",
      [uid, hero.id, randomUUID()],
    );
  // Clicking still opens the budget when exhausted, then generation is disabled.
  await equipment.getByRole('button', { name: 'Vestir', exact: true }).click();
  await expect(quota).toContainText('10 usadas · 0 restantes neste mês');
  await expect(quota).toContainText('Cota esgotada');
  await modal.locator('input[type="file"]').setInputFiles(referenceFile);
  await expect(modal.getByRole('button', { name: 'Vestir', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/art-quota-exhausted.png' });
  await page.keyboard.press('Escape');
  await pool.query('INSERT INTO character_art_allowances(user_id,unlimited) VALUES($1,true)', [
    uid,
  ]);
  await equipment.getByRole('button', { name: 'Vestir', exact: true }).click();
  await expect(quota).toContainText('Personagem: gerações sem limite');
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(quota).toBeVisible();
    expect(await quota.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/art-quota-mobile.png' });
  expect(errors).toEqual([]);
  console.log(
    'Cotas no inventário: personagem 10, mascote/montaria 2 separados, atualização após clique/falha, inicial grátis, esgotada, ilimitada e celular OK.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
