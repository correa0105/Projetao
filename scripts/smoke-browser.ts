import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { pool } from '../server/db.js';

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  colorScheme: 'light',
});
const email = `browser-${randomUUID()}@example.test`;
const password = `Guilda-${randomUUID()}`;
const errors: string[] = [];
const nav = page.getByRole('navigation', { name: 'Navegação principal' });
async function revealNavigation() {
  const handle = nav.locator('.dock-handle');
  if ((await handle.getAttribute('aria-expanded')) !== 'true') await handle.click();
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
}
async function navigate(label: string) {
  await revealNavigation();
  const group = ['Personagens', 'Perfil', 'Inventário', 'Conquistas', 'Mercenários'].includes(label)
    ? 'Personagem'
    : ['Missões', 'Mural & eventos', 'Ganchos'].includes(label)
      ? 'Aventura'
      : ['Mundo', 'House'].includes(label)
        ? 'Explorar'
        : ['Lore', 'Regras'].includes(label)
          ? 'Biblioteca'
          : null;
  if (group) await nav.getByRole('button', { name: group, exact: true }).click();
  // The mural destination includes the live post count in its accessible name.
  await nav.getByRole('button', { name: label, exact: label !== 'Mural & eventos' }).click();
  await expect(page.locator('.dock-panel')).toHaveCount(0);
}
page.on('pageerror', (error) => errors.push(error.message));
await mkdir('test-results', { recursive: true });
try {
  // Old light preferences and a light OS must not change the permanent dark palette.
  await page.addInitScript(() => localStorage.setItem('alvorada-cinzenta-theme', 'light'));
  await page.goto('http://localhost:3000');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.getByRole('switch', { name: 'Modo escuro' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar aventura' })).toBeVisible();
  await expect(page.locator('#intro-heading')).toHaveText('Alvorada Cinzenta');
  await expect(page.locator('.entry-page')).not.toContainText(
    /Além do horizonte|HONRE O CAMINHO|TERRAS DO NORTE|RPG DE MESA|REÚNA SUA GUILDA/,
  );
  const startButton = page.getByRole('button', { name: 'Iniciar aventura' });
  await expect(startButton.locator('svg')).toHaveCount(0);
  const startBounds = (await startButton.boundingBox())!;
  await startButton.hover();
  await expect(startButton).toHaveCSS('transform', 'none');
  const hoveredBounds = (await startButton.boundingBox())!;
  expect(Math.abs(startBounds.y - hoveredBounds.y)).toBeLessThan(0.5);
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cloudX = await page
    .locator('.entry-cloud-current')
    .evaluate((el) => el.getBoundingClientRect().x);
  await expect
    .poll(() => page.locator('.entry-cloud-current').evaluate((el) => el.getBoundingClientRect().x))
    .toBeGreaterThan(cloudX);
  await page.getByRole('button', { name: 'Pausar atmosfera' }).click();
  await expect(page.locator('.entry-cloud-current')).toHaveCSS('animation-play-state', 'paused');
  const pauseBounds = (await page.locator('.atmosphere-toggle').boundingBox())!;
  expect(1000 - pauseBounds.y - pauseBounds.height).toBeLessThanOrEqual(32);
  await page.getByRole('button', { name: 'Retomar atmosfera' }).click();
  // Exercise the real animated handoff too; the remaining flow uses reduced motion.
  await startButton.click();
  await expect(page.locator('.auth-panel')).toBeVisible();
  await expect(page.locator('.auth-panel')).toHaveCSS('opacity', '1');
  await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused();
  const loginCloudX = await page
    .locator('.entry-cloud-current')
    .evaluate((el) => el.getBoundingClientRect().x);
  await expect
    .poll(() => page.locator('.entry-cloud-current').evaluate((el) => el.getBoundingClientRect().x))
    .toBeGreaterThan(loginCloudX);
  await page.locator('.entry-auth').click({ position: { x: 8, y: 8 } });
  await expect(startButton).toBeFocused();
  await expect(page.locator('.auth-panel')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const titleBox = await page.locator('#intro-heading').boundingBox();
  expect(Math.abs(titleBox!.x + titleBox!.width / 2 - 720)).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/intro-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Iniciar aventura' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused();
  const panel = await page.locator('.auth-panel').boundingBox();
  expect(Math.abs(panel!.x + panel!.width / 2 - 720)).toBeLessThan(2);
  expect(Math.abs(panel!.y + panel!.height / 2 - 500)).toBeLessThan(2);
  await page.locator('.auth-panel').click({ position: { x: 12, y: 12 } });
  await expect(page.locator('.auth-panel')).toBeVisible();
  await page.locator('.entry-auth').click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('button', { name: 'Iniciar aventura' })).toBeFocused();
  await page.getByRole('button', { name: 'Iniciar aventura' }).click();
  await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Iniciar aventura' })).toBeFocused();
  await page.getByRole('button', { name: 'Iniciar aventura' }).click();
  await expect(page).toHaveTitle('Alvorada Cinzenta • Guilda de Aventureiros');
  await expect(page.locator('.auth-wordmark, .entry-back, .auth-divider, .login-note')).toHaveCount(
    0,
  );
  await expect(page.locator('.auth-panel')).not.toContainText(
    /SEU PRÓXIMO CAPÍTULO|Seu lugar é aqui|Cruze os portões|Alvorada Cinzenta/,
  );
  await expect(page.locator('body')).not.toContainText(/Entre Mundos|Casa das Lanternas/);
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/login-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Criar uma conta', exact: true }).click();
  await page.getByLabel('Como podemos chamar você?').fill('Elara');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Boas-vindas, Elara.' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar meu primeiro personagem' }).click();
  await page.getByLabel('Nome do personagem').fill('Elara Ventofolha');
  await page.getByLabel('Raça', { exact: true }).selectOption('Elfo');
  await page.getByLabel('Classe', { exact: true }).selectOption('Patrulheiro');
  await page
    .getByLabel('Sua história')
    .fill(
      'Uma guardiã das trilhas antigas que veio aos Domínios da Alvorada em busca da sétima lanterna.',
    );
  await page.getByRole('button', { name: 'Dar vida ao personagem' }).click();
  await expect(page.getByRole('heading', { name: 'Elara Ventofolha', exact: true })).toBeVisible();
  await navigate('Loja');
  await expect(page.getByRole('heading', { name: 'Empório do viajante.' })).toBeVisible();
  const sword = page
    .locator('.item-card')
    .filter({ has: page.getByRole('heading', { name: 'Espada longa', exact: true }) });
  await sword.getByRole('button', { name: 'Comprar' }).click();
  await page.getByLabel('Quantidade', { exact: true }).fill('2');
  await page.screenshot({ path: 'test-results/purchase-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirmar compra' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.wallet')).toContainText('120');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/shop-desktop.png', fullPage: true });
  await navigate('Inventário');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Espada longa');
  await expect(page.locator('.quantity-badge')).toHaveText('2');
  await page.reload();
  await expect(page.locator('.quantity-badge')).toHaveText('2');
  await expect(page.getByRole('switch', { name: 'Modo escuro' })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await navigate('Personagens');
  await page.getByRole('button', { name: 'Novo personagem', exact: true }).click();
  await page.getByLabel('Nome do personagem').fill('Borin Pedrafirme');
  await page.getByLabel('Raça', { exact: true }).selectOption('Anão');
  await page.getByRole('button', { name: 'Dar vida ao personagem' }).click();
  await expect(page.getByRole('heading', { name: 'Borin Pedrafirme', exact: true })).toBeVisible();
  const characterPicker = page.getByRole('combobox', { name: 'Personagem ativo' });
  const pickerBounds = (await characterPicker.boundingBox())!;
  const exitBounds = (await page.getByRole('button', { name: 'Sair da conta' }).boundingBox())!;
  expect(Math.abs(pickerBounds.y - exitBounds.y)).toBeLessThan(1);
  expect(Math.abs(pickerBounds.height - exitBounds.height)).toBeLessThan(1);
  await characterPicker.click();
  await expect(page.getByRole('option', { name: 'Borin Pedrafirme', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ path: 'test-results/character-picker-desktop.png', fullPage: false });
  await page.getByRole('option', { name: 'Elara Ventofolha', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Seus personagens' })).toHaveCount(0);
  await expect(characterPicker).toBeFocused();
  await characterPicker.press('ArrowDown');
  await characterPicker.press('b');
  await characterPicker.press('Enter');
  await expect(characterPicker).toHaveText('Borin Pedrafirme');
  await characterPicker.press('ArrowDown');
  await characterPicker.press('e');
  await characterPicker.press('Enter');
  await expect(characterPicker).toHaveText('Elara Ventofolha');
  await characterPicker.click();
  await characterPicker.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await characterPicker.click();
  await page.locator('main h1').click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Elara Ventofolha', exact: true })).toBeVisible();
  await navigate('Missões');
  await page.getByRole('button', { name: 'Publicar no mural', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('A lanterna esquecida');
  await expect(page.getByLabel('Tipo').locator('option')).toHaveCount(1);
  const startTime = new Date(Date.now() + 3600000);
  const localStartTime = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page.locator('input[name="starts_at"]').fill(localStartTime);
  await page.getByLabel('Local', { exact: true }).fill('Bosque dos Sussurros');
  await page
    .getByLabel('Descrição', { exact: true })
    .fill('Descubra o destino da antiga expedição da Bastião da Alvorada.');
  await page.getByRole('dialog').getByRole('button', { name: 'Publicar no mural' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate('Início');
  await expect(page.getByRole('region', { name: 'Mesas nas próximas 24 horas' })).toContainText(
    'Você tem uma mesa para mestrar',
  );
  await page.screenshot({ path: 'test-results/upcoming-missions-desktop.png', fullPage: true });
  await navigate('Mural & eventos');
  const mission = page
    .locator('.quest-card')
    .filter({ has: page.getByRole('heading', { name: 'A lanterna esquecida', exact: true }) });
  await mission.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect(mission.getByRole('button', { name: 'Inscrito', exact: true })).toBeVisible();
  await mission.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(mission.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  await mission.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page
    .getByLabel('Resumo da missão')
    .fill('A expedição foi encontrada e a lanterna voltou ao Bastião.');
  await page.getByLabel('XP de Elara Ventofolha', { exact: true }).fill('150');
  await page.getByLabel('Criar um gancho a partir desta missão').check();
  await page.getByLabel('Título do gancho', { exact: true }).fill('O segredo da lanterna');
  await page
    .getByLabel('Descrição do gancho', { exact: true })
    .fill('A lanterna revelou uma trilha escondida sob o Bastião.');
  await page.screenshot({ path: 'test-results/mission-completion-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mission-completion-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Confirmar conclusão', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(mission).toHaveCount(0);
  await expect(page).toHaveURL(/#board$/);
  await expect(page.getByRole('button', { name: 'Ver histórico de missões' })).toHaveCount(0);
  await page.locator('.tabs').getByRole('button', { name: 'Missões', exact: true }).click();
  await expect(mission).toHaveCount(0);
  await navigate('Missões');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(mission).toBeVisible();
  await expect(mission).toContainText('Concluída');
  await expect(mission).toContainText('A expedição foi encontrada');
  await expect(mission).toContainText('Elara Ventofolha: +150 XP');
  await page.getByRole('button', { name: 'Abertas', exact: true }).click();
  await expect(mission).toHaveCount(0);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(mission).toContainText('Concluída');
  // Every requested section must render with the new guild identity.
  await navigate('Ganchos');
  await expect(page.getByRole('button', { name: 'Publicar no mural', exact: true })).toHaveCount(0);
  await expect(
    page.locator('.quest-card').filter({ hasText: 'O segredo da lanterna' }),
  ).toContainText('Originado em: A lanterna esquecida');
  await navigate('Perfil');
  await expect(page.locator('main')).toContainText('150 XP');
  for (const [label, heading, screenshot] of [
    ['Perfil', 'Perfil do personagem.', 'profile'],
    ['Conquistas', 'Conquistas.', 'achievements'],
    ['Mercenários', 'Mercenários.', 'mercenaries'],
    ['House', 'House.', 'house'],
    ['Mundo', '', 'world'],
    ['Lore', 'Crônicas & lore.', 'lore'],
    ['Regras', 'Regras da mesa.', 'rules'],
    ['Ganchos', 'Ganchos de aventura.', 'hooks'],
  ]) {
    await navigate(label);
    if (label === 'Mundo')
      await expect(page.getByRole('region', { name: 'Mapa do mundo com relevo 3D' })).toBeVisible();
    else await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/Entre Mundos|Casa das Lanternas/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/${screenshot}-desktop.png`, fullPage: true });
  }
  const artwork = await page.request.get('http://localhost:3000/alvorada-dawn-banner.png');
  expect(artwork.ok()).toBe(true);
  expect(artwork.headers()['content-type']).toContain('image/png');
  await navigate('Início');
  await expect(page.locator('.character-mini h3')).toHaveText('Elara Ventofolha');
  const dismissToast = page.getByRole('button', { name: 'Dispensar aviso' });
  if (await dismissToast.isVisible()) await dismissToast.click();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await expect(nav.locator('.dock-tray')).toBeHidden();
  const collapsedDock = await nav.boundingBox();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await nav.locator('.dock-handle').hover();
  await expect(nav.locator('.dock-handle')).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.locator('.dock-handle svg, .dock-chevron, .handle-line')).toHaveCount(0);
  await expect(nav.locator('.dock-handle')).toBeHidden();
  await expect
    .poll(async () => (await nav.boundingBox())!.width)
    .toBeGreaterThan(collapsedDock!.width + 300);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(nav.locator('.dock-orb .guild-engraving')).toHaveCount(6);
  // Check the rendered silhouette on a transparent canvas, not just its CSS color.
  const iconAtlas = await page.request.get('http://localhost:3000/guild-icons-candle-helmet.png');
  expect(iconAtlas.ok()).toBe(true);
  const alphaChecks = await page.evaluate(
    async (base64) => {
      const checks = [];
      for (const icon of document.querySelectorAll('.dock-orb .guild-engraving')) {
        const svg = icon.cloneNode(true) as SVGSVGElement;
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', '256');
        svg.setAttribute('height', '256');
        svg.querySelector('image')!.setAttribute('href', 'data:image/png;base64,' + base64);
        const bitmap = new Image();
        bitmap.src =
          'data:image/svg+xml;charset=utf-8,' +
          encodeURIComponent(new XMLSerializer().serializeToString(svg));
        await bitmap.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        const pixels = ctx.getImageData(0, 0, 256, 256).data;
        let visible = 0;
        let cornerAlpha = 0;
        for (let y = 0; y < 256; y++)
          for (let x = 0; x < 256; x++) {
            const alpha = pixels[(y * 256 + x) * 4 + 3];
            if (alpha > 240) visible++;
            if ((x < 12 || x >= 244) && (y < 12 || y >= 244))
              cornerAlpha = Math.max(cornerAlpha, alpha);
          }
        checks.push({ visible, cornerAlpha });
      }
      return checks;
    },
    (await iconAtlas.body()).toString('base64'),
  );
  for (const check of alphaChecks) {
    expect(check.cornerAlpha).toBe(0);
    expect(check.visible).toBeGreaterThan(10000);
  }

  await nav.getByRole('button', { name: 'Aventura', exact: true }).hover();
  await page.screenshot({ path: 'test-results/navigation-expanded-desktop.png', fullPage: false });
  // Compact balloons follow the clicked button without expanding the dock.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const name of ['Personagem', 'Aventura', 'Explorar', 'Biblioteca']) {
    await nav.getByRole('button', { name, exact: true }).click();
    const panel = nav.getByRole('region', { name: 'Opções de ' + name });
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => {
        const outer = (await nav.boundingBox())!;
        const inner = (await panel.boundingBox())!;
        const anchor = (await nav.getByRole('button', { name, exact: true }).boundingBox())!;
        return (
          inner.width <= 198 &&
          inner.y >= 0 &&
          Math.abs(inner.x + inner.width / 2 - (anchor.x + anchor.width / 2)) < 2 &&
          Math.abs(anchor.y - (inner.y + inner.height) - 16.2) < 2 &&
          Math.abs(outer.height - 106) < 0.1
        );
      })
      .toBe(true);
    await page.screenshot({
      path: 'test-results/submenu-' + name + '-desktop.png',
      animations: 'disabled',
    });
  }
  await page.keyboard.press('Escape');
  // Artwork and button must share a center and move together on hover at each breakpoint.
  for (const width of [320, 390, 600, 601, 760, 761, 1440]) {
    await page.mouse.move(5, 5);
    await expect(nav.locator('.dock-handle')).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width, height: 1000 });
    await revealNavigation();
    await expect
      .poll(async () => {
        const panel = (await nav.boundingBox())!;
        const buttons = (await nav.locator('.dock-buttons').boundingBox())!;
        return Math.abs(buttons.y + buttons.height / 2 - panel.y - panel.height / 2);
      })
      .toBeLessThan(1);
    for (const button of await nav.locator('.dock-item').all()) {
      await button.hover();
      const fit = await button.evaluate((element) => {
        const orb = element.querySelector('.dock-orb')!.getBoundingClientRect();
        const art = element.querySelector('.guild-engraving')!.getBoundingClientRect();
        return {
          dx: Math.abs(orb.x + orb.width / 2 - art.x - art.width / 2),
          dy: Math.abs(orb.y + orb.height / 2 - art.y - art.height / 2),
          ratio: art.width / orb.width,
          inside: orb.x >= 0 && orb.x + orb.width <= window.innerWidth,
        };
      });
      expect(fit.dx).toBeLessThan(0.6);
      expect(fit.dy).toBeLessThan(0.6);
      expect(fit.ratio).toBeLessThan(0.73);
      expect(fit.ratio).toBeGreaterThan(0.68);
      expect(fit.inside).toBe(true);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(5, 5);
  await expect(nav.locator('.dock-handle')).toHaveAttribute('aria-expanded', 'false');
  await nav.locator('.dock-handle').focus();
  await page.keyboard.press('ArrowUp');
  await expect(nav.getByRole('button', { name: 'Início', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav.locator('.dock-handle')).toBeFocused();
  await expect(nav.locator('.dock-tray')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await navigate('Loja');
  await expect(page.getByRole('heading', { name: 'Empório do viajante.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/shop-mobile.png', fullPage: true });
  await page.getByLabel('Buscar itens').fill('escudo');
  await expect(page.locator('.item-card')).toHaveCount(1);
  for (const label of ['Perfil', 'House', 'Mundo', 'Conquistas']) {
    await navigate(label);
    if (label === 'Mundo')
      await expect(page.getByRole('region', { name: 'Mapa do mundo com relevo 3D' })).toBeVisible();
    else await expect(page.locator('main h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await revealNavigation();
  await nav.getByRole('button', { name: 'Aventura', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Opções de Aventura' })).toBeVisible();
  expect(
    await nav
      .locator('.guild-engraving')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(30); // Artwork remains legible inside the compact mobile buttons.
  await page.screenshot({ path: 'test-results/navigation-mobile.png', fullPage: false });
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('button', { name: 'Aventura', exact: true })).toBeFocused();
  await expect(page.locator('.dock-panel')).toHaveCount(0);
  await revealNavigation();
  await nav.getByRole('button', { name: 'Personagem', exact: true }).click();
  await page.locator('main h1').click();
  await expect(page.locator('.dock-panel')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await revealNavigation();
  await nav.getByRole('button', { name: 'Personagem', exact: true }).click();
  const smallPanel = nav.getByRole('region', { name: 'Opções de Personagem' });
  await expect(smallPanel).toBeVisible();
  const panelBox = (await smallPanel.boundingBox())!;
  expect(panelBox.y).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(320);
  await smallPanel
    .getByRole('button', { name: 'Mercenários', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    smallPanel.getByRole('button', { name: 'Mercenários', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: 'test-results/submenu-small-mobile.png' });
  await page.keyboard.press('Escape');
  await navigate('Inventário');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar aventura' })).toBeVisible();
  await page.screenshot({ path: 'test-results/intro-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Iniciar aventura' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(nav).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await page.reload();
  await expect(nav).toBeVisible();
  const map = await page.request.get('http://localhost:3000/alvorada-map-v2.png');
  expect(map.ok()).toBe(true);
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  try {
    touch.on('pageerror', (error) => errors.push(error.message));
    await touch.goto('http://localhost:3000');
    await touch.getByRole('button', { name: 'Iniciar aventura' }).tap();
    await touch.getByLabel('E-mail', { exact: true }).fill(email);
    await touch.getByLabel('Senha', { exact: true }).fill(password);
    await touch.getByRole('button', { name: 'Entrar', exact: true }).tap();
    const touchNav = touch.getByRole('navigation', { name: 'Navegação principal' });
    const touchPicker = touch.getByRole('combobox', { name: 'Personagem ativo' });
    await touchPicker.tap();
    const touchOptions = touch.getByRole('listbox', { name: 'Seus personagens' });
    const touchOptionBounds = (await touchOptions.boundingBox())!;
    expect(touchOptionBounds.x).toBeGreaterThanOrEqual(0);
    expect(touchOptionBounds.x + touchOptionBounds.width).toBeLessThanOrEqual(390);
    await touch.screenshot({ path: 'test-results/character-picker-mobile.png' });
    await touch.getByRole('option', { name: 'Elara Ventofolha', exact: true }).tap();
    await expect(touchPicker).toHaveText('Elara Ventofolha');
    await expect(touchOptions).toHaveCount(0);
    await expect(touchNav.locator('.dock-tray')).toBeHidden();
    await touchNav.getByRole('button', { name: 'Abrir navegação' }).tap();
    await touchNav.getByRole('button', { name: 'Aventura', exact: true }).tap();
    await touch.screenshot({ path: 'test-results/navigation-touch.png', fullPage: false });
    await touchNav.getByRole('button', { name: 'Missões', exact: true }).tap();
    await expect(touchNav.locator('.dock-tray')).toBeHidden();
    await touchNav.getByRole('button', { name: 'Abrir navegação' }).tap();
    await touch.locator('h1').tap();
    await expect(touchNav.locator('.dock-tray')).toBeHidden();
  } finally {
    await touch.close();
  }
  expect(errors).toEqual([]);
  console.log(
    'Browser OK: Alvorada Cinzenta, todos os menus, arte, cadastro, personagens, compra, persistência, missão, histórico, busca, mobile e logout.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  throw error;
} finally {
  const { rows } = await pool.query('SELECT id FROM "user" WHERE email=$1', [email]);
  if (rows.length) {
    await pool.query('DELETE FROM board_posts WHERE author_id=$1', [rows[0].id]);
    await pool.query('DELETE FROM "user" WHERE id=$1', [rows[0].id]);
  }
  await browser.close();
  await pool.end();
}
