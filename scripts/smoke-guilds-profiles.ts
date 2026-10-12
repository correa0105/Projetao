import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { communitySettingsSchema } from '../shared/guilds';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable DB only');
const origin = 'http://localhost:3059';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const savedEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const server = createApp().listen(3059, '127.0.0.1');
process.env.NODE_ENV = savedEnv;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ownerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  admContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  friendContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await ownerContext.newPage(),
  adminPage = await admContext.newPage(),
  friendPage = await friendContext.newPage(),
  errors: string[] = [],
  missing: string[] = [];
for (const ctx of [ownerContext, admContext, friendContext])
  await ctx.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
for (const p of [page, adminPage, friendPage]) {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (
      !path.startsWith('/api/') &&
      /\.(webp|png|svg|woff2?)$/.test(path) &&
      (r.status() >= 400 || r.headers()['content-type']?.includes('text/html'))
    )
      missing.push(path);
  });
}
async function api(ctx: typeof ownerContext, path: string, method = 'GET', data?: unknown) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function signup(ctx: typeof ownerContext, name: string) {
  return (
    await api(ctx, '/auth/sign-up/email', 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
}
async function screenshot(label: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.waitForTimeout(180);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    'No horizontal overflow: ' + label + ' ' + width,
  ).toBe(true);
  await page.screenshot({ path: `test-results/community/${label}-${width}.png`, fullPage: true });
}
await mkdir('test-results/community', { recursive: true });
try {
  const adm = await signup(admContext, 'Administrador'),
    owner = await signup(ownerContext, 'Viajante do Amanhecer'),
    friend = await signup(friendContext, 'Companheiro de jornada');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adm.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Arden'),
    b = await createLegacyTestCharacter(friend.id, 'Lyra'),
    c = await createLegacyTestCharacter(adm.id, 'Thorne');
  await pool.query('UPDATE characters SET level=12,gold_cp=200000 WHERE id=$1', [a.id]);
  await pool.query('UPDATE characters SET level=8 WHERE id=$1', [b.id]);
  await pool.query('UPDATE characters SET level=4 WHERE id=$1', [c.id]);
  const portrait = await sharp(await readFile('public/shop/merchant-v2.png'))
    .resize({ height: 900 })
    .png()
    .toBuffer();
  for (const ch of [a, b, c])
    await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
      ch.id,
      portrait,
    ]);
  // Real completion ledger fixtures unlock profile modules without trusting browser fields.
  for (let i = 0; i < 10; i++) {
    const {
      rows: [post],
    } = await pool.query(
      "INSERT INTO board_posts(author_id,kind,status,title,description,location,difficulty) VALUES($1,'mission','completed','Uma aventura','Uma crônica registrada','Norte','Moderada') RETURNING id",
      [adm.id],
    );
    await pool.query('INSERT INTO mission_participants(post_id,character_id) VALUES($1,$2)', [
      post.id,
      a.id,
    ]);
    await pool.query(
      'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by) VALUES($1,$2,0,$3)',
      [post.id, a.id, adm.id],
    );
  }
  await adminPage.goto(origin + '/#guild');
  await adminPage.getByRole('button', { name: 'Painel administrativo', exact: true }).click();
  await adminPage.getByLabel('Custo de fundação (PO)', { exact: true }).fill('500');
  await adminPage.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(adminPage.getByText('Configuração salva.', { exact: true })).toBeVisible();
  expect((await api(admContext, '/community/settings')).document.founding_po).toBe(500);
  await page.goto(origin + '/#hall');
  await expect(page.locator('.hall-champion')).toHaveCount(3);
  for (const width of [1440, 768, 390, 320]) await screenshot('hall', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#guild');
  await page.getByRole('button', { name: 'Fundar uma guilda', exact: true }).click();
  await page.getByLabel('Nome da guilda', { exact: true }).fill('Companhia do Amanhecer');
  await page.getByLabel('Símbolo', { exact: true }).selectOption('raven');
  await page.getByLabel('Fundo', { exact: true }).selectOption('diagonal');
  await page.getByLabel('Borda', { exact: true }).selectOption('laurel');
  await page.getByRole('button', { name: 'Fundar guilda', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Companhia do Amanhecer', exact: true }),
  ).toBeVisible();
  const id = (await api(ownerContext, '/guilds')).mine;
  expect(id).toBeTruthy();
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [a.id])).rows[0].gold_cp,
  ).toBe(150000);
  for (const name of ['Salão principal', 'Ferraria', 'Sala de estar', 'Sala de reunião']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
    await screenshot('room-' + name.replaceAll(' ', '-'), 1440);
  }
  await expect(page.getByRole('button', { name: /Alquimia/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Biblioteca/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Personalizar sede', exact: true }).click();
  await page.getByLabel('Objeto', { exact: true }).selectOption('table');
  await page.getByRole('button', { name: 'Adicionar peça', exact: true }).click();
  const object = page.locator('.guild-furniture').first();
  await expect(object).toBeVisible();
  await object.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByLabel('Atmosfera', { exact: true }).selectOption('warm');
  await page.getByRole('button', { name: 'Salvar sede', exact: true }).click();
  await expect(page.getByText('Sede salva.', { exact: true })).toBeVisible();
  const g = await api(ownerContext, '/guilds/' + id);
  expect(g.document.placements.length).toBe(6);
  expect(g.document.placements.at(-1).room).toBe('meeting');
  expect(g.document.ambience).toBe('warm');
  for (const width of [1440, 768, 390, 320]) await screenshot('guild', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Companhia', exact: true }).click();
  await page.getByLabel('Buscar usuário', { exact: true }).fill('Companheiro');
  await page.getByRole('button', { name: 'Companheiro de jornada', exact: true }).click();
  await expect(
    page.getByText('Convite enviado a Companheiro de jornada.', { exact: true }),
  ).toBeVisible();
  await friendPage.goto(origin + '/#guild');
  await friendPage.getByRole('button', { name: 'Aceitar', exact: true }).click();
  await expect(
    friendPage.getByRole('heading', { name: 'Companhia do Amanhecer', exact: true }),
  ).toBeVisible();
  await expect(
    friendPage.getByRole('button', { name: 'Personalizar sede', exact: true }),
  ).toHaveCount(0);
  await api(ownerContext, '/social/friends/' + friend.id, 'POST', {});
  await api(friendContext, '/social/friends/' + owner.id, 'PATCH', {});
  await page.goto(origin + '/#profiles?user=' + owner.id);
  await expect(page.locator('.player-profile-home')).toBeVisible();
  await page.getByRole('button', { name: 'Personalizar perfil', exact: true }).click();
  await page
    .getByLabel('Frase de apresentação', { exact: true })
    .fill('A estrada começa com uma companhia.');
  await page
    .getByLabel('Sobre você', { exact: true })
    .fill('Coleciono histórias, amizades e mapas do Norte.');
  await page.getByLabel('Borda do avatar', { exact: true }).selectOption('runic');
  await page.getByLabel('Efeito da borda', { exact: true }).selectOption('aurora');
  await page
    .getByLabel('Enviar background personalizado', { exact: true })
    .setInputFiles({
      name: 'abrigo.webp',
      mimeType: 'image/webp',
      buffer: await readFile('public/guild/rooms/lounge.webp'),
    });
  await page.getByRole('button', { name: 'Adicionar vitrine', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).nth(1).fill('Crônicas do Norte');
  await page.getByLabel('Texto', { exact: true }).fill('Uma fogueira, uma estrada e bons amigos.');
  await page.getByRole('button', { name: 'Salvar meu perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crônicas do Norte', exact: true })).toBeVisible();
  expect((await api(ownerContext, '/profiles/' + owner.id)).document.background).toMatch(
    /^\/api\/social\/assets\//,
  );
  await expect(page.locator('.player-avatar')).toHaveClass(/border-runic effect-aurora/);
  for (const width of [1440, 768, 390, 320]) await screenshot('profile', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Amigos e mensagens', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Amigos e chat', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Conversar com Companheiro de jornada', exact: true })
    .click();
  await page.getByLabel('Mensagem privada', { exact: true }).fill('Uma nova jornada!');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Uma nova jornada!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar amigos e chat', exact: true }).click();
  await page.getByRole('button', { name: 'Personagens e coleções', exact: true }).click();
  await expect(page.locator('.public-camp')).toBeVisible();
  await page.getByRole('button', { name: 'Perfil de Viajante do Amanhecer', exact: true }).click();
  await expect(page.locator('.player-profile-home')).toBeVisible();
  expect(errors).toEqual([]);
  expect([...new Set(missing)]).toEqual([]);
  await writeFile(
    'test-results/community/result.json',
    JSON.stringify({
      passed: true,
      viewports: [1440, 768, 390, 320],
      rooms: 4,
      profileUpload: true,
      crestLayers: true,
      foundationGold: true,
      ownerFurniture: true,
      roomLocks: true,
      invitations: true,
      chat: true,
      errors,
      missing,
    }),
  );
  console.log('Community browser QA passed.');
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
