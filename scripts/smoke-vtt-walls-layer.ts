import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { movementBlocked } from '../shared/vtt-movement.js';
import { sightPolygon } from '../shared/vtt.js';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3040';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3040, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'X-Vtt-Schema-Version': '7' },
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
const barrierNames = ['Barreira de luz', 'Porta', 'Janela', 'Fonte de luz'];
async function layer(name: string, synthetic = false) {
  const layers = page.getByRole('button', { name: 'Camadas', exact: true });
  if (synthetic) await layers.evaluate((el: HTMLButtonElement) => el.click());
  else await layers.click();
  const option = page
    .getByRole('group', { name: 'Opções de Camadas', exact: true })
    .getByRole('button', { name, exact: true });
  if (synthetic) await option.evaluate((el: HTMLButtonElement) => el.click());
  else await option.click();
}
async function assertLayer(name: string) {
  await page.getByRole('button', { name: 'Camadas', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Opções de Camadas', exact: true })
      .getByRole('button', { name, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
}
async function screen(x: number, y: number) {
  const box = (await board.boundingBox())!;
  const [cx, cy, zoom] = await Promise.all(
    ['data-camera-x', 'data-camera-y', 'data-camera-zoom'].map((name) =>
      board.getAttribute(name).then(Number),
    ),
  );
  return {
    x: box.x + box.width / 2 + (x - cx) * zoom,
    y: box.y + box.height / 2 + (y - cy) * zoom,
  };
}
async function wallPixels() {
  return board.evaluate((el: HTMLCanvasElement) => {
    const box = el.getBoundingClientRect(),
      zoom = Number(el.dataset.cameraZoom),
      cx = Number(el.dataset.cameraX),
      cy = Number(el.dataset.cameraY),
      x = box.width / 2 + (850 - cx) * zoom,
      y = box.height / 2 + (750 - cy) * zoom,
      ratio = el.width / box.width;
    const pixels = el
      .getContext('2d')!
      .getImageData(Math.round((x - 12) * ratio), Math.round((y - 5) * ratio), 24, 10).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 80 && pixels[i] > pixels[i + 2] + 35) red++;
    return red;
  });
}
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Paredes por camada',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Mestre das barreiras');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Paredes na iluminação');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(board).toBeVisible();
  const {
    rows: [room],
  } = await pool.query('SELECT id,document,revision FROM vtt_rooms WHERE owner_id=$1', [user.id]);
  const scene = room.document.scenes[0];
  scene.background = '';
  scene.grid.type = 'none';
  scene.grid.snap = false;
  scene.fog = false;
  scene.ambient = 1;
  scene.walls = [
    { id: randomUUID(), kind: 'wall', a: { x: 700, y: 750 }, b: { x: 1000, y: 750 }, open: false },
    { id: randomUUID(), kind: 'door', a: { x: 760, y: 1000 }, b: { x: 950, y: 1000 }, open: false },
    {
      id: randomUUID(),
      kind: 'window',
      a: { x: 1080, y: 730 },
      b: { x: 1080, y: 850 },
      open: false,
    },
  ];
  const saved = await context.request.put(origin + '/api/vtt/rooms/' + room.id, {
    headers: { Origin: origin },
    data: { revision: room.revision, document: room.document },
  });
  expect(saved.ok()).toBe(true);
  await page.reload();
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await page
    .locator('.vtt-panel-content')
    .getByRole('button', { name: 'Mapa', exact: true })
    .click();
  await layer('Iluminação e barreiras');
  for (const name of barrierNames)
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.getByLabel('Mostrar barreiras do mestre')).toBeChecked();
  await expect.poll(wallPixels).toBeGreaterThan(10);
  const wallAt = await screen(850, 750),
    doorAt = await screen(855, 1000);
  await page.mouse.click(wallAt.x, wallAt.y);
  await expect(board).toHaveAttribute('data-selection-ids', scene.walls[0].id);
  await page.mouse.click(wallAt.x, wallAt.y, { button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Ações do objeto' })).toBeVisible();
  for (const name of ['Tokens · jogadores', 'Fundo · visível aos jogadores', 'Mestre · oculto']) {
    await layer(name);
    await expect(board).toHaveAttribute('data-selection-count', '0');
    await expect(page.getByRole('dialog', { name: 'Ações do objeto' })).toHaveCount(0);
    for (const tool of barrierNames)
      await expect(page.getByRole('button', { name: tool, exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Mostrar barreiras do mestre')).toHaveCount(0);
    await expect(page.getByText('Paredes, portas e janelas', { exact: true })).toHaveCount(0);
    await expect.poll(wallPixels).toBe(0);
    await page.mouse.click(wallAt.x, wallAt.y);
    await expect(board).toHaveAttribute('data-selection-count', '0');
    await board.focus();
    await page.keyboard.press('Delete');
    await page.mouse.click(wallAt.x, wallAt.y, { button: 'right' });
    await expect(page.getByRole('dialog', { name: 'Ações do objeto' })).toHaveCount(0);
    await page.mouse.dblclick(doorAt.x, doorAt.y);
    const state = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id]))
      .rows[0].document;
    expect(state.scenes[0].walls).toEqual(scene.walls);
    expect(movementBlocked(state.scenes[0], { x: 850, y: 700 }, { x: 850, y: 800 })).toBe(true);
    const vision = sightPolygon({ x: 850, y: 700 }, 300, state.scenes[0]);
    expect(vision.find((p) => Math.abs(p.x - 850) < 0.1 && p.y > 700)?.y).toBeCloseTo(750);
  }
  await layer('Iluminação e barreiras');
  await page.getByLabel('Mostrar barreiras do mestre').uncheck();
  await page.mouse.click(wallAt.x, wallAt.y);
  await expect(board).toHaveAttribute('data-selection-count', '0');
  await expect.poll(wallPixels).toBe(0);
  await page.getByLabel('Mostrar barreiras do mestre').check();
  await page.getByRole('button', { name: 'Barreira de luz', exact: true }).click();
  const from = await screen(1100, 1000),
    to = await screen(1250, 1150);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await layer('Tokens · jogadores', true);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Selecionar (V)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document
      .scenes[0].walls,
  ).toEqual(scene.walls);
  await layer('Iluminação e barreiras');
  await page.getByRole('button', { name: 'Barreira de luz', exact: true }).click();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document
          .scenes[0].walls.length,
    )
    .toBe(4);
  await board.focus();
  await page.keyboard.press('Escape');
  const addedAt = await screen(1175, 1075);
  await page.mouse.click(addedAt.x, addedAt.y);
  await expect(board).toHaveAttribute('data-selection-count', '1');
  await board.focus();
  await page.keyboard.press('Delete');
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document
          .scenes[0].walls,
    )
    .toEqual(scene.walls);
  // Choosing a drawing after a wall must keep the new tool, even though the
  // layer transition also resets the previous wall tool.
  await layer('Iluminação e barreiras');
  await page.getByRole('button', { name: 'Barreira de luz', exact: true }).click();
  await page.getByRole('button', { name: 'Formas', exact: true }).click();
  await page
    .getByRole('group', { name: 'Opções de Formas', exact: true })
    .getByRole('button', { name: 'Retângulo', exact: true })
    .click();
  await assertLayer('Tokens · jogadores');
  await expect(page.getByRole('button', { name: 'Formas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await layer('Iluminação e barreiras');
  await page.getByRole('button', { name: 'Barreira de luz', exact: true }).click();
  await page.getByRole('button', { name: 'Desenhar (P)', exact: true }).click();
  await assertLayer('Tokens · jogadores');
  await expect(page.getByRole('button', { name: 'Desenhar (P)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await layer('Iluminação e barreiras');
  await page.getByRole('button', { name: 'Selecionar (V)' }).click();
  await page.mouse.click(wallAt.x, wallAt.y);
  await page.getByRole('button', { name: 'Visão do jogador', exact: true }).click();
  await expect(board).toHaveAttribute('data-selection-count', '0');
  await expect(page.getByRole('button', { name: 'Barreira de luz', exact: true })).toHaveCount(0);
  await page.mouse.dblclick(doorAt.x, doorAt.y);
  expect(
    (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document
      .scenes[0].walls,
  ).toEqual(scene.walls);
  await page.getByRole('button', { name: 'Visão do jogador', exact: true }).click();
  await page.mouse.dblclick(doorAt.x, doorAt.y);
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document
          .scenes[0].walls[1].open,
    )
    .toBe(true);
  // Markers keep their active map/GM layer. Monster drop always enters Tokens.
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page
    .locator('.vtt-panel-content')
    .getByRole('button', { name: 'Token selecionado', exact: true })
    .click();
  for (const [name, id] of [
    ['Fundo · visível aos jogadores', 'map'],
    ['Mestre · oculto', 'gm'],
  ]) {
    await layer(name);
    await page
      .locator('.vtt-panel-content')
      .getByRole('button', { name: 'Token', exact: true })
      .click();
    await assertLayer(name);
    await expect(board).toHaveAttribute('data-selection-count', '1');
    const markerId = (await board.getAttribute('data-selection-ids'))!;
    await expect
      .poll(
        async () =>
          (
            await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])
          ).rows[0].document.scenes[0].tokens.find((t: any) => t.id === markerId)?.layer,
      )
      .toBe(id);
  }
  await layer('Iluminação e barreiras');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page
    .locator('.vtt-panel-content')
    .getByRole('button', { name: 'Monstros', exact: true })
    .click();
  const aboleth = page.locator('.vtt-compendium > button').filter({ hasText: /^AbolethND/ });
  await aboleth.locator('img').dragTo(board, { targetPosition: { x: 250, y: 200 } });
  await assertLayer('Tokens · jogadores');
  await expect(board).toHaveAttribute('data-selection-count', '1');
  await expect
    .poll(
      async () =>
        (
          await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])
        ).rows[0].document.scenes[0].tokens.find((t: any) => t.name === 'Aboleth')?.layer,
    )
    .toBe('tokens');
  await page.reload();
  await layer('Iluminação e barreiras');
  await expect.poll(wallPixels).toBeGreaterThan(10);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/vtt-walls-lighting-only.png' });
  await layer('Tokens · jogadores');
  await expect.poll(wallPixels).toBe(0);
  await page.screenshot({ path: 'test-results/vtt-walls-tokens-hidden.png' });
  const finalState = await (await context.request.get(origin + '/api/vtt/rooms/' + room.id)).json();
  expect(finalState.document.scenes[0].walls).toEqual(
    scene.walls.map((w: any, i: number) => ({ ...w, open: i === 1 })),
  );
  const player = await browser.newContext({ extraHTTPHeaders: { 'X-Vtt-Schema-Version': '7' } });
  const playerSignup = await player.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Jogador das paredes',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(playerSignup.ok()).toBe(true);
  expect(
    (
      await player.request.post(origin + '/api/vtt/join', {
        headers: { Origin: origin },
        data: { invite: finalState.invite, role: 'player' },
      })
    ).ok(),
  ).toBe(true);
  const playerPage = await player.newPage();
  await playerPage.goto(origin + '/#vtt');
  await expect(playerPage.getByRole('button', { name: 'Camadas', exact: true })).toHaveCount(0);
  for (const name of barrierNames)
    await expect(playerPage.getByRole('button', { name, exact: true })).toHaveCount(0);
  expect(
    (
      await player.request.put(origin + '/api/vtt/rooms/' + room.id, {
        headers: { Origin: origin },
        data: { revision: finalState.revision, document: finalState.document },
      })
    ).status(),
  ).toBe(403);
  await player.close();
  expect(errors).toEqual([]);
  console.log(
    'VTT walls: lighting-only lines/selection/tools/context; layer/preview cancels hidden edits, persisted geometry/physics, markers and monster drop preserved; player403 passed.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
}
