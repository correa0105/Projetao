import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
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
try {
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Estabulo teste',
      email: `stable-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const hero = await createLegacyTestCharacter((await signup.json()).user.id, 'Cavaleiro');
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [hero.id]);
  const send = (data: unknown) =>
    page.request.post(origin + '/api/stable/purchase', { headers: { Origin: origin }, data });
  const order = {
    character_id: hero.id,
    mount_id: 'mule',
    name: 'Passo Firme',
    idempotency_key: randomUUID(),
  };
  const stranger = await browser.newContext();
  await stranger.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Outro',
      email: `other-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(
    (
      await stranger.request.post(origin + '/api/stable/purchase', {
        headers: { Origin: origin },
        data: order,
      })
    ).status(),
  ).toBe(404);
  expect((await stranger.request.get(origin + '/api/stable/' + hero.id)).status()).toBe(404);
  await stranger.close();
  const concurrent = await Promise.all([send({ ...order, price_cp: 1 }), send(order)]);
  expect(concurrent.map((r) => r.status()).sort()).toEqual([200, 201]);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(99200);
  expect((await send({ ...order, name: 'Outro' })).status()).toBe(409);
  expect((await send({ ...order, idempotency_key: randomUUID(), name: '' })).status()).toBe(400);
  expect((await send({ ...order, coat: 'alternate' })).status()).toBe(409);
  expect((await send({ ...order, equipment: ['feed'] })).status()).toBe(409);
  expect(
    (await send({ ...order, idempotency_key: randomUUID(), equipment: ['unknown'] })).status(),
  ).toBe(400);
  expect(
    (
      await send({
        ...order,
        idempotency_key: randomUUID(),
        equipment: ['saddle-riding', 'saddle-military'],
      })
    ).status(),
  ).toBe(400);
  expect((await send({ ...order, idempotency_key: randomUUID(), coat: 'invalid' })).status()).toBe(
    400,
  );
  expect(
    (await send({ ...order, idempotency_key: randomUUID(), mount_id: 'dragon' })).status(),
  ).toBe(400);
  await pool.query('UPDATE characters SET gold_cp=0 WHERE id=$1', [hero.id]);
  expect((await send({ ...order, idempotency_key: randomUUID() })).status()).toBe(409);
  await pool.query('UPDATE characters SET gold_cp=99200 WHERE id=$1', [hero.id]);
  await page.goto(origin + '/#stable');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Estábulo da Alvorada', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.stable-owned')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const assertBalloonAttached = async (selector: string, dark = false) => {
    await expect
      .poll(() =>
        page.locator(selector).evaluate((balloon, dark) => {
          const portrait = balloon.parentElement!.querySelector<HTMLImageElement>(
            dark ? '.ginna-vision-figure' : '.stable-keeper-trigger img',
          )!;
          if (!portrait.naturalWidth) return Infinity;
          const box = portrait.getBoundingClientRect();
          const scale = Math.min(
            box.width / portrait.naturalWidth,
            box.height / portrait.naturalHeight,
          );
          const artWidth = portrait.naturalWidth * scale;
          const artHeight = portrait.naturalHeight * scale;
          const faceX = box.x + (box.width - artWidth) / 2 + artWidth * 0.37;
          const mouthY = box.bottom - artHeight + artHeight * (dark ? 0.19 : 0.125);
          const shape = balloon.querySelector<SVGSVGElement>('.ginna-balloon-shape')!;
          const shapeBox = shape.getBoundingClientRect();
          const tipX = shapeBox.x + Number(shape.getAttribute('width')) - 2;
          const tipY = shapeBox.y + Number(shape.dataset.tailY);
          return Math.hypot(tipX - faceX, tipY - mouthY);
        }, dark),
      )
      .toBeLessThan(14);
  };
  await expect(page.locator('.stable-field > .ginna-balloon')).toContainText('Olha só, visita!');
  await expect(page.locator('.stable-field > .ginna-balloon')).not.toContainText('Ginna');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/ginna-welcome.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertBalloonAttached('.stable-field > .ginna-balloon');
  await page.screenshot({ path: 'test-results/ginna-welcome-mobile.png' });
  const welcomeBox = (await page.locator('.stable-field > .ginna-balloon').boundingBox())!;
  expect(welcomeBox.y).toBeGreaterThanOrEqual(0);
  expect(welcomeBox.x + welcomeBox.width).toBeLessThanOrEqual(390);
  // The arrival greeting expires, while the keeper remains available to converse.
  await expect(page.locator('.stable-field > .ginna-balloon')).toHaveCount(0, { timeout: 7500 });
  await expect(page.locator('.stable-keeper-trigger')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const name of ['Cavalo de montaria', 'Cavalo de guerra', 'Pônei', 'Mula']) {
    await page.getByRole('button', { name: `Ver ${name}`, exact: true }).click();
    await expect(page.getByAltText(`${name} de corpo inteiro no campo`)).toBeVisible();
    expect(
      await page
        .getByAltText(`${name} de corpo inteiro no campo`)
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
  }
  await mkdir('test-results', { recursive: true });
  const keeper = page.locator('.stable-keeper .stable-keeper-trigger');
  const normalBalloon = page.locator('.stable-field > .ginna-balloon');
  await expect(keeper.locator('img')).toHaveAttribute('src', '/stable/ginna.webp');
  await expect(page.locator('.stable-keeper-hint')).toHaveCount(0);
  await expect(normalBalloon).not.toContainText('Ginna');
  const normalFilter = await keeper
    .locator('img')
    .evaluate((element) => getComputedStyle(element).filter);
  await keeper.hover();
  await expect
    .poll(() => keeper.locator('img').evaluate((element) => getComputedStyle(element).filter))
    .not.toBe(normalFilter);
  await keeper.focus();
  await keeper.press('Enter');
  const conversation = page.getByRole('group', { name: 'Perguntas à cuidadora', exact: true });
  await expect(conversation).toBeVisible();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(conversation.locator('[role="status"]')).toContainText('O que deseja saber?');
  await expect(conversation).not.toContainText('Ginna');
  await expect(conversation.locator('.ginna-questions button')).toHaveCount(3);
  await expect(conversation.locator('svg.ginna-balloon-shape path')).toHaveCount(1);
  await assertBalloonAttached('.stable-field > .ginna-balloon');
  await expect(conversation.locator('[data-ginna-question="warning"]')).toHaveText(
    'E se eu fizer mal a ele?',
  );
  const askQuestion = async (topic: string) => {
    if (!(await conversation.isVisible())) await keeper.click();
    await conversation.locator('[data-ginna-question="' + topic + '"]').click();
    if (topic !== 'warning') await expect(conversation).toHaveCount(0);
  };
  await askQuestion('identity');
  await expect(normalBalloon.locator('[role="status"]')).toContainText('Pode me chamar de Ginna');
  await expect(normalBalloon.locator('.npc-speaker')).toHaveText('Ginna');
  await expect(keeper).toBeFocused();
  await askQuestion('animals');
  await expect(normalBalloon.locator('[role="status"]')).toContainText('Os animais vêm até mim');
  const excuses = [
    'E se eu precisar discipliná-lo?',
    'Mas e se ele não me obedecer?',
    'Seria só para ensinar uma lição…',
    'E se ninguém ficar sabendo?',
  ];
  for (let warning = 0; warning < 4; warning++) {
    await askQuestion('warning');
    await expect(conversation).toBeVisible();
    await expect(conversation.locator('.ginna-questions button')).toHaveCount(1);
    await expect(conversation.locator('[data-ginna-question="warning"]')).toHaveText(
      excuses[warning],
    );
    await assertBalloonAttached('.stable-field > .ginna-balloon');
    await expect(page.locator('.ginna-vision')).toHaveCount(0);
    await expect(keeper.locator('img')).toHaveAttribute(
      'src',
      warning === 3
        ? '/stable/ginna-angry.webp'
        : warning === 2
          ? '/stable/ginna-serious.webp'
          : '/stable/ginna.webp',
    );
    if (warning === 2) {
      await expect
        .poll(() => keeper.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);
      await page.screenshot({ path: 'test-results/ginna-serious-warning.png' });
    }
    if (warning === 3) {
      await expect
        .poll(() => keeper.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBe(768);
      await page.screenshot({ path: 'test-results/ginna-angry-warning.png' });
    }
  }
  await expect(normalBalloon.locator('[role="status"]')).toContainText('ÚLTIMA VEZ');
  const shakingLetters = await normalBalloon.locator('.ginna-shaking-letter').allTextContents();
  expect(shakingLetters.every((letter) => /^\p{Lu}$/u.test(letter))).toBe(true);
  expect(shakingLetters.join('')).toBe(
    'ÚLTIMAVEZNÃOMALTRATENENHUMDELESEMHIPÓTESEALGUMAVOCÊENTENDEU',
  );
  for (const word of ['Esta', 'Não']) {
    const sentenceWord = normalBalloon
      .locator('.ginna-shaking-word')
      .filter({ hasText: new RegExp(`^${word}$`) });
    await expect(sentenceWord.locator('.ginna-shaking-letter')).toHaveCount(0);
  }
  const shakingLetter = normalBalloon.locator('.ginna-shaking-letter').first();
  await expect(shakingLetter).toBeVisible();
  expect(await shakingLetter.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    'none',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await shakingLetter.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    'ginna-letter-shake',
  );
  await expect
    .poll(() => shakingLetter.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: 'test-results/ginna-conversation.png' });
  // Closing the balloon does not erase the warnings on this visit.
  await conversation.locator('[data-ginna-question="warning"]').press('Escape');
  await expect(conversation).toHaveCount(0);
  await expect(keeper).toBeFocused();
  await keeper.click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const normalImage = await page.locator('.stable-animal-base').getAttribute('src');
  const normalMusic = page.locator('[data-site-music]');
  const musicBefore = await normalMusic.evaluate((element: HTMLAudioElement) => ({
    src: element.getAttribute('src'),
    time: element.currentTime,
    volume: element.volume,
  }));
  const normalTextFontSize = await normalBalloon
    .locator('.ginna-balloon-copy')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  await askQuestion('warning');
  const vision = page.locator('.ginna-vision');
  // The scene deliberately keeps moving; click the live target with the mouse.
  const clickShaking = async (button: ReturnType<typeof page.locator>) => {
    const box = (await button.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await expect(vision).toBeVisible();
  await expect(vision).toContainText('Pague para ver o que acontece');
  const ominousText = vision.locator('.ginna-balloon-copy');
  expect(
    await ominousText.evaluate((element) => getComputedStyle(element).textDecorationLine),
  ).toBe('none');
  expect(
    await ominousText.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThan(normalTextFontSize);
  expect(await ominousText.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    'ginna-text-heartbeat',
  );
  const firstColor = await ominousText.evaluate((element) => getComputedStyle(element).color);
  await expect(vision).toHaveAttribute('data-heartbeat-state', 'playing');
  await expect
    .poll(() => vision.getAttribute('data-heartbeat-beats').then(Number))
    .toBeGreaterThan(1);
  const beatPhase = Number(await vision.getAttribute('data-heartbeat-phase'));
  expect(Math.min(Math.abs(beatPhase - 0.1), Math.abs(beatPhase - 0.27))).toBeLessThan(0.04);
  await expect
    .poll(() => ominousText.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(firstColor);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(vision).toHaveAttribute('data-heartbeat-state', 'reduced');
  const reducedBeats = await vision.getAttribute('data-heartbeat-beats');
  await page.waitForTimeout(300);
  expect(await vision.getAttribute('data-heartbeat-beats')).toBe(reducedBeats);
  expect(await ominousText.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    'none',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.stable-animal')).toBeHidden();
  expect(await normalMusic.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  const visionMusic = page.locator('[data-ginna-music]');
  const visionPlayer = await visionMusic.elementHandle();
  await expect
    .poll(() =>
      visionMusic.evaluate(
        (element: HTMLAudioElement) => !element.paused && element.currentTime > 0,
      ),
    )
    .toBe(true);
  expect(await visionMusic.evaluate((element: HTMLAudioElement) => element.volume)).toBe(
    musicBefore.volume,
  );
  expect(await visionMusic.evaluate((element: HTMLAudioElement) => element.loop)).toBe(true);
  await expect(vision.locator('.ginna-vision-figure')).toHaveAttribute(
    'src',
    '/stable/ginna-shadow.webp',
  );
  await expect(vision.locator('.ginna-earth-eye')).toHaveCount(23);
  await expect(vision.locator('[data-depth="ridge"]')).toHaveCount(0);
  await expect(vision.locator('[data-depth="mountain"]')).toHaveCount(1);
  await assertBalloonAttached('.ginna-vision .ginna-balloon', true);
  await expect
    .poll(() =>
      vision
        .locator('.ginna-earth-eye')
        .last()
        .evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBe(0.9);
  const eyeBoxes = await vision
    .locator('.ginna-earth-eye[data-depth="ground"]')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
  const groundSizes = eyeBoxes.map((box) => box.width);
  expect(Math.max(...groundSizes)).toBeLessThan(155);
  expect(Math.max(...groundSizes) / Math.min(...groundSizes)).toBeGreaterThan(4);
  expect(
    Math.max(...eyeBoxes.map((box) => box.y)) - Math.min(...eyeBoxes.map((box) => box.y)),
  ).toBeGreaterThan(160);
  const mountain = await vision
    .locator('[data-depth="mountain"]')
    .evaluate((element) => element.getBoundingClientRect().toJSON());
  expect(mountain.width).toBeGreaterThan(200);
  expect(mountain.y).toBeLessThan(250);
  expect(mountain.height / mountain.width).toBeGreaterThan(0.95);
  const groundCanvas = vision.locator('.ginna-ground-eyes-canvas');
  await expect(groundCanvas).toHaveAttribute('data-renderer', 'webgl');
  await expect(groundCanvas).toHaveAttribute('data-eye-count', '23');
  await expect(groundCanvas).toHaveAttribute('data-ground-eye-count', '22');
  await expect(groundCanvas).toHaveAttribute('data-mountain-eye-count', '1');
  await expect(vision.locator('[data-depth="mountain"]')).toHaveAttribute('data-renderer', 'webgl');
  await expect.poll(() => groundCanvas.getAttribute('data-frame').then(Number)).toBeGreaterThan(15);
  await expect(groundCanvas).toHaveAttribute('data-emerged', '23');
  expect(await groundCanvas.getAttribute('data-eye-vertices').then(Number)).toBeGreaterThan(1000);
  expect(
    await groundCanvas.evaluate(
      (element: HTMLCanvasElement) => element.width > 0 && element.height > 0,
    ),
  ).toBe(true);
  await expect
    .poll(() => groundCanvas.getAttribute('data-mountain-blink').then(Number), {
      timeout: 8000,
      intervals: [75],
    })
    .toBeGreaterThan(0.7);
  await expect
    .poll(() => groundCanvas.getAttribute('data-mountain-blink').then(Number), { intervals: [75] })
    .toBeLessThan(0.1);
  const shakes = await vision.locator('.ginna-nightmare-scene').evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 100;
    const first = getComputedStyle(element).transform;
    animation.currentTime = 500;
    const second = getComputedStyle(element).transform;
    animation.play();
    return [first, second];
  });
  expect(shakes[0]).not.toBe(shakes[1]);
  await vision.getByRole('button', { name: 'Ajustar volume da música' }).click();
  await vision.getByRole('button', { name: 'Mutar música', exact: true }).click();
  expect(await visionMusic.evaluate((element: HTMLAudioElement) => element.muted)).toBe(true);
  await expect(vision).toHaveAttribute('data-heartbeat-state', 'muted');
  const mutedBeats = await vision.getAttribute('data-heartbeat-beats');
  await page.waitForTimeout(350);
  expect(await vision.getAttribute('data-heartbeat-beats')).toBe(mutedBeats);
  await vision.getByRole('button', { name: 'Ativar música', exact: true }).click();
  await vision.getByRole('button', { name: 'Ajustar volume da música' }).click();
  await page.screenshot({ path: 'test-results/ginna-vision-desktop.png' });
  // It must persist beyond the former automatic timeout, keeping the music.
  await page.waitForTimeout(6100);
  await expect(vision).toBeVisible();
  expect(await visionMusic.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
  await expect(vision.getByRole('button', { name: 'Não vou machucá-los!' })).toHaveCount(0);
  await clickShaking(vision.getByRole('button', { name: 'Conversar com a cuidadora na visão' }));
  const promise = vision.getByRole('button', { name: 'Não vou machucá-los!', exact: true });
  await expect(promise).toBeVisible();
  await assertBalloonAttached('.ginna-vision .ginna-balloon', true);
  await promise.press('Escape');
  await expect(vision).toBeVisible();
  await clickShaking(promise);
  const recovery = page.locator('.ginna-return');
  const breath = page.locator('[data-ginna-breathing]');
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute('data-motion', 'full');
  await expect(recovery).toHaveAttribute('data-phase', 'reaching');
  await expect(vision.locator('.ginna-balloon-copy')).toHaveText(
    'Melhor assim. Estarei de olho em você.',
  );
  await expect(promise).toHaveCount(0);
  expect(await recovery.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  expect(
    await recovery.evaluate((element) => getComputedStyle(element, '::backdrop').backdropFilter),
  ).toBe('none');
  await expect(recovery.locator('.ginna-return-tentacles')).toHaveAttribute('data-stage', 'sky');
  await expect(recovery.locator('.ginna-return-tentacles')).toHaveAttribute('data-origin', 'lake');
  await expect(recovery.locator('.ginna-return-tentacles')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  await expect
    .poll(() =>
      recovery.locator('.ginna-return-tentacles').getAttribute('data-far-progress').then(Number),
    )
    .toBeGreaterThan(0.6);
  expect(
    Number(await recovery.locator('.ginna-return-tentacles').getAttribute('data-water-ripples')),
  ).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/ginna-tentacle-sky.png' });
  await expect(recovery.locator('.ginna-return-tentacles')).toHaveAttribute(
    'data-stage',
    'descending',
  );
  await page.screenshot({ path: 'test-results/ginna-tentacle-descending.png' });
  await expect(recovery.locator('.ginna-return-tentacles')).toHaveAttribute(
    'data-stage',
    'wrapping',
  );
  await expect
    .poll(() =>
      recovery.locator('.ginna-return-tentacles').getAttribute('data-progress').then(Number),
    )
    .toBeGreaterThan(0.85);
  await expect(vision).toBeVisible();
  await page.screenshot({ path: 'test-results/ginna-tentacle-wrapping.png' });
  await page.waitForFunction(
    () => document.querySelector('.ginna-return')?.getAttribute('data-phase') === 'closed',
  );
  const closedFrame = await page.screenshot({ path: 'test-results/ginna-return-closed.png' });
  const closedColors = await sharp(closedFrame).removeAlpha().stats();
  expect(closedColors.channels.every((channel) => channel.max < 2)).toBe(true);
  await expect
    .poll(() =>
      breath.evaluate(
        (element: HTMLAudioElement) =>
          !element.paused &&
          element.currentTime > 0 &&
          element.duration > 4 &&
          element.duration < 5,
      ),
    )
    .toBe(true);
  expect(await breath.evaluate((element: HTMLAudioElement) => element.loop)).toBe(false);
  expect(await breath.evaluate((element: HTMLAudioElement) => element.volume)).toBe(
    Math.min(1, musicBefore.volume * 1.25),
  );
  await expect(vision).toHaveCount(0);
  expect(await visionPlayer!.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await expect(recovery).toHaveCount(0);
  await page.screenshot({ path: 'test-results/ginna-return-day.png' });
  expect(await breath.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
  await expect(page.locator('.stable-animal-base')).toHaveAttribute('src', normalImage!);
  await expect(keeper).toBeFocused();
  await expect(keeper.locator('img')).toHaveAttribute('src', '/stable/ginna.webp');
  await expect
    .poll(() => normalMusic.evaluate((element: HTMLAudioElement) => element.paused))
    .toBe(false);
  expect(await normalMusic.getAttribute('src')).toBe(musicBefore.src);
  expect(
    await normalMusic.evaluate((element: HTMLAudioElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(musicBefore.time);
  // Reduced motion keeps the persistent scene, without shaking, drifting or blinking.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await keeper.click();
  await assertBalloonAttached('.stable-field > .ginna-balloon');
  const mobileBalloon = (await conversation.boundingBox())!;
  expect(mobileBalloon.x).toBeGreaterThanOrEqual(0);
  expect(mobileBalloon.x + mobileBalloon.width).toBeLessThanOrEqual(390);
  const normalMobileTextFontSize = await normalBalloon
    .locator('.ginna-balloon-copy')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  await page.screenshot({ path: 'test-results/ginna-balloon-mobile.png' });
  for (let warning = 0; warning < 5; warning++) await askQuestion('warning');
  await expect(vision).toBeVisible();
  await expect(groundCanvas).toHaveAttribute('data-motion', 'static');
  await expect(groundCanvas).toHaveAttribute('data-emerged', '23');
  await expect(groundCanvas).toHaveAttribute('data-mountain-blink', '0.000');
  await expect(vision).toHaveAttribute('data-heartbeat-state', 'reduced');
  expect(
    await vision
      .locator('.ginna-nightmare-scene')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await vision.getByRole('button', { name: 'Conversar com a cuidadora na visão' }).click();
  await assertBalloonAttached('.ginna-vision .ginna-balloon', true);
  const darkMobileBalloon = (await vision.locator('.ginna-balloon').boundingBox())!;
  expect(darkMobileBalloon.x).toBeGreaterThanOrEqual(6);
  expect(darkMobileBalloon.x + darkMobileBalloon.width).toBeLessThanOrEqual(390);
  expect(
    await ominousText.evaluate((element) => getComputedStyle(element).textDecorationLine),
  ).toBe('none');
  expect(
    await ominousText.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThan(normalMobileTextFontSize);
  await page.screenshot({ path: 'test-results/ginna-vision-mobile.png' });
  await vision.getByRole('button', { name: 'Ajustar volume da música' }).click();
  await vision.getByRole('button', { name: 'Mutar música', exact: true }).click();
  await promise.click();
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute('data-motion', 'reduced');
  expect(await breath.evaluate((element: HTMLAudioElement) => element.muted)).toBe(true);
  await expect(vision).toHaveCount(0);
  await expect(recovery).toHaveCount(0);
  await expect(page.locator('.stable-animal')).toBeVisible();
  await expect(keeper).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Ver Pônei', exact: true }).click();
  await page.getByRole('button', { name: 'Pampa', exact: true }).click();
  await expect(page.locator('.stable-animal-base')).toHaveAttribute(
    'src',
    '/stable/pony-alternate.png',
  );
  await page.getByRole('button', { name: 'Experimentar Barda de placas' }).click();
  await expect(page.locator('.stable-field > .ginna-balloon')).toContainText('fortaleza');
  await expect(page.locator('.stable-field > .ginna-balloon')).not.toContainText('CA 18');
  await page.getByRole('button', { name: 'Ver detalhes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Barda selecionada' })).toContainText(
    'Barda de placas',
  );
  await expect(page.getByRole('region', { name: 'Barda selecionada' })).toContainText('CA 18');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Experimentar Sela de montaria' }).click();
  await expect(page.locator('.stable-field > .ginna-balloon')).toContainText('primeira taverna');
  await page.getByRole('button', { name: 'Ver detalhes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Sela selecionada' })).toContainText(
    'Sela de montaria',
  );
  await expect(page.getByRole('region', { name: 'Sela selecionada' })).toContainText(
    'Inclui freio',
  );
  await expect(page.getByRole('region', { name: 'Barda selecionada' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Experimentar Ração · 1 dia' }).click();
  await page.getByLabel('Como vai se chamar?').fill('Pé de Pano');
  await expect(page.locator('.stable-field > .ginna-balloon')).toContainText('Pé de Pano');
  await expect(page.locator('.stable-field > .ginna-balloon .npc-speaker')).toHaveText('Ginna');
  expect(
    await page
      .locator('.stable-field > .ginna-balloon p')
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain('NPC Inter');
  await page.getByRole('button', { name: 'Comprar conjunto', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    (await (await page.request.get(origin + '/api/stable/' + hero.id)).json()).some(
      (m: { name: string; coat: string }) => m.name === 'Pé de Pano' && m.coat === 'alternate',
    ),
  ).toBe(true);
  await page.reload();
  expect(
    (await (await page.request.get(origin + '/api/stable/' + hero.id)).json()).some(
      (m: { name: string; coat: string }) => m.name === 'Pé de Pano' && m.coat === 'alternate',
    ),
  ).toBe(true);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(95195);
  expect(
    (
      await pool.query(
        "SELECT equipment,equipment_price_cp FROM character_mounts WHERE character_id=$1 AND name='Pé de Pano'",
        [hero.id],
      )
    ).rows[0],
  ).toEqual({ equipment: ['feed', 'saddle-riding'], equipment_price_cp: 1005 });
  expect(
    (await pool.query('SELECT * FROM character_mounts WHERE character_id=$1', [hero.id])).rowCount,
  ).toBe(2);
  await mkdir('test-results', { recursive: true });
  expect(
    await page.locator('.stable-background').evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain('paddock-camp-v2.webp');
  await expect.poll(() => page.locator('.stable-hoof-contact').count()).toBeGreaterThan(1);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByLabel('Como vai se chamar?').fill('Sir Cenoura da Estrada Longa');
    await expect(page.locator('.stable-field > .ginna-balloon')).toContainText('Sir Cenoura');
    await page.getByRole('button', { name: 'Ver detalhes' }).click();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const nameBox = (await page.locator('.stable-name').boundingBox())!;
    const choicesBox = (await page.locator('.stable-choices').boundingBox())!;
    const shopBox = (await page.locator('.stable-tack-shop').boundingBox())!;
    const checkoutBox = (await page.locator('.stable-order').boundingBox())!;
    expect(nameBox.y + nameBox.height).toBeLessThanOrEqual(choicesBox.y + 1);
    expect(checkoutBox.y).toBeGreaterThanOrEqual(shopBox.y + shopBox.height - 1);
    if (viewport.width <= 600) {
      const speechBox = (await page.locator('.stable-field > .ginna-balloon').boundingBox())!;
      expect(speechBox.y).toBeGreaterThanOrEqual(checkoutBox.y + checkoutBox.height);
    }
    const keeper = (await page.locator('.stable-keeper-trigger img').boundingBox())!;
    await assertBalloonAttached('.stable-field > .ginna-balloon');
    expect(keeper.height).toBeGreaterThan(80);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
    ).toBe(true);
    expect(keeper.y + keeper.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator('.stable-choices .stable-inspect')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver detalhes', exact: true })).toBeVisible();
    await expect(page.locator('.stable-choices .stable-coats')).toBeVisible();
    const animal = (await page.locator('.stable-animal-base').boundingBox())!;
    expect(animal.x).toBeGreaterThanOrEqual(0);
    expect(animal.x + animal.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await page
        .locator('.stable-field > .ginna-balloon')
        .evaluate(
          (el) =>
            el.querySelector('p')!.getBoundingClientRect().bottom <=
            el.getBoundingClientRect().bottom,
        ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/stable-${viewport.width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const animal of ['Cavalo de montaria', 'Cavalo de guerra', 'Pônei', 'Mula']) {
    await page.getByRole('button', { name: `Ver ${animal}`, exact: true }).click();
    for (const item of [
      'Sela de montaria',
      'Sela militar',
      'Barda de couro',
      'Barda de cota de malha',
      'Barda de placas',
      'Ração · 1 dia',
    ]) {
      await page.getByRole('button', { name: `Experimentar ${item}`, exact: true }).click();
      const art = item.startsWith('Ração')
        ? page.locator('.stable-feed')
        : page.locator('.stable-animal-base');
      await expect(art).toBeVisible();
      if (item.startsWith('Barda')) {
        await expect(art).toHaveAttribute('src', /\/stable\/barded\//);
        await expect(page.locator('.stable-equipped-armor')).toHaveCount(0);
      }
      await expect
        .poll(() => art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      if (!item.startsWith('Ração'))
        await expect.poll(() => page.locator('.stable-hoof-contact').count()).toBeGreaterThan(1);
      await page.screenshot({
        path: `test-results/tack-${animal}-${item.replaceAll(' · ', '-')}.png`,
      });
      await page.getByRole('button', { name: `Experimentar ${item}`, exact: true }).click();
    }
  }
  for (const animal of ['Cavalo de montaria', 'Cavalo de guerra', 'Pônei', 'Mula']) {
    await page.getByRole('button', { name: `Ver ${animal}`, exact: true }).click();
    await page.locator('.stable-coats button').nth(1).click();
    await page.getByRole('button', { name: 'Experimentar Barda de couro', exact: true }).click();
    await page.getByRole('button', { name: 'Experimentar Sela militar', exact: true }).click();
    await expect(page.locator('.stable-equipped')).toHaveCount(0);
    await expect(page.locator('.stable-animal-base')).toHaveAttribute(
      'src',
      new RegExp('saddled/.+-alternate-military.png'),
    );
    await expect(
      page.getByRole('button', { name: 'Experimentar Barda de couro', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Experimentar Barda de couro', exact: true }).click();
    await expect(page.locator('.stable-animal-base')).toHaveAttribute(
      'src',
      new RegExp('barded/.+-alternate-leather.png'),
    );
    await expect(
      page.getByRole('button', { name: 'Experimentar Sela militar', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Experimentar Barda de couro', exact: true }).click();
  }
  for (const [animal, id] of [
    ['Cavalo de montaria', 'riding-horse'],
    ['Cavalo de guerra', 'warhorse'],
    ['Pônei', 'pony'],
    ['Mula', 'mule'],
  ]) {
    await page.getByRole('button', { name: `Ver ${animal}`, exact: true }).click();
    for (const [coatIndex, coat] of [
      [0, 'original'],
      [1, 'alternate'],
    ] as const) {
      await page.locator('.stable-coats button').nth(coatIndex).click();
      for (const [label, key] of [
        ['Barda de couro', 'leather'],
        ['Barda de cota de malha', 'chain'],
        ['Barda de placas', 'plate'],
      ]) {
        await page.getByRole('button', { name: `Experimentar ${label}`, exact: true }).click();
        await expect(page.locator('.stable-animal-base')).toHaveAttribute(
          'src',
          `/stable/barded/${id}-${coat}-${key}.png`,
        );
        await expect
          .poll(() =>
            page
              .locator('.stable-animal-base')
              .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
          )
          .toBe(true);
        await page.screenshot({ path: `test-results/barded-${id}-${coat}-${key}.png` });
        await page.getByRole('button', { name: `Experimentar ${label}`, exact: true }).click();
      }
      for (const [label, key] of [
        ['Sela de montaria', 'riding'],
        ['Sela militar', 'military'],
      ]) {
        await page.getByRole('button', { name: `Experimentar ${label}`, exact: true }).click();
        await expect(page.locator('.stable-animal-base')).toHaveAttribute(
          'src',
          `/stable/saddled/${id}-${coat}-${key}.png`,
        );
        await expect
          .poll(() =>
            page
              .locator('.stable-animal-base')
              .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
          )
          .toBe(true);
        await expect(page.locator('.stable-equipped-saddle')).toHaveCount(0);
        await page.screenshot({ path: `test-results/saddled-${id}-${coat}-${key}.png` });
        await page.getByRole('button', { name: `Experimentar ${label}`, exact: true }).click();
      }
    }
  }
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await page.getByRole('button', { name: 'Loja', exact: true }).click();
  await page.getByRole('button', { name: 'Empório', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Catálogo da loja' })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Estábulo: ownership, preços, idempotência concorrente, saldo, nomes, persistência, quatro artes e seis viewports OK.',
  );
} catch (e) {
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/stable-failure.png' });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
