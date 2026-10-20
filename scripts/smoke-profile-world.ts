import { expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

export async function verifyProfileAndWorld(page: Page, origin: string, user: string, out: string) {
  const baseline = process.env.SITE_VISUAL_BASELINE === '1';
  const suffix = baseline ? '-before' : '';
  const report: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (!baseline) {
    await page.goto(origin + '/#profiles');
    await expect(page.getByRole('heading', { name: 'Encontre um viajante' })).toBeVisible();
    await expect(page.locator('.profiles-directory-heading').getByRole('button', { name: 'Meu perfil' })).toHaveCount(0);
    await page.screenshot({ path: out + '/profile-directory.png' });
    const account = page.getByRole('complementary', { name: 'Personagem e conta' });
    await account.getByRole('button', { name: /^Abrir menu de/ }).click();
    await expect(account.getByRole('button', { name: 'Meu perfil', exact: true })).toHaveCSS('border-radius', '5px');
    await page.screenshot({ path: out + '/account-profile-button.png' });
    await account.getByRole('button', { name: 'Meu perfil', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('profiles\\?user=' + encodeURIComponent(user)));
  }
  await page.goto(origin + '/#profiles?user=' + encodeURIComponent(user));
  await page.getByRole('button', { name: 'Abrir perfil de Mestre básico', exact: true }).click();
  await expect(page.locator('.player-profile-home')).toBeVisible();
  const positions = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    const position = await page.locator('.player-profile-home').evaluate(el => ({ top: el.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth }));
    positions.push({ width, ...position });
    if (!baseline) {
      expect(position.top).toBeLessThanOrEqual(1);
      expect(position.overflow).toBe(false);
      await expect(page.getByRole('navigation', { name: 'Voltar ao personagem' })).toHaveCount(0);
    }
    await page.screenshot({ path: out + '/profile-' + width + suffix + '.png' });
  }
  report.profile = positions;
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Personalizar perfil' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar personalização' }).click();
  await page.goto(origin + '/#profile');
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).first().click();
  await page.getByLabel('Espécie', { exact: true }).selectOption('Changeling');
  await expect(page.locator('fieldset.sheet-choice').filter({ hasText: 'Instintos changeling' })).toBeVisible();
  await expect(page.getByLabel('Atributo das magias da espécie', { exact: true })).toHaveCount(0);
  await page.getByLabel('Espécie', { exact: true }).selectOption('Elfo');
  await expect(page.getByLabel('Atributo das magias da espécie', { exact: true })).toBeVisible();
  await page.getByLabel('Espécie', { exact: true }).selectOption('Changeling');
  await expect(page.getByLabel('Atributo das magias da espécie', { exact: true })).toHaveCount(0);
  if (!baseline) {
    await expect(page.getByRole('combobox', { name: /^Atributo de Iniciado em Magia:/ })).toHaveCount(0);
    const source = page.getByLabel('Classe de Iniciado em Magia do antecedente', { exact: true });
    await source.selectOption('Mago');
    await expect(page.getByLabel('Atributo de Iniciado em Magia: Mago', { exact: true })).toContainText('Inteligência');
    await source.selectOption('Druida');
    await expect(page.getByLabel('Atributo de Iniciado em Magia: Druida', { exact: true })).toContainText('Sabedoria');
    await expect(page.getByRole('combobox', { name: /^Atributo de Iniciado em Magia:/ })).toHaveCount(0);
    await page.screenshot({ path: out + '/spell-ability-source.png' });
    await page.getByLabel('Espécie', { exact: true }).selectOption('Tiefling');
    const hornOptions = page.locator('.tiefling-horns');
    await expect(hornOptions.getByRole('radio')).toHaveCount(8);
    for (const id of ['curved', 'swept', 'upright', 'short', 'sinuous', 'hooked', 'ridged', 'wide']) {
      await hornOptions.locator('input[value="' + id + '"]').check();
      await expect(hornOptions.locator('input[value="' + id + '"]')).toBeChecked();
    }
    await expect.poll(() => hornOptions.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 384))).toBe(true);
    await page.getByLabel('Classe', { exact: true }).selectOption('Mago');
    await expect(hornOptions.locator('input[value="wide"]')).toBeChecked();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await hornOptions.scrollIntoViewIfNeeded();
      await page.screenshot({ path: out + '/tiefling-horns-' + width + '.png' });
    }
  }
  report.changeling = { speciesSpellAbilityAbsent: true, raceChangeUpdatesField: true };
  await page.locator('dialog[open]').getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(origin + '/#world');
  const world = page.locator('.world-map');
  await expect(world).toHaveAttribute('data-status', 'ready', { timeout: 60000 });
  const canvas = world.locator('.world-map__viewport > canvas');
  await expect(canvas).toBeVisible();
  await page.mouse.move(1430, 950);
  await canvas.screenshot({ path: out + '/world-default' + suffix + '.png' });
  const geometry = await world.locator('.world-map__viewport').evaluate(el => ({ ...((el as HTMLElement).dataset), width: el.clientWidth, height: el.clientHeight }));
  report.geometry = geometry;
  if (!baseline) {
    const toggle = page.getByRole('button', { name: 'Efeitos visuais do mapa', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const ratio = await page.evaluate(() => {
      const zoom = document.querySelector('.world-map__zoom')!.getBoundingClientRect();
      const button = document.querySelector('[aria-label="Efeitos visuais do mapa"]')!.getBoundingClientRect();
      return { dx: button.left - zoom.right, dy: Math.abs(button.y + button.height / 2 - zoom.y - zoom.height / 2) };
    });
    expect(ratio.dx).toBeGreaterThanOrEqual(0); expect(ratio.dx).toBeLessThan(20); expect(ratio.dy).toBeLessThan(2);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const frames = () => world.locator('.world-map__viewport').evaluate(el => Number((el as HTMLElement).dataset.renderFrames));
    const started = await frames();
    await expect.poll(frames).toBeGreaterThan(started + 3);
    await toggle.click();
    await expect(world).toHaveAttribute('data-visual-effects', 'off');
    await page.waitForTimeout(250);
    const stopped = await frames(); await page.waitForTimeout(800); expect(await frames()).toBe(stopped);
    await page.getByRole('button', { name: 'Aproximar mapa', exact: true }).click();
    await expect.poll(() => world.locator('.world-map__zoom').innerText()).not.toBe('100%');
    const viewport = world.locator('.world-map__viewport');
    const pan = () => viewport.evaluate(el => Number((el as HTMLElement).dataset.worldPanX));
    const panBefore = await pan();
    await viewport.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(pan).toBeGreaterThan(panBefore);
    await page.getByRole('button', { name: 'Centralizar mapa', exact: true }).click();
    await expect(world.locator('.world-map__zoom')).toHaveText('100%');
    await page.screenshot({ path: out + '/world-effects-off.png' });
    await world.locator('[data-marker-id="reino-do-norte"]').hover();
    await expect(viewport).toHaveAttribute('data-hovered-territory', 'reino-do-norte');
    await page.reload(); await expect(world).toHaveAttribute('data-status', 'ready', { timeout: 60000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(toggle).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: out + '/world-mobile.png' });
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const resumed = await frames(); await expect.poll(frames).toBeGreaterThan(resumed + 3);
    report.effects = { besideZoom: true, persistsReload: true, idleFramesWhileOff: 0, zoomWorksWhenOff: true, resumes: true };
    try {
      const [before, after] = await Promise.all(['world-default-before.png', 'world-default.png'].map(file => sharp(out + '/' + file).ensureAlpha().raw().toBuffer()));
      expect(after.length).toBe(before.length);
      let changed = 0, error = 0;
      for (let i = 0; i < before.length; i += 4) {
        const delta = Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]);
        error += delta; if (delta > 9) changed++;
      }
      report.visualComparison = { changedPixelRatio: changed / (before.length / 4), meanChannelDifference: error / (before.length / 4 * 3) };
      expect(error / (before.length / 4 * 3)).toBeLessThan(1);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  await writeFile(out + '/profile-world' + suffix + '.json', JSON.stringify(report, null, 2));
  console.log('PASS perfil sem faixa/vazio, Changeling sem atributo de magia racial e mapa mundi com efeitos opcionais e navegação preservada.');
}
