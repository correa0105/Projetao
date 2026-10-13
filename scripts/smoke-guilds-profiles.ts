import 'dotenv/config';
import { chromium, expect, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { communitySettingsSchema } from '../shared/guilds';
import { houseTurnFacing } from '../shared/house';
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
    reducedMotion: 'no-preference',
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
  await page.screenshot({
    path: `test-results/community/${label}-${width}.png`,
    fullPage: true,
  });
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
  const workshop = page.getByRole('region', { name: 'Oficina de brasões' });
  await workshop.getByRole('button', { name: 'Runas gravadas', exact: false }).click();
  await workshop.getByRole('button', { name: 'Formato', exact: false }).click();
  await workshop.getByRole('button', { name: 'Formato: Escudo', exact: true }).click();
  await workshop.getByRole('button', { name: 'Símbolo', exact: false }).first().click();
  await workshop.getByRole('button', { name: 'Símbolo: Corvo', exact: true }).click();
  await workshop.getByRole('button', { name: 'Fundo', exact: true }).click();
  await workshop.getByRole('button', { name: 'Fundo: Banda', exact: true }).click();
  await workshop.getByRole('button', { name: 'Borda', exact: true }).click();
  await workshop.getByRole('button', { name: 'Borda: Louros', exact: true }).click();
  await workshop.getByLabel('Cor da borda', { exact: true }).fill('#b6884a');
  for (const width of [1440, 768, 390, 320]) await screenshot('crest-workshop', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Fundar guilda', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Fundar uma guilda', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Companhia do Amanhecer', exact: true }),
  ).toBeVisible();
  const id = (await api(ownerContext, '/guilds')).mine;
  expect(id).toBeTruthy();
  const savedCrest = (await api(ownerContext, '/guilds/' + id)).document.crest;
  expect(savedCrest).toMatchObject({
    icon: 'raven',
    field: 'diagonal',
    border: 'shield',
    ornament: 'laurel',
    borderColor: '#b6884a',
  });
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
  await expect(page.getByLabel('Decoração da sala')).toBeVisible();
  await expect(page.getByLabel('História da guilda')).toHaveCount(0);
  await expect(workshop).toHaveCount(0);
  const object = page.locator('.guild-furniture').first();
  await expect(object).toBeVisible();
  const position = () => object.evaluate((el) => ({ x: el.style.left, y: el.style.top }));
  const assertTurnAlignment = async (piece: Locator) => {
    await expect
      .poll(async () => {
        const art = await piece.locator('img').evaluate((image: HTMLImageElement) => {
          if (!image.complete || !image.naturalWidth) return null;
          const c = document.createElement('canvas');
          c.width = image.naturalWidth;
          c.height = image.naturalHeight;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          let left = c.width,
            top = c.height,
            right = 0,
            bottom = 0;
          for (let y = 0; y < c.height; y++)
            for (let x = 0; x < c.width; x++)
              if (data[(y * c.width + x) * 4 + 3] > 64) {
                left = Math.min(left, x);
                right = Math.max(right, x + 1);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y + 1);
              }
          const r = image.getBoundingClientRect();
          return {
            left: r.left + (left / c.width) * r.width,
            right: r.left + (right / c.width) * r.width,
            centerY: r.top + ((top + bottom) / (2 * c.height)) * r.height,
          };
        });
        const left = await page
          .getByRole('button', { name: 'Virar item à esquerda', exact: true })
          .boundingBox();
        const right = await page
          .getByRole('button', { name: 'Virar item à direita', exact: true })
          .boundingBox();
        if (!art || !left || !right) return 1000;
        return Math.max(
          Math.abs(left.y + left.height / 2 - art.centerY),
          Math.abs(right.y + right.height / 2 - art.centerY),
          Math.abs(art.left - (left.x + left.width / 2) - 20),
          Math.abs(right.x + right.width / 2 - art.right - 20),
        );
      })
      .toBeLessThan(3);
  };
  const assertHoldKeepsPosition = async (piece: Locator) => {
    const before = (await piece.boundingBox())!;
    await page.mouse.move(before.x + before.width * 0.5, before.y + before.height * 0.6);
    await page.mouse.down();
    await page.waitForTimeout(220);
    const held = (await piece.boundingBox())!;
    expect(held.x).toBeCloseTo(before.x, 1);
    expect(held.y).toBeCloseTo(before.y, 1);
    await page.mouse.up();
    const released = (await piece.boundingBox())!;
    expect(released.x).toBeCloseTo(before.x, 1);
    expect(released.y).toBeCloseTo(before.y, 1);
  };
  const beforeClick = await position();
  const box = (await object.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.waitForTimeout(220);
  const heldBox = (await object.boundingBox())!;
  expect(heldBox.x).toBeCloseTo(box.x, 1);
  expect(heldBox.y).toBeCloseTo(box.y, 1);
  await page.mouse.move(box.x + box.width * 0.25 + 1, box.y + box.height * 0.3 + 1);
  await page.mouse.up();
  expect(await position()).toEqual(beforeClick);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25 + 50, box.y + box.height * 0.3 + 15, {
    steps: 8,
  });
  await page.mouse.up();
  const stage = (await page.locator('.guild-room').boundingBox())!;
  const moved = await position();
  expect(parseFloat(moved.x) - parseFloat(beforeClick.x)).toBeCloseTo(
    (49 / stage.width) * 100,
    1,
  );
  expect(parseFloat(moved.y) - parseFloat(beforeClick.y)).toBeCloseTo(
    (14 / stage.height) * 100,
    1,
  );
  const sidebar = (await page.getByLabel('Decoração da sala').boundingBox())!;
  expect(sidebar.x).toBeGreaterThanOrEqual(stage.x + stage.width);
  const oldFacing = Number(await object.getAttribute('data-facing'));
  await assertTurnAlignment(object);
  await page.getByRole('button', { name: 'Virar item à direita', exact: true }).click();
  await expect(object).toHaveAttribute(
    'data-facing',
    String(houseTurnFacing('table', oldFacing, 1)),
  );
  await expect(object.locator('img')).toHaveAttribute(
    'src',
    new RegExp('/' + houseTurnFacing('table', oldFacing, 1) + '\\.webp$'),
  );
  await assertTurnAlignment(object);
  await page.getByRole('button', { name: 'Virar item à esquerda', exact: true }).click();
  await expect(object).toHaveAttribute('data-facing', String(oldFacing));
  await assertTurnAlignment(object);
  await page.getByLabel('Tamanho do objeto', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await assertTurnAlignment(object);
  await assertHoldKeepsPosition(object);
  for (const catalog of ['chest', 'bench']) {
    await page.getByLabel('Objeto', { exact: true }).selectOption(catalog);
    await page.getByRole('button', { name: 'Adicionar peça', exact: true }).click();
    const fixtureId = await page
      .locator('.guild-furniture.selected')
      .getAttribute('data-guild-piece');
    const fixture = page.locator('[data-guild-piece="' + fixtureId + '"]');
    await fixture.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await assertTurnAlignment(fixture);
    await assertHoldKeepsPosition(fixture);
    await page.getByRole('button', { name: 'Virar item à direita', exact: true }).click();
    await assertTurnAlignment(fixture);
    await page.getByRole('button', { name: 'Virar item à esquerda', exact: true }).click();
    await assertTurnAlignment(fixture);
    await page.screenshot({ path: 'test-results/community/turn-' + catalog + '.png' });
    await page.getByRole('button', { name: 'Remover peça', exact: true }).click();
  }
  await object.focus();
  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowLeft');
  await page.getByLabel('Atmosfera', { exact: true }).selectOption('warm');
  for (const width of [1440, 768, 390, 320]) {
    await screenshot('decoration-sidebar', width);
    await assertTurnAlignment(object);
    await assertHoldKeepsPosition(object);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pieceId = await object.getAttribute('data-guild-piece');
  const anchorBeforePerspective = await position();
  await page.getByRole('button', { name: 'Ajustar perspectiva', exact: true }).click();
  await expect(page.getByLabel('Guias de perspectiva da sala')).toBeVisible();
  await expect(page.locator('.guild-perspective-handle')).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Virar item à direita', exact:true })).toBeVisible();
  await page.getByRole('button', { name:'Refinar pelos cantos', exact:true }).click();
  await expect(page.locator('.guild-perspective-handle')).toHaveCount(4);
  await page.getByRole('button', { name: 'Alinhar à direita', exact: true }).click();
  await expect(object.locator('img')).toHaveAttribute('style', /matrix3d/);
  expect(await position()).toEqual(anchorBeforePerspective);
  await page.getByLabel('Aderir às linhas de fuga', { exact: true }).uncheck();
  const handle = page.getByRole('button', {
    name: 'Ajustar canto superior esquerdo',
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  await expect(handle).toBeInViewport();
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  const heldHandle = (await handle.boundingBox())!;
  expect(heldHandle.x).toBeCloseTo(h.x, 1);
  expect(heldHandle.y).toBeCloseTo(h.y, 1);
  await page.mouse.move(h.x + h.width / 2 + 12, h.y + h.height / 2 + 7, { steps: 5 });
  await page.mouse.up();
  const movedHandle = (await handle.boundingBox())!;
  expect(movedHandle.x - h.x).toBeCloseTo(12, 0);
  expect(movedHandle.y - h.y).toBeCloseTo(7, 0);
  expect(await position()).toEqual(anchorBeforePerspective);
  await page.getByText('Calibrar as guias da sala', { exact: true }).click();
  await page.getByLabel('Linha do horizonte', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  for (const width of [1440, 390, 320]) await screenshot('perspective-guides', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Concluir perspectiva', exact: true }).click();
  await expect(page.locator('.guild-perspective-handle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar sede', exact: true }).click();
  await expect(page.getByText('Sede salva.', { exact: true })).toBeVisible();
  const g = await api(ownerContext, '/guilds/' + id);
  expect(g.document.placements.length).toBe(6);
  expect(g.document.placements.at(-1).room).toBe('meeting');
  expect(g.document.ambience).toBe('warm');
  expect(g.document.crest).toEqual(savedCrest);
  expect(
    g.document.placements.find((p: { id: string }) => p.id === pieceId).perspective,
  ).toHaveLength(4);
  expect(g.document.perspectives.meeting.horizon).toBe(0.44);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Companhia do Amanhecer', exact: true }),
  ).toBeVisible();
  expect((await api(ownerContext, '/guilds/' + id)).document.placements).toEqual(
    g.document.placements,
  );
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
  await page.getByRole('button',{name:'Abrir perfil de Viajante do Amanhecer',exact:true}).click();
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
  await page.getByLabel('Enviar background personalizado', { exact: true }).setInputFiles({
    name: 'abrigo.webp',
    mimeType: 'image/webp',
    buffer: await readFile('public/guild/rooms/lounge.webp'),
  });
  await page.getByRole('button', { name: 'Adicionar vitrine', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).nth(1).fill('Crônicas do Norte');
  await page
    .getByLabel('Texto', { exact: true })
    .fill('Uma fogueira, uma estrada e bons amigos.');
  await page.getByRole('button', { name: 'Salvar meu perfil', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Crônicas do Norte', exact: true }),
  ).toBeVisible();
  expect((await api(ownerContext, '/profiles/' + owner.id)).document.background).toMatch(
    /^\/api\/social\/assets\//,
  );
  await expect(page.locator('.player-avatar')).toHaveClass(/border-runic effect-aurora/);
  for (const width of [1440, 768, 390, 320]) await screenshot('profile', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Amigos e mensagens', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Amigos e chat', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Conversar com Companheiro de jornada', exact: true })
    .click();
  await page.getByLabel('Mensagem privada', { exact: true }).fill('Uma nova jornada!');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Uma nova jornada!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar amigos e chat', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar ao personagem', exact: true }).click();
  await expect(page.locator('.public-camp')).toBeVisible();
  await page
    .getByRole('button', { name: 'Abrir perfil de Viajante do Amanhecer', exact: true })
    .click();
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
      visibleTurnAlignment: true,
      heldFurnitureStable: true,
      perspectiveGuides: true,
      perspectivePersisted: true,
      roomLocks: true,
      invitations: true,
      chat: true,
      errors,
      missing,
    }),
  );
  console.log('Community browser QA passed.');
} catch (error) {
  await page.screenshot({ path: 'test-results/community/turn-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
