import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { lockTestIllustrator, testArtImage, finishTestArt } =
  await import('../tests/character-fixtures');
const unlock = await lockTestIllustrator();
const { createApp } = await import('../server/app'),
  server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/character-style', { recursive: true });
try {
  const registered = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Estilo de personagem',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(registered.ok()).toBe(true);
  const { user } = await registered.json();
  await pool.query(
    'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
  );
  expect((await page.request.get(origin + '/api/character-slots')).ok()).toBe(true);
  expect(
    (
      await page.request.post(origin + '/api/character-slots/1/roll', {
        headers: { Origin: origin },
        data: {},
      })
    ).ok(),
  ).toBe(true);
  for (let revealed = 1; revealed <= 6; revealed++)
    expect(
      (
        await page.request.post(origin + '/api/character-slots/1/reveal', {
          headers: { Origin: origin },
          data: { revealed },
        })
      ).ok(),
    ).toBe(true);
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  const form = page.locator('.character-creation-form');
  await expect(form.getByLabel('Nome do personagem')).toBeEnabled({ timeout: 60000 });
  await form.getByLabel('Nome do personagem').fill('Viajante curvado');
  await form.getByLabel('Espécie', { exact: true }).selectOption('Orc');
  for (const [label, value] of [
    ['Gênero do personagem', 'male'],
    ['Altura', 'average'],
    ['Porte físico', 'average'],
    ['Idade aparente', 'elder'],
    ['Postura', 'hunched'],
    ['Bengala de apoio', 'wooden'],
  ])
    await form.getByRole('combobox', { name: label, exact: true }).selectOption(value);
  const outfit = form.getByRole('group', { name: 'Roupa inicial', exact: true });
  for (const label of ['Modelo: parte superior', 'Modelo: calça', 'Modelo: calçado'])
    await expect(
      outfit.getByRole('combobox', { name: label, exact: true }).locator('option'),
    ).toHaveCount(4);
  await outfit.getByRole('combobox', { name: 'Modelo: parte superior' }).selectOption('vest');
  await outfit.getByRole('combobox', { name: 'Modelo: calça', exact: true }).selectOption('wool');
  await outfit.getByRole('combobox', { name: 'Modelo: calçado' }).selectOption('boots');
  await outfit.getByLabel('Cor da parte superior', { exact: true }).fill('#123abc');
  await outfit.getByRole('button', { name: 'Cor da calça: Vinho', exact: true }).click();
  await outfit.getByLabel('Cor do calçado', { exact: true }).fill('#222222');
  await outfit.getByLabel('Cor da faixa', { exact: true }).fill('#456789');
  await outfit.getByRole('checkbox', { name: 'Usar faixa na cintura' }).uncheck();
  await expect(outfit.getByLabel('Cor da faixa', { exact: true })).toHaveCount(0);
  await outfit.getByRole('checkbox', { name: 'Usar faixa na cintura' }).check();
  await expect(outfit.getByLabel('Cor da faixa', { exact: true })).toHaveValue('#456789');
  await outfit.getByRole('checkbox', { name: 'Usar faixa na cintura' }).uncheck();
  // Species/class changes keep independent visual selections without granting equipment.
  await form.getByLabel('Classe', { exact: true }).selectOption('Mago');
  await expect(form.getByLabel('Postura', { exact: true })).toHaveValue('hunched');
  await expect(outfit.getByLabel('Cor da parte superior', { exact: true })).toHaveValue('#123abc');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await outfit.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await outfit.screenshot({ path: `test-results/character-style/choices-${width}.png` });
  }
  await form
    .locator('input[type=file]')
    .setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: await testArtImage() });
  const queuedResponse = page.waitForResponse(
    (r) => r.url().endsWith('/character-art') && r.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Dar vida ao personagem', exact: true }).click();
  const response = await queuedResponse;
  expect(response.status(), await response.text()).toBe(202);
  const { id } = await response.json();
  const readJob = () =>
    pool
      .query('SELECT creation FROM character_art_jobs WHERE id=$1', [id])
      .then((r) => r.rows[0].creation);
  const creation = await readJob();
  expect(creation.choices.physicalTraits.posture).toBe('hunched');
  expect(creation.choices.physicalTraits.cane).toBe('wooden');
  expect(creation.choices.startingOutfit).toEqual({
    top: 'vest',
    topColor: '#123abc',
    trousers: 'wool',
    trousersColor: '#723c46',
    footwear: 'boots',
    footwearColor: '#222222',
    sash: false,
    sashColor: '#456789',
  });
  await pool.query(
    "UPDATE character_art_jobs SET status='failed',error='Falha simulada' WHERE id=$1",
    [id],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Criações salvas (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Retomar preenchimento', exact: true }).click();
  await expect(form.getByLabel('Postura', { exact: true })).toHaveValue('hunched');
  await expect(form.getByLabel('Bengala de apoio', { exact: true })).toHaveValue('wooden');
  await expect(outfit.getByLabel('Cor da parte superior', { exact: true })).toHaveValue('#123abc');
  await expect(outfit.getByRole('checkbox', { name: 'Usar faixa na cintura' })).not.toBeChecked();
  const retry = page.waitForResponse(
    (r) => r.url().endsWith(`/${id}/retry`) && r.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Dar vida ao personagem', exact: true }).click();
  expect((await retry).status()).toBe(202);
  // Test-only placeholder art verifies completion persists the same choices; no live generation or quota is touched.
  await finishTestArt(id);
  const saved = (
    await pool.query(
      'SELECT s.choices,c.id,c.portrait_revision FROM character_sheets s JOIN characters c ON c.id=s.character_id WHERE c.user_id=$1',
      [user.id],
    )
  ).rows[0];
  expect(saved.choices.physicalTraits).toEqual(creation.choices.physicalTraits);
  expect(saved.choices.startingOutfit).toEqual(creation.choices.startingOutfit);
  await page.goto(origin + '/#profile');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Confirmar distribuição e abrir ficha', exact: true }),
  ).toBeVisible();
  const after = (
    await pool.query(
      'SELECT s.choices,c.portrait_revision FROM character_sheets s JOIN characters c ON c.id=s.character_id WHERE c.id=$1',
      [saved.id],
    )
  ).rows[0];
  expect(after.choices.physicalTraits.posture).toBe('hunched');
  expect(after.choices.physicalTraits.cane).toBe('wooden');
  expect(after.choices.startingOutfit).toEqual(saved.choices.startingOutfit);
  expect(after.portrait_revision).toBe(saved.portrait_revision);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/character-style/result.json',
    JSON.stringify(
      {
        passed: true,
        widths: [1440, 768, 390, 320],
        creation: true,
        savedDraft: true,
        persistedOnCompletion: true,
        independentColors: true,
        optionalSash: true,
        posture: true,
        cane: true,
        noAutomaticRegeneration: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'Character style: creation, saved draft, completion, preserved choices and four widths passed.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/character-style/failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await unlock();
  await pool.end();
}
