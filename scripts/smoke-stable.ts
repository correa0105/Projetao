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
  const keeper = page.getByRole('button', { name: 'Conversar com Ginna', exact: true });
  await expect(keeper.locator('img')).toHaveAttribute('src', '/stable/ginna.webp');
  await keeper.focus();
  await keeper.press('Enter');
  const conversation = page.getByRole('dialog', { name: 'Conversar com Ginna', exact: true });
  await expect(conversation).toBeVisible();
  await expect(conversation.locator('[role="status"]')).toContainText('Pode me chamar de Ginna');
  await expect(conversation.locator('.ginna-questions button')).toHaveCount(3);
  await conversation.getByRole('button', { name: 'Como você conseguiu esses animais?' }).click();
  await expect(conversation.locator('[role="status"]')).toContainText('Os animais vêm até mim');
  for (let warning = 0; warning < 4; warning++) {
    await conversation.locator('[data-ginna-question="warning"]').click();
    await expect(page.locator('.ginna-vision')).toHaveCount(0);
  }
  await expect(conversation.locator('[role="status"]')).toContainText('Esta é a última vez');
  await page.screenshot({ path: 'test-results/ginna-conversation.png' });
  // Closing the dialogue does not erase the warnings on this visit.
  await conversation.getByRole('button', { name: 'Fechar', exact: true }).click();
  await keeper.click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const normalImage = await page.locator('.stable-animal-base').getAttribute('src');
  const normalMusic = page.locator('[data-site-music]');
  const musicBefore = await normalMusic.evaluate((element: HTMLAudioElement) => ({
    src: element.getAttribute('src'),
    time: element.currentTime,
    volume: element.volume,
  }));
  await conversation.locator('[data-ginna-question="warning"]').click();
  const vision = page.locator('.ginna-vision');
  await expect(vision).toBeVisible();
  await expect(vision).toContainText('Pague para ver o que acontece');
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
  await expect(vision.locator('.ginna-vision-figure')).toHaveAttribute(
    'src',
    '/stable/ginna-shadow.webp',
  );
  await expect(vision.locator('.ginna-earth-eye')).toHaveCount(5);
  await expect
    .poll(() =>
      vision
        .locator('.ginna-earth-eye')
        .last()
        .evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBe(1);
  const blinkingEye = vision.locator('.ginna-eye-blink').first();
  await blinkingEye.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    const timing = animation.effect!.getTiming();
    animation.currentTime = (timing.delay || 0) + Number(timing.duration) * 0.47;
  });
  expect(
    await blinkingEye.evaluate((element) => getComputedStyle(element).backgroundPosition),
  ).toBe('50% 100%');
  await blinkingEye.evaluate((element) => {
    const animation = element.getAnimations()[0];
    const timing = animation.effect!.getTiming();
    animation.currentTime = (timing.delay || 0) + Number(timing.duration) * 0.53;
  });
  expect(
    await blinkingEye.evaluate((element) => getComputedStyle(element).backgroundPosition),
  ).toBe('50% 0%');
  await vision.locator('.ginna-vision-shutter').evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 1500;
  });
  await page.screenshot({ path: 'test-results/ginna-vision-desktop.png' });
  await expect(vision).toHaveCount(0, { timeout: 6500 });
  expect(await visionPlayer!.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await expect(page.locator('.stable-animal-base')).toHaveAttribute('src', normalImage!);
  await expect(keeper).toBeFocused();
  await expect
    .poll(() => normalMusic.evaluate((element: HTMLAudioElement) => element.paused))
    .toBe(false);
  expect(await normalMusic.getAttribute('src')).toBe(musicBefore.src);
  expect(
    await normalMusic.evaluate((element: HTMLAudioElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(musicBefore.time);
  // Reduced motion keeps the story and quick return, with static eyes/fog.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await keeper.click();
  for (let warning = 0; warning < 5; warning++)
    await conversation.locator('[data-ginna-question="warning"]').click();
  await expect(vision).toBeVisible();
  expect(await blinkingEye.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    'none',
  );
  await page.screenshot({ path: 'test-results/ginna-vision-mobile.png' });
  await vision.getByRole('button', { name: 'Voltar ao estábulo' }).click();
  await expect(vision).toHaveCount(0);
  await expect(page.locator('.stable-animal')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Ver Pônei', exact: true }).click();
  await page.getByRole('button', { name: 'Pampa', exact: true }).click();
  await expect(page.locator('.stable-animal-base')).toHaveAttribute(
    'src',
    '/stable/pony-alternate.png',
  );
  await page.getByRole('button', { name: 'Experimentar Barda de placas' }).click();
  await expect(page.locator('.stable-speech')).toContainText('fortaleza');
  await expect(page.locator('.stable-speech')).not.toContainText('CA 18');
  await page.getByRole('button', { name: 'Ver detalhes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Barda selecionada' })).toContainText(
    'Barda de placas',
  );
  await expect(page.getByRole('region', { name: 'Barda selecionada' })).toContainText('CA 18');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Experimentar Sela de montaria' }).click();
  await expect(page.locator('.stable-speech')).toContainText('primeira taverna');
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
  await expect(page.locator('.stable-speech')).toContainText('Pé de Pano');
  await expect(page.locator('.stable-speech .npc-speaker')).toHaveText('Ginna');
  expect(
    await page.locator('.stable-speech p').evaluate((el) => getComputedStyle(el).fontFamily),
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
    await expect(page.locator('.stable-speech')).toContainText('Sir Cenoura');
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
      const speechBox = (await page.locator('.stable-speech').boundingBox())!;
      expect(speechBox.y).toBeGreaterThanOrEqual(checkoutBox.y + checkoutBox.height);
    }
    const keeper = (await page.locator('.stable-keeper-trigger img').boundingBox())!;
    if (viewport.width <= 600) {
      const speechBox = (await page.locator('.stable-speech').boundingBox())!;
      expect(speechBox.y + speechBox.height + 20).toBeLessThanOrEqual(keeper.y + 1);
    }
    expect(keeper.height).toBeGreaterThan(110);
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
        .locator('.stable-speech')
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
