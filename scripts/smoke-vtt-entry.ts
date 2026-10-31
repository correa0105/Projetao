import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { terrainTextures } from '../shared/vtt-terrain';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/vtt-entry', { recursive: true });
const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
async function api(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const response = await context.request.fetch(origin + '/api' + path, { method, headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
try {
  const account = await api('/auth/sign-up/email', {
    name: 'Viajante dos efeitos',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  await createLegacyTestCharacter(account.user.id, 'Viajante');
  let room = await api('/vtt', { name: 'Mesa com piso' });
  const scene = room.document.scenes[0];
  scene.fog = false;
  scene.lighting = false;
  scene.terrain = [
    {
      id: randomUUID(),
      texture: 'grass',
      erase: false,
      points: [
        { x: 500, y: 500 },
        { x: 1200, y: 1200 },
      ],
      radius: 500,
      softness: 0.2,
      opacity: 1,
      textureScale: 280,
      shape: 'round',
      layer: 'base',
    },
  ];
  room = await api(
    '/vtt/rooms/' + room.id,
    { revision: room.revision, document: room.document },
    'PUT',
  );
  let release!: () => void;
  const delayed = new Promise<void>((r) => (release = r)),
    terrainRequests = new Set<string>();
  page.on('request', (r) => {
    if (terrainTextures.some((t) => r.url().endsWith(t.image)))
      terrainRequests.add(new URL(r.url()).pathname);
  });
  await page.route('**' + terrainTextures[0].image, async (route) => {
    await delayed;
    await route.continue();
  });
  await page.goto(origin + '/#vtt?room=' + room.id, { waitUntil: 'domcontentloaded' });
  const entry = page.getByRole('region', { name: 'Preferências de entrada da mesa' });
  await expect(entry).toBeVisible();
  await expect(page.locator('.vtt-workspace')).toHaveCount(0);
  expect(terrainRequests.size).toBe(0);
  await entry.getByLabel('Efeitos do mapa', { exact: true }).uncheck();
  await entry.getByLabel('Efeitos do mestre', { exact: true }).uncheck();
  await expect(entry).toContainText('Sempre ativos: iluminação dinâmica e horário da cena');
  await page.screenshot({ path: 'test-results/vtt-entry/preferences.png' });
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Preparando o mapa', exact: true }).or(page.getByRole('status', { name: 'Preparando o mapa', exact: true }))).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('.vtt-workspace')).toBeHidden();
  await page.screenshot({ path: 'test-results/vtt-entry/terrain-wait.png' });
  release();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.vtt-workspace')).toHaveAttribute('data-map-effects', 'off');
  await expect(page.locator('.vtt-workspace')).toHaveAttribute('data-visual-effects', 'off');
  expect([...terrainRequests]).toEqual([terrainTextures[0].image]);
  const paintedPixels = await page.getByLabel('Tabuleiro da mesa', { exact: true }).evaluate((canvas) => {
    const board = canvas as HTMLCanvasElement;
    const pixels = board.getContext('2d')!.getImageData(0, 0, board.width, board.height).data;
    let grass = 0;
    for (let i = 0; i < pixels.length; i += 16)
      if (pixels[i + 1] > pixels[i] + 4 && pixels[i + 1] > pixels[i + 2] + 6) grass++;
    return grass;
  });
  expect(paintedPixels, 'A brush salva deve estar desenhada ao revelar a mesa').toBeGreaterThan(500);
  await page.screenshot({ path: 'test-results/vtt-entry/terrain-ready.png' });
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('alvorada-vtt-media:' + id) || '{}'),
    account.user.id,
  );
  expect(saved.mapEffects).toBe(false);
  expect(saved.masterEffects).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(entry).toBeVisible();
  await expect(entry.getByLabel('Efeitos do mapa', { exact: true })).not.toBeChecked();
  await expect(entry.getByLabel('Efeitos do mestre', { exact: true })).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(entry.getByRole('button', { name: 'Entrar no VTT', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/vtt-entry/preferences-mobile.png' });
  // Abrir o VTT sem endereço não escolhe a mesa do dono da conta.
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(origin + '/#vtt');
  const openedRooms: string[] = [];
  page.on('request', request => {
    if (/\/api\/vtt\/rooms\//.test(request.url())) openedRooms.push(request.url());
  });
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  const lobby = page.getByRole('region', { name: 'Escolher uma mesa', exact: true });
  await expect(lobby).toBeVisible();
  await expect(lobby.getByRole('button', { name: 'Abrir minha mesa', exact: true })).toBeEnabled();
  await expect(page.locator('.vtt-workspace')).toHaveCount(0);
  expect(openedRooms).toEqual([]);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/vtt-entry/lobby-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await lobby.getByRole('button', { name: 'Preferências visuais', exact: true }).click();
  await entry.getByLabel('Não perguntar novamente', { exact: true }).check();
  await expect(entry).toBeVisible();
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await page.reload();
  await expect(lobby).toBeVisible();
  await expect(entry).toHaveCount(0);
  await expect(page.locator('.vtt-workspace')).toHaveCount(0);
  const inviteField = lobby.getByLabel('Link ou código de convite', { exact: true });
  await inviteField.fill('isto não é um convite');
  await lobby.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await expect(lobby.getByRole('alert')).toContainText('Cole um link válido');
  await expect(lobby.getByRole('button', { name: 'Abrir minha mesa', exact: true })).toBeEnabled();
  // A conta tem sua própria mesa, mas participa da mesa de outro mestre como jogador.
  const otherContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const otherApi = async (path: string, data?: unknown) => {
    const response = await otherContext.request.fetch(origin + '/api' + path, { method: data ? 'POST' : 'GET', headers, data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await otherApi('/auth/sign-up/email', { name: 'Outro mestre', email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() });
  const otherRoom = await otherApi('/vtt', { name: 'Mesa da outra companhia' });
  const otherListing = await otherApi('/vtt');
  const peer = await otherContext.newPage();
  await peer.goto(origin + '/#vtt');
  await expect(peer.getByRole('region', { name: 'Preferências de entrada da mesa' })).toBeVisible();
  await inviteField.fill(origin + '/#vtt?table=' + otherListing.personal.public_id);
  await lobby.getByRole('radio', { name: 'Jogador', exact: true }).check();
  await lobby.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  let joined = await api('/vtt/rooms/' + otherRoom.id);
  expect(joined.is_gm).toBe(false);
  expect(joined.role).toBe('player');
  await expect(page.getByRole('button', { name: 'Salvar mesa', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(entry).toHaveCount(0);
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  expect((await api('/vtt/rooms/' + otherRoom.id)).role).toBe('player');
  await page.goto(origin + '/#vtt');
  await expect(lobby).toBeVisible();
  await inviteField.fill(origin + '/#vtt?invite=' + otherRoom.invite);
  await lobby.getByRole('radio', { name: 'Espectador', exact: true }).check();
  await lobby.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  joined = await api('/vtt/rooms/' + otherRoom.id);
  expect(joined.is_gm).toBe(false);
  expect(joined.role).toBe('spectator');
  await page.reload();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  expect((await api('/vtt/rooms/' + otherRoom.id)).role).toBe('spectator');
  await page.goto(origin + '/#vtt');
  await expect(lobby).toBeVisible();
  await inviteField.fill(origin + '/#vtt?table=' + otherListing.personal.public_id);
  await lobby.getByRole('radio', { name: 'Espectador', exact: true }).check();
  await lobby.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  expect(page.url()).toContain('role=spectator');
  await page.reload();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  expect((await api('/vtt/rooms/' + otherRoom.id)).role).toBe('spectator');
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await page.getByRole('button', { name: 'Mesa', exact: true }).click();
  await page.getByLabel('Não perguntar novamente', { exact: true }).uncheck();
  await page.goto(origin + '/#vtt');
  await expect(lobby).toBeVisible();
  await lobby.getByRole('button', { name: 'Abrir minha mesa', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  expect((await api('/vtt/rooms/' + room.id)).is_gm).toBe(true);
  await page.reload();
  await expect(entry).toBeVisible();
  await expect(entry.getByLabel('Não perguntar novamente', { exact: true })).not.toBeChecked();
  await otherContext.close();
  const renderer = await build({
    stdin: {
      contents: `import {renderVtt} from './src/vtt-canvas';import {newScene,newToken,lightSchema} from './shared/vtt';import {atmosphereSchema} from './shared/vtt-atmosphere';globalThis.requiredVisuals=()=>{const s=newScene(crypto.randomUUID());s.width=600;s.height=400;s.backgroundColor='#9eab9a';s.fog=false;s.grid.opacity=0;s.lighting=false;const viewer=newToken(crypto.randomUUID(),s);Object.assign(viewer,{x:300,y:200,controller:'viewer',vision:0});s.tokens=[viewer];const draw=(day,lighting=false,weather='clear',enabled=false)=>{const can=document.createElement('canvas');can.width=600;can.height=400;s.lighting=lighting;s.atmosphere=atmosphereSchema.parse({enabled:true,day,weather,intensity:.8});renderVtt(can.getContext('2d'),s,{camera:{x:300,y:200,zoom:1},width:600,height:400,dpr:1,images:new Map(),selected:[],gm:false,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,userId:'viewer',visualEffects:enabled,mapEffects:enabled});return Array.from(can.getContext('2d').getImageData(0,0,600,400).data);};const diff=(a,b)=>a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0);const day=draw('afternoon'),night=draw('night'),dark=draw('afternoon',true);s.lights=[lightSchema.parse({id:crypto.randomUUID(),x:300,y:200,bright:10,dim:5})];const lit=draw('afternoon',true);return {day:diff(day,night),lighting:diff(dark,lit),weatherMuted:diff(night,draw('night',false,'rain')),sameMandatory:diff(lit,draw('afternoon',true,'clear',true))};};`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    logLevel: 'silent',
  });
  await page.route('**/__test_vtt_renderer.js', route => route.fulfill({contentType:'application/javascript',body:renderer.outputFiles[0].text}));
  await page.addScriptTag({ url: origin + '/__test_vtt_renderer.js' });
  const pixels = await page.evaluate(() => (globalThis as any).requiredVisuals());
  expect(pixels.day).toBeGreaterThan(100000);
  expect(pixels.lighting).toBeGreaterThan(100000);
  expect(pixels.weatherMuted).toBe(0);
  expect(pixels.sameMandatory).toBe(0);
  expect(errors).toEqual([]);
  await writeFile('test-results/vtt-entry/result.json', JSON.stringify({ passed: true, noAutomaticOwnRoom: true, joinOtherAsPlayer: true, inviteSpectator: true, personalSpectatorReload: true, rememberChoices: true, revertRemember: true, accountIsolation: true, explicitOwnRoom: true, widths: [1440,768,390,320], mandatoryVisuals: pixels, errors }, null, 2));
  console.log(
    'PASS: entrada, escolhas separadas, piso antes de revelar, persistência/celular e pixels de iluminação/horário obrigatórios.',
    pixels,
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
