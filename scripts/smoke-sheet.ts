import { abilityRollTotal, abilityRollResult, abilityRollRaw } from '../shared/ability-rolls';
import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

// This end-to-end flow must use a disposable database, never the local player database.
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Use banco isolado alvorada_test_* para testar a ficha.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { finishTestArt, lockTestIllustrator } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const unlock = await lockTestIllustrator();
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let userId = '';
const heartbeat = setInterval(
  () => void pool.query('UPDATE character_art_worker SET heartbeat_at=now(),available=true'),
  10000,
);
try {
  await pool.query(
    'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
  );
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Ficha visual',
      email: `sheet-browser-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  userId = (await signup.json()).user.id;
  await page.goto(origin + '/#characters');
  await page.reload();
  await page.getByRole('button', { name: 'Criar personagem' }).click();
  await expect(page.locator('.ability-boost-choices')).toHaveCount(0);
  await page.getByLabel('Nome do personagem').fill('Liora dos Tomos');
  await page.getByLabel('Espécie', { exact: true }).selectOption('Elfo');
  await page.getByLabel('Classe', { exact: true }).selectOption('Mago');
  await expect(page.getByText('Truques da classe', { exact: false }).first()).toBeVisible();
  await page
    .getByLabel('Imagem de referência', { exact: true })
    .setInputFiles('docs/references/character-style-v1.png');
  const sent = page.waitForResponse(
    (r) => r.url().endsWith('/api/character-art') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Dar vida ao personagem' }).click();
  const response = await sent;
  expect(response.status()).toBe(202);
  const id = await finishTestArt((await response.json()).id);
  await expect(page.locator(`.camp-figure img[src*="${id}"]`)).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: 'Abrir ficha' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ficha de Personagem', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rolar os seis atributos' })).toBeVisible();
  await expect(page.locator('.attribute-roll-rule')).toHaveCount(0);
  await mkdir('test-results', { recursive: true });
  await page
    .locator('.sheet-panel details')
    .first()
    .evaluate((el) => el.setAttribute('open', ''));
  await page.screenshot({ path: 'test-results/sheet-choices.png', fullPage: true });
  await page.getByRole('button', { name: 'Rolar os seis atributos' }).click();
  await expect(page.locator('.ability-boost-choices')).toHaveCount(0);
  await expect(page.locator('.sheet-rolls>div')).toHaveCount(6);
  await expect(page.getByLabel('Resultado para Inteligência')).toHaveCount(0);
  // Deterministic accepted set exercises a real 6 -> 8 adjustment through the UI.
  const floorRolls=[[3,1,2,1],[6,6,5,1],[5,5,4,1],[4,4,4,1],[4,4,3,1],[4,3,3,1]];
  await pool.query('UPDATE character_sheets SET rolls=$2 WHERE character_id=$1',[id,JSON.stringify(floorRolls)]);
  await page.reload();
  await expect(page.locator('.sheet-rolls>div')).toHaveCount(6);
  await page.getByRole('button', { name: 'Rever rolagens em 3D' }).click();
  const persistedRolls = (
    await pool.query('SELECT rolls FROM character_sheets WHERE character_id=$1', [id])
  ).rows[0].rolls as number[][];
  const total = abilityRollTotal(persistedRolls);
  expect(total).toBeGreaterThanOrEqual(72); expect(total).toBeLessThanOrEqual(90);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: `Lançar dados · resultado ${i + 1}` }).click();
    const diceDialog = page.getByRole('dialog', { name: `Rolagem ${i + 1} de 6` });
    await expect(diceDialog).toBeVisible();
    const rule = diceDialog.locator('.attribute-roll-rule');
    await expect(rule).toContainText('de 72 a 90');
    await expect(rule).toContainText('abaixo de 8 é ajustado para 8');
    await expect(rule).toHaveCSS('color', 'rgb(255, 143, 143)');
    await expect(rule).toBeInViewport();
    const ruleBox = (await rule.boundingBox())!, stageBox = (await diceDialog.locator('.attribute-dice-stage').boundingBox())!;
    expect(ruleBox.y + ruleBox.height).toBeLessThanOrEqual(stageBox.y);
    await expect(diceDialog.locator('.attribute-die')).toHaveCount(4);
    await expect(diceDialog.getByRole('button', { name: 'Guardar resultado' })).toBeVisible();
    const dice = persistedRolls[i];
    await expect(diceDialog.locator('.attribute-dice-outcome strong')).toHaveText(
      String(abilityRollResult(dice)),
    );
    if (abilityRollRaw(dice)<8) await expect(diceDialog.locator('.attribute-dice-outcome')).toContainText('6 ajustado para 8');
    if (i === 0) { await page.screenshot({ path: 'test-results/sheet-dice-desktop.png' }); await page.screenshot({ path: 'test-results/attribute-rule-red.png' }); }
    if (i === 1) {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(rule).toBeInViewport();
      await page.screenshot({ path: 'test-results/sheet-dice-mobile.png' });
    }
    await diceDialog.getByRole('button', { name: 'Guardar resultado' }).click();
    await expect(diceDialog).toHaveCount(0);
    if (i === 1) await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await expect(page.getByLabel('Resultado para Inteligência')).toBeVisible();
  await expect(page.locator('.ability-boost-choices')).toBeVisible();
  expect(
    (await pool.query('SELECT rolls FROM character_sheets WHERE character_id=$1', [id])).rows[0]
      .rolls,
  ).toEqual(persistedRolls);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const before = await page.locator('.sheet-rolls').innerText();
  await page.reload();
  await expect(page.locator('.sheet-rolls')).toHaveText(before, { useInnerText: true });
  await page.getByLabel('Atributo com +2', { exact: true }).selectOption('0');
  await page.getByLabel('Atributo com +1', { exact: true }).selectOption('1');
  const confirmDistribution = page.getByRole('button', {
    name: 'Confirmar distribuição e abrir ficha',
  });
  await expect(confirmDistribution).toBeEnabled();
  await page.getByRole('radio', { name: 'Três +1', exact: true }).check();
  await expect(confirmDistribution).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Constituição +1', exact: true }).check();
  await expect(confirmDistribution).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: 'Sabedoria +1', exact: true })).toBeDisabled();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.locator('.ability-boost-choices').scrollIntoViewIfNeeded();
    expect(
      await page.locator('.main-content').evaluate((el) => el.scrollWidth > el.clientWidth + 1),
    ).toBe(false);
    await page.screenshot({ path: `test-results/sheet-boosts-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Resultado para Inteligência').selectOption('0');
  await page.getByRole('button', { name: 'Confirmar distribuição e abrir ficha' }).click();
  await expect(page.getByRole('tab', { name: 'Atributos', exact: true })).toBeVisible();
  await expect(page.locator('.sheet-vitals')).toBeVisible();
  const savedBoosts = (
    await pool.query('SELECT choices,rolls FROM character_sheets WHERE character_id=$1', [id])
  ).rows[0];
  expect(savedBoosts.choices.abilityBoosts).toEqual([1, 1, 1, 0, 0, 0]);
  expect(savedBoosts.rolls).toEqual(persistedRolls);
  if (process.env.SHEET_ROLL_RULE_ONLY === '1') {
    expect(errors).toEqual([]);
    console.log('PASS regra vermelha dentro da janela, acima dos dados em cada lançamento, soma entre 72 e 90, seis resultados, recarga e distribuição preservadas.');
  } else {
  await expect(page.locator('.sheet-panel').first()).toHaveCSS(
    'background-color',
    'rgb(23, 27, 30)',
  );
  expect(
    await page.locator('.main-shell').evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain('character-library-v2-20261012.webp');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/sheet-desktop.png', fullPage: true });
  const skillHelp = page.getByRole('button', { name: 'Informações sobre Perícias', exact: true });
  await skillHelp.hover();
  await expect(page.getByRole('tooltip')).toContainText('Setas duplas: especialização');
  await page.screenshot({ path: 'test-results/sheet-help-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await skillHelp.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  await page
    .getByRole('group', { name: 'Magias preparadas (até o limite)' })
    .getByRole('checkbox')
    .first()
    .check();
  await page.getByRole('button', { name: 'Salvar magias e espaços' }).click();
  await page.getByRole('tab', { name: 'História', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Identidade', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Equipamento inicial/ })).toHaveCount(0);
  await page.getByLabel('Anotações', { exact: true }).fill('Uma pista entre as páginas.');
  await page.getByRole('button', { name: 'Salvar anotações' }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'História', exact: true }).click();
  await expect(page.getByLabel('Anotações', { exact: true })).toHaveValue(
    'Uma pista entre as páginas.',
  );
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Magias preparadas (até o limite)' })
      .getByRole('checkbox')
      .first(),
  ).toBeChecked();
  for (const tab of ['Atributos', 'Combate', 'Magias', 'História', 'Equipamento']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: tab, exact: true }).click();
    if (tab === 'Atributos') {
      await skillHelp.click();
      await expect(page.getByRole('tooltip')).toBeVisible();
      const helpBox = await page.getByRole('tooltip').boundingBox();
      expect(helpBox!.x).toBeGreaterThanOrEqual(0);
      expect(helpBox!.x + helpBox!.width).toBeLessThanOrEqual(390);
      await page.screenshot({ path: 'test-results/sheet-help-mobile.png' });
      await page.keyboard.press('Escape');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/sheet-mobile-${tab.split(' ')[0]}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  await page.getByRole('tab', { name: 'Equipamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Equipamento inicial/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identidade', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Anotações', { exact: true })).toHaveCount(0);
  console.log(
    'Ficha no navegador: criação real, arte de teste, rolagem, recarga, distribuição, preparação, notas e cinco seções mobile OK.',
  );
  }
} catch (e) {
  await page.screenshot({ path: 'test-results/sheet-failure.png', fullPage: true });
  console.log((await page.locator('body').innerText()).slice(0, 1800));
  throw e;
} finally {
  clearInterval(heartbeat);
  await browser.close();
  await unlock();
  if (userId) await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
