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
  await expect(heads.getByRole('radio')).toHaveCount(12);
  await bodies.getByRole('radio', { name: /Braços reforçados/ }).check();
  await heads.getByRole('radio', { name: /^Cavaleiro/ }).check();
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
    head: 'cavalier',
    metal: 'copper',
    finish: 'rusted',
    accentEnabled: true,
    accentColor: '#123abc',
  });
  await page.reload();
  await expect(design.getByRole('radio', { name: /Braços reforçados/ })).toBeChecked({
    timeout: 60000,
  });
  await expect(design.getByRole('radio', { name: /^Cavaleiro/ })).toBeChecked();
  await expect(design.getByLabel('Cor secundária personalizada', { exact: true })).toHaveValue(
    '#123abc',
  );
  await design.getByLabel('Usar cor secundária', { exact: true }).uncheck();
  await expect(design.getByLabel('Cor secundária personalizada', { exact: true })).toHaveCount(0);
  await design.getByLabel('Usar cor secundária', { exact: true }).check();
  await expect(design.getByLabel('Cor secundária personalizada', { exact: true })).toHaveValue(
    '#123abc',
  );
  await pool.query(
    'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now()) ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
  );
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  const form = page.locator('.character-creation-form');
  await expect(form).toContainText('Ouro inicial: 6.000 PO por personagem novo');
  await form.getByLabel('Nome do personagem').fill('Construído sem foto');
  for (const race of (await import('../shared/rules')).races) {
    await form.getByLabel('Espécie', { exact: true }).selectOption(race);
    for (const label of ['Gênero do personagem', 'Altura', 'Porte físico', 'Idade aparente']) {
      await expect(form.getByRole('combobox', { name: label, exact: true })).toHaveValue('');
      expect(await form.getByRole('combobox', { name: label, exact: true }).evaluate((el: HTMLSelectElement) => el.required)).toBe(true);
    }
  }
  await form.getByRole('combobox', { name: 'Gênero do personagem', exact: true }).selectOption('female');
  await form.getByRole('combobox', { name: 'Altura', exact: true }).selectOption('tall');
  await form.getByRole('combobox', { name: 'Porte físico', exact: true }).selectOption('slim');
  expect(await form.getByRole('combobox', { name: 'Idade aparente', exact: true }).locator('option:not([disabled])').allTextContents()).toEqual(['Jovem', 'Adulto', 'Meia-idade', 'Idoso', 'Ancião']);
  await form.getByRole('combobox', { name: 'Idade aparente', exact: true }).selectOption('elder');
  await form.getByLabel('Espécie', { exact: true }).selectOption('Warforged');
  const without = form.getByRole('radio', {
    name: 'Criar apenas com as características escolhidas',
    exact: true,
  });
  const upload = form.getByRole('radio', { name: 'Enviar uma imagem de referência', exact: true });
  const submit = form.getByRole('button', { name: 'Dar vida ao personagem' });
  await expect(without).toBeChecked();
  await expect(form.locator('input[type=file]')).toHaveCount(0);
  await expect(submit).toBeEnabled();
  await form.getByLabel('Espécie', { exact: true }).selectOption('Humano');
  await expect(submit).toBeDisabled();
  await form.getByLabel('Espécie', { exact: true }).selectOption('Warforged');
  const creationDesign = form.getByRole('region', { name: 'Aparência do Warforged' });
  await creationDesign.getByRole('radio', { name: /Braços reforçados/ }).check();
  await creationDesign.getByRole('radio', { name: /^Cavaleiro/ }).check();
  await creationDesign.getByLabel('Cor metálica principal', { exact: true }).selectOption('copper');
  await creationDesign.getByLabel('Acabamento', { exact: true }).selectOption('rusted');
  await creationDesign.getByLabel('Cor secundária personalizada', { exact: true }).fill('#123abc');
  await upload.check();
  await expect(creationDesign).toHaveCount(0);
  await expect(form).toContainText('a cabeça, as cores e o acabamento vêm da imagem enviada');
  const referenceBody = form.getByRole('region', { name: 'Corpo do Warforged com referência' });
  await expect(referenceBody.getByRole('radio')).toHaveCount(6);
  await expect(referenceBody.getByRole('radio', { name: /Braços reforçados/ })).toBeChecked();
  await referenceBody.getByRole('radio', { name: /Pernas alongadas/ }).check();
  await expect(form.getByLabel('Cor metálica principal', { exact: true })).toHaveCount(0);
  await expect(submit).toBeDisabled();
  const { testArtImage } = await import('../tests/character-fixtures');
  await form
    .locator('input[type=file]')
    .setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer: await testArtImage() });
  await expect(submit).toBeEnabled();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await referenceBody.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/warforged-appearance/reference-body-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await without.check();
  await creationDesign.getByRole('radio', { name: /Braços reforçados/ }).check();
  await creationDesign.getByRole('radio', { name: /^Cavaleiro/ }).check();
  await creationDesign.getByLabel('Cor metálica principal', { exact: true }).selectOption('copper');
  await creationDesign.getByLabel('Acabamento', { exact: true }).selectOption('rusted');
  await creationDesign.getByLabel('Cor secundária personalizada', { exact: true }).fill('#123abc');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await without.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/warforged-appearance/creation-no-reference-${width}.png`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/character-art') && r.request().method() === 'POST',
  );
  await submit.click();
  const response = await responsePromise;
  expect(response.status()).toBe(202);
  const job = await response.json();
  expect(response.request().postDataJSON().reference).toBeUndefined();
  const queued = (
    await pool.query('SELECT reference,creation FROM character_art_jobs WHERE id=$1', [job.id])
  ).rows[0];
  expect(queued.reference).toBeNull();
  expect(queued.creation.choices.warforgedAppearance).toEqual(persisted);
  expect(queued.creation.choices.physicalTraits).toEqual({ height: 'tall', build: 'slim', age: 'elder', gender: 'female' });
  await pool.query(
    "UPDATE character_art_jobs SET status='failed',error='Falha simulada' WHERE id=$1",
    [job.id],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Criações salvas (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Retomar preenchimento', exact: true }).click();
  await expect(without).toBeChecked();
  await expect(form.getByRole('combobox', { name: 'Gênero do personagem', exact: true })).toHaveValue('female');
  await expect(form.getByRole('combobox', { name: 'Idade aparente', exact: true })).toHaveValue('elder');
  await expect(submit).toBeEnabled();
  await expect(form.getByRole('radio', { name: /Braços reforçados/ })).toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  const identity = await testArtImage();
  await pool.query(
    'INSERT INTO character_portraits(character_id,image,construction_base)VALUES($1,$2,$2) ON CONFLICT(character_id)DO UPDATE SET image=$2,construction_base=$2',
    [hero.id, identity],
  );
  await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=$1', [hero.id]);
  await page.goto(origin + '/#characters');
  await page.reload();
  await page.getByRole('button', { name: 'Nova imagem', exact: true }).click();
  let outfit = page.getByRole('dialog', { name: 'Imagem de Forjado', exact: true });
  await expect(outfit.locator('input[type=file]')).toHaveCount(0);
  await expect(outfit).toContainText('identidade salva');
  const campResponse = page.waitForResponse(
    (r) => r.url().endsWith('/character-art') && r.request().method() === 'POST',
  );
  await outfit.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
  const campJob = await campResponse;
  expect(campJob.status()).toBe(202);
  expect(campJob.request().postDataJSON().reference).toBeUndefined();
  await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1", [
    (await campJob.json()).id,
  ]);
  await page.goto(origin + '/#inventory');
  await page.reload();
  await page
    .getByRole('region', { name: 'Itens equipados', exact: true })
    .getByRole('button', { name: 'Vestir', exact: true })
    .click();
  outfit = page.getByRole('dialog', { name: 'Imagem de Forjado', exact: true });
  await expect(outfit.locator('input[type=file]')).toHaveCount(0);
  await expect(outfit).toContainText('cores serão preservados');
  await expect(outfit.getByRole('button', { name: 'Vestir', exact: true })).toBeEnabled();
  await page.screenshot({
    path: 'test-results/warforged-appearance/outfit-no-reference-mobile.png',
  });
  await outfit.getByRole('button', { name: 'Fechar', exact: true }).click();
  const byReference = {
    ...defaultChoices('Warforged', 'Guerreiro'),
    warforgedArtMode: 'reference',
    warforgedAppearance: undefined,
  };
  await pool.query('UPDATE character_sheets SET choices=$2 WHERE character_id=$1', [
    hero.id,
    byReference,
  ]);
  await page.reload();
  await page
    .getByRole('region', { name: 'Itens equipados', exact: true })
    .getByRole('button', { name: 'Vestir', exact: true })
    .click();
  await expect(outfit.locator('input[type=file]')).toHaveCount(1);
  await expect(outfit.getByRole('button', { name: 'Vestir', exact: true })).toBeDisabled();
  await outfit.getByRole('button', { name: 'Fechar', exact: true }).click();
  await pool.query('UPDATE character_art_worker SET available=true,heartbeat_at=now() WHERE id=true');
  await page.goto(origin + '/#characters'); await page.reload();
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  await form.getByLabel('Nome do personagem').fill('Barba e bigode QA');
  const facial = form.getByRole('region', { name: 'Barba e bigode', exact: true });
  await expect(facial).toHaveCount(0);
  await form.getByRole('combobox', { name: 'Gênero do personagem', exact: true }).selectOption('male');
  for (const race of (await import('../shared/rules')).races) {
    await form.getByLabel('Espécie', { exact: true }).selectOption(race);
    await expect(facial).toHaveCount(race === 'Warforged' ? 0 : 1);
    if (race !== 'Warforged') {
      await expect(facial.getByRole('group', { name: 'Modelo de barba', exact: true }).getByRole('radio')).toHaveCount(6);
      await expect(facial.getByRole('group', { name: 'Modelo de bigode', exact: true }).getByRole('radio')).toHaveCount(7);
    }
  }
  await form.getByLabel('Espécie', { exact: true }).selectOption('Humano');
  await facial.getByRole('radio', { name: /Longa trançada/ }).check();
  await facial.getByRole('radio', { name: /Pontas curvadas/ }).check();
  await form.getByRole('combobox', { name: 'Gênero do personagem', exact: true }).selectOption('female');
  await expect(facial).toHaveCount(0);
  await form.getByRole('combobox', { name: 'Gênero do personagem', exact: true }).selectOption('male');
  await expect(facial.locator('input:checked')).toHaveCount(1); // Only the illustrative default color; no saved models.
  await facial.getByRole('radio', { name: /Sem barba/ }).check();
  await expect(facial.getByRole('radio', { name: 'Preto', exact: true })).toBeDisabled();
  await facial.getByRole('radio', { name: /^Cheio / }).check();
  await expect(facial.getByRole('radio', { name: 'Preto', exact: true })).toBeEnabled();
  await facial.getByRole('radio', { name: /Longa trançada/ }).check();
  await facial.getByRole('radio', { name: /Pontas curvadas/ }).check();
  for (const color of ['Marrom', 'Preto', 'Branco', 'Loiro', 'Preto']) await facial.getByRole('radio', { name: color, exact: true }).check();
  await facial.getByLabel('Adicionar fios grisalhos', { exact: true }).check();
  await expect(facial.getByRole('radio', { name: 'Preto', exact: true })).toBeChecked();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const [group, file] of [['Modelo de barba', 'beards'], ['Modelo de bigode', 'mustaches']] as const) {
      await facial.getByRole('group', { name: group, exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/warforged-appearance/${file}-${width}.png` });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const label of await facial.locator('.facial-hair-options > label').all()) { const box = await label.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width); }
  }
  await form.getByRole('combobox', { name: 'Altura', exact: true }).selectOption('average');
  await form.getByRole('combobox', { name: 'Porte físico', exact: true }).selectOption('average');
  await form.getByRole('combobox', { name: 'Idade aparente', exact: true }).selectOption('elder');
  await form.locator('input[type=file]').setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer: await testArtImage() });
  await pool.query('UPDATE character_art_worker SET available=true,heartbeat_at=now() WHERE id=true');
  const facialResponsePromise = page.waitForResponse(r => r.url().endsWith('/character-art') && r.request().method() === 'POST');
  await submit.click(); const facialResponse = await facialResponsePromise; expect(facialResponse.status()).toBe(202);
  const facialJob = await facialResponse.json();
  const savedFacial = (await pool.query('SELECT creation FROM character_art_jobs WHERE id=$1', [facialJob.id])).rows[0].creation.choices.facialHair;
  expect(savedFacial).toEqual({ beard: 'braided', mustache: 'handlebar', color: 'black', graying: true });
  await pool.query("UPDATE character_art_jobs SET status='failed',error='Falha simulada' WHERE id=$1", [facialJob.id]);
  await page.reload();
  await page.getByRole('button', { name: /Criações salvas/ }).click();
  await page.getByRole('region', { name: 'Criação salva de Barba e bigode QA', exact: true }).getByRole('button', { name: 'Retomar preenchimento', exact: true }).click();
  await expect(facial.getByRole('radio', { name: /Longa trançada/ })).toBeChecked();
  await expect(facial.getByRole('radio', { name: /Pontas curvadas/ })).toBeChecked();
  await expect(facial.getByRole('radio', { name: 'Preto', exact: true })).toBeChecked();
  await expect(facial.getByLabel('Adicionar fios grisalhos', { exact: true })).toBeChecked();
  expect(errors).toEqual([]);
  console.log(
    'PASS: construção e retomada sem referência, upload opcional, escolhas persistidas e layout em quatro larguras.',
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
