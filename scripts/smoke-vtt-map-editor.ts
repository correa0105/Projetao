import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
import { newToken } from '../shared/vtt';
import { rockAssets } from '../shared/vtt-rock-assets';
import { terrainTextures } from '../shared/vtt-terrain';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3064';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
await mkdir('test-results/map-editor', { recursive: true });
await mkdir('dist/client/__qa', { recursive: true });
const bundle = await build({
  stdin: {
    contents:
      "import {renderVtt} from './src/vtt-canvas';import {newScene,newToken} from './shared/vtt';import {bindCanopy,resolveCanopy} from './shared/vtt-canopies';import {drawTerrain} from './src/vtt-terrain-canvas';import {drawMapWind,mapWindMotion} from './src/vtt-map-wind';import {effectMaterialsReady} from './src/vtt-effects-materials';import {physicalPropsReady} from './src/vtt-effects-physical'; window.editorQA={renderVtt,newScene,newToken,bindCanopy,resolveCanopy,drawTerrain,drawMapWind,mapWindMotion,ready:Promise.all([effectMaterialsReady,physicalPropsReady])};",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
});
await writeFile('dist/client/__qa/renderer.js', bundle.outputFiles[0].text);
await cp('public/vtt/rocks-20261013', 'dist/client/vtt/rocks-20261013', { recursive: true });
await mkdir('dist/client/vtt/scenery-v2-20261012', { recursive: true });
for (const t of terrainTextures) await cp('public' + t.image, 'dist/client' + t.image);
const { createApp } = await import('../server/app');
const env = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const app = createApp();
const server = app.listen(3064, '127.0.0.1');
process.env.NODE_ENV = env;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage();
await ctx.addInitScript(
  'globalThis.__name=(fn)=>fn;localStorage.setItem("alvorada-music-muted","true");localStorage.setItem("alvorada-effects-muted","true");',
);
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
async function request(path: string, data?: unknown, method = 'POST') {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    data,
    headers: { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
try {
  const account = (
    await request('/auth/sign-up/email', {
      name: 'Editor de teste',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [account.id]);
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('QA de edição');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  const room = (await pool.query('SELECT id FROM vtt_rooms WHERE owner_id=$1', [account.id]))
    .rows[0];
  const stored = async () =>
    (await pool.query('SELECT document,revision FROM vtt_rooms WHERE id=$1', [room.id])).rows[0];
  let row = await stored(),
    s = row.document.scenes[0];
  s.width = 900;
  s.height = 700;
  s.grid.type = 'none';
  s.backgroundColor = '#b7a580';
  s.fog = false;
  s.lighting = false;
  const actor = {
    ...newToken(randomUUID(), s),
    name: 'Irineu',
    x: 450,
    y: 350,
    width: 75,
    height: 75,
    color: '#bb3838',
    controller: account.id,
    hp: 11,
    maxHp: 11,
  };
  const rock = {
    ...newToken(randomUUID(), s),
    name: 'Rocha de teste',
    x: 260,
    y: 380,
    width: 150,
    height: 150,
    layer: 'map',
    image: rockAssets[0].image,
  };
  const backdrop = {
    ...newToken(randomUUID(), s),
    name: 'Fundo travado',
    x: 450,
    y: 350,
    width: 900,
    height: 700,
    layer: 'map',
    image: '',
    locked: true,
    color: '#b7a580',
    level: -1,
  };
  s.tokens = [backdrop, rock, actor];
  await request('/vtt/rooms/' + room.id, { document: row.document, revision: row.revision }, 'PUT');
  await page.reload();
  const canvas = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(canvas).toBeVisible();
  async function camera() {
    return canvas.evaluate((e) => ({
      x: +e.dataset.cameraX!,
      y: +e.dataset.cameraY!,
      zoom: +e.dataset.cameraZoom!,
    }));
  }
  async function screen(x: number, y: number) {
    const b = (await canvas.boundingBox())!,
      c = await camera();
    return {
      x: b.x + b.width / 2 + (x - c.x) * c.zoom,
      y: b.y + b.height / 2 + (y - c.y) * c.zoom,
    };
  }
  async function pan(x: number, y: number, button: 'left' | 'middle' = 'left') {
    const before = await camera();
    await page.mouse.move(x, y);
    await page.mouse.down({ button });
    await page.mouse.move(x + 64, y + 39, { steps: 8 });
    await page.mouse.up({ button });
    await expect
      .poll(async () => Math.hypot((await camera()).x - before.x, (await camera()).y - before.y))
      .toBeGreaterThan(10);
  }
  // Left drag on bare map, outside map, locked map object, and middle during painting.
  let p = await screen(100, 100);
  await pan(p.x, p.y);
  const box = (await canvas.boundingBox())!;
  await pan(box.x + 8, box.y + 16);
  await page.getByLabel('Camadas', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Fundo · visível aos jogadores', exact: true })
    .first()
    .click();
  p = await screen(100, 100);
  await pan(p.x, p.y);
  // Brush palette and layers, with input through actual pointer capture.
  await page.getByRole('button', { name: 'Brush do mapa', exact: true }).click();
  const brush = page.getByRole('region', { name: 'Brush do mapa', exact: true });
  await expect(page.getByLabel('Texturas do brush').getByRole('button')).toHaveCount(6);
  p = await screen(350, 200);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 70, p.y + 25, { steps: 8 });
  await page.mouse.up();
  await page.getByLabel('Adicionar camada de pintura').click();
  await page.getByLabel('Nome da camada de pintura').fill('Caminho');
  await page.getByLabel('Textura: Terra', { exact: true }).click();
  p = await screen(500, 220);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 80, p.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.getByLabel('Formato do brush').selectOption('rough');
  await page.getByRole('button', { name: 'Borracha', exact: true }).click();
  await page.mouse.click(p.x + 30, p.y + 10);
  await pan(box.x + 150, box.y + 120, 'middle');
  await canvas.focus();
  await page.keyboard.down('Space');
  p = await screen(actor.x, actor.y);
  await pan(p.x, p.y);
  await page.keyboard.up('Space');
  await canvas.press('Escape');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect.poll(async () => (await stored()).document.scenes[0].terrain.length).toBe(3);
  row = await stored();
  expect(row.document.scenes[0].terrainLayers).toHaveLength(2);
  expect(row.document.scenes[0].terrain[2].erase).toBe(true);
  await page.screenshot({ path: 'test-results/map-editor/brush-desktop.png' });
  // Left select has no HUD; right click does. Conditions share their state.
  await page.getByLabel('Camadas', { exact: true }).click();
  await page.getByRole('button', { name: 'Tokens · jogadores', exact: true }).first().click();
  p = await screen(actor.x, actor.y);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.vtt-token-hud')).toHaveCount(0);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('.vtt-token-hud')).toBeVisible();
  await page.getByLabel('Condições do token', { exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Condições', exact: true });
  await popup.getByLabel('Cego', { exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored()).document.scenes[0].tokens.find((t: any) => t.id === actor.id).conditions,
    )
    .toEqual(['Cego']);
  await page.getByLabel('Fechar menu do token').click();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.getByRole('button', { name: 'Token selecionado', exact: true }).click();
  const sidebar = page.locator('.vtt-panel-content');
  await expect(sidebar.getByLabel('Cego', { exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sidebar.getByText('Cor da borda', { exact: true })).toHaveCount(0);
  await expect(sidebar.locator('.vtt-token-sheet-action')).toBeVisible();
  await sidebar.getByLabel('Cego', { exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored()).document.scenes[0].tokens.find((t: any) => t.id === actor.id).conditions,
    )
    .toEqual([]);
  p = await screen(actor.x, actor.y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.getByLabel('Condições do token', { exact: true }).click();
  await expect(popup.getByLabel('Cego', { exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Fechar menu do token').click();
  // Resize directly at corner, cancel a second gesture, undo the first.
  await page.getByLabel('Camadas', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Fundo · visível aos jogadores', exact: true })
    .first()
    .click();
  p = await screen(rock.x, rock.y);
  await page.mouse.click(p.x, p.y);
  let c = await camera(),
    h = await screen(rock.x + rock.width / 2 + 4 / c.zoom, rock.y + rock.height / 2 + 4 / c.zoom);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + 45, h.y + 45, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored()).document.scenes[0].tokens.find((t: any) => t.id === rock.id).width,
    )
    .toBeGreaterThan(rock.width + 20);
  row = await stored();
  let resized = row.document.scenes[0].tokens.find((t: any) => t.id === rock.id);
  await canvas.focus();
  await canvas.press('Control+z');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored()).document.scenes[0].tokens.find((t: any) => t.id === rock.id).width,
    )
    .toBe(rock.width);
  await canvas.press('Control+Shift+z');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored()).document.scenes[0].tokens.find((t: any) => t.id === rock.id).width,
    )
    .toBe(resized.width);
  c = await camera();
  h = await screen(
    resized.x + resized.width / 2 + 4 / c.zoom,
    resized.y + resized.height / 2 + 4 / c.zoom,
  );
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + 35, h.y + 35);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  expect((await stored()).document.scenes[0].tokens.find((t: any) => t.id === rock.id).width).toBe(
    resized.width,
  );
  // Selected PNG area binds to the map object; editor permits blank drag.
  await page.getByLabel('Áreas de transparência', { exact: true }).click();
  const editor = page.getByLabel('Editor de áreas de transparência', { exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Objeto da transparência').selectOption(rock.id);
  await editor.getByRole('button', { name: 'Nova área', exact: true }).click();
  await editor.getByLabel('Modo de seleção de transparência').selectOption('rect');
  const a = await screen(resized.x - resized.width * 0.4, resized.y - resized.height * 0.4),
    b = await screen(resized.x + resized.width * 0.4, resized.y + resized.height * 0.4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await editor.getByRole('button', { name: 'Salvar áreas', exact: true }).click();
  await expect
    .poll(async () => (await stored()).document.scenes[0].canopyAreas?.[0]?.source?.tokenId)
    .toBe(rock.id);
  await pan(box.x + 90, box.y + 110);
  await page.screenshot({ path: 'test-results/map-editor/canopy-desktop.png' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(
      true,
    );
    await expect(editor.getByRole('button', { name: 'Nova área', exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/map-editor/canopy-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editor.getByLabel('Fechar editor de transparência').click();
  // Drop small stone ignores a previously increased large-stone multiplier.
  await page.getByLabel('Alternar painel', { exact: true }).click();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Assets', exact: true }).click();
  await sidebar.getByRole('button', { name: /Pedras/ }).click();
  await sidebar.getByLabel('Asset: Rocha de granito', { exact: true }).click();
  await sidebar.getByLabel('Escala da pedra', { exact: true }).selectOption('2');
  const small = rockAssets.find((a) => a.group === 'Pequenas')!;
  await sidebar.getByLabel('Asset: ' + small.name, { exact: true }).click();
  await expect(sidebar.getByLabel('Escala da pedra', { exact: true })).toHaveValue('1');
  await sidebar.getByRole('button', { name: 'Colocar no mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () =>
      (await stored()).document.scenes[0].tokens.some((t: any) => t.image === small.image),
    )
    .toBe(true);
  row = await stored();
  expect(row.document.scenes[0].tokens.find((t: any) => t.image === small.image).width).toBeCloseTo(
    s.grid.size * small.squares,
    4,
  );
  const terrainBefore = structuredClone(row.document.scenes[0].terrain),
    layersBefore = structuredClone(row.document.scenes[0].terrainLayers);
  await page.reload();
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Brush do mapa', exact: true }).click();
  await expect(page.locator('.vtt-terrain-layer')).toHaveCount(2);
  await expect(
    page.locator('.vtt-terrain-layer-name').filter({ hasText: 'Caminho' }),
  ).toBeVisible();
  await canvas.focus();
  await canvas.press('Escape');
  await page.getByRole('button', { name: 'Efeitos do mapa', exact: true }).click();
  const weather = page.getByRole('dialog', { name: 'Efeitos do mapa', exact: true });
  await weather.getByRole('button', { name: 'Vento', exact: true }).click();
  await expect
    .poll(async () => (await stored()).document.scenes[0].atmosphere.weather)
    .toBe('wind');
  await weather.getByRole('button', { name: 'Ventania', exact: true }).click();
  await expect
    .poll(async () => (await stored()).document.scenes[0].atmosphere.weather)
    .toBe('gale');
  await weather.getByLabel('Fechar efeitos do mapa').click();
  row = await stored();
  delete row.document.scenes[0].terrain;
  delete row.document.scenes[0].terrainLayers;
  await request('/vtt/rooms/' + room.id, { document: row.document, revision: row.revision }, 'PUT');
  row = await stored();
  expect(row.document.scenes[0].terrain).toEqual(terrainBefore);
  expect(row.document.scenes[0].terrainLayers).toEqual(layersBefore);
  // Guest cannot submit map paints or alter layers.
  const guest = await browser.newContext();
  await guest.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Visitante',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  const detail = await request('/vtt/rooms/' + room.id, undefined, 'GET');
  await guest.request.post(origin + '/api/vtt/join', {
    headers: { Origin: origin },
    data: { invite: detail.invite },
  });
  expect(
    (
      await guest.request.put(origin + '/api/vtt/rooms/' + room.id, {
        headers: { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
        data: { document: row.document, revision: row.revision },
      })
    ).status(),
  ).toBe(403);
  await guest.close();
  await page.addScriptTag({ url: origin + '/__qa/renderer.js' });
  const rendering = await page.evaluate(async () => {
    const q = (window as any).editorQA;
    await q.ready;
    const image = async (svg: string) => {
      const img = new Image();
      img.src =
        'data:image/svg+xml,' +
        encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
      await img.decode();
      return img;
    };
    const green = await image(
        '<svg width="100" height="100"><circle cx="50" cy="50" r="44" fill="#00ff00"/></svg>',
      ),
      red = await image(
        '<svg width="100" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>',
      );
    const scene = q.newScene(crypto.randomUUID());
    scene.width = scene.height = 512;
    scene.backgroundColor = '#c8b48c';
    scene.grid.type = 'none';
    scene.lighting = false;
    scene.fog = false;
    const rock = {
      ...q.newToken(crypto.randomUUID(), scene),
      layer: 'map',
      image: '/vtt/rocks-20261013/granito-grande.png',
      x: 256,
      y: 256,
      width: 220,
      height: 220,
    };
    const actor = {
      ...q.newToken(crypto.randomUUID(), scene),
      image: '/vtt/rocks-20261013/basalto-grande.png',
      x: 256,
      y: 236,
      width: 100,
      height: 100,
      name: '',
    };
    scene.tokens = [rock, actor];
    scene.canopyAreas = [
      q.bindCanopy(
        {
          id: crypto.randomUUID(),
          name: 'Top',
          points: [
            { x: 146, y: 146 },
            { x: 366, y: 146 },
            { x: 366, y: 256 },
            { x: 146, y: 256 },
          ],
          opacity: 0.25,
          enabled: true,
        },
        rock,
      ),
    ];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d')!;
    const options = {
      camera: { x: 256, y: 256, zoom: 1 },
      width: 512,
      height: 512,
      dpr: 1,
      images: new Map([
        [rock.image, green],
        [actor.image, red],
      ]),
      selected: [],
      gm: true,
      preview: false,
      viewer: null,
      layer: 'map',
      ruler: [],
      draft: null,
      showWalls: false,
      ping: null,
      visualEffects: false,
    };
    q.renderVtt(c, scene, options);
    const pixel = (x: number, y: number) => Array.from(c.getImageData(x, y, 1, 1).data);
    const under = pixel(256, 236),
      outside = pixel(150, 150),
      solid = pixel(256, 330);
    const canopy = canvas.toDataURL();
    const textures = new Map();
    for (const [id, color] of [
      ['grass', '#00ff00'],
      ['earth', '#ff0000'],
    ])
      textures.set(
        '/vtt/scenery-v2-20261012/terrain-' + id + '.webp',
        await image(
          '<svg width="16" height="16"><rect width="16" height="16" fill="' + color + '"/></svg>',
        ),
      );
    const base = {
      id: crypto.randomUUID(),
      texture: 'grass',
      points: [{ x: 256, y: 256 }],
      radius: 80,
      softness: 0,
      opacity: 1,
      textureScale: 100,
      shape: 'round',
      layer: 'base',
      erase: false,
    };
    const layer = crypto.randomUUID();
    scene.tokens = [];
    scene.canopyAreas = [];
    scene.terrainLayers = [
      { id: 'base', name: 'Chão', visible: true, opacity: 1 },
      { id: layer, name: 'Terra', visible: true, opacity: 1 },
    ];
    scene.terrain = [
      base,
      { ...base, id: crypto.randomUUID(), texture: 'earth', layer },
      { ...base, id: crypto.randomUUID(), layer, erase: true, radius: 25 },
    ];
    q.renderVtt(c, scene, { ...options, images: textures });
    const erased = pixel(256, 256),
      upper = pixel(310, 256);
    scene.terrainLayers[1].visible = false;
    q.renderVtt(c, scene, { ...options, images: textures });
    const hidden = pixel(310, 256);
    scene.terrainLayers[1].visible = true;
    scene.terrainLayers[1].opacity = 0.5;
    q.renderVtt(c, scene, { ...options, images: textures });
    const opacity = pixel(310, 256);
    const wind = document.createElement('canvas');
    wind.width = 1280;
    wind.height = 800;
    const wc = wind.getContext('2d')!;
    const frames: Record<string, string> = {};
    const coverage: Record<string, number[]> = {};
    let performanceMs = 0;
    for (const mode of ['wind', 'gale']) {
      wc.clearRect(0, 0, 1280, 800);
      q.drawMapWind(
        wc,
        scene.id,
        { weather: mode, intensity: 0.8, wind: 12, speed: 0.65 },
        12,
        1280,
        800,
      );
      frames[mode] = wind.toDataURL();
      const data = wc.getImageData(0, 0, 1280, 800).data,
        quadrants = [0, 0, 0, 0];
      for (let y = 0; y < 800; y += 4)
        for (let x = 0; x < 1280; x += 4)
          if (data[(y * 1280 + x) * 4 + 3] > 3)
            quadrants[(y >= 400 ? 2 : 0) + (x >= 640 ? 1 : 0)]++;
      coverage[mode] = quadrants;
    }
    const start = performance.now();
    for (let i = 0; i < 30; i++) {
      wc.clearRect(0, 0, 1280, 800);
      q.drawMapWind(
        wc,
        scene.id,
        { weather: 'gale', intensity: 0.8, wind: 12, speed: 0.65 },
        12 + i / 60,
        1280,
        800,
      );
    }
    performanceMs = (performance.now() - start) / 30;
    return {
      under,
      outside,
      solid,
      erased,
      upper,
      hidden,
      opacity,
      canopy,
      frames,
      coverage,
      performanceMs,
    };
  });
  await writeFile(
    'test-results/map-editor/canopy-pixels.png',
    Buffer.from(rendering.canopy.split(',')[1], 'base64'),
  );
  for (const [name, frame] of Object.entries(rendering.frames))
    await writeFile(
      'test-results/map-editor/' + name + '.png',
      Buffer.from(frame.split(',')[1], 'base64'),
    );
  expect(rendering.under[0]).toBeGreaterThan(175);
  expect(rendering.under[1]).toBeGreaterThan(45);
  expect(rendering.under[1]).toBeLessThan(85);
  expect(rendering.solid.slice(0, 3)).toEqual([0, 255, 0]);
  expect(rendering.outside.slice(0, 3)).toEqual([200, 180, 140]);
  expect(rendering.erased.slice(0, 3)).toEqual([0, 255, 0]);
  expect(rendering.upper.slice(0, 3)).toEqual([255, 0, 0]);
  expect(rendering.hidden.slice(0, 3)).toEqual([0, 255, 0]);
  expect(rendering.opacity[0]).toBeGreaterThan(120);
  expect(rendering.opacity[0]).toBeLessThan(135);
  for (const values of Object.values(rendering.coverage))
    expect(values.every((v) => v > 100)).toBe(true);
  expect(rendering.performanceMs).toBeLessThan(45);
  // Account details open from the traveller identity; directory visits begin in camp.
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  const character = await createLegacyTestCharacter(account.id, 'Nana de teste');
  const profileUrl = origin + '/#profiles?user=' + encodeURIComponent(account.id);
  await page.goto(profileUrl);
  await expect(page.locator('.public-camp')).toBeVisible();
  await expect(page.locator('.player-profile-home')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Perfil de Editor de teste',exact:true})).toHaveCount(0);
  const identity = page.getByRole('button', {name:'Abrir perfil de Editor de teste',exact:true});
  await identity.click();
  await expect(page.locator('.player-profile-home')).toBeVisible();
  await expect(page.getByRole('button', {name:'Personalizar perfil',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Voltar ao personagem',exact:true}).click();
  await expect(page.locator('.public-camp')).toBeVisible();
  await identity.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.player-profile-home')).toBeVisible();
  await page.reload(); // Profile entry always starts with the character.
  await expect(page.locator('.public-camp')).toBeVisible();
  await page.goto(profileUrl + '&character=' + character.id);
  await expect(page.locator('.public-camp')).toBeVisible();
  await identity.click();
  await expect(page.locator('.player-profile-home')).toBeVisible();
  await page.screenshot({path:'test-results/map-editor/profile-account-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button', {name:'Voltar ao personagem',exact:true}).click();
  await identity.click();
  await expect(page.locator('.player-profile-home')).toBeVisible();
  await page.screenshot({path:'test-results/map-editor/profile-account-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  const visitor = await browser.newContext({viewport:{width:1440,height:1000}});
  await visitor.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Visitante de teste',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()}});
  const visitorPage = await visitor.newPage();await visitorPage.goto(profileUrl);
  await expect(visitorPage.locator('.public-camp')).toBeVisible();
  await visitorPage.getByRole('button',{name:'Abrir perfil de Editor de teste',exact:true}).click();
  await expect(visitorPage.locator('.player-profile-home')).toBeVisible();
  await expect(visitorPage.getByRole('button',{name:'Personalizar perfil',exact:true})).toHaveCount(0);
  await visitor.close();
  // Switching characters must not grant the account's other character membership.
  const alternate = await createLegacyTestCharacter(account.id, 'Irineu de teste');
  const {communitySettingsSchema,guildDocumentSchema} = await import('../shared/guilds');
  const cfg = await request('/community/settings', undefined, 'GET');
  await request('/community/settings', {document:communitySettingsSchema.parse({...cfg.document,founding_po:0}),revision:cfg.revision}, 'PUT');
  const guild = await request('/guilds',{character_id:character.id,request_id:randomUUID(),document:guildDocumentSchema.parse({name:'Companhia de teste'})});
  await page.goto(origin+'/#guild?id='+guild.id);
  await page.reload();
  await page.getByRole('button',{name:/Abrir menu de/}).click();
  await page.getByRole('option',{name:'Nana de teste',exact:true}).click();
  await expect(page.getByRole('button',{name:'Personalizar sede',exact:true})).toBeVisible();
  await expect(page.locator('.guild-feedback')).toContainText('Nana de teste · Membro desta guilda');
  await page.getByRole('button',{name:'Abrir menu de Nana de teste',exact:true}).click();
  await page.getByRole('option',{name:'Irineu de teste',exact:true}).click();
  await expect(page.locator('.guild-feedback')).toContainText('Irineu de teste · Visitante');
  await expect(page.getByRole('button',{name:'Personalizar sede',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Minha guilda',exact:true})).toHaveCount(0);
  await page.goto(origin+'/#guild');
  await expect(page.getByText('O personagem selecionado não é membro.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Usar Nana de teste',exact:true}).click();
  await expect(page.getByRole('button',{name:'Personalizar sede',exact:true})).toBeVisible();
  expect((await pool.query('SELECT character_id FROM player_guild_members WHERE guild_id=$1',[guild.id])).rows.map(m=>m.character_id)).toEqual([character.id]);
  await page.screenshot({path:'test-results/map-editor/guild-character-member.png'});
  await pool.query('UPDATE characters SET gold_cp=50000 WHERE id=$1',[character.id]);
  await page.goto(origin+'/#cards');
  await page.reload();
  await expect(page.getByRole('button',{name:'A Vigília',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'A Vigília',exact:true}).click();
  await page.getByRole('button',{name:'Comprar carta',exact:true}).click();
  await expect(page.getByRole('button',{name:'Equipar no espaço 1',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Encerrar conversa',exact:true}).click();
  await page.getByRole('button',{name:'Selecionar espaço 2',exact:true}).click();
  await page.getByRole('button',{name:'Equipar no espaço 2',exact:true}).click();
  await expect(page.getByRole('button',{name:'Selecionar espaço 2: A Vigília',exact:true})).toBeVisible();
  expect((await request('/cards/'+character.id,undefined,'GET'))[0].slot).toBe(2);
  await page.getByRole('button',{name:'Esvaziar espaço 2',exact:true}).click();
  await expect(page.getByRole('button',{name:'Selecionar espaço 2',exact:true})).toBeVisible();
  for(const [width,height] of [[1920,1000],[1440,768],[1024,768],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'Todas',exact:true}).click();
    await expect(page.locator('.cards-catalog > button')).toHaveCount(8);
    const layout=await page.locator('.cards-workbench').evaluate(el=>{
      const table=el.querySelector('.cards-table')!,detail=el.querySelector('.cards-detail')!,copy=el.querySelector('.cards-detail-copy')!;
      return {width:el.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth,tableScroll:getComputedStyle(table).overflowY,detailScroll:getComputedStyle(detail).overflowY,copyWidth:copy.getBoundingClientRect().width};
    });
    expect(layout.width).toBeLessThanOrEqual(720.5);expect(layout.overflow).toBe(false);
    expect(layout.copyWidth).toBeGreaterThan(180);expect(layout.tableScroll).toBe('visible');expect(layout.detailScroll).toBe('visible');
    await page.getByRole('button',{name:'Minha coleção',exact:true}).click();
    await expect(page.locator('.cards-catalog > button')).toHaveCount(1);
    await page.getByRole('button',{name:'A Vigília',exact:true}).click();
    await page.getByRole('button',{name:'Equipar no espaço 2',exact:true}).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button',{name:'Equipar no espaço 2',exact:true})).toBeInViewport();
    await page.getByText('História e comentário do Anfitrião',{exact:true}).click();
    await expect(page.locator('.cards-history')).toHaveAttribute('open','');
    await page.getByText('História e comentário do Anfitrião',{exact:true}).click();
    await page.getByRole('button',{name:'Todas',exact:true}).click();
    await page.screenshot({path:'test-results/map-editor/cards-compact-'+width+'.png'});
  }
  await page.getByRole('button',{name:'Abrir menu de Nana de teste',exact:true}).click();
  await page.getByRole('option',{name:'Irineu de teste',exact:true}).click();
  await page.getByRole('button',{name:'Minha coleção',exact:true}).click();
  await expect(page.locator('.cards-catalog > button')).toHaveCount(0);
  await page.setViewportSize({width:1440,height:1000});
  // Different native aspect ratios and saved fit modes share one thumbnail frame.
  for(const [index,image] of ['/atlas-world-v2.png','/character-camp-v2.png','/alvorada-dawn-banner.png'].entries()) {
    await request('/home-updates',{title:'Crônica de teste '+index,body:'Uma história para o diário.',kind:'article',layout:index===0?'portrait':'compact',image_path:image,image_side:'right',image_fit:index===1?'contain':'cover',link:'',starts_at:null,location:'',text_align:'left',text_size:'normal',position:index});
  }
  await page.goto(origin+'/#overview');
  const covers=page.locator('.journal-compact .journal-image,.journal-portrait .journal-image');
  await expect(covers).toHaveCount(3);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===1440?1000:844});
    const sizes=await covers.evaluateAll(elements=>elements.map(el=>({frame:el.getBoundingClientRect().toJSON(),image:el.querySelector('img')!.getBoundingClientRect().toJSON()})));
    for(const size of sizes) {
      expect(Math.abs(size.frame.width-size.image.width)).toBeLessThan(1);
      expect(Math.abs(size.frame.height-size.image.height)).toBeLessThan(1);
      expect(Math.abs(size.frame.width/size.frame.height-16/9)).toBeLessThan(.01);
      expect(Math.abs(size.frame.height-sizes[0].frame.height)).toBeLessThan(1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/map-editor/journal-cards-'+width+'.png',fullPage:true});
  }
  expect(errors).toEqual([]);
  const { canopy, frames, ...pixels } = rendering;
  await writeFile(
    'test-results/map-editor/result.json',
    JSON.stringify({
      passed: true,
      brushLayers: true,
      panning: true,
      rightClickHud: true,
      resize: true,
      conditionsSynced: true,
      smallRockScale: true,
      canopyBinding: true,
      permissions: true,
      profileAvatarNavigation: true,
      uniformJournalCovers: true,
      characterGuildMembership: true,
      compactCardsPanel: true,
      pixels,
      errors,
    }),
  );
  console.log('Map editor browser QA passed.');
} catch (error) {
  await page.screenshot({ path: 'test-results/map-editor/failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
