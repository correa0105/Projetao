import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { newScene, newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { referenceGrassTextures } from '../shared/reference-grass';
import { terrainTextures } from '../shared/vtt-terrain';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável obrigatório.');
const origin = 'http://localhost:3075';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createLegacyTestCharacter } = await import('../tests/character-fixtures'),
  { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3075, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const options = {
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: {
    'Accept-Encoding': 'identity',
    'X-Vtt-Schema-Version': String(vttProtocolVersion),
  },
};
const gm = await browser.newContext(options),
  player = await browser.newContext(options),
  visitor = await browser.newContext(options);
for (const c of [gm, player, visitor])
  await c.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
const page = await gm.newPage(),
  peer = await player.newPage(),
  errors: string[] = [];
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/vtt-map-controls', { recursive: true });
await writeFile('test-results/vtt-map-controls/result.json', JSON.stringify({ passed: false }));
async function raw(c: BrowserContext, path: string, method = 'GET', data?: unknown) {
  return c.request.fetch(origin + '/api' + path, { method, headers: { Origin: origin }, data });
}
async function request(c: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await raw(c, path, method, data);
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function signup(c: BrowserContext, name: string) {
  const r = await request(c, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  return r.user;
}
try {
  const master = await signup(gm, 'Mestre'),
    owner = await signup(player, 'Jogadora'),
    outsider = await signup(visitor, 'Visitante');
  for (const [context, account] of [[gm, master], [player, owner]] as const)
    await context.addInitScript(id => {
      const key = 'alvorada-vtt-media:' + id;
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ mapEffects: false, masterEffects: false, soundEnabled: false }));
    }, account.id);
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [master.id]);
  const masterHero = await createLegacyTestCharacter(master.id, 'Arden'),
    hero = await createLegacyTestCharacter(owner.id, 'Mira'),
    second = await createLegacyTestCharacter(owner.id, 'Borin'),
    privateHero = await createLegacyTestCharacter(outsider.id, 'Reservado');
  await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
    hero.id,
    await readFile('public/character-silhouette-v2.png'),
  ]);
  const siteBefore = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0];
  let room = await request(gm, '/vtt', 'POST', { name: 'Camadas e personagens' }),
    path = '/vtt/rooms/' + room.id;
  expect((await raw(visitor, path + '/characters')).status()).toBe(404);
  expect((await raw(gm, path + '/characters/' + privateHero.id, 'POST', {})).status()).toBe(404);
  await request(player, '/vtt/join', 'POST', { invite: room.invite });
  await request(visitor, '/vtt/join', 'POST', { invite: room.invite, role: 'spectator' });
  expect((await raw(player, path + '/characters')).status()).toBe(403);
  expect((await raw(visitor, path + '/characters')).status()).toBe(403);
  expect((await raw(player, path + '/characters/' + masterHero.id, 'POST', {})).status()).toBe(404);
  expect((await raw(visitor, path + '/characters/' + privateHero.id, 'POST', {})).status()).toBe(
    403,
  );
  expect((await raw(player, path + '/capture-permission')).status()).toBe(403);
  expect((await request(gm, path + '/capture-permission')).allowed).toBe(true);
  const roster = (await request(gm, path + '/characters')).characters;
  expect(roster.map((c: any) => c.id).sort()).toEqual([masterHero.id, hero.id, second.id].sort());
  expect(roster.every((c: any) => c.gold_cp === undefined && c.biography === undefined)).toBe(true);
  room = await request(gm, path);
  const scene = newScene(randomUUID());
  Object.assign(scene, {
    name: 'Mapa de camadas',
    width: 1000,
    height: 700,
    fog: false,
    lighting: false,
    backgroundColor: '#202b38',
  });
  scene.grid.type = 'none';
  scene.grid.snap = false;
  const red = {
    ...newToken(randomUUID(), scene),
    name: 'Caixa rubra',
    x: 400,
    y: 300,
    width: 180,
    height: 130,
    color: '#bd4234',
    layer: 'map' as const,
    level: 0,
  };
  const blue = {
    ...newToken(randomUUID(), scene),
    name: 'Caixa azul',
    x: 400,
    y: 300,
    width: 180,
    height: 130,
    color: '#446cba',
    layer: 'map' as const,
    level: 1,
  };
  scene.tokens = [red, blue];
  room.document.scenes.push(scene);
  room.document.activeScene = scene.id;
  await request(gm, path, 'PUT', { revision: room.revision, document: room.document });
  await page.goto(origin + '/#vtt?room=' + room.id);
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  const rosterPanel = page.getByRole('region', { name: 'Personagens dos jogadores da mesa' });
  await expect(rosterPanel.locator('[data-room-character]')).toHaveCount(3);
  await rosterPanel.getByRole('button', { name: 'Colocar Mira no mapa', exact: true }).click();
  await expect(board).toHaveAttribute('data-selection-count', '1');
  const stored = async () => request(gm, path);
  const current = async () => {
    const r = await stored();
    return r.document.scenes.find((s: any) => s.id === scene.id);
  };
  await expect
    .poll(async () => (await current()).tokens.filter((t: any) => t.characterId === hero.id).length)
    .toBe(1);
  let placed = (await current()).tokens.find((t: any) => t.characterId === hero.id);
  expect(placed.controller).toBe(owner.id);
  expect(placed.image).toMatch(/^\/api\/vtt\/assets\//);
  expect((await gm.request.get(origin + placed.image)).ok()).toBe(true);
  const assetsBefore = (
    await pool.query('SELECT count(*)::int n FROM vtt_assets WHERE room_id=$1', [room.id])
  ).rows[0].n;
  await rosterPanel.getByRole('button', { name: 'Selecionar Mira no mapa', exact: true }).click();
  await expect(
    rosterPanel.getByRole('button', { name: 'Selecionar Mira no mapa', exact: true }),
  ).toBeEnabled();
  expect((await current()).tokens.filter((t: any) => t.characterId === hero.id).length).toBe(1);
  expect(
    (await pool.query('SELECT count(*)::int n FROM vtt_assets WHERE room_id=$1', [room.id])).rows[0]
      .n,
  ).toBe(assetsBefore);
  await rosterPanel
    .locator(`[data-room-character="${second.id}"]`)
    .dragTo(board, { targetPosition: { x: 220, y: 180 } });
  await expect
    .poll(async () =>
      (await current()).tokens.some(
        (t: any) => t.characterId === second.id && t.controller === owner.id,
      ),
    )
    .toBe(true);
  await page.getByLabel('Camadas', { exact: true }).click();
  await page.getByRole('button', { name: 'Ordem de sobreposição dos itens', exact: true }).click();
  const layers = page.getByRole('region', { name: 'Camadas dos itens' });
  await expect(layers).toBeVisible();
  await layers.locator(`[data-stack-item="${red.id}"]`).click();
  await layers.getByRole('button', { name: 'Trazer para frente', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => {
      const s = await current();
      return (
        s.tokens.find((t: any) => t.id === red.id).level >
        s.tokens.find((t: any) => t.id === blue.id).level
      );
    })
    .toBe(true);
  await layers.getByRole('button', { name: 'Descer uma camada', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => {
      const s = await current();
      return (
        s.tokens.find((t: any) => t.id === red.id).level <
        s.tokens.find((t: any) => t.id === blue.id).level
      );
    })
    .toBe(true);
  const camera = async () =>
    board.evaluate((e) => ({
      x: +e.dataset.cameraX!,
      y: +e.dataset.cameraY!,
      zoom: +e.dataset.cameraZoom!,
    }));
  const screen = async (x: number, y: number) => {
    const b = (await board.boundingBox())!,
      c = await camera();
    return {
      x: b.x + b.width / 2 + (x - c.x) * c.zoom,
      y: b.y + b.height / 2 + (y - c.y) * c.zoom,
    };
  };
  // The selected item can rotate even while another item covers it.
  const cameraBefore = await camera(),
    from = await screen(red.x + 50, red.y),
    to = await screen(red.x, red.y + 50);
  await page.mouse.move(from.x, from.y);
  await page.keyboard.down('Control');
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => (await current()).tokens.find((t: any) => t.id === red.id).rotation)
    .toBeCloseTo(90, 1);
  expect(await camera()).toEqual(cameraBefore);
  await page.mouse.move(to.x, to.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Control');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => (await current()).tokens.find((t: any) => t.id === red.id).rotation)
    .toBeCloseTo(105, 1);
  expect(await camera()).toEqual(cameraBefore);
  const cancelFrom = await screen(red.x + 25, red.y),
    cancelTo = await screen(red.x, red.y + 25);
  await page.mouse.move(cancelFrom.x, cancelFrom.y);
  await page.keyboard.down('Control');
  await page.mouse.down();
  await page.mouse.move(cancelTo.x, cancelTo.y, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.keyboard.up('Control');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  expect((await current()).tokens.find((t: any) => t.id === red.id).rotation).toBeCloseTo(105, 1);
  await layers.getByLabel('Camada dos itens selecionados', { exact: true }).selectOption('tokens');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => (await current()).tokens.find((t: any) => t.id === red.id).layer)
    .toBe('tokens');
  await layers.getByLabel('Camada dos itens selecionados', { exact: true }).selectOption('map');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => (await current()).tokens.find((t: any) => t.id === red.id).layer)
    .toBe('map');
  await page.screenshot({ path: 'test-results/vtt-map-controls/layers.png' });
  await page.getByRole('button', { name: 'Brush do mapa', exact: true }).click();
  await expect(page.locator('.vtt-terrain-textures button')).toHaveCount(terrainTextures.length);
  await expect(page.locator('.vtt-terrain-textures button').first()).toHaveAccessibleName(
    'Textura: Grama fina clara',
  );
  const textureSearch = page.getByRole('searchbox', {
    name: 'Buscar textura de terreno',
    exact: true,
  });
  await textureSearch.fill('fina clara');
  await expect(page.locator('.vtt-terrain-textures button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Textura: Grama fina clara', exact: true }).click();
  await expect(page.locator('[aria-label="Textura selecionada"]')).toContainText(
    'Grama fina clara',
  );
  await page.screenshot({ path: 'test-results/vtt-map-controls/grass-search.png' });
  await textureSearch.fill('');
  for (const [index, texture] of referenceGrassTextures.entries()) {
    await page.getByRole('button', { name: 'Textura: ' + texture.name, exact: true }).click();
    const from = await screen(150 + index * 180, 550),
      to = await screen(220 + index * 180, 550);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () =>
        (await current()).terrain.some((stroke: any) => stroke.texture === texture.id),
      )
      .toBe(true);
  }
  await page.screenshot({ path: 'test-results/vtt-map-controls/grass-brushes.png' });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Capturar mapa em alta qualidade', exact: true }).click();
  const download = await downloadPromise,
    imagePath = 'test-results/vtt-map-controls/capture.png';
  await download.saveAs(imagePath);
  const metadata = await sharp(imagePath).metadata(),
    bounds = (await board.boundingBox())!;
  expect(metadata.format).toBe('png');
  expect(metadata.width).toBe(Math.round(bounds.width * 4));
  expect(metadata.height).toBe(Math.round(bounds.height * 4));
  expect(metadata.width! <= 8192 && metadata.height! <= 8192).toBe(true);
  expect((await sharp(imagePath).stats()).channels.some((c) => c.stdev > 5)).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(board).toBeVisible();
  expect((await current()).tokens.find((t: any) => t.id === red.id).rotation).toBeCloseTo(105, 1);
  expect((await current()).terrain.map((stroke: any) => stroke.texture)).toEqual(
    referenceGrassTextures.map((t) => t.id),
  );
  // Navigation is local to the viewer: dragging must not edit the saved map.
  await board.focus();
  await page.keyboard.press('v');
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  const panSetting = page.getByLabel('Botão para mover o mapa', { exact: true });
  await expect(panSetting).toHaveValue('right');
  const pan = async (button: 'left' | 'right' | 'middle', dx: number, dy: number, start?: { x: number; y: number }) => {
    const from = start || await screen(850, 100);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button });
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
    await page.mouse.up({ button });
  };
  const unchangedMap = await current();
  let beforePan = await camera();
  await pan('left', 60, 30);
  expect(await camera()).toEqual(beforePan);
  await pan('right', 60, 30);
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 60 / beforePan.zoom, 3);
  await expect.poll(async () => (await camera()).y).toBeCloseTo(beforePan.y - 30 / beforePan.zoom, 3);
  expect(await current()).toEqual(unchangedMap);
  await expect(page.locator('.vtt-token-hud')).toHaveCount(0);
  beforePan = await camera();
  await pan('middle', -30, 15);
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x + 30 / beforePan.zoom, 3);
  beforePan = await camera();
  await board.focus();
  await page.keyboard.down('Space');
  await pan('left', 25, -20);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 25 / beforePan.zoom, 3);
  // Pan over a map object without changing it or opening its context menu.
  beforePan = await camera();
  await pan('right', 40, 15, await screen(red.x, red.y));
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 40 / beforePan.zoom, 3);
  await expect(page.locator('.vtt-token-hud')).toHaveCount(0);
  expect(await current()).toEqual(unchangedMap);
  await panSetting.selectOption('left');
  beforePan = await camera();
  await pan('right', 40, 20);
  expect(await camera()).toEqual(beforePan);
  await pan('left', 40, 20);
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 40 / beforePan.zoom, 3);
  await page.reload();
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await expect(panSetting).toHaveValue('left');
  await page.screenshot({ path: 'test-results/vtt-map-controls/pan-button-preference.png' });
  await panSetting.selectOption('right');
  const touch = await gm.newCDPSession(page), touchStart = await screen(850, 100);
  beforePan = await camera();
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchStart] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchStart.x + 45, y: touchStart.y + 20 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 45 / beforePan.zoom, 3);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await touch.detach();
  expect(await current()).toEqual(unchangedMap);
  await page.getByRole('button', { name: 'Brush do mapa', exact: true }).click();
  beforePan = await camera();
  await pan('right', 30, 10);
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 30 / beforePan.zoom, 3);
  expect(await current()).toEqual(unchangedMap);
  await board.focus();
  await page.keyboard.press('v');
  await page.getByRole('button', { name: 'Áreas de transparência', exact: true }).click();
  await expect(page.getByLabel('Editor de áreas de transparência', { exact: true })).toBeVisible();
  const canopyBoard = (await board.boundingBox())!;
  const canopyBlank = { x: canopyBoard.x + canopyBoard.width * .3, y: canopyBoard.y + canopyBoard.height * .2 };
  beforePan = await camera();
  await pan('left', 20, 10, canopyBlank);
  expect(await camera()).toEqual(beforePan);
  await pan('right', 20, 10, canopyBlank);
  await expect.poll(async () => (await camera()).x).toBeCloseTo(beforePan.x - 20 / beforePan.zoom, 3);
  expect(await current()).toEqual(unchangedMap);
  await page.getByRole('button', { name: 'Áreas de transparência', exact: true }).click();
  // Right dragging an actor retains its measured movement; a right click opens its menu.
  const actor = (await current()).tokens.find((t: any) => t.characterId === hero.id);
  beforePan = await camera();
  await pan('right', 25, 15, await screen(actor.x, actor.y));
  expect(await camera()).toEqual(beforePan);
  await expect.poll(async () => (await current()).tokens.find((t: any) => t.id === actor.id).x).not.toBe(actor.x);
  const movedActor = (await current()).tokens.find((t: any) => t.id === actor.id);
  await expect(page.locator('.vtt-token-hud')).toHaveCount(0);
  const actorPoint = await screen(movedActor.x, movedActor.y);
  await page.mouse.click(actorPoint.x, actorPoint.y, { button: 'right' });
  await expect(page.locator('.vtt-token-hud')).toBeVisible();
  await board.focus();
  await page.keyboard.press('Escape');
  await peer.goto(origin + '/#vtt?room=' + room.id);
  await peer.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(peer.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await peer.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await expect(peer.getByLabel('Botão para mover o mapa', { exact: true })).toHaveValue('right');
  await expect(
    peer.getByRole('button', { name: 'Capturar mapa em alta qualidade', exact: true }),
  ).toHaveCount(0);
  await expect(peer.getByLabel('Camadas', { exact: true })).toHaveCount(0);
  await peer.getByRole('button', { name: 'Fichas', exact: true }).click();
  await peer.getByRole('button', { name: 'Colocar Mira no mapa', exact: true }).click();
  await expect(
    peer.getByRole('button', { name: 'Colocar Mira no mapa', exact: true }),
  ).toBeEnabled();
  const playerBoard = peer.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(playerBoard).toHaveAttribute('data-selection-count', '1');
  const pb = (await playerBoard.boundingBox())!;
  const rotationBeforeWheel = (await current()).tokens.find((t: any) => t.characterId === hero.id).rotation;
  await peer.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await peer.keyboard.down('Control');
  await peer.mouse.wheel(0, 120);
  await peer.keyboard.up('Control');
  await expect
    .poll(async () => (await current()).tokens.find((t: any) => t.characterId === hero.id).rotation)
    .toBeCloseTo((rotationBeforeWheel + 15) % 360, 3);
  const playerCamera = await playerBoard.evaluate((e) => ({
    x: +e.dataset.cameraX!,
    y: +e.dataset.cameraY!,
    zoom: +e.dataset.cameraZoom!,
  }));
  const playerScreen = (x: number, y: number) => ({
    x: pb.x + pb.width / 2 + (x - playerCamera.x) * playerCamera.zoom,
    y: pb.y + pb.height / 2 + (y - playerCamera.y) * playerCamera.zoom,
  });
  placed = (await current()).tokens.find((t: any) => t.characterId === hero.id);
  const playerFrom = playerScreen(placed.x + 20, placed.y),
    playerTo = playerScreen(placed.x, placed.y + 20);
  await peer.mouse.move(playerFrom.x, playerFrom.y);
  await peer.keyboard.down('Control');
  await peer.mouse.down();
  await peer.mouse.move(playerTo.x, playerTo.y, { steps: 6 });
  await peer.mouse.up();
  await peer.keyboard.up('Control');
  await expect
    .poll(async () => (await current()).tokens.find((t: any) => t.characterId === hero.id).rotation)
    .toBeCloseTo((rotationBeforeWheel + 105) % 360, 1);
  expect(
    (await raw(visitor, path + '/tokens/' + placed.id, 'PATCH', { rotation: 60 })).status(),
  ).toBe(403);
  const viewports = [];
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel('Camadas', { exact: true }).click();
    await page
      .getByRole('button', { name: 'Ordem de sobreposição dos itens', exact: true })
      .click();
    await expect(layers).toBeVisible();
    const b = (await layers.boundingBox())!;
    expect(b.x >= 0 && b.x + b.width <= width + 1).toBe(true);
    await page.screenshot({ path: `test-results/vtt-map-controls/layers-${width}.png` });
    viewports.push(width);
  }
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [master.id]);
  // Personal VTT ownership, rather than site administration, grants these controls.
  expect((await raw(gm, path + '/capture-permission')).status()).toBe(200);
  expect((await raw(gm, path + '/characters')).status()).toBe(200);
  expect((await raw(gm, path + '/characters/' + hero.id, 'POST', {})).status()).toBe(201);
  expect((await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0]).toEqual(
    siteBefore,
  );
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/vtt-map-controls/result.json',
    JSON.stringify(
      {
        passed: true,
        viewports,
        stacking: true,
        ctrlDrag: true,
        ctrlWheel: true,
        ctrlCancellation: true,
        rightButtonPan: true,
        leftButtonOptionAndPersistence: true,
        navigationDoesNotEditMap: true,
        touchAndNavigationShortcuts: true,
        brushAndCanopyNavigation: true,
        rightTokenMovementAndMenu: true,
        playerControl: true,
        participantImport: true,
        importIdempotent: true,
        readOnlySpectator: true,
        rosterPrivacy: true,
        ownerCapture: true,
        referenceGrassBrushes: referenceGrassTextures.length,
        grassSearchAndPreview: true,
        capture: { width: metadata.width, height: metadata.height, format: metadata.format },
        siteCharacterPreserved: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS VTT: camadas, Ctrl, personagens dos participantes, permissões e captura PNG em alta resolução.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/vtt-map-controls/failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
