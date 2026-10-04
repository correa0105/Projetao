import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
  page = await context.newPage(),
  errors: string[] = [];
// Observe the real browser audio nodes; keep native scheduling/output intact.
await context.addInitScript(() => {
  const native = window.AudioContext;
  const observations: { context: AudioContext; starts: number; buffers: number }[] = [];
  (window as any).__communityAudio = observations;
  window.AudioContext = class extends native {
    private observation = { context: this as AudioContext, starts: 0, buffers: 0 };
    constructor(options?: AudioContextOptions) {
      super(options);
      observations.push(this.observation);
    }
    createOscillator() {
      const voice = super.createOscillator(),
        start = voice.start.bind(voice);
      voice.start = (when = 0) => {
        this.observation.starts++;
        start(when);
      };
      return voice;
    }
    createBufferSource() {
      const voice = super.createBufferSource(),
        start = voice.start.bind(voice);
      voice.start = (when = 0, offset = 0, duration?: number) => {
        this.observation.buffers++;
        if (duration === undefined) start(when, offset);
        else start(when, offset, duration);
      };
      return voice;
    }
  };
});
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Administrador',
      email: `ui-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const owner = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Arden');
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [a.id]);
  await pool.query(
    "INSERT INTO achievements(character_id,code) SELECT $1,unnest(ARRAY['first_character','first_purchase','first_mission','north_veteran','first_story','shop_patron','north_renown'])ON CONFLICT DO NOTHING",
    [a.id],
  );
  await page.goto(origin + '/#pets');
  await expect(page.locator('.pet-shop-choices button')).toHaveCount(10);
  await expect
    .poll(() =>
      page
        .locator('.garalho-portrait img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/pets-desktop.png' });
  const q = page.getByRole('button', { name: 'Quem é o esqueleto ali?', exact: true });
  const start = Date.now();
  await q.click();
  await expect(page.locator('.garalho-sign')).toHaveAttribute('data-phase', 'writing');
  await page.screenshot({ path: 'test-results/garalho-writing.png' });
  await expect(page.locator('.garalho-sign-front p')).toContainText('Baguncinha, meu servo.', {
    timeout: 5000,
  });
  expect(Date.now() - start).toBeGreaterThan(2400);
  await page.screenshot({ path: 'test-results/garalho-sign-front.png' });
  for (const species of [
    'Gato',
    'Coelho',
    'Coruja',
    'Raposa',
    'Corvo',
    'Sapo',
    'Cobra',
    'Rato',
    'Porquinho-da-índia',
    'Cão',
  ]) {
    const before = await page.evaluate(() => (window as any).__communityAudio.length);
    await page
      .locator('.pet-shop-choices button')
      .filter({ has: page.getByText(species, { exact: true }) })
      .click();
    await expect
      .poll(() =>
        page.evaluate((index) => {
          const observations = (window as any).__communityAudio.slice(index);
          // Garalho's separate meow has one oscillator. The appearing animal also
          // produces its own context: multi-part voice or a noise buffer.
          return observations.some(
            (entry: any) =>
              entry.context.state === 'running' && (entry.starts > 1 || entry.buffers > 0),
          );
        }, before),
      )
      .toBe(true);
  }
  await page.locator('.profile-avatar').click();
  await page.getByRole('button', { name: 'Configurações de som', exact: true }).click();
  await page.getByRole('button', { name: 'Silenciar efeitos sonoros', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__communityAudio.every((entry: any) => entry.context.state === 'closed'),
      ),
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const beforeMuted = await page.evaluate(() => (window as any).__communityAudio.length);
  await page
    .locator('.pet-shop-choices button')
    .filter({ has: page.getByText('Gato', { exact: true }) })
    .click();
  await expect(page.locator('.pet-shop-preview [role=img]')).toHaveAttribute('aria-label', 'Gato');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__communityAudio.length)).toBe(beforeMuted);
  await page.locator('.profile-avatar').click();
  await page.getByRole('button', { name: 'Configurações de som', exact: true }).click();
  await page.getByRole('button', { name: 'Ativar efeitos sonoros', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page
    .locator('.pet-shop-choices button')
    .filter({ has: page.getByText('Cão', { exact: true }) })
    .click();
  await page.locator('.pet-appearances button').filter({ hasText: 'Pastor da estrada' }).click();
  await page.getByLabel('Como vai se chamar?', { exact: true }).fill('Brasa');
  await page.getByRole('button', { name: 'Levar este companheiro', exact: true }).click();
  await expect(page.locator('.pet-shop-notice')).toContainText('Brasa');
  await page.goto(origin + '/#inventory');
  await expect(page.locator('.inventory-pets')).toContainText('Pastor da estrada');
  await expect(page.locator('.inventory-pets')).toContainText('Brasa');
  await page.goto(origin + '/#cards');
  await expect(page.locator('.cards-equipped>button')).toHaveCount(3);
  await expect(page.locator('.cards-catalog>button')).toHaveCount(8);
  await page.getByRole('button', { name: 'Comprar carta', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Equipar no espaço 1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Equipar no espaço 1', exact: true }).click();
  await expect(page.locator('.cards-equipped').first()).toContainText('A Vigília');
  await page.reload();
  await expect(page.locator('.cards-equipped')).toContainText('A Vigília');
  await page.screenshot({ path: 'test-results/cards-desktop.png' });
  await page.goto(origin + '/#events');
  await expect(
    page.getByRole('heading', { name: 'Onde as histórias se encontram.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Criar evento', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Criar evento', exact: true });
  await dialog.getByLabel('Título', { exact: true }).fill('A noite das histórias');
  await dialog
    .getByLabel('Descrição', { exact: true })
    .fill('Uma celebração para a guilda.\n> Cada encontro deixa uma memória.');
  await dialog.getByLabel('Arte do evento', { exact: true }).selectOption('/events/hall-v1.webp');
  await dialog.getByLabel('Animação da arte', { exact: true }).selectOption('breathe');
  await dialog.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(page.locator('.event-feature')).toContainText('A noite das histórias');
  await page.getByRole('button', { name: 'Editar cenário', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar cenário dos eventos', exact: true });
  await dialog.getByLabel('Título da página', { exact: true }).fill('O salão da nossa guilda');
  await dialog.getByLabel('Ambientação', { exact: true }).selectOption('mist');
  await dialog.getByRole('button', { name: 'Salvar cenário', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'O salão da nossa guilda', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/events-desktop.png', fullPage: true });
  await page.goto(origin + '/#achievements');
  await page.getByRole('button', { name: 'Prateleira 1', exact: true }).click();
  for (const title of [
    'O primeiro capítulo',
    'Pronto para a estrada',
    'Atenda ao chamado',
    'Veterano do Norte',
    'Conte uma história',
  ]) {
    const article = page
      .locator('.catalog-achievement')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await article.getByRole('button', { name: 'Exibir na estante', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  for (const title of ['Fortuna em circulação', 'Honra do Norte']) {
    await page
      .locator('.catalog-achievement')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
      .getByRole('button', { name: 'Exibir na estante', exact: true })
      .click();
  }
  await page
    .locator('.cabinet-row-choices')
    .getByRole('button', { name: 'Salvar estante', exact: true })
    .click();
  await expect(page.locator('.cabinet-slot.occupied')).toHaveCount(7);
  expect(
    (
      await context.request
        .get(origin + '/api/characters/' + a.id + '/achievements')
        .then((r) => r.json())
    ).shelf.rows,
  ).toEqual([0, 0, 0, 0, 0, 0, 0]);
  await page.screenshot({ path: 'test-results/shelves-desktop.png' });
  await page.goto(origin + '/#titles');
  await page.getByRole('button', { name: 'Administrar títulos', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Administrar títulos', exact: true });
  await dialog.getByLabel('Nome do título', { exact: true }).fill('Amigo da Alvorada');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Uma homenagem da nossa guilda.');
  await dialog.getByRole('button', { name: 'Salvar título', exact: true }).click();
  await expect(dialog.getByText('Título salvo.', { exact: true })).toBeVisible();
  await dialog.getByLabel('Buscar personagem ou jogador', { exact: true }).fill('Arden');
  await expect(dialog.getByLabel('Personagem', { exact: true }).locator('option')).toHaveCount(2);
  await dialog.getByLabel('Personagem', { exact: true }).selectOption(a.id);
  await dialog.getByRole('button', { name: 'Conceder título', exact: true }).click();
  await expect(dialog.getByText('Título concedido ao personagem.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  const honor = page.locator('.title-hall-cards article').filter({ hasText: 'Amigo da Alvorada' });
  await honor.getByRole('button', { name: 'Exibir título', exact: true }).click();
  await expect(
    honor.getByRole('button', { name: 'Em exibição · ocultar', exact: true }),
  ).toBeVisible();
  await page.goto(origin + '/#characters');
  await expect(page.locator('.character-title-label')).toContainText('Amigo da Alvorada');
  // Desktop and narrow-screen composition, overflow and reduced-motion checks.
  for (const route of ['pets', 'cards', 'events', 'achievements', 'lore']) {
    await page.goto(origin + '/#' + route);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/${route}-mobile-new.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/#events');
  await expect(page.locator('.event-feature-art img')).toHaveCSS('animation-name', 'none');
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [owner.id]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Editar cenário', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar evento', exact: true })).toHaveCount(0);
  await page.goto(origin + '/#titles');
  await expect(page.getByRole('button', { name: 'Administrar títulos', exact: true })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
  console.log(
    'Mascotes/placa/aparência, dez vozes em Web Audio real/silenciar, cartas/3 espaços, eventos/cenário, sete conquistas numa prateleira, concessão/título em exibição e responsividade verificados.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/community-failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
