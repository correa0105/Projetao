import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3008';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3008, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ownerContext = await browser.newContext({ reducedMotion: 'reduce' });
const visitorContext = await browser.newContext({ reducedMotion: 'reduce' });
const ownerPage = await ownerContext.newPage();
const page = await visitorContext.newPage();
const errors: string[] = [];
for (const tab of [ownerPage, page]) tab.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  async function signup(context: typeof ownerContext, name: string) {
    const response = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: { name, email: `camp-${randomUUID()}@example.test`, password: `Test-${randomUUID()}` },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()).user;
  }
  const owner = await signup(ownerContext, 'Viajante da Alvorada');
  await signup(visitorContext, 'Visitante');
  const a = await createLegacyTestCharacter(owner.id, 'Nana');
  const b = await createLegacyTestCharacter(owner.id, 'Irineu');
  const png = await sharp(await readFile('public/shop/merchant-v2.png'))
    .resize({ height: 900 })
    .png()
    .toBuffer();
  for (const [ch, race, mount, mountName, pet, petName] of [
    [a, 'Gnomo', 'pony', 'Pé de Pano', 'dog', 'Brasa'],
    [b, 'Humano', 'warhorse', 'Trovão', 'cat', 'Nuvem'],
  ] as const) {
    await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
      ch.id,
      png,
    ]);
    await pool.query(
      'UPDATE characters SET race=$2,portrait_revision=1,gold_cp=100000 WHERE id=$1',
      [ch.id, race],
    );
    await pool.query(
      'INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,displayed) VALUES($1,$2,$3,1000,$4,true)',
      [ch.id, mount, mountName, randomUUID()],
    );
    const r = await ownerContext.request.post(origin + '/api/pets/purchase', {
      headers: { Origin: origin },
      data: {
        character_id: ch.id,
        pet_id: pet,
        name: petName,
        appearance: 'original',
        idempotency_key: randomUUID(),
      },
    });
    expect(r.status()).toBe(201);
  }
  const snapshot = async () => {
    const rows: Record<string, unknown> = {};
    for (const table of [
      'characters',
      'character_portraits',
      'character_mounts',
      'character_pets',
      'inventory',
    ])
      rows[table] = (
        await pool.query(
          `SELECT count(*)::int AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY md5(to_jsonb(t)::text)),'')) AS hash FROM ${table} t`,
        )
      ).rows[0];
    return rows;
  };
  await page.route('**/api/profiles/' + owner.id, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  const before = await snapshot();
  const comparisons = [];
  async function settle(tab: typeof page) {
    await tab.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.querySelectorAll('img')].map((image) => image.decode().catch(() => {})),
      );
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
  }
  async function geometry(tab: typeof page, publicCamp: boolean) {
    return tab.evaluate((publicCamp) => {
      const camp = document.querySelector(publicCamp ? '.public-camp' : '.character-camp')!;
      const surface = publicCamp ? camp : camp.closest('.main-shell')!;
      const figure = camp.querySelector('.camp-figure')!;
      const f = figure.getBoundingClientRect();
      const mount = camp.querySelector('.camp-mount img')!.getBoundingClientRect();
      const pet = camp.querySelector('.camp-pet .pet-art')!.getBoundingClientRect();
      const bounds = camp.getBoundingClientRect();
      const styles = getComputedStyle(surface);
      return {
        debug: {
          camp: getComputedStyle(camp).cssText,
          padding: getComputedStyle(camp).padding,
          gap: getComputedStyle(camp).gap,
          stageTop: camp.querySelector('.camp-stage')!.getBoundingClientRect().top,
          spacer: camp.querySelector('.page-header-spacer')!.getBoundingClientRect().height,
          caption: camp.querySelector('.camp-capacity-row')!.getBoundingClientRect().height,
          info: camp.querySelector('.camp-character-info')!.getBoundingClientRect().height,
          mountTransform: getComputedStyle(camp.querySelector('.camp-mount')!).transform,
        },
        floor: f.bottom,
        figure: { x: f.x, width: f.width, height: f.height },
        backgroundSize: styles
          .getPropertyValue('--camp-background-size')
          .trim()
          .split(' ')
          .map(parseFloat),
        backgroundY: parseFloat(styles.getPropertyValue('--camp-background-y')),
        mount: { x: mount.x, bottom: mount.bottom, height: mount.height },
        pet: { x: pet.x, bottom: pet.bottom, width: pet.width },
        contained: [mount, pet].every(
          (r) =>
            r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.bottom <= bounds.bottom,
        ),
      };
    }, publicCamp);
  }
  for (const [width, height] of [
    [1880, 812],
    [1440, 900],
    [768, 900],
    [390, 844],
    [320, 700],
  ]) {
    await ownerPage.setViewportSize({ width, height });
    await page.setViewportSize({ width, height });
    await ownerPage.goto(origin + '/#characters');
    await ownerPage.getByRole('button', { name: 'Selecionar Nana', exact: true }).click();
    await expect(ownerPage.locator('.camp-mount')).toContainText('Pé de Pano');
    await expect(ownerPage.locator('.camp-pet')).toContainText('Brasa');
    await page.goto(origin + '/#profiles?user=' + owner.id + '&character=' + a.id);
    await expect(page.locator('.public-camp-mount')).toContainText('Pé de Pano');
    await expect(page.locator('.public-camp-pet')).toContainText('Brasa');
    await settle(ownerPage);
    await settle(page);
    const reference = await geometry(ownerPage, false),
      visit = await geometry(page, true);
    comparisons.push({ width, height, reference, visit });
    await writeFile(
      'test-results/profile-visit-comparison.json',
      JSON.stringify(comparisons, null, 2),
    );
    expect(Math.abs(visit.floor - reference.floor), 'Mesmo chão dos personagens').toBeLessThan(38);
    expect(
      Math.abs(visit.figure.width - reference.figure.width),
      'Mesma largura de personagem',
    ).toBeLessThan(2);
    expect(Math.abs(visit.figure.x - reference.figure.x), 'Mesma posição horizontal').toBeLessThan(
      2,
    );
    expect(
      Math.abs(visit.mount.height - reference.mount.height),
      'Mesma escala de montaria',
    ).toBeLessThan(3);
    expect(
      Math.abs(visit.pet.width - reference.pet.width),
      'Mesmo tamanho de mascote',
    ).toBeLessThan(2);
    expect(Math.abs(visit.mount.bottom - reference.mount.bottom)).toBeLessThan(38);
    expect(Math.abs(visit.pet.bottom - reference.pet.bottom)).toBeLessThan(38);
    expect(Math.abs(visit.backgroundSize[0] - reference.backgroundSize[0])).toBeLessThan(100);
    expect(visit.contained).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const selector = await page
      .getByRole('combobox', { name: 'Personagem do perfil visitado' })
      .boundingBox();
    expect(selector!.y).toBeLessThan(70);
    expect(selector!.x).toBeGreaterThan(width / 2);
    await expect(page.locator('.profile-signboard')).toHaveCount(5);
    await expect(page.locator('.profile-visit-nav')).not.toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await page.screenshot({ path: `test-results/profile-visit-${width}.png` });
    await ownerPage.screenshot({ path: `test-results/profile-standard-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.locator('.profile-visit-nav');
  const sheet = nav.getByRole('button', { name: 'Ficha', exact: true });
  await page.mouse.move(20, 20);
  const normal = await sheet.evaluate((el) => getComputedStyle(el).filter);
  await sheet.hover();
  const hover = await sheet.evaluate((el) => getComputedStyle(el).filter);
  expect(hover).not.toBe(normal);
  expect(hover).toContain('brightness');
  await page.screenshot({ path: 'test-results/profile-visit-signpost-hover.png' });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const railBounds = (await nav.boundingBox())!;
    for (const [name, selector] of [
      ['Conquistas', '.public-achievements'],
      ['Ficha', '.public-sheet'],
      ['Cartas', '.public-cards'],
      ['Hall da Fama', '.public-profile-panel:has(.hall-of-fame)'],
      ['Personagens', '.public-camp'],
    ]) {
      const button = nav.getByRole('button', { name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator(selector)).toHaveAttribute('aria-hidden', 'false');
      const bounds = (await nav.boundingBox())!;
      expect(bounds.x).toBeCloseTo(railBounds.x, 0);
      expect(bounds.y).toBeCloseTo(railBounds.y, 0);
      expect(bounds.height).toBeCloseTo(railBounds.height, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (name !== 'Personagens') {
        const heading = await page.locator(selector).locator('h2').first().boundingBox();
        if (heading) expect(heading.y).toBeGreaterThan(bounds.y + bounds.height);
      }
      await page.screenshot({
        path: 'test-results/profile-rail-' + width + '-' + name.replaceAll(' ', '-') + '.png',
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('combobox', { name: 'Personagem do perfil visitado' }).selectOption(b.id);
  await expect(page.locator('.public-camp-pet')).toContainText('Nuvem');
  await expect(page.locator('.public-camp-mount')).toContainText('Trovão');
  await expect(page.getByRole('button', { name: 'Selecionar Irineu no perfil' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await nav.getByRole('button', { name: 'Ficha', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.public-sheet h2')).toHaveText('Ficha de Irineu');
  await page.getByRole('combobox', { name: 'Personagem do perfil visitado' }).selectOption(a.id);
  await expect(page.locator('.public-sheet h2')).toHaveText('Ficha de Nana');
  const details = await visitorContext.request.get(
    origin + `/api/profiles/${owner.id}/characters/${a.id}`,
  );
  expect(details.status()).toBe(200);
  const character = (await details.json()).character;
  expect(character).not.toHaveProperty('gold_cp');
  expect(character).not.toHaveProperty('email');
  expect(await snapshot()).toEqual(before);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/profile-visit-comparison.json',
    JSON.stringify(comparisons, null, 2),
  );
  console.log(
    'Visita e acampamento padrão comparados em cinco telas; placas, contorno, cinco abas, teclado, seletor e dados preservados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/profile-visit-failure.png', fullPage: true });
  await ownerPage.screenshot({ path: 'test-results/profile-standard-failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
