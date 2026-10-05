import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
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
  const media: { voice: HTMLMediaElement; source: string }[] = [];
  (window as any).__communityMedia = media;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this.src.includes('/audio/pets/')) media.push({ voice: this, source: this.src });
    return play.call(this);
  };
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
  // Rasterize the actual SVG as displayed in wide thumbnail boxes. Opaque pixels
  // in letterboxing indicate that a neighbouring sprite is leaking into the art.
  async function checkPetFrames() {
    if (await page.locator('.pet-shop-preview').count()) {
      await page.locator('.pet-shop-preview').evaluate(async (preview) => {
        await Promise.all(preview.getAnimations().map((animation) => animation.finished));
      });
      const stage = await page.locator('.pet-shop-preview .pet-art svg').boundingBox();
      expect(stage!.width).toBeGreaterThan(40);
      expect(stage!.height).toBeGreaterThan(40);
      // Check actual browser paint too, including after a sprite replacement.
      const art = page.locator('.pet-shop-preview .pet-art');
      await art.scrollIntoViewIfNeeded();
      const clip = (await art.boundingBox())!;
      const visible = await page.screenshot({ clip, animations: 'disabled' });
      await art.evaluate((el) => {
        (el as HTMLElement).style.opacity = '0';
      });
      let hidden: Buffer;
      try {
        hidden = await page.screenshot({ clip, animations: 'disabled' });
      } finally {
        await art.evaluate((el) => {
          (el as HTMLElement).style.removeProperty('opacity');
        });
      }
      const a = await sharp(visible).ensureAlpha().raw().toBuffer();
      const b = await sharp(hidden).ensureAlpha().raw().toBuffer();
      let painted = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
          24
        )
          painted++;
      expect(painted, 'Animal realmente visível no cenário').toBeGreaterThan(200);
    }
    const reports = await page.locator('.pet-art svg').evaluateAll(async (elements) => {
      const results: { frame: string; leaks: number; edge: number; painted: number }[] = [];
      for (const element of elements) {
        const svg = element.cloneNode(true) as SVGSVGElement;
        const source = svg.querySelector('image')!;
        const bytes = await fetch(source.getAttribute('href')!).then((r) => r.blob());
        const url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(bytes);
        });
        source.setAttribute('href', url);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', '200');
        svg.setAttribute('height', '120');
        const object = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
        const img = new Image();
        img.src = object;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 120;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(object);
        const frame = element.getAttribute('viewBox')!;
        const [, , w, h] = frame.split(' ').map(Number);
        const scale = Math.min(200 / w, 120 / h);
        const left = (200 - w * scale) / 2,
          top = (120 - h * scale) / 2;
        const rgba = ctx.getImageData(0, 0, 200, 120).data;
        let leaks = 0,
          edge = 0,
          painted = 0;
        for (let y = 0; y < 120; y++)
          for (let x = 0; x < 200; x++) {
            if (rgba[(y * 200 + x) * 4 + 3] < 32) continue;
            painted++;
            if (x < left - 1 || x > 200 - left + 1 || y < top - 1 || y > 120 - top + 1) leaks++;
            if (
              Math.abs(x - left) < 1 ||
              Math.abs(x - (200 - left)) < 1 ||
              Math.abs(y - top) < 1 ||
              Math.abs(y - (120 - top)) < 1
            )
              edge++;
          }
        results.push({ frame, leaks, edge, painted });
      }
      return results;
    });
    for (const report of reports) {
      expect(report.leaks, `Arte vizinha vazando: ${report.frame}`).toBe(0);
      expect(report.edge, `Silhueta tocando o corte: ${report.frame}`).toBeLessThan(5);
      expect(report.painted, `Imagem vazia: ${report.frame}`).toBeGreaterThan(200);
    }
  }
  await checkPetFrames();
  await expect
    .poll(() =>
      page
        .locator('.garalho-ready-pose')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/pets-desktop.png' });
  await expect(page.locator('.baguncinha-label')).toHaveCount(0);
  await expect(page.locator('.pet-shop-background')).toHaveCSS(
    'background-image',
    /garalho-cottage-v2/,
  );
  const catBox = await page.locator('.garalho-scene').boundingBox();
  const gardenBox = await page.locator('.pet-shop-garden').boundingBox();
  expect(catBox!.height).toBeLessThan(gardenBox!.height * 0.4);
  const q = page.getByRole('button', { name: 'Como escolho um companheiro?', exact: true });
  await expect(page.locator('.garalho-dialogue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conversar com Garalho', exact: true }).click();
  await expect(page.locator('.garalho-reply')).toHaveCount(0);
  const start = Date.now();
  await q.click();
  await expect(page.locator('.garalho-sign')).toHaveAttribute('data-phase', 'writing');
  await expect(page.locator('.garalho-sign svg')).toHaveCount(0);
  await expect(page.locator('.garalho-writing-pose')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/garalho-writing.png' });
  await expect(page.locator('.garalho-sign-front p')).toContainText('Veja quem gosta de você.', {
    timeout: 5000,
  });
  expect(Date.now() - start).toBeGreaterThan(2400);
  await page.screenshot({ path: 'test-results/garalho-sign-front.png' });
  const board = await page.locator('.garalho-sign').boundingBox();
  expect(board!.x).toBeGreaterThan(catBox!.x);
  expect(board!.x + board!.width).toBeLessThan(catBox!.x + catBox!.width);
  expect(board!.y + board!.height).toBeLessThan(catBox!.y + catBox!.height);
  await page.getByRole('button', { name: 'Ler placa', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Placa de Garalho', exact: true })).toContainText(
    'Veja quem gosta de você.',
  );
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await checkPetFrames();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const signFits = await page.locator('.garalho-sign-front').evaluate((front) => {
      const box = front.getBoundingClientRect(),
        text = front.querySelector('p')!.getBoundingClientRect();
      return text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
    });
    expect(signFits, `Texto dentro da placa em ${width}px`).toBe(true);
    await page.screenshot({
      path: `test-results/pets-redesign-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.pet-shop-catalog').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/pets-catalog-desktop.png' });
  for (const art of await page.locator('.pet-shop-choices .pet-art svg').all()) {
    await expect(art).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    const visible = await art.boundingBox();
    expect(visible!.height).toBeGreaterThan(100);
  }
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
    const beforeMedia = await page.evaluate(() => (window as any).__communityMedia.length);
    await page
      .locator('.pet-shop-choices button')
      .filter({ has: page.getByText(species, { exact: true }) })
      .click();
    await expect
      .poll(() =>
        page
          .evaluate((index) => {
            const observations = (window as any).__communityAudio.slice(index);
            // Quiet pets use a noise buffer; other active animals use recordings.
            return observations.some(
              (entry: any) =>
                entry.context.state === 'running' && (entry.starts > 1 || entry.buffers > 0),
            );
          }, before)
          .then(
            async (synth) =>
              synth ||
              (await page.evaluate(
                (index) =>
                  (window as any).__communityMedia
                    .slice(index)
                    .some(
                      (entry: any) => !entry.voice.paused && entry.source.includes('/audio/pets/'),
                    ),
                beforeMedia,
              )),
          ),
      )
      .toBe(true);
    const appearances = page.locator('.pet-appearances button');
    if ((await appearances.count()) > 1) await appearances.last().click();
    await checkPetFrames();
    if (species === 'Corvo') {
      const clips = await page.evaluate(
        (index) =>
          (window as any).__communityMedia
            .slice(index)
            .map((entry: any) => entry.source.split('/').at(-1)),
        beforeMedia,
      );
      expect(clips.length).toBeGreaterThan(0);
      expect(clips.every((clip: string) => clip === 'raven-caw-v2.wav')).toBe(true);
      expect(await page.evaluate(() => (window as any).__communityAudio.length)).toBe(before);
    }
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
  const mediaMuted = await page.evaluate(() => (window as any).__communityMedia.length);
  await page
    .locator('.pet-shop-choices button')
    .filter({ has: page.getByText('Gato', { exact: true }) })
    .click();
  await expect(page.locator('.pet-shop-preview [role=img]')).toHaveAttribute('aria-label', 'Gato');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__communityAudio.length)).toBe(beforeMuted);
  expect(await page.evaluate(() => (window as any).__communityMedia.length)).toBe(mediaMuted);
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
  await expect(page.locator('.pet-shop-preview')).toHaveCSS('opacity', '1');
  await checkPetFrames();
  await page.screenshot({
    path: 'test-results/pets-shepherd-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByLabel('Como vai se chamar?', { exact: true }).fill('Brasa');
  await page.getByRole('button', { name: 'Levar este companheiro', exact: true }).click();
  await expect(page.locator('.pet-shop-notice')).toContainText('Brasa');
  await page.goto(origin + '/#inventory');
  await expect(page.locator('.inventory-pets')).toContainText('Pastor da estrada');
  await expect(page.locator('.inventory-pets')).toContainText('Brasa');
  await checkPetFrames();
  await page.screenshot({ path: 'test-results/pets-inventory.png' });
  await page.goto(origin + '/#cards');
  await expect(page.locator('.cards-equipped>button')).toHaveCount(3);
  await expect(page.locator('.cards-catalog>button')).toHaveCount(8);
  await expect(page.locator('.cards-host-dialogue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conversar com o Anfitrião', exact: true }).click();
  await expect(page.locator('.cards-host-dialogue')).toContainText('A cadeira está livre');
  await page.getByRole('button', { name: 'Quem é você?', exact: true }).click();
  await expect(page.locator('.cards-host-dialogue')).toContainText('Chamam-me de Anfitrião');
  await page.keyboard.press('Escape');
  await expect(page.locator('.cards-host-dialogue')).toHaveCount(0);
  await page.locator('.cards-catalog > button').filter({ hasText: 'O Corvo' }).click();
  await expect(page.locator('.cards-host-dialogue')).toContainText('Olhe as penas');
  await expect(page.locator('.cards-host-questions')).toHaveCount(0);
  await page.getByRole('button', { name: 'Encerrar conversa', exact: true }).click();
  await page.locator('.cards-catalog > button').filter({ hasText: 'A Vigília' }).click();
  await page.getByRole('button', { name: 'Encerrar conversa', exact: true }).click();
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
  await expect(page.locator('.catalog-achievement')).toHaveCount(5);
  await expect(page.locator('.fantasy-cabinet')).toHaveCount(1);
  const conquest = page.locator('.catalog-achievement[data-code="first_purchase"]');
  await conquest.getByRole('button', { name: 'Criar título', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Administrar títulos', exact: true });
  await expect(dialog.getByLabel('Forma de conquistar', { exact: true })).toHaveValue(
    'achievement',
  );
  await expect(dialog.getByLabel('Conquista vinculada', { exact: true })).toHaveValue(
    'first_purchase',
  );
  await dialog.getByLabel('Nome do título', { exact: true }).fill('Companheiro de estrada');
  await dialog.getByRole('button', { name: 'Salvar título', exact: true }).click();
  await expect(dialog.getByText('Título salvo.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await conquest.getByRole('button', { name: 'Editar conquista', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Editar conquista', exact: true });
  await dialog.getByLabel('Nome da conquista', { exact: true }).fill('A primeira troca');
  await dialog
    .getByLabel('Descrição da conquista', { exact: true })
    .fill('Faça sua primeira compra para seguir viagem.');
  await dialog
    .getByLabel('Título concedido', { exact: true })
    .selectOption({ label: 'Companheiro de estrada' });
  await dialog.getByRole('button', { name: 'Salvar conquista', exact: true }).click();
  await expect(conquest).toContainText('A primeira troca');
  await expect(conquest).toContainText('Companheiro de estrada');
  await page.reload();
  await expect(conquest).toContainText('A primeira troca');
  await page.screenshot({ path: 'test-results/achievements-titles-desktop.png', fullPage: true });
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
  await page.goto(origin + '/#inventory');
  await expect(page.locator('.character-title-label')).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Editar conquista', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar título', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Administrar títulos', exact: true })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
  console.log(
    'Mascotes/placa/aparência, sons dos animais e corvo sem a gravação antiga/silenciar, cartas em leque/3 espaços/conversa sob demanda, eventos/cenário, conquistas editáveis/título automático, concessão/exibição e responsividade verificados.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/community-failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
