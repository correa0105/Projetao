import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { petArtwork } from '../shared/pet-art';
import { reviewRealmPages } from './review-realm-pages';

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
const missingStatic = new Set<string>();
for (const tab of [ownerPage, page]) tab.on('pageerror', (e) => errors.push(e.message));
for (const tab of [ownerPage, page])
  tab.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      !pathname.startsWith('/api/') &&
      /\.(png|webp|jpg|svg|woff2?|ttf|wav)$/.test(pathname) &&
      (response.status() >= 400 || response.headers()['content-type']?.includes('text/html'))
    )
      missingStatic.add(pathname);
  });
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
  const mediaRoot = process.env.PROFILE_MEDIA_ROOT || 'public';
  const animals = (
    await pool.query(
      "SELECT id,character_id,'pet' AS kind,pet_id AS species FROM character_pets WHERE character_id=ANY($1::uuid[]) UNION ALL SELECT id,character_id,'mount' AS kind,mount_id AS species FROM character_mounts WHERE character_id=ANY($1::uuid[])",
      [[a.id, b.id]],
    )
  ).rows;
  for (const animal of animals) {
    const source = animal.kind === 'pet' ? petArtwork(animal.species) : null;
    const artwork = source
      ? await sharp(await readFile(mediaRoot + source.source))
          .extract({
            left: source.frame[0],
            top: source.frame[1],
            width: source.frame[2],
            height: source.frame[3],
          })
          .png()
          .toBuffer()
      : await readFile(mediaRoot + '/stable/' + animal.species + '.png');
    await pool.query(
      'INSERT INTO companion_wardrobes(id,character_id,kind,mount_id,pet_id,image_revision) VALUES($1,$2,$3,$4,$5,1)',
      [
        animal.id,
        animal.character_id,
        animal.kind,
        animal.kind === 'mount' ? animal.id : null,
        animal.kind === 'pet' ? animal.id : null,
      ],
    );
    await pool.query(
      'INSERT INTO companion_artworks(wardrobe_id,equipment_revision,image) VALUES($1,0,$2)',
      [animal.id, artwork],
    );
    const response = await visitorContext.request.get(
      origin + `/api/profiles/${owner.id}/characters/${animal.character_id}`,
    );
    const details = await response.json(),
      row = details[animal.kind === 'pet' ? 'pets' : 'mounts'].find((x: any) => x.id === animal.id);
    expect(row.image_url).toContain(
      '/profiles/' + owner.id + '/characters/' + animal.character_id + '/companions/',
    );
    expect(row.image_url).toContain('v=1');
    const image = await visitorContext.request.get(origin + row.image_url);
    expect(image.status()).toBe(200);
    expect(image.headers()['cache-control']).toContain('no-store');
    expect(
      createHash('sha256')
        .update(await image.body())
        .digest('hex'),
    ).toBe(createHash('sha256').update(artwork).digest('hex'));
    expect(
      (
        await visitorContext.request.get(
          origin + `/api/companions/${animal.character_id}/${animal.kind}/${animal.id}/image`,
        )
      ).status(),
    ).toBe(404);
  }
  const petImage = animals.find((x: any) => x.kind === 'pet' && x.character_id === a.id);
  const publicImagePath = `/api/profiles/${owner.id}/characters/${a.id}/companions/pet/${petImage.id}/image`;
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(origin + publicImagePath)).status()).toBe(401);
  await anonymous.close();
  expect(
    (await visitorContext.request.get(origin + publicImagePath.replace(a.id, b.id))).status(),
  ).toBe(404);
  await pool.query('UPDATE character_pets SET displayed=false WHERE id=$1', [petImage.id]);
  expect((await visitorContext.request.get(origin + publicImagePath)).status()).toBe(404);
  await pool.query('UPDATE character_pets SET displayed=true WHERE id=$1', [petImage.id]);
  const visitor = await visitorContext.request.get(origin + '/api/auth/get-session');
  const viewerId = (await visitor.json()).user.id;
  await pool.query('INSERT INTO social_blocks(blocker_id,blocked_id) VALUES($1,$2)', [
    owner.id,
    viewerId,
  ]);
  expect((await visitorContext.request.get(origin + publicImagePath)).status()).toBe(404);
  await pool.query('DELETE FROM social_blocks WHERE blocker_id=$1 AND blocked_id=$2', [
    owner.id,
    viewerId,
  ]);
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
    expect(selector!.y).toBeLessThan(width > 1320 ? 70 : 190);
    expect(selector!.x).toBeGreaterThan(width / 2);
    await expect(page.locator('.profile-tab')).toHaveCount(5);
    expect(
      await page
        .locator('.profile-tab')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain('linear-gradient');
    await expect(page.locator('.profile-visit-nav')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    const rail = (await page.locator('.profile-visit-nav').boundingBox())!;
    expect(Math.abs(rail.x + rail.width / 2 - width / 2)).toBeLessThan(1);
    expect(rail.y).toBeLessThan(25);
    for (const tab of await page.locator('.profile-tab').all()) {
      const button = (await tab.boundingBox())!;
      expect(button.x).toBeGreaterThanOrEqual(0);
      expect(button.x + button.width).toBeLessThanOrEqual(width);
      expect(button.height).toBeGreaterThanOrEqual(42);
    }
    await page.screenshot({ path: `test-results/profile-visit-${width}.png` });
    await ownerPage.screenshot({ path: `test-results/profile-standard-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.locator('.profile-visit-nav');
  const sheet = nav.getByRole('tab', { name: 'Ficha', exact: true });
  await page.mouse.move(20, 20);
  const normal = await sheet.evaluate((el) => getComputedStyle(el).color);
  await sheet.hover();
  const hover = await sheet.evaluate((el) => getComputedStyle(el).color);
  expect(hover).not.toBe(normal);
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
      const button = nav.getByRole('tab', { name, exact: true });
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
        if (heading) {
          expect(heading.x).toBeLessThan(width / 2);
          expect(heading.y).toBeLessThan(width > 1320 ? 80 : 190);
          expect(
            heading.x + heading.width <= bounds.x || heading.y >= bounds.y + bounds.height,
            JSON.stringify({ width, name, heading, bounds }),
          ).toBe(true);
          expect(
            await page
              .locator(selector)
              .locator('h2')
              .first()
              .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
          ).toBeLessThanOrEqual(26);
        }
      }
      const panelBounds = (await page.locator(selector).boundingBox())!;
      const actionsBounds = (await page.locator('.profiles-top').boundingBox())!;
      expect(actionsBounds.y).toBeGreaterThanOrEqual(panelBounds.y + panelBounds.height);
      if (name === 'Conquistas') {
        const room = (await page.locator('.public-cabinet-stage').boundingBox())!;
        const cabinet = (await page
          .locator('.public-cabinet-stage .fantasy-cabinet')
          .boundingBox())!;
        expect(
          Math.abs(cabinet.y + cabinet.height * 0.95 - (room.y + room.width * 0.425)),
        ).toBeLessThan(2);
        expect(
          await page
            .locator('.public-cabinet-stage')
            .evaluate((el) => getComputedStyle(el).backgroundPosition),
        ).toBe('50% 0%');
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
  await nav.getByRole('tab', { name: 'Ficha', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.public-sheet h2')).toHaveText('Ficha de Irineu');
  await page.getByRole('combobox', { name: 'Personagem do perfil visitado' }).selectOption(a.id);
  await nav.getByRole('tab', { name: 'Personagens', exact: true }).click();
  await expect(page.locator('.public-camp-pet img')).toHaveAttribute('src', /v=1/);
  await pool.query('UPDATE companion_wardrobes SET image_revision=2 WHERE id=$1', [petImage.id]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.public-camp-pet img')).toHaveAttribute('src', /v=2/);
  await expect
    .poll(() =>
      page
        .locator('.public-camp-pet img')
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
  await nav.getByRole('tab', { name: 'Personagens', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(nav.getByRole('tab', { name: 'Cartas', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(nav.getByRole('tab', { name: 'Personagens', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(nav.getByRole('tab', { name: 'Conquistas', exact: true })).toBeFocused();
  await expect(page.locator('.public-sheet h2')).toHaveText('Ficha de Nana');
  const details = await visitorContext.request.get(
    origin + `/api/profiles/${owner.id}/characters/${a.id}`,
  );
  expect(details.status()).toBe(200);
  const character = (await details.json()).character;
  expect(character).not.toHaveProperty('gold_cp');
  expect(character).not.toHaveProperty('email');
  expect(await snapshot()).toEqual(before);
  await reviewRealmPages(ownerPage, pool, origin, owner.id);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/profile-missing-static.json',
    JSON.stringify([...missingStatic], null, 2),
  );
  expect([...missingStatic]).toEqual([]);
  await writeFile(
    'test-results/profile-visit-comparison.json',
    JSON.stringify(comparisons, null, 2),
  );
  console.log(
    'PASS perfil em cinco telas: arte atual de companheiros, acesso público apenas à imagem exibida e não bloqueada, atualização por foco, cinco abas minimalistas/teclado, estante no chão/teto alinhado e dados preservados.',
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
