import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { originFixture, legalAdvance, advanceFixture } from '../tests/advancement-fixtures';
import { deriveSheet } from '../shared/character-sheet';
import { levelPlan } from '../shared/character-advancement';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável obrigatório.');
const origin = 'http://localhost:3082';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3082, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
  (window as any).__house2Audio = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    (window as any).__house2Audio.push(this);
    return play.call(this);
  };
});
await mkdir('test-results/class-choices-camp', { recursive: true });
async function req(path: string, body?: unknown) {
  const r = await context.request.fetch(origin + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: origin },
    data: body,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
try {
  const { user } = await req('/auth/sign-up/email', {
    name: 'Carrossel',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const heroes = [];
  const realDirectory = process.env.CAMP_REAL_ART_DIRECTORY;
  const realArt = realDirectory
    ? JSON.parse(await readFile(realDirectory + '/metadata.json', 'utf8'))
    : [];
  for (const [index, name] of ['Aurora', 'Bruma'].entries()) {
    const hero = await createLegacyTestCharacter(user.id, name),
      f = originFixture('Guerreiro');
    f.choices.options.style = ['Arquearia'];
    for (let i = 2; i <= 3; i++)
      advanceFixture(f.character, f.choices, legalAdvance(f.character, f.choices));
    const d = deriveSheet(f.character, f.choices);
    await pool.query(
      'UPDATE characters SET race=$2,stats=$3,hp=$4,armor_class=$5,level=3,portrait_revision=1,gold_cp=50000 WHERE id=$1',
      [hero.id, f.character.race, JSON.stringify(f.character.stats), d.hp, d.armorClass],
    );
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      hero.id,
      await readFile(
        realArt[index]
          ? realDirectory + '/' + realArt[index].id + '.png'
          : 'public/character-silhouette-v2.png',
      ),
    ]);
    await pool.query(
      'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,current_hp)VALUES($1,$2,$3,$4,now(),$5)',
      [
        hero.id,
        JSON.stringify(f.choices),
        JSON.stringify(Array(6).fill([4, 4, 4, 4])),
        JSON.stringify([0, 1, 2, 3, 4, 5]),
        d.hp,
      ],
    );
    heroes.push(hero);
    await pool.query(
      "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'greatsword',1)",
      [hero.id],
    );
    await pool.query(
      "INSERT INTO character_equipment(character_id,slot,item_id)VALUES($1,'main_hand','greatsword'),($1,'off_hand','greatsword')",
      [hero.id],
    );
  }
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-capacity')).toHaveText('2 / 2 personagens');
  await expect(page.locator('.camp-stage > .camp-character')).toHaveCount(2);
  await expect(page.locator('.camp-carousel,.camp-carousel-arrow,.camp-create-slot')).toHaveCount(
    0,
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const rects = await page
      .locator('.camp-stage > .camp-character .camp-figure')
      .evaluateAll((nodes) =>
        nodes.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, bottom: r.bottom };
        }),
      );
    expect(rects[0].x).toBeLessThan(rects[1].x);
    expect(Math.abs(rects[0].bottom - rects[1].bottom)).toBeLessThan(1);
    await page.screenshot({ path: `test-results/class-choices-camp/camp-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.camp-character a').filter({ hasText: 'Abrir ficha' }).last().click();
  await expect(
    page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }),
  ).toBeVisible();
  const selectedId = await page.evaluate(
      (id) => sessionStorage.getItem('alvorada-selected-character:' + id),
      user.id,
    ),
    selected = (await req('/characters')).find((h: any) => h.id === selectedId),
    sheet = await req(`/characters/${selected.id}/sheet`),
    next = legalAdvance(selected, sheet.sheet.choices),
    plan = levelPlan(selected, sheet.sheet.choices, next);
  await page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Melhoria de Força', { exact: true }).selectOption('2');
  await expect(
    modal.getByLabel('Melhoria de Destreza', { exact: true }).locator('option[value="2"]'),
  ).toHaveAttribute('disabled', '');
  await modal.getByLabel('Melhoria de Força', { exact: true }).selectOption('1');
  await modal.getByLabel('Melhoria de Destreza', { exact: true }).selectOption('1');
  await expect(
    modal.getByLabel('Melhoria de Constituição', { exact: true }).locator('option[value="1"]'),
  ).toHaveAttribute('disabled', '');
  await modal.getByLabel('Atributos ou talento', { exact: true }).selectOption('tough');
  await expect(modal.getByLabel('Melhoria de Força', { exact: true })).toHaveValue('0');
  for (const field of plan.fields) {
    const group = modal
      .locator('.sheet-choice')
      .filter({ has: page.locator('legend').filter({ hasText: field.label }) });
    for (const value of next.choices[field.key] || [])
      await group.getByRole('checkbox', { name: value, exact: true }).check();
  }
  await modal.getByRole('button', { name: 'Confirmar evolução', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('tab', { name: 'Combate', exact: true }).click();
  const talents = page.getByRole('region', { name: 'Talento', exact: true });
  await expect(talents).toContainText('Robusto');
  await expect(talents).toContainText('Guerreiro · nível 4');
  await expect(page.getByRole('region', { name: 'Classe', exact: true })).toContainText(
    'Guerreiro · nível 2',
  );
  await page.getByLabel('Novo estilo de luta', { exact: true }).selectOption('Defesa');
  await page.getByRole('button', { name: 'Confirmar estilo de luta', exact: true }).click();
  await expect(talents).toContainText('Defesa');
  await page.getByRole('tab', { name: 'Equipamento', exact: true }).click();
  const equipped = await req(`/characters/${selected.id}/sheet`),
    weapon = equipped.equipped.find((i: any) => i.id === 'greatsword');
  expect(weapon.image_path).toBeTruthy();
  await expect(page.locator('.sheet-equipment-grid').first().locator('img')).toHaveAttribute(
    'src',
    weapon.image_path,
  );
  expect(equipped.startingEquipment.some((i: any) => i.image_path)).toBe(true);
  await page.getByRole('tab', { name: 'História', exact: true }).click();
  await expect(page.locator('.sheet-identity-grid')).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/class-choices-camp/identity-${width}.png`,
      fullPage: true,
    });
  }
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user.id]);
  await page.reload();
  await page.getByRole('tab', { name: 'Combate', exact: true }).click();
  for (const label of ['PV atuais', 'PV temporários'])
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('readonly', '');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const clock = await req('/world-clock');
  await req('/world-clock', { time: '22:00', revision: clock.revision });
  const directory = await req('/house-v2'),
    n = directory.neighborhoods[0].id,
    scene = await req('/house-v2/neighborhoods/' + n),
    p = scene.plots[0],
    hero = heroes[0];
  await req(`/house-v2/plots/${p.id}/purchase`, {
    character_id: hero.id,
    idempotency_key: randomUUID(),
  });
  await req(`/house-v2/plots/${p.id}/house`, {
    character_id: hero.id,
    catalog_id: 'house-empty-001',
    idempotency_key: randomUUID(),
  });
  const fire = await req('/house-v2/furniture', {
      character_id: hero.id,
      plot_id: p.id,
      catalog_id: 'h2-firepit',
      idempotency_key: randomUUID(),
    }),
    lamp = await req('/house-v2/furniture', {
      character_id: hero.id,
      plot_id: p.id,
      catalog_id: 'furniture-031',
      idempotency_key: randomUUID(),
    });
  const lot = (await req('/house-v2/neighborhoods/' + n)).plots.find((v: any) => v.id === p.id);
  const layout = await context.request.put(origin + `/api/house-v2/plots/${p.id}/layout`, {
    headers: { Origin: origin },
    data: {
      revision: lot.revision,
      house: { x: lot.house_x, y: lot.house_y, rotation: lot.house_rotation },
      items: [
        { id: fire.item_id, x: lot.x + 3, y: lot.y + 13, rotation: 0, scale: 1 },
        { id: lamp.item_id, x: lot.house_x, y: lot.house_y, rotation: 0, scale: 1 },
      ],
    },
  });
  expect(layout.ok(), await layout.text()).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#house2');
  await page.locator('.h2-neighborhood-card').first().click();
  await page.locator(`[data-house2-plot="${lot.id}"] rect.h2-plot`).focus();
  await page.keyboard.press('Enter');
  async function tool(name: string) {
    await page.getByRole('button', { name: 'House 2.0', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Controles da vizinhança' })
      .getByRole('button', { name, exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Configurações de som', exact: true }).click();
  await expect(page.getByLabel('Volume das músicas', { exact: true })).toBeVisible();
  await page.getByLabel('Volume dos efeitos sonoros', { exact: true }).fill('22');
  await page.keyboard.press('Escape');
  await page.locator(`[data-house2-piece="${fire.item_id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Acender luz', exact: true }).click();
  await expect(page.locator(`[data-house2-light="${fire.item_id}"]`)).toHaveCount(1);
  const wave = page.locator(`[data-house2-light="${fire.item_id}"] .h2-light-wave`);
  expect(await wave.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect
    .poll(() => wave.evaluate((el) => getComputedStyle(el).animationName))
    .toBe('h2-light-breathe');
  const intensity = await wave.evaluate((el) => Number(getComputedStyle(el).opacity));
  await page.waitForTimeout(450);
  expect(
    Math.abs((await wave.evaluate((el) => Number(getComputedStyle(el).opacity))) - intensity),
  ).toBeGreaterThan(0.0001);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-house2-day-phase]')).toHaveAttribute(
    'mask',
    'url(#h2-local-lights-mask)',
  );
  expect(
    await page.evaluate(() =>
      ((window as any).__house2Audio as HTMLAudioElement[]).some(
        (a) => a.src.endsWith('/amb-hearth.ogg') && a.loop,
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      ((window as any).__house2Audio as HTMLAudioElement[]).some((a) =>
        a.src.endsWith('/sfx-torch-light.ogg'),
      ),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Apagar luz', exact: true }).click();
  await expect(page.locator(`[data-house2-light="${fire.item_id}"]`)).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      ((window as any).__house2Audio as HTMLAudioElement[])
        .filter((a) => a.src.endsWith('/amb-hearth.ogg'))
        .every((a) => a.paused),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Acender luz', exact: true }).click();
  await page.locator(`[data-house2-piece="${lamp.item_id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Acender luz', exact: true }).click();
  await expect(page.locator(`[data-house2-light="${lamp.item_id}"]`)).toHaveCount(1);
  await tool('Mobília');
  for (const [category, name, kind] of [
    ['Telhados', 'Telhas vermelhas', 'roof'],
    ['Paredes', 'Paredes de pedra', 'walls'],
    ['Pisos', 'Piso de mármore', 'floor'],
  ] as const) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await page.locator('.h2-finishes-catalog button').filter({ hasText: name }).click();
    await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
    await page.locator('.h2-finishes-catalog button').filter({ hasText: name }).click();
    await expect(
      page.locator('.h2-finishes-catalog button').filter({ hasText: name }),
    ).toContainText('Em uso');
    if (kind === 'floor')
      await expect(page.locator('[data-house2-floor-finish]')).toHaveAttribute(
        'data-house2-floor-finish',
        'floor-marble',
      );
    if (kind === 'walls')
      await expect(page.locator('[data-house2-wall-finish]')).toHaveAttribute(
        'data-house2-wall-finish',
        'walls-stone',
      );
  }
  await page.screenshot({ path: 'test-results/class-choices-camp/house2-finishes-lights.png' });
  await page.getByRole('button', { name: 'Fechar Mobília', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/class-choices-camp/house2-mobile.png' });
  await page.goto(origin + '/#profile');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-page', 'profile');
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as any).__house2Audio as HTMLAudioElement[])
          .filter((a) => a.loop && a.src.includes('/audio/vtt/amb-'))
          .every((a) => a.paused),
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/class-choices-camp/result.json',
    JSON.stringify({
      passed: true,
      errors,
      twoPositions: true,
      noCarousel: true,
      realPortraits: Boolean(realDirectory),
      viewports: [1440, 768, 390, 320],
      globalAttributeBudget: true,
      featInsteadOfASI: true,
      featureClassLevels: true,
      styleChoice: true,
      identityGrid: true,
      protectedResources: true,
      lightItems: true,
      soundControls: true,
      fireLoop: true,
      finishesPurchasedAndApplied: true,
    }),
  );
  console.log(
    'PASS escolhas, atributos/talento, origem por nível, recursos e acampamento original em quatro larguras.',
  );
} catch (e) {
  console.log('ALERTS', await page.locator('[role="alert"]').allTextContents());
  await page.screenshot({ path: 'test-results/class-choices-camp/failure.png', fullPage: true });
  throw e;
} finally {
  await context.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
