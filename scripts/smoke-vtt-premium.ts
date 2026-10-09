import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { newToken, drawingSchema } from '../shared/vtt.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3006';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3006, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': '4' },
  }),
  page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  const signup = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre premium',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Arden');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Bestiário particular');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const {
    rows: [r],
  } = await pool.query('SELECT id,document FROM vtt_rooms WHERE owner_id=$1', [user.id]);
  const scene = r.document.scenes[0];
  scene.lighting = false;
  scene.fog = false;
  scene.ambient = 1;
  const token = newToken(randomUUID(), scene);
  token.name = 'Alvo';
  token.hp = 100;
  token.maxHp = 100;
  token.x = 650;
  token.y = 875;
  scene.tokens.push(token);
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    r.id,
    JSON.stringify(r.document),
  ]);
  const now = new Date();
  for (let i = 0; i < 55; i++)
    await pool.query(
      'INSERT INTO vtt_messages(room_id,author_id,author,text,roll,created_at)VALUES($1,$2,$3,$4,$5,$6)',
      [
        r.id,
        user.id,
        user.name,
        'Histórico ' + i,
        JSON.stringify({ formula: '1d6', dice: [3], total: 3 }),
        new Date(now.getTime() + i),
      ],
    );
  await page.reload();
  const panel = page.locator('.vtt-panel-content');
  await expect(page.locator('.vtt-chat-log article')).toHaveCount(55);
  const log = page.locator('.vtt-chat-log');
  const bottom = () => log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
  expect(await bottom()).toBeLessThan(3);
  async function externalMessage(text: string) {
    const x = await ctx.request.post(origin + `/api/vtt/rooms/${r.id}/messages`, {
      headers: { Origin: origin },
      data: { text, formula: '1d6' },
    });
    expect(x.status()).toBe(201);
    await expect(log).toContainText(text, { timeout: 10000 });
  }
  await externalMessage('Rolagem no rodapé');
  expect(await bottom()).toBeLessThan(3);
  await log.evaluate((el) => {
    el.scrollTop = 100;
    el.dispatchEvent(new Event('scroll'));
  });
  const before = await log.evaluate((el) => el.scrollTop);
  await externalMessage('Preservar leitura');
  expect(await log.evaluate((el) => el.scrollTop)).toBe(before);
  await log.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });
  await externalMessage('Voltou ao final');
  expect(await bottom()).toBeLessThan(3);
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Galeria de monstros', exact: true }).click();
  const assets = JSON.parse(await readFile('data/vtt/premium-art/manifest.json', 'utf8')).assets;
  await expect(panel.locator('.vtt-premium-grid > button')).toHaveCount(assets.length);
  await expect(panel.getByLabel('Mudar tokens para premium', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Acesso premium', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Premium', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Ver todos os monstros', exact: true }).click();
  await expect(panel.locator('.vtt-compendium img.premium')).toHaveCount(assets.length);
  const aboleth = panel.locator('.vtt-compendium > button').filter({ hasText: /^AbolethND/ });
  await expect(aboleth.locator('img')).toHaveAttribute(
    'src',
    '/api/vtt/premium-art/monster-aboleth',
  );
  await aboleth.click();
  await panel.getByRole('button', { name: 'Adicionar ao tabuleiro', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Abrir folha completa' })).toBeVisible();
  await expect
    .poll(async () => {
      const {
        rows: [saved],
      } = await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id]);
      return saved.document.scenes[0].tokens.find((t: any) => t.name === 'Aboleth')?.image;
    })
    .toBe('/api/vtt/premium-art/monster-aboleth');
  await panel.getByRole('button', { name: 'Abrir folha completa' }).click();
  let sheet = page.getByRole('dialog', { name: 'Ficha · Aboleth', exact: true });
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  await sheet.getByLabel('Nome', { exact: true }).fill('Aboleth da aurora');
  await sheet.getByLabel('Classe de armadura', { exact: true }).fill('24');
  await sheet.getByLabel('PV máximos', { exact: true }).fill('250');
  const matching = sheet
    .locator('.vtt-monster-edit-action')
    .filter({ has: page.locator('input[value="Tentacle"]') });
  await expect(matching).toHaveCount(1);
  const actionIndex = await matching.evaluate((el) =>
    [...el.parentElement!.querySelectorAll('.vtt-monster-edit-action')].indexOf(el),
  );
  const tentacle = sheet.locator('.vtt-monster-edit-action').nth(actionIndex);
  await tentacle.getByLabel('Rolagem de ataque', { exact: true }).fill('1d20+25');
  await tentacle.locator('textarea').nth(1).fill('7');
  await tentacle.getByLabel('Nome da ação', { exact: true }).fill('Tentáculo da aurora');
  await sheet.getByRole('button', { name: 'Salvar ficha e preset' }).click();
  sheet = page.getByRole('dialog', { name: 'Ficha · Aboleth da aurora', exact: true });
  await expect(
    sheet.getByRole('heading', { name: 'Aboleth da aurora', exact: true }),
  ).toBeVisible();
  await expect(
    sheet.getByRole('heading', { name: 'Tentáculo da aurora', exact: true }),
  ).toBeVisible();
  await sheet
    .getByRole('button', { name: 'Fechar Ficha · Aboleth da aurora', exact: true })
    .click();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Presets de monstros', exact: true }).click();
  await expect(panel.locator('.vtt-premium-grid')).toContainText('Aboleth da aurora');
  await page.screenshot({ path: 'test-results/vtt-private-presets-desktop.png' });
  await panel.getByRole('button', { name: 'Trazer à mesa', exact: true }).click();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  // Select the ordinary target, then apply the actual server roll from chat.
  const canvas = page.locator('canvas[data-camera-x]');
  const rect = await canvas.boundingBox();
  expect(rect).toBeTruthy();
  const cx = Number(await canvas.getAttribute('data-camera-x')),
    cy = Number(await canvas.getAttribute('data-camera-y')),
    zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  await page.mouse.click(
    rect!.x + rect!.width / 2 + (650 - cx) * zoom,
    rect!.y + rect!.height / 2 + (875 - cy) * zoom,
  );
  await externalMessage('Dano de teste');
  const row = log
    .locator('article')
    .filter({ has: page.getByText('Dano de teste', { exact: true }) });
  await expect(
    row.getByRole('button', { name: 'Aplicar dano em Alvo', exact: true }),
  ).toBeVisible();
  await row.getByRole('button', { name: 'Aplicar dano em Alvo', exact: true }).click();
  await expect(
    row.getByRole('button', { name: 'Dano aplicado em Alvo', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Galeria de monstros', exact: true }).click();
  await expect(panel.locator('.vtt-premium-grid > button')).toHaveCount(assets.length);
  await panel.getByRole('button', { name: 'Ver todos os monstros', exact: true }).click();
  await expect(panel.locator('.vtt-compendium img.premium')).toHaveCount(assets.length);
  await expect
    .poll(async () => {
      const {
        rows: [saved],
      } = await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id]);
      return saved.document.scenes[0].tokens.find((t: any) => t.name === 'Aboleth da aurora')
        ?.image;
    })
    .toBe('/api/vtt/premium-art/monster-aboleth');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Monstros', exact: true }).click();
  await expect(panel.locator('.vtt-compendium img.premium')).toHaveCount(assets.length);
  await page.screenshot({ path: 'test-results/vtt-premium-monsters.png' });
  await panel.getByRole('button', { name: 'Galeria de monstros', exact: true }).click();
  await expect
    .poll(() =>
      panel
        .locator('.vtt-premium-grid img')
        .first()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `test-results/vtt-premium-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  for (const [width, height] of [
    [1440, 900],
    [768, 760],
    [390, 650],
    [320, 540],
  ]) {
    await page.setViewportSize({ width, height });
    for (const collapsed of [true, false]) {
      const control = panel.locator('.vtt-chat-collapse');
      if ((await control.getAttribute('aria-expanded')) === String(collapsed))
        await control.click();
      await expect(control).toHaveAttribute('aria-expanded', String(!collapsed));
      const bounds = await panel.boundingBox(),
        compose = await panel.locator('.vtt-chat-compose').boundingBox(),
        history = await log.boundingBox();
      expect(bounds && compose && history).toBeTruthy();
      expect(compose!.y + compose!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
      expect(bounds!.y + bounds!.height - compose!.y - compose!.height).toBeLessThan(
        width < 700 ? 85 : 25,
      );
      expect(compose!.y - history!.y - history!.height).toBeLessThan(30);
      expect(history!.height).toBeGreaterThan(25);
      await panel.getByLabel('Mensagem', { exact: true }).click();
      await expect(panel.getByLabel('Mensagem', { exact: true })).toBeFocused();
      await expect(panel.getByRole('heading', { name: 'Macros', exact: true })).toHaveCount(0);
      await expect(
        panel.getByRole('button', { name: 'Salvar rolagem como macro', exact: true }),
      ).toHaveCount(0);
      await page.screenshot({ path: `test-results/vtt-chat-bottom-${width}-${collapsed}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log(
    'Chat no rodapé: histórico contíguo à mensagem, sem bloco de macros, controles expandidos/recolhidos em quatro tamanhos aprovados.',
  );
  const {
    rows: [selectionRoom],
  } = await pool.query('SELECT document,revision FROM vtt_rooms WHERE id=$1', [r.id]);
  const selectionScene = selectionRoom.document.scenes.find(
    (s: any) => s.id === selectionRoom.document.activeScene,
  );
  const first = newToken(randomUUID(), selectionScene),
    second = newToken(randomUUID(), selectionScene),
    outside = newToken(randomUUID(), selectionScene);
  Object.assign(first, { name: 'Grupo um', x: 750, y: 650, width: 70, height: 70 });
  Object.assign(second, { name: 'Grupo dois', x: 950, y: 650, width: 70, height: 70 });
  Object.assign(outside, { name: 'Fora do grupo', x: 1450, y: 650, width: 70, height: 70 });
  const stroke = drawingSchema.parse({
    id: randomUUID(),
    kind: 'pen',
    points: [
      { x: 720, y: 725 },
      { x: 990, y: 725 },
    ],
    width: 4,
    color: '#e7c58b',
    fill: false,
  });
  selectionScene.tokens.push(first, second, outside);
  selectionScene.drawings.push(stroke);
  const groupEffect = {
    id: randomUUID(),
    name: 'Chama do grupo',
    kind: 'fire',
    color: '#d68a44',
    scale: 1,
    duration: 0,
  };
  selectionRoom.document.effects.push(groupEffect);
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    r.id,
    JSON.stringify(selectionRoom.document),
  ]);
  const originalRevision = selectionRoom.revision + 1;
  await page.reload();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Seleção livre (L)', exact: true }).click();
  async function drawLasso(points: { x: number; y: number }[], shift = false, cancel = false) {
    const rect = (await canvas.boundingBox())!;
    const x = Number(await canvas.getAttribute('data-camera-x')),
      y = Number(await canvas.getAttribute('data-camera-y')),
      zoom = Number(await canvas.getAttribute('data-camera-zoom'));
    const screen = (p: { x: number; y: number }) => ({
      x: rect.x + rect.width / 2 + (p.x - x) * zoom,
      y: rect.y + rect.height / 2 + (p.y - y) * zoom,
    });
    if (shift) await page.keyboard.down('Shift');
    const start = screen(points[0]);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const p of points.slice(1)) {
      const s = screen(p);
      await page.mouse.move(s.x, s.y, { steps: 5 });
    }
    if (cancel) await page.keyboard.press('Escape');
    else await page.screenshot({ path: 'test-results/vtt-free-selection-contour.png' });
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
  }
  const contour = [
    { x: 650, y: 560 },
    { x: 800, y: 535 },
    { x: 1050, y: 565 },
    { x: 1070, y: 750 },
    { x: 900, y: 780 },
    { x: 670, y: 770 },
    { x: 650, y: 560 },
  ];
  await drawLasso(contour);
  await expect(canvas).toHaveAttribute('data-selection-count', '3');
  expect((await canvas.getAttribute('data-selection-ids'))!.split(',').sort()).toEqual(
    [first.id, second.id, stroke.id].sort(),
  );
  expect(
    (await pool.query('SELECT revision FROM vtt_rooms WHERE id=$1', [r.id])).rows[0].revision,
  ).toBe(originalRevision);
  await drawLasso(
    [
      { x: 1390, y: 590 },
      { x: 1510, y: 590 },
      { x: 1510, y: 710 },
      { x: 1390, y: 710 },
    ],
    true,
  );
  await expect(canvas).toHaveAttribute('data-selection-count', '4');
  await drawLasso(contour);
  await expect(canvas).toHaveAttribute('data-selection-count', '3');
  await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
  await expect(page.locator('.vtt-effects-target')).toHaveText('Alvos · 2 tokens');
  await page.locator('.vtt-effects-apply').filter({ hasText: 'Chama do grupo' }).click();
  await expect
    .poll(async () => {
      const doc = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
        .document;
      return doc.scenes[0].tokens.filter(
        (t: any) =>
          [first.id, second.id].includes(t.id) && t.effects.some((e: any) => e.kind === 'fire'),
      ).length;
    })
    .toBe(2);
  await page.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
  await page.screenshot({ path: 'test-results/vtt-free-selection-group.png' });
  await page.getByRole('button', { name: 'Excluir objetos selecionados', exact: true }).click();
  await expect
    .poll(async () => {
      const s = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
        .document.scenes[0];
      return [
        s.tokens.some((t: any) => t.id === first.id || t.id === second.id),
        s.drawings.some((d: any) => d.id === stroke.id),
        s.tokens.some((t: any) => t.id === outside.id),
      ];
    })
    .toEqual([false, false, true]);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect
    .poll(async () => {
      const s = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
        .document.scenes[0];
      return (
        s.tokens.filter((t: any) => [first.id, second.id].includes(t.id)).length +
        s.drawings.filter((d: any) => d.id === stroke.id).length
      );
    })
    .toBe(3);
  const beforeCancel = (
    await pool.query('SELECT document,revision FROM vtt_rooms WHERE id=$1', [r.id])
  ).rows[0];
  await canvas.focus();
  await page.keyboard.press('l');
  await drawLasso(contour, false, true);
  await expect(canvas).toHaveAttribute('data-selection-count', '0');
  expect(
    (await pool.query('SELECT document,revision FROM vtt_rooms WHERE id=$1', [r.id])).rows[0],
  ).toEqual(beforeCancel);
  const movementDocument = structuredClone(beforeCancel.document);
  movementDocument.scenes[0].grid.snap = false;
  movementDocument.scenes[0].restrictMovement = false;
  movementDocument.scenes[0].walls.push({
    id: randomUUID(),
    kind: 'wall',
    a: { x: 850, y: 580 },
    b: { x: 850, y: 760 },
    open: false,
  });
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    r.id,
    JSON.stringify(movementDocument),
  ]);
  await page.reload();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
  async function dragToken(points: { x: number; y: number }[]) {
    const rect = (await canvas.boundingBox())!,
      cx = Number(await canvas.getAttribute('data-camera-x')),
      cy = Number(await canvas.getAttribute('data-camera-y')),
      zoom = Number(await canvas.getAttribute('data-camera-zoom'));
    const screen = (p: { x: number; y: number }) => ({
      x: rect.x + rect.width / 2 + (p.x - cx) * zoom,
      y: rect.y + rect.height / 2 + (p.y - cy) * zoom,
    });
    const start = screen(points[0]);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const p of points.slice(1)) {
      const s = screen(p);
      await page.mouse.move(s.x, s.y, { steps: 10 });
    }
    await page.mouse.up();
  }
  await dragToken([
    { x: 750, y: 650 },
    { x: 970, y: 650 },
  ]);
  await expect
    .poll(async () => {
      const s = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
        .document.scenes[0];
      return s.tokens.find((t: any) => t.id === first.id).x;
    })
    .toBeGreaterThan(750);
  const blockedPosition = (
    await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])
  ).rows[0].document.scenes[0].tokens.find((t: any) => t.id === first.id);
  expect(blockedPosition.x).toBeLessThan(850);
  await dragToken([
    { x: blockedPosition.x, y: blockedPosition.y },
    { x: blockedPosition.x, y: 520 },
    { x: 1000, y: 520 },
    { x: 1000, y: 650 },
  ]);
  await expect
    .poll(async () => {
      const s = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
        .document.scenes[0];
      return Math.round(s.tokens.find((t: any) => t.id === first.id).x);
    })
    .toBe(1000);
  console.log(
    'Movimento no navegador: parede impede arraste direto mesmo sem restrição legada; contornar pela área aberta permite chegar ao outro lado.',
  );
  await page.getByRole('button', { name: 'Combate', exact: true }).click();
  await panel.getByRole('button', { name: 'Adicionar todos à ordem', exact: true }).click();
  const combatEntries = movementDocument.scenes[0].tokens.filter(
    (t: any) => t.layer === 'tokens' && !t.hidden,
  ).length;
  await expect(panel.locator('.vtt-combat-entry')).toHaveCount(combatEntries);
  await panel.getByRole('button', { name: 'Rolar todas as iniciativas', exact: true }).click();
  await expect
    .poll(async () =>
      Promise.all(
        (await panel.locator('.vtt-combat-entry input').all()).map((input) => input.inputValue()),
      ),
    )
    .not.toContain('');
  await panel.getByRole('button', { name: 'Iniciar combate', exact: true }).click();
  await expect(page.locator('.vtt-turn-carousel')).toContainText('Rodada 1');
  const carousel = page.locator('.vtt-turn-carousel');
  await expect(carousel.locator('article')).toHaveCount(Math.min(5, combatEntries));
  expect(await carousel.evaluate((el) => parseFloat(getComputedStyle(el).top))).toBe(8);
  await carousel.getByRole('button', { name: 'Minimizar carrossel', exact: true }).click();
  await expect(carousel.locator('article')).toHaveCount(0);
  await carousel.getByRole('button', { name: 'Expandir carrossel', exact: true }).click();
  await expect(carousel.locator('article')).toHaveCount(Math.min(5, combatEntries));
  await page.screenshot({ path: 'test-results/vtt-combat-carousel-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/vtt-combat-carousel-mobile.png' });
  await carousel.getByRole('button', { name: 'Minimizar carrossel', exact: true }).click();
  await page.screenshot({ path: 'test-results/vtt-combat-carousel-minimized.png' });
  console.log(
    'Combate: rolagem coletiva do mestre, início, carrossel mais alto/transparente e minimizar/expandir aprovados.',
  );
  const playerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const account = await playerContext.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name: 'Jogador da versão básica',
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      },
    });
    expect(account.ok()).toBe(true);
    const invite = (await pool.query('SELECT invite FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
      .invite;
    expect(
      (
        await playerContext.request.post(origin + '/api/vtt/join', {
          headers: { Origin: origin },
          data: { invite, role: 'player' },
        })
      ).ok(),
    ).toBe(true);
    const playerPage = await playerContext.newPage();
    playerPage.on('pageerror', (e) => errors.push(e.message));
    await playerPage.goto(origin + '/#vtt');
    await expect(
      playerPage.getByRole('region', { name: 'Mesa virtual', exact: true }),
    ).toBeVisible();
    await playerPage.getByRole('button', { name: 'Biblioteca', exact: true }).click();
    const playerPanel = playerPage.locator('.vtt-panel-content');
    await playerPanel.getByRole('button', { name: 'Monstros', exact: true }).click();
    await expect(playerPanel.locator('.vtt-compendium img.premium')).toHaveCount(assets.length);
    await playerPanel.getByRole('button', { name: 'Galeria de monstros', exact: true }).click();
    await expect(playerPanel.locator('.vtt-premium-grid > button')).toHaveCount(assets.length);
    await expect(playerPanel.locator('.vtt-premium-grid > button').first()).toHaveAttribute(
      'draggable',
      'false',
    );
    await expect(playerPanel.getByText('Mudar tokens para premium', { exact: true })).toHaveCount(
      0,
    );
    await playerPanel.locator('.vtt-premium-grid > button').first().click();
    await expect(
      playerPanel.getByRole('button', { name: 'Trazer à mesa', exact: true }),
    ).toHaveCount(0);
    await playerPage.screenshot({ path: 'test-results/vtt-basic-player.png' });
  } finally {
    await playerContext.close();
  }
  expect(errors).toEqual([]);
  console.log(
    'Seleção livre: contorno irregular, Shift, efeitos em dois tokens, exclusão mista, desfazer e Esc aprovados; seleção não grava nem move objetos.',
  );
  console.log(
    `VTT básico: ${assets.length} artes padrão em Monstros e Galeria, sem ativação/tag, recarga e mesas preservadas, chat/editor/dano e quatro larguras aprovados.`,
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/vtt-premium-failure.png' });
  console.log(
    await page
      .locator('.vtt-monster-editor')
      .textContent()
      .catch(() => ''),
  );
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
