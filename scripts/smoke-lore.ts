import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
async function noOverflow() {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function watercolorImage() {
  const paint = page.locator('.lore-image-paint');
  await paint.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await expect
    .poll(() => paint.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  expect(await paint.evaluate((element) => getComputedStyle(element).maskImage)).toContain(
    '/lore-watercolor-mask.svg',
  );
  await expect(paint.locator('.lore-image-paper')).toHaveCount(1);
  if ((await page.locator('.lore-image-frame').getAttribute('data-fit')) === 'contain') {
    await expect
      .poll(() =>
        paint.evaluate((element) => {
          const image = element.querySelector('img')!;
          const rect = element.getBoundingClientRect();
          return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight);
        }),
      )
      .toBeLessThan(0.02);
    expect(await paint.locator('img').evaluate((image) => getComputedStyle(image).transform)).toBe(
      'none',
    );
  }
}
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Escriba teste',
      email: `lore-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const testUser = (await signup.json()).user;
  await pool.query('INSERT INTO lore_folder_managers(user_id) VALUES($1)', [testUser.id]);
  await page.goto(origin + '/#lore');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Biblioteca de lore' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crônicas & lore.' })).toBeVisible();
  await expect(page.locator('.lore-page-link')).toHaveCount(2);
  await expect(page.locator('.lore-page-edit')).toHaveCount(2);
  await expect(page.locator('.lore-page-delete')).toHaveCount(2);
  await expect(page.locator('.lore-page-edit').first()).toHaveText('Editar');
  await expect(page.locator('.lore-page-delete').first()).toHaveText('Excluir');
  await expect(page.getByRole('button', { name: 'Editar pasta História', exact: true })).toHaveText(
    'Editar',
  );
  await expect(
    page.getByRole('button', { name: 'Excluir pasta História', exact: true }),
  ).toHaveText('Excluir');
  await page.locator('.lore-page-edit').first().click();
  await expect(page.getByRole('region', { name: 'Editor de crônica' })).toBeVisible();
  expect(
    await page
      .locator('audio[data-lore-scroll-sound]')
      .evaluate((audio: HTMLAudioElement) => audio.paused),
  ).toBe(true);
  await page.getByRole('button', { name: 'Fechar edição', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await expect(page.getByRole('button', { name: 'Abrir os arquivos' })).toHaveCount(0);
  await expect(page.locator('.lore-hero-number')).toHaveCount(0);
  await expect(page.getByText('Terras, crenças e histórias que atravessam as eras.')).toHaveCount(
    0,
  );
  expect(page.url()).toBe(origin + '/#lore');
  await expect(page.getByRole('region', { name: 'Biblioteca de lore' })).toBeVisible();
  await expect(page.locator('.lore-page-link [data-scroll-state="closed"]')).toHaveCount(2);
  await expect(page.locator('.lore-scroll-holder-icon').first()).toBeVisible();
  await page.setViewportSize({ width: 1890, height: 1000 });
  const heroBounds = await page.locator('.lore-hero').boundingBox();
  expect(heroBounds!.x).toBe(0);
  expect(heroBounds!.width).toBe(1890);
  await page.screenshot({ path: 'test-results/lore-library-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // The mascot keeps running after a mouse while an incidental bump tips the scroll.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const folderChoice = page.locator('[data-folder-choice]').first();
  const vase = folderChoice.locator('.lore-scroll-holder-icon');
  const fallingScroll = vase.locator('.lore-scroll-holder-escaping-scroll');
  const idleTransform = await fallingScroll.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const mascot = vase.locator('.lore-mascot-traveler');
  const mouse = vase.locator('.lore-mouse-traveler');
  expect((await page.request.get(origin + '/mascot/crystal-fox-run.webp')).ok()).toBe(true);
  await folderChoice.hover();
  await expect(vase).toHaveAttribute('data-holder-state', 'hovered');
  const setSceneProgress = async (progress: number) => {
    await vase.evaluate(async (element, progress) => {
      for (const part of element.querySelectorAll(
        '.lore-scroll-holder-body, .lore-scroll-holder-rolls, .lore-scroll-holder-escaping-scroll, .lore-mascot-traveler, .lore-mascot-run-sprite, .lore-mouse-motion',
      )) {
        for (const animation of part.getAnimations()) {
          await animation.ready;
          animation.pause();
          animation.currentTime = 2100 * progress;
        }
      }
    }, progress);
  };
  await setSceneProgress(0.28);
  const initialScrollBounds = (await fallingScroll.boundingBox())!;
  expect(await fallingScroll.evaluate((element) => getComputedStyle(element).transform)).toBe(
    idleTransform,
  );
  const body = vase.locator('.lore-scroll-holder-body');
  const beforeImpact = await body.evaluate((element) => getComputedStyle(element).transform);
  const impactChoiceBounds = (await folderChoice.boundingBox())!;
  const sceneClip = {
    x: Math.max(0, impactChoiceBounds.x - 42),
    y: impactChoiceBounds.y,
    width: impactChoiceBounds.width + 42,
    height: impactChoiceBounds.height,
  };
  await page.screenshot({ path: 'test-results/lore-mascot-approach.png', clip: sceneClip });
  const chaseSamples: { progress: number; x: number }[] = [];
  for (const progress of [0.28, 0.32, 0.38, 0.44, 0.5]) {
    await setSceneProgress(progress);
    chaseSamples.push({
      progress,
      x: await mascot.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41),
    });
    expect(await mouse.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    const mouseBounds = (await mouse.locator('[data-mouse-body]').boundingBox())!;
    const foxBounds = (await mascot.boundingBox())!;
    expect(mouseBounds.x + mouseBounds.width / 2).toBeGreaterThan(foxBounds.x + foxBounds.width);
  }
  const chaseSpeeds = chaseSamples
    .slice(1)
    .map(
      (sample, i) => (sample.x - chaseSamples[i].x) / (sample.progress - chaseSamples[i].progress),
    );
  const averageSpeed = chaseSpeeds.reduce((sum, speed) => sum + speed, 0) / chaseSpeeds.length;
  for (const speed of chaseSpeeds) {
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeGreaterThan(averageSpeed * 0.85);
    expect(speed).toBeLessThan(averageSpeed * 1.15);
  }
  await setSceneProgress(0.44);
  expect(await body.evaluate((element) => getComputedStyle(element).transform)).not.toBe(
    beforeImpact,
  );
  expect(await mascot.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await page.screenshot({ path: 'test-results/lore-mascot-bump.png', clip: sceneClip });
  const rim = vase.locator('[data-holder-rim]');
  for (const progress of [0.45, 0.6, 0.72, 0.78, 0.85, 0.93, 1]) {
    await setSceneProgress(progress);
    const outsideBounds = (await fallingScroll.boundingBox())!;
    expect(outsideBounds.y).toBeGreaterThan(initialScrollBounds.y - 3);
    if (progress >= 0.72) {
      const rimBounds = (await rim.boundingBox())!;
      expect(outsideBounds.x).toBeGreaterThan(rimBounds.x + rimBounds.width);
    }
    if (progress === 0.78) {
      await page.screenshot({ path: 'test-results/lore-mascot-falling.png', clip: sceneClip });
    }
  }
  expect(await mascot.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  expect(await mouse.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  await vase.evaluate((element) => {
    for (const part of element.querySelectorAll(
      '.lore-scroll-holder-body, .lore-scroll-holder-rolls, .lore-scroll-holder-escaping-scroll, .lore-mascot-traveler, .lore-mascot-run-sprite, .lore-mouse-motion',
    )) {
      for (const animation of part.getAnimations()) {
        animation.currentTime = 0;
        animation.play();
      }
    }
  });
  // One shake/drop per hover; retain the fallen scroll, reset on exit or click.
  await expect
    .poll(() =>
      fallingScroll.evaluate((element) =>
        element.getAnimations().map((animation) => animation.playState),
      ),
    )
    .toEqual(['finished']);
  const heldTransform = await fallingScroll.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const fallStarted = await fallingScroll.evaluate(
    (element) => element.getAnimations()[0].startTime,
  );
  expect(heldTransform).not.toBe('none');
  const vaseBounds = (await vase.boundingBox())!,
    floorBounds = (await fallingScroll.boundingBox())!;
  expect(floorBounds.y).toBeGreaterThan(vaseBounds.y + vaseBounds.height * 0.7);
  await expect
    .poll(() =>
      vase
        .locator('.lore-scroll-holder-grounded-glow')
        .evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe('1');
  await folderChoice.screenshot({ path: 'test-results/lore-scroll-holder-fallen.png' });
  const choiceBounds = (await folderChoice.boundingBox())!;
  await page.mouse.move(
    choiceBounds.x + choiceBounds.width * 0.7,
    choiceBounds.y + choiceBounds.height * 0.5,
  );
  await page.waitForTimeout(900);
  expect(await fallingScroll.evaluate((element) => getComputedStyle(element).transform)).toBe(
    heldTransform,
  );
  expect(await fallingScroll.evaluate((element) => element.getAnimations()[0].startTime)).toBe(
    fallStarted,
  );
  await page.mouse.move(1400, 50);
  await expect(vase).toHaveAttribute('data-holder-state', 'idle');
  expect(await fallingScroll.evaluate((element) => getComputedStyle(element).transform)).toBe(
    idleTransform,
  );
  await expect(vase.locator('.lore-scroll-holder-grounded-glow')).toHaveCount(0);
  await folderChoice.hover();
  await expect(vase).toHaveAttribute('data-holder-state', 'hovered');
  await folderChoice.click();
  await expect(vase).toHaveAttribute('data-holder-state', 'idle');
  await page.getByRole('button', { name: /Todas as crônicas/ }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await folderChoice.hover();
  expect(await fallingScroll.evaluate((element) => element.getAnimations().length)).toBe(0);
  expect(await mascot.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  expect(await mouse.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  expect(await fallingScroll.evaluate((element) => getComputedStyle(element).transform)).toBe(
    heldTransform,
  );
  expect(
    await vase
      .locator('.lore-scroll-holder-grounded-glow')
      .evaluate((element) => getComputedStyle(element).opacity),
  ).toBe('1');
  await page.mouse.move(1400, 50);
  const sound = page.locator('audio[data-lore-scroll-sound]');
  await expect(sound).toHaveAttribute('src', '/audio/lore-scroll-open.wav');
  await page.locator('.lore-page-link').first().click();
  await expect
    .poll(() => sound.evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > 0))
    .toBe(true);
  expect(await sound.evaluate((audio: HTMLAudioElement) => audio.loop)).toBe(false);
  expect(await sound.evaluate((audio: HTMLAudioElement) => audio.volume)).toBeCloseTo(0.58, 2);
  await expect(page.getByRole('button', { name: 'Editar crônica', exact: true })).toBeVisible();
  const magic = page.locator('.lore-reader-title .lore-scroll-magic');
  expect(await magic.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await expect(magic.locator('.lore-wisp-ribbon')).toHaveCount(4);
  await page.getByRole('button', { name: 'Editar crônica', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Editor de crônica' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar edição', exact: true }).click();
  await expect.poll(() => sound.evaluate((audio: HTMLAudioElement) => audio.ended)).toBe(true);
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.locator('.lore-page-link').first().click();
  await expect
    .poll(() =>
      sound.evaluate(
        (audio: HTMLAudioElement) => !audio.paused && !audio.ended && audio.currentTime > 0,
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.getByRole('button', { name: 'Editar pasta Lendas', exact: true }).click();
  const editFolder = page.getByRole('dialog');
  await editFolder.getByLabel('Nome da pasta').fill('Lendas antigas');
  await editFolder.getByRole('button', { name: 'Salvar pasta' }).click();
  await expect(editFolder).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Editar pasta Lendas antigas', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova pasta / subpasta' }).click();
  const folderDialog = page.getByRole('dialog');
  await folderDialog.getByLabel('Nome da pasta').fill('Portos antigos');
  const folders = (await (await page.request.get(origin + '/api/lore')).json()).folders;
  const cities = folders.find(
    (item: { region_id: string; name: string }) =>
      item.region_id === 'reino-do-norte' && item.name === 'Cidades',
  );
  await folderDialog.getByLabel('Dentro da pasta').selectOption(cities.id);
  await folderDialog.getByRole('button', { name: 'Criar pasta', exact: true }).click();
  await expect(folderDialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova crônica', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.getByLabel('Título da crônica').fill('As muralhas de Vigília');
  await create.getByRole('button', { name: 'Criar rascunho', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Editor de crônica' });
  await expect(editor).toBeVisible();
  await editor
    .getByLabel('Subtítulo', { exact: true })
    .fill('O arquivo das cidades · Uma crônica ilustrada');
  await editor.getByLabel('Título do bloco', { exact: true }).fill('À sombra do bastião');
  await editor
    .getByLabel('Texto', { exact: true })
    .fill(
      'Vigília reúne viajantes, artesãos e aventureiros entre suas muralhas de pedra. Os caminhos do Reino do Norte convergem para a cidade.\n\nNas crônicas, cada rua preserva uma história. Ao longe, a névoa cobre os caminhos e as torres anunciam a chegada de novos viajantes.',
    );
  await editor.getByLabel('Tipo de caixa').selectOption('parchment');
  await editor
    .getByLabel('Enviar imagem para a crônica')
    .setInputFiles('public/alvorada-dawn-banner.png');
  await expect(editor.locator('.lore-edit-block')).toHaveCount(2);
  const imageBlock = editor.getByRole('region', { name: 'Bloco 2', exact: true });
  await imageBlock.getByLabel('Formato').selectOption('portrait');
  await imageBlock.getByLabel('Posição').selectOption('left');
  await imageBlock.getByLabel('Enquadramento').selectOption('contain');
  await imageBlock.getByLabel('Descrição da imagem').fill('Fortaleza nas montanhas ao amanhecer');
  await imageBlock.getByLabel('Legenda').fill('As terras do Reino do Norte');
  for (const alignment of ['left', 'center', 'right']) {
    await imageBlock.getByLabel('Posição').selectOption(alignment);
    await editor.getByRole('button', { name: 'Prévia', exact: true }).click();
    await expect(editor.locator(`.lore-block--portrait.lore-align--${alignment}`)).toBeVisible();
    await watercolorImage();
    await editor.getByRole('button', { name: 'Voltar à edição', exact: true }).click();
  }
  await imageBlock.getByLabel('Enquadramento').selectOption('cover');
  await imageBlock.getByLabel('Efeito').selectOption('still');
  await editor.getByRole('button', { name: 'Prévia', exact: true }).click();
  await watercolorImage();
  await expect(page.locator('.lore-image-mist')).toHaveCount(0);
  await page
    .locator('.lore-image')
    .screenshot({ path: 'test-results/lore-watercolor-portrait.png' });
  await editor.getByRole('button', { name: 'Voltar à edição', exact: true }).click();
  await imageBlock.getByLabel('Enquadramento').selectOption('contain');
  await imageBlock.getByLabel('Efeito').selectOption('cinematic');
  const firstText = editor.getByRole('region', { name: 'Bloco 1', exact: true });
  await imageBlock.getByLabel('Posição').selectOption('right');
  for (const style of ['prose', 'parchment', 'inscription', 'quote']) {
    await firstText.getByLabel('Tipo de caixa').selectOption(style);
    for (const side of ['left', 'right']) {
      await firstText.getByLabel('Alinhamento').selectOption(side);
      await imageBlock.getByLabel('Posição').selectOption(side === 'left' ? 'right' : 'left');
      await editor.getByRole('button', { name: 'Prévia', exact: true }).click();
      const pair = editor.locator('.lore-block-pair');
      await expect(pair).toHaveCount(1);
      const text = await pair.locator('.lore-text').boundingBox();
      const image = await pair.locator('.lore-block--image').boundingBox();
      expect(Math.abs(text!.y - image!.y)).toBeLessThan(2);
      expect(
        side === 'left' ? text!.x + text!.width < image!.x : image!.x + image!.width < text!.x,
      ).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow();
      const mobileText = await pair.locator('.lore-text').boundingBox();
      const mobileImage = await pair.locator('.lore-block--image').boundingBox();
      expect(mobileImage!.y).toBeGreaterThanOrEqual(mobileText!.y + mobileText!.height);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await editor.getByRole('button', { name: 'Voltar à edição', exact: true }).click();
    }
  }
  await firstText.getByLabel('Tipo de caixa').selectOption('parchment');
  await firstText.getByLabel('Alinhamento').selectOption('right');
  await imageBlock.getByLabel('Formato').selectOption('half-landscape');
  expect(await imageBlock.getByLabel('Posição').locator('option').allTextContents()).toEqual([
    'Esquerda',
    'Direita',
  ]);
  await imageBlock.getByLabel('Posição').selectOption('left');
  await editor.getByRole('button', { name: 'Subir bloco 2' }).click();
  await editor.getByRole('button', { name: 'Adicionar caixa de texto', exact: true }).click();
  const third = editor.getByRole('region', { name: 'Bloco 3', exact: true });
  await third.getByLabel('Tipo de caixa').selectOption('quote');
  await third
    .getByLabel('Texto', { exact: true })
    .fill('Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois.');
  await editor.getByRole('button', { name: 'Prévia', exact: true }).click();
  await expect(editor.locator('.lore-block--half-landscape.lore-align--left')).toBeVisible();
  await watercolorImage();
  await page
    .locator('.lore-image')
    .screenshot({ path: 'test-results/lore-watercolor-half-landscape.png' });
  await expect(editor.locator('.lore-text--parchment')).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-editor-preview.png', fullPage: true });
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'As muralhas de Vigília', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.lore-image img')).toHaveAttribute(
    'alt',
    'Fortaleza nas montanhas ao amanhecer',
  );
  await page.reload();
  await page.getByRole('button').filter({ hasText: 'As muralhas de Vigília' }).click();
  await expect(page.locator('.lore-text--quote')).toContainText('Honre a palavra');
  await expect(page.locator('.lore-image-frame--cinematic')).toBeVisible();
  await expect(page.locator('.lore-reader-title [data-scroll-state="open"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/lore-reader-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Editar crônica', exact: true }).click();
  const updatedEditor = page.getByRole('region', { name: 'Editor de crônica' });
  await updatedEditor
    .getByRole('region', { name: 'Bloco 1', exact: true })
    .getByLabel('Formato')
    .selectOption('landscape');
  await updatedEditor
    .getByRole('region', { name: 'Bloco 1', exact: true })
    .getByLabel('Enquadramento')
    .selectOption('cover');
  await updatedEditor.getByRole('button', { name: 'Prévia', exact: true }).click();
  await expect(page.locator('.lore-block--landscape')).toBeVisible();
  await watercolorImage();
  await page
    .locator('.lore-image')
    .screenshot({ path: 'test-results/lore-watercolor-landscape.png' });
  await updatedEditor.getByRole('button', { name: 'Voltar à edição', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-editor-mobile.png', fullPage: true });
  await updatedEditor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(updatedEditor).toHaveCount(0);
  await expect(page.locator('.lore-block--landscape')).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-reader-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.lore-reader-title').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('.lore-reader-title .lore-magic-wisp')
        .first()
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe('none');
  await page
    .locator('.lore-reader-title')
    .screenshot({ path: 'test-results/lore-scroll-wisps.png' });
  const movingFrame = page.locator('.lore-image-frame--cinematic');
  await movingFrame.scrollIntoViewIfNeeded();
  const bounds = await movingFrame.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.8, bounds!.y + bounds!.height * 0.3);
  await expect
    .poll(() => movingFrame.evaluate((element) => element.style.getPropertyValue('--image-x')))
    .not.toBe('');
  expect(
    await page
      .locator('.lore-image-mist')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('lore-mist');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watercolorImage();
  expect(
    await page
      .locator('.lore-image-mist')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.getByLabel('Região').selectOption('coroa-da-geada');
  await expect(page.getByRole('heading', { name: 'Um capítulo por escrever' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar pasta Lendas', exact: true }).click();
  const distantEdit = page.getByRole('dialog');
  await distantEdit.getByLabel('Nome da pasta').fill('Lendas da geada');
  await distantEdit.getByRole('button', { name: 'Salvar pasta', exact: true }).click();
  await expect(distantEdit).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Editar pasta Lendas da geada', exact: true }),
  ).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-empty-mobile.png', fullPage: true });
  await page.getByLabel('Região').selectOption('reino-do-norte');
  await page.getByRole('button', { name: 'Excluir pasta Portos antigos', exact: true }).click();
  const removeFolder = page.getByRole('dialog');
  await removeFolder.getByLabel('Guardar crônicas em').selectOption(cities.id);
  await page.screenshot({ path: 'test-results/lore-delete-folder-desktop.png', fullPage: true });
  await removeFolder.getByRole('button', { name: 'Excluir pasta', exact: true }).click();
  await expect(removeFolder).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Editar pasta Portos antigos', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button').filter({ hasText: 'As muralhas de Vigília' }).click();
  await expect(page.locator('.lore-reader-title [data-scroll-state="open"]')).toBeVisible();
  await expect(page.locator('.lore-text--quote')).toContainText('Honre a palavra');
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.getByRole('button', { name: 'Pastas excluídas', exact: true }).click();
  const trash = page.getByRole('dialog');
  await trash.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(trash).toContainText('Nenhuma pasta excluída.');
  await trash.getByRole('button', { name: 'Fechar' }).click();
  await expect(
    page.getByRole('button', { name: 'Editar pasta Portos antigos', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Excluir crônica As muralhas de Vigília', exact: true })
    .click();
  const deletePage = page.getByRole('dialog');
  await expect(deletePage).toContainText(
    'A crônica “As muralhas de Vigília” e suas imagens sairão da biblioteca.',
  );
  await deletePage.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(deletePage).toHaveCount(0);
  await page.getByRole('button').filter({ hasText: 'As muralhas de Vigília' }).click();
  await page.getByRole('button', { name: 'Excluir crônica', exact: true }).click();
  await deletePage.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.lore-reader-title')).toContainText('As muralhas de Vigília');
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: 'Excluir crônica As muralhas de Vigília', exact: true })
    .click();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-delete-page-mobile.png', fullPage: true });
  await deletePage.getByRole('button', { name: 'Excluir crônica', exact: true }).click();
  await expect(deletePage).toHaveCount(0);
  await expect(
    page.locator('.lore-page-link').filter({ hasText: 'As muralhas de Vigília' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.lore-page-link')).toHaveCount(2);
  await expect(
    page.locator('.lore-page-link').filter({ hasText: 'As muralhas de Vigília' }),
  ).toHaveCount(0);
  // A draft can be deleted directly from the list too.
  const deletionIndex = await (await page.request.get(origin + '/api/lore')).json();
  const draft = await page.request.post(origin + '/api/lore/pages', {
    headers: { Origin: origin },
    data: {
      title: 'Rascunho descartável',
      subtitle: '',
      region_id: 'reino-do-norte',
      folder_id: cities.id,
      published: false,
      blocks: [],
    },
  });
  expect(draft.ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Excluir crônica Rascunho descartável', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Excluir crônica Rascunho descartável', exact: true })
    .click();
  await deletePage.getByRole('button', { name: 'Excluir crônica', exact: true }).click();
  await expect(deletePage).toHaveCount(0);
  await expect(page.locator('.lore-page-link')).toHaveCount(deletionIndex.pages.length);
  await noOverflow();
  expect(errors).toEqual([]);
  console.log(
    'Lore desktop/celular: aquarela nos três formatos, proporção natural, movimento opcional, mascote, som, edição e persistência aprovados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/lore-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
