import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { defaultChoices } from '../shared/character-sheet';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3047';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter, testTokenImage } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3047, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { 'X-Vtt-Schema-Version': '6' },
      }),
    ),
  ),
  [gm, player, stranger] = contexts;
const page = await player.newPage(),
  master = await gm.newPage(),
  errors: string[] = [];
for (const p of [page, master]) p.on('pageerror', (e) => errors.push(e.message));
async function api(ctx: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  return {
    status: r.status(),
    data: r.headers()['content-type']?.includes('json') ? await r.json() : await r.body(),
    headers: r.headers(),
  };
}
async function signup(ctx: BrowserContext, name: string) {
  const r = await api(ctx, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  expect(r.status).toBe(200);
  return r.data.user;
}
try {
  const owner = await signup(gm, 'Mestre'),
    user = await signup(player, 'Jogador'),
    outsider = await signup(stranger, 'Visitante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const c = await createLegacyTestCharacter(user.id, 'Guerreiro da mochila'),
    other = await createLegacyTestCharacter(outsider.id, 'Outro personagem');
  await pool.query('UPDATE characters SET stats=$2 WHERE id=$1', [
    c.id,
    JSON.stringify([14, 12, 14, 10, 10, 10]),
  ]);
  const choices = defaultChoices(c.race, c.class);
  await pool.query(
    'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at)VALUES($1,$2,$3,$4,now())',
    [
      c.id,
      JSON.stringify(choices),
      JSON.stringify(Array(6).fill([3, 3, 4, 4])),
      JSON.stringify([0, 1, 2, 3, 4, 5]),
    ],
  );
  const principal = await readFile('docs/references/character-style-v1.png');
  for (const [id, image] of [
    [c.id, principal],
    [other.id, principal],
  ])
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      id,
      image,
    ]);
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
    c.id,
    await testTokenImage(),
  ]);
  let room = (await api(gm, '/vtt', 'POST', { name: 'Armas e retrato' })).data,
    root = '/vtt/rooms/' + room.id;
  const stale = await gm.request.get(origin + '/api' + root, {
    headers: { 'X-Vtt-Schema-Version': '4' },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toContain('Recarregue');
  await api(player, '/vtt/join', 'POST', { invite: room.invite, role: 'player' });
  room = (await api(gm, root)).data;
  room.document.scenes[0].fog = room.document.scenes[0].lighting = false;
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  const imported = await api(player, root + '/characters/' + c.id, 'POST', {});
  expect(imported.status).toBe(201);
  const token = imported.data.document.scenes[0].tokens.find((t: any) => t.characterId === c.id),
    url = root + '/sheets/' + token.id;
  let sheet = (await api(player, url)).data;
  expect(sheet.attacks).toEqual([]);
  expect(sheet.available_weapons).toEqual([]);
  expect((await api(player, '/characters/' + c.id + '/sheet')).data.attacks).toEqual([]);
  expect(
    (await api(player, url + '/weapons', 'PUT', { main_hand: 'flail', off_hand: null })).status,
  ).toBe(400);
  await pool.query(
    "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'flail',1),($1,'greatsword',1),($1,'dagger',1),($1,'longsword',1),($1,'leather-armor',1)",
    [c.id],
  );
  sheet = (await api(player, url)).data;
  expect(sheet.attacks).toEqual([]);
  expect(sheet.available_weapons.map((w: any) => w.itemId).sort()).toEqual([
    'dagger',
    'flail',
    'greatsword',
    'longsword',
  ]);
  let selected = await api(player, url + '/weapons', 'PUT', {
    main_hand: 'flail',
    off_hand: 'dagger',
  });
  expect(selected.status).toBe(200);
  expect(selected.data.attacks.map((w: any) => w.itemId).sort()).toEqual(['dagger', 'flail']);
  expect((await api(player, '/characters/' + c.id + '/sheet')).data.attacks).toEqual([]);
  expect(
    (
      await pool.query('SELECT count(*)::int n FROM character_equipment WHERE character_id=$1', [
        c.id,
      ])
    ).rows[0].n,
  ).toBe(0);
  expect(
    (await api(player, url + '/weapons', 'PUT', { main_hand: 'greatsword', off_hand: 'dagger' }))
      .status,
  ).toBe(400);
  expect(
    (await api(player, url + '/weapons', 'PUT', { main_hand: 'flail', off_hand: 'flail' })).status,
  ).toBe(400);
  expect(
    (await api(stranger, url + '/weapons', 'PUT', { main_hand: 'dagger', off_hand: null })).status,
  ).toBe(404);
  expect(
    (await api(gm, url + '/weapons', 'PUT', { main_hand: 'javelin', off_hand: null })).status,
  ).toBe(400);
  const grip = await api(player, url + '/weapons', 'PUT', {
    main_hand: 'longsword',
    off_hand: null,
    main_hand_two_handed: true,
  });
  expect(grip.status).toBe(200);
  expect(grip.data.attacks[0].dice).toBe('1d10');
  expect((await api(player, url)).data.weapon_slots.main_hand_two_handed).toBe(true);
  expect(
    (
      await api(player, url + '/weapons', 'PUT', {
        main_hand: 'longsword',
        off_hand: 'dagger',
        main_hand_two_handed: true,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await api(player, url + '/weapons', 'PUT', {
        main_hand: 'flail',
        off_hand: null,
        main_hand_two_handed: true,
      })
    ).status,
  ).toBe(400);
  expect(
    (await api(player, url + '/weapons', 'PUT', { main_hand: 'longsword', off_hand: null })).data
      .attacks[0].dice,
  ).toBe('1d10');
  expect(
    (
      await api(player, url + '/weapons', 'PUT', {
        main_hand: 'longsword',
        off_hand: 'dagger',
        main_hand_two_handed: false,
      })
    ).data.attacks.find((w: any) => w.itemId === 'longsword').dice,
  ).toBe('1d8');
  await api(player, url + '/weapons', 'PUT', {
    main_hand: 'flail',
    off_hand: 'dagger',
    main_hand_two_handed: false,
  });
  const portraitPath = root + '/tokens/' + token.id + '/portrait';
  const portrait = await api(player, portraitPath);
  expect(portrait.status).toBe(200);
  expect(portrait.headers['cache-control']).toMatch(/private.*no-store/);
  const meta = await sharp(portrait.data).metadata();
  expect(meta.width).toBe(320);
  expect(meta.height).toBe(400);
  expect((await api(stranger, portraitPath)).status).toBe(404);
  // A forged character ID must never expose a private, unimported portrait.
  let raw = (await api(gm, root)).data;
  const original = raw.document.scenes[0].tokens.find((t: any) => t.id === token.id);
  original.characterId = other.id;
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    room.id,
    JSON.stringify(raw.document),
  ]);
  expect((await api(gm, portraitPath)).status).toBe(404);
  original.characterId = c.id;
  original.hidden = true;
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    room.id,
    JSON.stringify(raw.document),
  ]);
  expect((await api(player, portraitPath)).status).toBe(404);
  expect((await api(gm, portraitPath)).status).toBe(200);
  original.hidden = false;
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    room.id,
    JSON.stringify(raw.document),
  ]);
  await mkdir('test-results', { recursive: true });
  await page.goto(origin + '/#vtt');
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await page.getByRole('button', { name: 'Colocar ' + c.name + ' no mapa', exact: true }).click();
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  const selectToken = async (p = page) => {
    const b = p.getByLabel('Tabuleiro da mesa', { exact: true }),
      box = (await b.boundingBox())!,
      x = Number(await b.getAttribute('data-camera-x')),
      y = Number(await b.getAttribute('data-camera-y')),
      z = Number(await b.getAttribute('data-camera-zoom'));
    await b.click({
      position: { x: box.width / 2 + (token.x - x) * z, y: box.height / 2 + (token.y - y) * z },
    });
  };
  await selectToken();
  const portraitHud = page.getByLabel('Retrato de ' + c.name, { exact: true });
  await expect(portraitHud).toBeVisible();
  expect(await portraitHud.locator('image').first().getAttribute('href')).toContain('/portrait?');
  await expect(portraitHud).toHaveAttribute('data-flowing', 'true');
  const flowCanvas = portraitHud.locator('canvas');
  expect(await flowCanvas.getAttribute('data-renderer')).toBe('webgl');
  await flowCanvas.screenshot({ path: 'test-results/vtt-smoke-flow-0.png' });
  await page.waitForTimeout(700);
  await flowCanvas.screenshot({ path: 'test-results/vtt-smoke-flow-700.png' });
  const frame1 = await sharp('test-results/vtt-smoke-flow-0.png').ensureAlpha().raw().toBuffer(),
    frame2 = await sharp('test-results/vtt-smoke-flow-700.png').ensureAlpha().raw().toBuffer();
  const changes = frame1.reduce((n, v, i) => n + (Math.abs(v - frame2[i]) > 8 ? 1 : 0), 0);
  expect(changes).toBeGreaterThan(frame1.length * 0.025);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(portraitHud).toHaveAttribute('data-animated', 'false');
  await expect(portraitHud).toHaveAttribute('data-flowing', 'false');
  await page.getByRole('button', { name: 'Abrir folha completa', exact: true }).click();
  const weapons = page.getByLabel('Arma na mesa', { exact: true });
  await expect(weapons).toHaveValue('flail');
  await weapons.selectOption('longsword');
  const gripChoice = page.getByLabel('Empunhadura da arma', { exact: true });
  await expect(gripChoice).toHaveValue('one');
  await gripChoice.selectOption('two');
  await expect(gripChoice).toHaveValue('two');
  await expect(page.getByLabel('Arma secundária na mesa', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '1d10+2', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            "SELECT roll->>'formula' formula FROM vtt_messages WHERE room_id=$1 AND roll IS NOT NULL ORDER BY id DESC LIMIT 1",
            [room.id],
          )
        ).rows[0]?.formula,
    )
    .toBe('1d10+2');
  await page.screenshot({ path: 'test-results/vtt-versatile-two-hands.png' });
  await gripChoice.selectOption('one');
  await expect(page.getByLabel('Arma secundária na mesa', { exact: true })).toBeEnabled();
  await weapons.selectOption('greatsword');
  await expect(weapons).toHaveValue('greatsword');
  await expect(page.getByLabel('Arma secundária na mesa', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Fixar Espada grande', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fixar Espada grande', exact: true }).click();
  const shortcut = page.getByRole('button', { name: 'Atalho 1 · Espada grande', exact: true });
  await expect(shortcut.locator('img')).toBeVisible();
  await expect(shortcut.locator('img')).toHaveAttribute('src', /greatsword/);
  const item = page.locator('.vtt-sheet-item').filter({ hasText: 'Armadura de couro' });
  await expect(item.locator('img')).toBeVisible();
  await expect(page.locator('.vtt-sheet-attack-title img')).toBeVisible();
  await page.screenshot({ path: 'test-results/vtt-owned-weapons-images.png' });
  await page.getByRole('button', { name: 'Fechar Ficha · ' + c.name, exact: true }).click();
  await shortcut.click();
  await pool.query("DELETE FROM inventory WHERE character_id=$1 AND item_id='greatsword'", [c.id]);
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  await shortcut.click();
  await expect(
    page.getByText('Esta arma não está na mochila do personagem.', { exact: true }),
  ).toBeVisible();
  expect((await api(player, url)).data.attacks).toEqual([]);
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir folha completa', exact: true }).click();
  await weapons.selectOption('longsword');
  await gripChoice.selectOption('two');
  await expect(gripChoice).toHaveValue('two');
  await page.getByRole('button', { name: 'Fixar Espada longa', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar Ficha · ' + c.name, exact: true }).click();
  await page.getByRole('button', { name: 'Atalho 2 · Espada longa', exact: true }).click();
  await page.getByRole('button', { name: 'Rolar dano separado', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            "SELECT roll->>'formula' formula FROM vtt_messages WHERE room_id=$1 AND roll IS NOT NULL ORDER BY id DESC LIMIT 1",
            [room.id],
          )
        ).rows[0]?.formula,
    )
    .toBe('1d10+2');
  await expect(page.getByRole('alert').filter({ hasText: 'Fórmula inválida' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  await selectToken();
  await page.screenshot({ path: 'test-results/vtt-selection-smoke-1440.png' });
  await master.goto(origin + '/#vtt');
  await expect(master.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await master.getByRole('button', { name: 'Alternar painel', exact: true }).click();
  await expect(master.locator('.vtt-panel')).toHaveCount(0);
  for (const width of [1920, 1366, 768, 390]) {
    await master.setViewportSize({ width, height: 1000 });
    await selectToken(master);
    await expect(master.getByLabel('Retrato de ' + c.name, { exact: true })).toBeVisible();
    const button = master.getByRole('button', { name: 'Efeitos do mestre', exact: true });
    expect(await button.evaluate((b) => !!b.closest('.vtt-tools'))).toBe(true);
    await button.click();
    const menu = master.locator('.vtt-effects-menu');
    await expect(menu).toBeVisible();
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThan(40);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1000);
    await master.screenshot({ path: `test-results/vtt-left-effects-smoke-${width}.png` });
    await master.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
    if (width <= 1100) {
      const portraitBox = (await master.locator('.vtt-selection-portrait').boundingBox())!,
        hotbarBox = (await master.locator('.vtt-hotbar').boundingBox())!;
      expect(portraitBox.y + portraitBox.height).toBeLessThanOrEqual(hotbarBox.y);
    }
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS owned weapons only; independent room loadout, switching and two hands; removed weapon blocks stale shortcut; item/hotbar images; private portrait and four viewport smoke/effects QA.',
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
