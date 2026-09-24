import 'dotenv/config';
import { chromium, expect as baseExpect, type CDPSession, type Page } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pool } from '../server/db.js';

const base = 'http://localhost:3000';
const visualOnly = process.argv.includes('--visual-only');
const navigationOnly = process.argv.includes('--navigation-only');
const worldMapOnly =
  process.argv.includes('--world-map-only') || process.argv.includes('--world-only');
const regionalEdgesOnly = process.argv.includes('--regional-edges-only');
const regionalMobileOnly = process.argv.includes('--regional-mobile-only');
const regionalRecoveryOnly = process.argv.includes('--regional-recovery-only');
const terrainOnly = process.argv.includes('--terrain-only');
const editorOnly = process.argv.includes('--editor-only');
const skipCameraMatrix = process.argv.includes('--skip-camera-matrix');
const useBrowserGpu = process.env.ATLAS_BROWSER_GPU === '1';
const expectedKingdomAssets = [
  '/kingdom/ground-trails.png',
  '/kingdom/structures/atlases/structures.png',
  '/kingdom/nature.png',
  '/kingdom/structures/atlases/landmarks.png',
  '/kingdom/structures/atlases/settlements.png',
  '/kingdom/structures/atlases/town-buildings.png',
  '/kingdom/structures/atlases/harbor-buildings.png',
  '/kingdom/structures/atlases/craft-buildings.png',
  '/kingdom/structures/atlases/frontier-buildings.png',
].sort();
const kingdomResponses = new Map<Page, Set<string>>();
const materialManifest = JSON.parse(
  await readFile('public/atlas-materials/manifest.json', 'utf8'),
) as { file: string; bytes: number; md5: string; width: number; height: number }[];
const materialResponses = new Map<Page, Set<string>>();
// Software-rendered WebGL and simultaneous local Docker checks can delay UI refreshes.
const expect = baseExpect.configure({ timeout: 15000 });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: useBrowserGpu ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'no-preference',
});
const email = `atlas-browser-${randomUUID()}@example.test`;
const errors: string[] = [];
const webglRasterRequests: string[] = [];
const cameraReport: Record<string, unknown> = {};
const missionTitle = 'As trilhas de Vigília';
const boardTitle = 'O chamado do Bastião';

function watchErrors(target: Page) {
  materialResponses.set(target, new Set());
  kingdomResponses.set(target, new Set());
  target.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (expectedKingdomAssets.includes(path)) {
      if (response.ok() || response.status() === 304) kingdomResponses.get(target)!.add(path);
      else errors.push(`Falha no atlas 2D: ${path}: HTTP ${response.status()}`);
      return;
    }
    if (!/^\/atlas-materials\/[^/]+\.jpg$/.test(path)) return;
    void (async () => {
      const filename = path.split('/').at(-1)!;
      const expected = materialManifest.find((item) => item.file === filename);
      expect(expected, `Textura sem procedência no manifest: ${path}`).toBeDefined();
      if (response.status() === 304) {
        // Reload may revalidate the original bytes already checked in this page.
        expect(
          materialResponses.get(target)?.has(filename),
          `Cache 304 sem download íntegro previamente verificado: ${path}`,
        ).toBe(true);
        return;
      }
      expect(response.status(), `Download da textura ${path}`).toBe(200);
      expect(response.headers()['content-type'], path).toContain('image/jpeg');
      const bytes = await response.body();
      expect(bytes.length, `Download incompleto: ${path}`).toBe(expected!.bytes);
      expect(
        createHash('md5').update(bytes).digest('hex'),
        `Textura diferente do original validado: ${path}`,
      ).toBe(expected!.md5);
      expect([expected!.width, expected!.height]).toEqual([1024, 1024]);
      materialResponses.get(target)!.add(filename);
    })().catch((error) => {
      console.error(`Falha PBR: ${path}: ${error.message}`);
      errors.push(`Falha PBR: ${path}: ${error.message}`);
    });
  });
  target.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/atlas-materials/'))
      errors.push(`Falha de rede PBR: ${path}: ${request.failure()?.errorText}`);
  });
  target.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/atlas-(?:world|north)\.png$/.test(path)) webglRasterRequests.push(path);
  });
  target.on('request', (request) => {
    if (new URL(request.url()).pathname === '/kingdom/cloud-bank.png')
      errors.push('A visão do reino não deve carregar a antiga névoa.');
  });
  target.on('pageerror', (error) => errors.push(error.message));
  target.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    console.error(`Erro do navegador: ${text}`);
    errors.push(text);
  });
}

async function navigate(target: Page, name: 'Mundo' | 'Mural & eventos') {
  const nav = target.getByRole('navigation', { name: 'Navegação principal' });
  const handle = nav.locator('.dock-handle');
  if ((await handle.getAttribute('aria-expanded')) !== 'true') await handle.click();
  await nav
    .getByRole('button', { name: name === 'Mundo' ? 'Explorar' : 'Aventura', exact: true })
    .click();
  await nav.getByRole('button', { name, exact: name === 'Mundo' }).click();
  await expect(nav.locator('.dock-tray')).toBeHidden();
}

async function ready(target: Page) {
  await expect(target.locator('.world-map, .kingdom-map')).toHaveCount(1);
  if (await target.locator('.world-map').count()) {
    await readyWorldRelief(target);
    return;
  }
  const scene = target.locator('.kingdom-map');
  await expect(scene).toHaveAttribute('data-status', 'ready', { timeout: 30000 });
  await expect(scene).toHaveAttribute('data-renderer', 'canvas2d');
  await expect(scene.locator('.kingdom-map__ground')).toBeVisible();
  await expect(scene.locator('.kingdom-map__clouds')).toHaveCount(0);
  await expect(scene.locator('.kingdom-map__edge-mist')).toBeVisible();
  expect(
    await scene
      .locator('.kingdom-map__ground')
      .evaluate((canvas) => !!(canvas as HTMLCanvasElement).getContext('2d')),
    'A visão do reino deve renderizar em Canvas2D, sem contexto WebGL.',
  ).toBe(true);
  await expect
    .poll(() => [...(kingdomResponses.get(target) || [])].sort())
    .toEqual(expectedKingdomAssets);
  const state = await camera(target);
  expect([state.x, state.y, state.homeX, state.homeY].every(Number.isFinite)).toBe(true);
  expect(state.minZoom).toBe(1);
  expect(state.maxZoom).toBe(1.3);
  expect(state.direction).toBeGreaterThanOrEqual(0);
  expect(state.direction).toBeLessThan(8);
  expect(webglRasterRequests, 'Nenhum mapa regional antigo deve ser solicitado.').toEqual([]);
}

type PinPosition = {
  name: string | null;
  x: number;
  y: number;
  visible: boolean;
  direction: number;
};
async function camera(target: Page) {
  return target.locator('.kingdom-map').evaluate((host) => ({
    x: Number((host as HTMLElement).dataset.panX),
    y: Number((host as HTMLElement).dataset.panY),
    homeX: Number((host as HTMLElement).dataset.homeX),
    homeY: Number((host as HTMLElement).dataset.homeY),
    zoom: Number((host as HTMLElement).dataset.zoom),
    direction: Number((host as HTMLElement).dataset.direction),
    minZoom: Number((host as HTMLElement).dataset.minZoom),
    maxZoom: Number((host as HTMLElement).dataset.maxZoom),
  }));
}
async function pins(target: Page): Promise<PinPosition[]> {
  return target.locator('.kingdom-place').evaluateAll((elements) =>
    elements.map((element) => ({
      name: element.getAttribute('aria-label'),
      x: parseFloat((element as HTMLElement).style.left),
      y: parseFloat((element as HTMLElement).style.top),
      visible: element.getAttribute('data-visible') === 'true',
      direction: Number(element.getAttribute('data-sprite-direction')),
    })),
  );
}
function pinDelta(before: PinPosition[], after: PinPosition[]) {
  expect(after.map((pin) => pin.name)).toEqual(before.map((pin) => pin.name));
  return Math.max(...before.map((pin, i) => Math.hypot(pin.x - after[i].x, pin.y - after[i].y)));
}
async function settleCamera(target: Page) {
  if (await target.locator('.world-map').count()) return settleWorldMap(target);
  const stable = await target.locator('.kingdom-map').evaluate(async (host) => {
    const fields = ['panX', 'panY', 'zoom', 'direction'];
    let previous: number[] | undefined;
    let stableFrames = 0;
    const deadline = performance.now() + 10000;
    while (performance.now() < deadline) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const values = fields.map((field) => Number((host as HTMLElement).dataset[field]));
      const delta = previous
        ? Math.max(...values.map((value, i) => Math.abs(value - previous![i])))
        : Infinity;
      stableFrames = delta < 0.0005 ? stableFrames + 1 : 0;
      if (stableFrames >= 3) return true;
      previous = values;
    }
    return false;
  });
  expect(stable, 'O mapa deve estabilizar entre gestos.').toBe(true);
}
async function resetCamera(target: Page, baseline?: PinPosition[]) {
  await target.getByRole('button', { name: 'Centralizar mapa', exact: true }).click();
  await settleCamera(target);
  const state = await camera(target);
  expect(Math.hypot(state.x - state.homeX, state.y - state.homeY)).toBeLessThan(0.001);
  expect(state.zoom).toBeCloseTo(1, 3);
  expect(state.direction).toBe(0);
  if (baseline)
    expect(
      pinDelta(baseline, await pins(target)),
      'Centralizar restaura também a posição das construções.',
    ).toBeLessThan(1);
}
async function maximumZoom(target: Page) {
  const button = target.getByRole('button', { name: 'Aproximar mapa', exact: true });
  for (let i = 0; i < 15 && (await button.isEnabled()); i++) {
    await button.click();
    await settleCamera(target);
  }
  const state = await camera(target);
  expect(state.zoom).toBeCloseTo(state.maxZoom, 2);
  await expect(button).toBeDisabled();
}
async function minimumZoom(target: Page) {
  const button = target.getByRole('button', { name: 'Afastar mapa', exact: true });
  for (let i = 0; i < 15 && (await button.isEnabled()); i++) {
    await button.click();
    await settleCamera(target);
  }
  const state = await camera(target);
  expect(state.zoom).toBeCloseTo(state.minZoom, 2);
  await expect(button).toBeDisabled();
}
async function turnForReview(target: Page, direction: 'left' | 'right') {
  const before = (await camera(target)).direction;
  await target
    .getByRole('button', {
      name: direction === 'left' ? 'Girar mapa para a esquerda' : 'Girar mapa para a direita',
      exact: true,
    })
    .click();
  await settleCamera(target);
  expect((await camera(target)).direction).not.toBe(before);
}
async function dragAcross(
  target: Page,
  direction: 'left' | 'right' | 'up' | 'down',
  touch?: CDPSession,
) {
  const gesture = await target.locator('.kingdom-map__ground').evaluate((canvas, direction) => {
    const rect = canvas.getBoundingClientRect();
    const horizontal = direction === 'left' || direction === 'right';
    const forward = direction === 'right' || direction === 'down';
    for (const primary of forward ? [0.2, 0.32, 0.42] : [0.8, 0.68, 0.58])
      for (const cross of [0.5, 0.64, 0.36, 0.74, 0.26]) {
        const x = rect.x + rect.width * (horizontal ? primary : cross);
        const y = rect.y + rect.height * (horizontal ? cross : primary);
        const hit = document.elementFromPoint(x, y);
        if (hit !== canvas && !hit?.closest('.kingdom-place, .kingdom-house')) continue;
        return {
          x,
          y,
          endX: horizontal ? rect.x + rect.width * (forward ? 0.8 : 0.2) : x,
          endY: horizontal ? y : rect.y + rect.height * (forward ? 0.8 : 0.2),
        };
      }
    return null;
  }, direction);
  expect(gesture, `Área livre para arrastar ${direction}.`).not.toBeNull();
  const { x, y, endX, endY } = gesture!;
  if (touch) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x, y }],
    });
    for (let step = 1; step <= 8; step++)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 1, x: x + ((endX - x) * step) / 8, y: y + ((endY - y) * step) / 8 }],
      });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await target.mouse.move(x, y);
    await target.mouse.down();
    await target.mouse.move(endX, endY, { steps: 8 });
    await target.mouse.up();
    await target.mouse.move(2, 2);
  }
  await settleCamera(target);
}
async function exerciseTerrainCamera(
  target: Page,
  _mode: 'north',
  mobile = false,
  onlyEdges = false,
) {
  if (skipCameraMatrix) return;
  const label = mobile ? 'mobile' : 'desktop';
  await target.emulateMedia({ reducedMotion: 'reduce' });
  await resetCamera(target);
  const baseline = await pins(target);
  expect(baseline).toHaveLength(6);
  for (const pin of baseline) expect(Number.isFinite(pin.x) && Number.isFinite(pin.y)).toBe(true);
  await target.screenshot({ path: `test-results/kingdom-entry-${label}.png`, fullPage: true });
  const touch = mobile ? await target.context().newCDPSession(target) : undefined;
  const report: Record<string, unknown> = {};
  try {
    if (!onlyEdges) {
      const point = await exposedMapPoint(target);
      const scrollBefore = await target.evaluate(() => scrollY);
      if (touch) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [
            { id: 1, x: point.x - 30, y: point.y },
            { id: 2, x: point.x + 30, y: point.y },
          ],
        });
        for (let step = 1; step <= 6; step++)
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              { id: 1, x: point.x - 30 - step * 4, y: point.y },
              { id: 2, x: point.x + 30 + step * 4, y: point.y },
            ],
          });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await target.mouse.move(point.x, point.y);
        await target.mouse.wheel(0, -320);
        await target.mouse.move(2, 2);
      }
      await settleCamera(target);
      expect((await camera(target)).zoom, 'Scroll/pinça devem ampliar a cena.').toBeGreaterThan(
        1.1,
      );
      expect(await target.evaluate(() => scrollY)).toBe(scrollBefore);
      await resetCamera(target, baseline);
    }
    await maximumZoom(target);
    expect(pinDelta(baseline, await pins(target))).toBeGreaterThan(8);
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      await resetCamera(target);
      await maximumZoom(target);
      let previous = await camera(target),
        limitPins = await pins(target),
        saturated = false;
      let gestures = 0;
      for (; gestures < 32; gestures++) {
        await dragAcross(target, direction, touch);
        const current = await camera(target),
          currentPins = await pins(target);
        if (
          Math.hypot(current.x - previous.x, current.y - previous.y) < 0.005 &&
          pinDelta(limitPins, currentPins) < 1
        ) {
          saturated = true;
          break;
        }
        previous = current;
        limitPins = currentPins;
      }
      expect(saturated, `Arraste deve respeitar o limite ${direction}.`).toBe(true);
      await dragAcross(target, direction, touch);
      expect(pinDelta(limitPins, await pins(target))).toBeLessThan(1);
      report[direction] = { ...(await camera(target)), gestures };
      await target.screenshot({
        path: `test-results/kingdom-edge-${direction}-${label}.png`,
        fullPage: true,
      });
    }
    await resetCamera(target, baseline);
    if (!onlyEdges) {
      const frames = new Set<string>();
      for (let direction = 0; direction < 8; direction++) {
        expect((await camera(target)).direction).toBe(direction);
        for (const pin of await pins(target)) expect(pin.direction).toBe(direction);
        frames.add(
          await target
            .locator('.kingdom-map__ground')
            .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
        );
        if (!mobile || direction === 0 || direction === 4)
          await target.screenshot({
            path: `test-results/kingdom-direction-${direction}-${label}.png`,
            fullPage: true,
          });
        await turnForReview(target, 'right');
      }
      expect((await camera(target)).direction, 'O oitavo giro completa a volta.').toBe(0);
      expect(frames.size, 'As oito orientações precisam produzir desenhos distintos.').toBe(8);
      await resetCamera(target, baseline);
      if (!mobile) {
        await target.locator('.kingdom-map').focus();
        await target.keyboard.press('e');
        await settleCamera(target);
        expect((await camera(target)).direction).toBe(1);
        await target.keyboard.press('q');
        await settleCamera(target);
        expect((await camera(target)).direction).toBe(0);
      }
      await minimumZoom(target);
      await resetCamera(target, baseline);
    }
    cameraReport[`kingdom-${label}`] = report;
  } finally {
    await touch?.detach();
  }
}
async function openNorth(target: Page) {
  await ready(target);
  await expect
    .poll(() =>
      ['ground-color.jpg', 'rock-color.jpg'].every((name) =>
        materialResponses.get(target)?.has(name),
      ),
    )
    .toBe(true);
  const materialsBefore = [...(materialResponses.get(target) || [])].sort();
  await clickMarker(target, 'Reino do Norte');
  await expect(target.locator('.world-atlas h1')).toHaveText('Reino do Norte.', { timeout: 30000 });
  await ready(target);
  expect(
    [...(materialResponses.get(target) || [])].sort(),
    'O reino não deve carregar os antigos materiais 3D.',
  ).toEqual(materialsBefore);
}
async function assertInteractiveMarker(target: Page, name: string) {
  const marker = target.getByRole('button', { name, exact: true });
  await expect(marker).toHaveAttribute('data-visible', 'true');
  await expect(marker).not.toHaveCSS('pointer-events', 'none');
  await expect(marker).toBeVisible();
  return marker;
}
async function clickMarker(target: Page, name: string) {
  const marker = target.getByRole('button', { name, exact: true });
  if ((await marker.getAttribute('data-visible')) === 'false') {
    await marker.focus();
    await settleCamera(target);
  }
  await (await assertInteractiveMarker(target, name)).click();
}

async function openVigilia(target: Page) {
  await clickMarker(target, 'Vigília');
  const drawer = target.getByRole('complementary', { name: 'Missões de Vigília' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS('opacity', '1');
  return drawer;
}

async function fillMission(target: Page, title: string) {
  const dialog = target.getByRole('dialog', { name: 'Um chamado à guilda' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Título', { exact: true }).fill(title);
  const start = new Date(Date.now() + 3600000);
  await dialog
    .locator('input[name="starts_at"]')
    .fill(new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  await dialog
    .getByLabel('Descrição', { exact: true })
    .fill('Explorar os caminhos antigos e retornar com notícias para a guilda.');
  return dialog;
}

async function publish(target: Page) {
  const response = target.waitForResponse(
    (result) => result.url() === `${base}/api/board` && result.request().method() === 'POST',
  );
  await target
    .getByRole('dialog')
    .getByRole('button', { name: 'Publicar no mural', exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(201);
  await expect(target.getByRole('dialog')).toHaveCount(0);
  return result.json();
}

async function worldMapState(target: Page) {
  return target.locator('.world-map__viewport').evaluate((viewport) => {
    const host = viewport as HTMLElement;
    const canvas = viewport.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const frameStyle = getComputedStyle(viewport.closest('.world-atlas')!);
    return {
      zoom: Number(host.dataset.worldZoom),
      x: Number(host.dataset.worldPanX),
      y: Number(host.dataset.worldPanY),
      homeX: Number(host.dataset.worldHomeX),
      homeY: Number(host.dataset.worldHomeY),
      minZoom: Number(host.dataset.cameraMinZoom),
      homeZoom: Number(host.dataset.cameraHomeZoom),
      maxZoom: Number(host.dataset.cameraMaxZoom),
      vertices: Number(host.dataset.terrainVertices),
      viewWidth: Number(host.dataset.cameraViewWidth),
      distance: Number(host.dataset.cameraDistance),
      elevation: Number(host.dataset.cameraElevation),
      rendererInfo: {
        renderer: gl ? gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
        vendor: gl ? gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) : null,
      },
      elastic: {
        state: host.dataset.elasticState,
        limitX: Number(host.dataset.limitX),
        limitY: Number(host.dataset.limitY),
        band: Number(host.dataset.elasticBand),
        overscroll: Number(host.dataset.elasticOverscroll),
        inset: Number(host.dataset.elasticInset),
      },
      viewport: viewport.getBoundingClientRect().toJSON() as {
        x: number;
        y: number;
        width: number;
        height: number;
      },
      canvas: canvas.getBoundingClientRect().toJSON() as {
        x: number;
        y: number;
        width: number;
        height: number;
      },
      frame: { border: frameStyle.borderTopWidth, radius: frameStyle.borderTopLeftRadius },
      drawingBuffer: { width: canvas.width, height: canvas.height },
      pins: Array.from(viewport.querySelectorAll<HTMLElement>('.atlas-pin'), (pin) => {
        const point = pin.querySelector('.atlas-pin__point')!.getBoundingClientRect();
        const style = getComputedStyle(pin.querySelector('.atlas-pin__point')!);
        return {
          name: pin.getAttribute('aria-label'),
          x: point.x + point.width / 2,
          y: point.y + point.height / 2,
          style: {
            width: style.width,
            height: style.height,
            border: style.borderTopWidth,
            shape: style.borderRadius,
          },
        };
      }),
    };
  });
}
type WorldMapState = Awaited<ReturnType<typeof worldMapState>>;

async function settleWorldMap(target: Page) {
  const stable = await target.locator('.world-map__viewport').evaluate(async (viewport) => {
    const host = viewport as HTMLElement;
    let previous: number[] | undefined;
    let consecutive = 0;
    const deadline = performance.now() + 12000;
    while (performance.now() < deadline) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const values = ['worldZoom', 'worldPanX', 'worldPanY', 'cameraViewWidth'].map((key) =>
        Number(host.dataset[key]),
      );
      const delta = previous
        ? Math.max(...values.map((value, index) => Math.abs(value - previous![index])))
        : Infinity;
      consecutive = delta < 0.001 ? consecutive + 1 : 0;
      if (consecutive >= 2) return true;
      previous = values;
    }
    return false;
  });
  expect(stable, 'O relevo deve estabilizar entre frames.').toBe(true);
}
function assertWorldCanvasCoverage(state: WorldMapState) {
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(
      Math.abs(state.canvas[key] - state.viewport[key]),
      'Canvas deve cobrir o viewport.',
    ).toBeLessThan(1);
  expect(state.drawingBuffer.width).toBeGreaterThan(0);
  expect(state.drawingBuffer.height).toBeGreaterThan(0);
  expect(state.frame.border, 'Mundo não deve ter moldura.').toBe('0px');
  expect(state.frame.radius).toBe('0px');
}
async function readyWorldRelief(target: Page) {
  const world = target.locator('.world-map');
  await expect(world).toHaveAttribute('data-renderer', 'relief');
  await expect(world).toHaveAttribute('data-status', 'ready', { timeout: 45000 });
  await expect(world.locator('.world-map__viewport')).toHaveAttribute(
    'data-camera-type',
    'orthographic',
  );
  await expect(world.locator('.world-map__viewport > canvas')).toBeVisible();
  await expect(world.locator('.world-map__image:visible')).toHaveCount(0);
  await settleWorldMap(target);
  const state = await worldMapState(target);
  expect(state.vertices, 'O mundo deve usar relevo detalhado.').toBeGreaterThan(100000);
  expect([state.homeX, state.homeY].every(Number.isFinite)).toBe(true);
  expect([state.minZoom, state.maxZoom]).toEqual([1, 3.5 / 1.42]);
  expect(state.elevation).toBeCloseTo(67, 1);
  expect(state.viewWidth).toBeGreaterThan(0);
  expect(state.distance).toBeGreaterThan(0);
  assertWorldCanvasCoverage(state);
  const windowSize = await target.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(Math.abs(state.viewport.width - windowSize.width)).toBeLessThan(1);
  expect(Math.abs(state.viewport.height - windowSize.height)).toBeLessThan(1);
  expect(Math.hypot(state.viewport.x, state.viewport.y)).toBeLessThan(1);
  return state;
}
function worldPinDistance(state: WorldMapState) {
  expect(state.pins).toHaveLength(22);
  return Math.hypot(state.pins[0].x - state.pins[1].x, state.pins[0].y - state.pins[1].y);
}
async function resetWorldMap(target: Page, baseline?: WorldMapState) {
  await target.getByRole('button', { name: 'Centralizar mapa', exact: true }).click();
  await expect
    .poll(async () => {
      const state = await worldMapState(target);
      return Math.max(
        Math.abs(state.zoom - state.homeZoom),
        Math.abs(state.x - state.homeX),
        Math.abs(state.y - state.homeY),
      );
    })
    .toBeLessThan(0.0001);
  await settleWorldMap(target);
  const state = await worldMapState(target);
  assertWorldCanvasCoverage(state);
  if (baseline) {
    const scale =
      state.viewport.width / state.viewWidth / (baseline.viewport.width / baseline.viewWidth);
    for (let i = 0; i < baseline.pins.length; i++) {
      const old = baseline.pins[i],
        next = state.pins[i];
      const x =
        state.viewport.x +
        state.viewport.width / 2 +
        (old.x - baseline.viewport.x - baseline.viewport.width / 2) * scale;
      const y =
        state.viewport.y +
        state.viewport.height / 2 +
        (old.y - baseline.viewport.y - baseline.viewport.height / 2) * scale;
      expect(
        Math.hypot(next.x - x, next.y - y),
        'Reset deve restaurar a projeção dos pinos.',
      ).toBeLessThan(2);
    }
  }
  return state;
}
async function dragWorldMap(target: Page, touch?: CDPSession) {
  const gesture = await target.locator('.world-map__viewport').evaluate((viewport) => {
    const rect = viewport.getBoundingClientRect();
    for (const yFraction of [0.5, 0.38, 0.65]) {
      const x = rect.x + rect.width * 0.76,
        y = rect.y + rect.height * yFraction;
      const element = document.elementFromPoint(x, y);
      if (element && viewport.contains(element) && !element.closest('button'))
        return { x, y, endX: rect.x + rect.width * 0.24 };
    }
    return null;
  });
  expect(gesture, 'Deve haver mapa livre para arrastar.').not.toBeNull();
  const { x, y, endX } = gesture!;
  if (touch) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x, y }],
    });
    for (let step = 1; step <= 3; step++)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 1, x: x + ((endX - x) * step) / 3, y }],
      });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await target.mouse.move(x, y);
    await target.mouse.down();
    await target.mouse.move(endX, y, { steps: 3 });
    await target.mouse.up();
    await target.mouse.move(2, 2);
  }
  await settleWorldMap(target);
}

async function exerciseWorldElasticEdge(target: Page, touch?: CDPSession) {
  const viewport = target.locator('.world-map__viewport');
  await resetWorldMap(target);
  for (let i = 0; i < 2; i++) {
    await target.getByRole('button', { name: 'Aproximar mapa', exact: true }).click();
    await settleWorldMap(target);
  }
  // Accessible navigation positions the camera at a real edge, without changing
  // component state or manufacturing pointer coordinates outside the screen.
  await target.getByRole('button', { name: 'Pomar Branco', exact: true }).focus();
  await settleWorldMap(target);
  await viewport.focus();
  let edge = await worldMapState(target);
  expect(edge.zoom).toBeGreaterThan(1.5);
  expect(edge.elastic.limitX).toBeGreaterThan(0);
  for (let step = 0; step < 40 && edge.x < edge.elastic.limitX - 0.001; step++) {
    await target.keyboard.press('ArrowRight');
    edge = await worldMapState(target);
  }
  expect(Math.abs(edge.x - edge.elastic.limitX)).toBeLessThan(0.001);
  const gesture = await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (const yFraction of [0.5, 0.4, 0.6]) {
      const x = rect.x + rect.width * 0.8,
        y = rect.y + rect.height * yFraction;
      const hit = document.elementFromPoint(x, y);
      if (hit && element.contains(hit) && !hit.closest('button')) return { x, y };
    }
    return null;
  });
  expect(gesture).not.toBeNull();
  const { x, y } = gesture!;
  const stepPx = Math.max(
    10,
    Math.min(edge.viewport.width * 0.12, (edge.viewport.width / edge.viewWidth) * 0.45),
  );
  const held: WorldMapState[] = [];
  let pointerDown = false;
  await target.emulateMedia({ reducedMotion: 'no-preference' });
  try {
    if (touch)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ id: 9, x, y }],
      });
    else {
      await target.mouse.move(x, y);
      await target.mouse.down();
    }
    pointerDown = true;
    for (let step = 1; step <= 3; step++) {
      if (touch)
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ id: 9, x: x - stepPx * step, y }],
        });
      else await target.mouse.move(x - stepPx * step, y);
      held.push(await worldMapState(target));
    }
    const last = held.at(-1)!;
    expect(last.elastic.state).toBe('dragging');
    expect(last.x, 'A borda deve ceder levemente durante o gesto.').toBeGreaterThan(
      edge.elastic.limitX + 0.005,
    );
    expect(
      last.x - edge.elastic.limitX,
      'Não deve expor um grande vazio além do mundo.',
    ).toBeLessThan(1.25);
    const firstGain = held[0].x - edge.x,
      secondGain = held[1].x - held[0].x,
      thirdGain = held[2].x - held[1].x;
    expect(firstGain).toBeGreaterThan(0.01);
    expect(secondGain).toBeGreaterThanOrEqual(-0.001);
    expect(thirdGain).toBeGreaterThanOrEqual(-0.001);
    expect(
      thirdGain,
      'Movimentos iguais do ponteiro devem encontrar resistência crescente.',
    ).toBeLessThan(firstGain * 0.9);
    expect(
      Math.hypot(last.pins[0].x - edge.pins[0].x, last.pins[0].y - edge.pins[0].y),
    ).toBeGreaterThan(1);
    await target.screenshot({
      path: `test-results/world-relief-elastic-held-${touch ? 'mobile' : 'desktop'}.png`,
      animations: 'disabled',
    });

    // Timestamp the real pointer event and sample RAFs in the page. Wall-clock
    // CDP round trips can be slow under software WebGL and are not animation time.
    await viewport.evaluate((element) => {
      const host = element as HTMLElement;
      (window as typeof window & { __atlasSpringProbe?: Promise<unknown> }).__atlasSpringProbe =
        new Promise((resolve) => {
          element.addEventListener(
            'pointerup',
            () => {
              const start = performance.now();
              void (async () => {
                const samples: {
                  elapsed: number;
                  x: number;
                  y: number;
                  state: string | undefined;
                }[] = [];
                while (true) {
                  samples.push({
                    elapsed: performance.now() - start,
                    x: Number(host.dataset.worldPanX),
                    y: Number(host.dataset.worldPanY),
                    state: host.dataset.elasticState,
                  });
                  if (samples.at(-1)!.state === 'idle' || performance.now() - start > 2000) break;
                  await new Promise<void>((next) => requestAnimationFrame(() => next()));
                }
                resolve(samples);
              })();
            },
            { once: true, capture: true },
          );
        });
    });
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await target.mouse.up();
    pointerDown = false;
    const spring = await target.evaluate(
      () =>
        (
          window as typeof window & {
            __atlasSpringProbe: Promise<
              { elapsed: number; x: number; y: number; state: string | undefined }[]
            >;
          }
        ).__atlasSpringProbe,
    );
    const releaseMs = spring.at(-1)!.elapsed;
    const returned = await worldMapState(target);
    await writeFile(
      `test-results/world-relief-elastic-${touch ? 'mobile' : 'desktop'}.json`,
      JSON.stringify({ edge, held, spring, returned, releaseMs }, null, 2),
    );
    expect(spring.every((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y))).toBe(
      true,
    );
    expect(returned.elastic.state).toBe('idle');
    expect(spring.at(-1)!.state).toBe('idle');
    expect(releaseMs, 'A volta elástica deve concluir em até dois segundos.').toBeLessThanOrEqual(
      2000,
    );
    expect(
      returned.x,
      'Ao soltar deve recuar para dentro, sem parar na parede exata.',
    ).toBeLessThan(edge.elastic.limitX - 0.005);
    expect(returned.x).toBeGreaterThan(edge.elastic.limitX - 1.5);
    expect(
      spring.some(
        (sample) =>
          sample.state === 'returning' &&
          sample.x < last.x - 0.005 &&
          sample.x > returned.x + 0.005,
      ),
      'A volta deve ter frames intermediários, sem salto instantâneo.',
    ).toBe(true);

    // Immediately start another inward gesture. This catches a stuck capture or
    // stale suppression flag without inserting a delay after the spring.
    if (touch)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ id: 10, x: x - stepPx * 3, y }],
      });
    else {
      await target.mouse.move(x - stepPx * 3, y);
      await target.mouse.down();
    }
    pointerDown = true;
    if (touch)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 10, x, y }],
      });
    else await target.mouse.move(x, y);
    const nextGesture = await worldMapState(target);
    expect(nextGesture.x, 'Um novo gesto deve responder imediatamente.').toBeLessThan(
      returned.x - 0.05,
    );
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await target.mouse.up();
    pointerDown = false;
    await settleWorldMap(target);
    console.log(
      `Borda elástica ${touch ? 'mobile' : 'desktop'}: avanços ${[firstGain, secondGain, thirdGain].map((value) => value.toFixed(3)).join(' / ')}; retorno ${releaseMs} ms.`,
    );
    return { edge, held, spring, returned, nextGesture, releaseMs };
  } finally {
    if (pointerDown) {
      if (touch)
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await target.mouse.up();
    }
    await target.emulateMedia({ reducedMotion: 'reduce' });
    await resetWorldMap(target);
  }
}
async function exerciseWorldRelief(target: Page, mobile: boolean) {
  const startedAt = Date.now();
  const label = mobile ? 'mobile' : 'desktop';
  const missionWrites: string[] = [];
  target.on('request', (request) => {
    if (request.method() !== 'GET' && /^\/api\/board(?:\/|$)/.test(new URL(request.url()).pathname))
      missionWrites.push(request.method());
  });
  await target.emulateMedia({ reducedMotion: 'reduce' });
  await target.goto(base + '/#world');
  const baseline = await readyWorldRelief(target);
  const readyMs = Date.now() - startedAt;
  console.log(
    `Mundo ${label}: pronto em ${readyMs} ms; ${baseline.vertices} vértices, canvas ${baseline.viewport.width}×${baseline.viewport.height}; renderer ${baseline.rendererInfo.renderer}.`,
  );
  expect(baseline.zoom).toBeCloseTo(1, 3);
  expect(Math.hypot(baseline.x - baseline.homeX, baseline.y - baseline.homeY)).toBeLessThan(0.001);
  expect(baseline.pins.map((pin) => pin.name).sort()).toEqual([
    'Altos de Boreal',
    'Campos de Vésper',
    'Coroa da Geada',
    'Costa Cinzenta',
    'Dunas de Auren',
    'Ermos de Sálvia',
    'Escarpas de Cinábrio',
    'Falésias de Sal',
    'Fulkushima',
    'Marchas do Poente',
    'Northundria',
    'Olho da Tormenta',
    'Península de Lume',
    'Pomar Branco',
    'Portas de Arenito',
    'Reino do Norte',
    'Skelliege',
    'Terras de Âmbar',
    'Valdrakken',
    'Vale do Cervo',
    'Vale dos Pinheiros',
    'Vigias do Gelo',
  ]);
  for (const pin of baseline.pins) expect(pin.style).toEqual(baseline.pins[0].style);
  await target.screenshot({
    path: 'test-results/world-relief-home-' + label + '.png',
    fullPage: true,
    animations: 'disabled',
  });
  if (!mobile) {
    // Hit real land outside HTML pins: hovering and clicking the surface must work too.
    const desert = baseline.pins.find((pin) => pin.name === 'Dunas de Auren')!;
    let hit: { x: number; y: number } | undefined;
    for (const [dx, dy] of [
      [-28, -42],
      [30, -38],
      [-42, 0],
      [42, 0],
      [0, -48],
      [70, -32],
      [65, -50],
      [10, 65],
      [45, 62],
    ]) {
      const point = { x: desert.x + dx, y: desert.y + dy };
      const overButton = await target.evaluate(
        (p) => !!document.elementFromPoint(p.x, p.y)?.closest('button'),
        point,
      );
      if (overButton) continue;
      await target.mouse.move(point.x, point.y);
      if (
        (await target.locator('.world-map__viewport').getAttribute('data-hovered-territory')) ===
        'dunas-de-auren'
      ) {
        hit = point;
        break;
      }
    }
    expect(hit, 'Uma área terrestre fora do pin deve responder ao cursor.').toBeDefined();
    await target.screenshot({ path: 'test-results/world-territory-hover.png' });
    await target.mouse.click(hit!.x, hit!.y);
    await expect(target.locator('.atlas-notice')).toContainText(
      'Dunas de Auren: exploração em breve.',
    );
    await target.getByRole('button', { name: 'Fechar aviso do território' }).click();
    for (const name of [
      'Fulkushima',
      'Olho da Tormenta',
      'Valdrakken',
      'Skelliege',
      'Coroa da Geada',
      'Vale dos Pinheiros',
      'Falésias de Sal',
      'Altos de Boreal',
      'Campos de Vésper',
      'Terras de Âmbar',
      'Península de Lume',
      'Escarpas de Cinábrio',
      'Vigias do Gelo',
      'Vale do Cervo',
      'Ermos de Sálvia',
      'Portas de Arenito',
    ]) {
      await target.getByRole('button', { name, exact: true }).focus();
      await settleWorldMap(target);
      if (name === 'Coroa da Geada') {
        await target.getByRole('button', { name, exact: true }).hover();
        await expect(target.locator('.world-map__viewport')).toHaveAttribute(
          'data-hovered-territory',
          'coroa-da-geada',
        );
        await target.screenshot({ path: 'test-results/world-subdivision-hover.png' });
      }
      if (name === 'Fulkushima') {
        const volcanoPin = target.getByRole('button', { name, exact: true });
        await volcanoPin.focus();
        await settleWorldMap(target);
        // Remove keyboard focus before comparing the island's normal/hover finishes.
        await target.getByRole('button', { name: 'Centralizar mapa', exact: true }).focus();
        await target.mouse.move(2, 2);
        await target.screenshot({ path: 'test-results/fulkushima-idle.png' });
        const box = (await volcanoPin.boundingBox())!;
        // Test the land beside the pin, not just the HTML marker.
        await target.mouse.move(box.x + box.width / 2 - 28, box.y - 8);
        await expect(target.locator('.world-map__viewport')).toHaveAttribute(
          'data-hovered-territory',
          'fulkushima',
        );
        await target.screenshot({ path: 'test-results/fulkushima-hover.png' });
      }
      await target.getByRole('button', { name, exact: true }).click();
      await expect(target.locator('.atlas-notice')).toContainText(name + ': exploração em breve.');
      await target.getByRole('button', { name: 'Fechar aviso do território' }).click();
    }
    await resetWorldMap(target, baseline);
    await target.mouse.move(2, 2);
    await expect(target.locator('.world-map__viewport')).toHaveAttribute(
      'data-hovered-territory',
      '',
    );
  }
  const scroll = await target.evaluate(() => window.scrollY);
  if (mobile) await target.getByRole('button', { name: 'Aproximar mapa', exact: true }).tap();
  else {
    await target.mouse.move(baseline.viewport.width * 0.52, baseline.viewport.height * 0.53);
    await target.mouse.wheel(0, -500);
    await target.mouse.move(2, 2);
  }
  await settleWorldMap(target);
  const near = await worldMapState(target);
  expect(near.zoom).toBeGreaterThan(1);
  expect(near.zoom).toBeLessThanOrEqual(3.5 / 1.42);
  expect(near.viewWidth, 'Zoom deve alterar câmera.').toBeLessThan(baseline.viewWidth);
  expect(worldPinDistance(near), 'Pinos devem acompanhar a projeção ampliada.').toBeGreaterThan(
    worldPinDistance(baseline) + 2,
  );
  expect(await target.evaluate(() => window.scrollY)).toBe(scroll);
  const touch = mobile ? await target.context().newCDPSession(target) : undefined;
  try {
    await dragWorldMap(target, touch);
    const moved = await worldMapState(target);
    expect(Math.hypot(moved.x - near.x, moved.y - near.y)).toBeGreaterThan(0.05);
    const dx = moved.pins[0].x - near.pins[0].x,
      dy = moved.pins[0].y - near.pins[0].y;
    expect(Math.hypot(dx, dy), 'Pinos devem mover com o arraste.').toBeGreaterThan(2);
    for (let i = 1; i < moved.pins.length; i++)
      expect(
        Math.hypot(moved.pins[i].x - near.pins[i].x - dx, moved.pins[i].y - near.pins[i].y - dy),
        'Pinos devem acompanhar a mesma translação da câmera.',
      ).toBeLessThan(2);
    await target.screenshot({
      path: 'test-results/world-relief-pan-' + label + '.png',
      fullPage: true,
      animations: 'disabled',
    });
    await resetWorldMap(target, baseline);
    const elastic = await exerciseWorldElasticEdge(target, touch);
    if (!mobile) {
      const closer = target.getByRole('button', { name: 'Aproximar mapa', exact: true });
      for (let step = 0; step < 12 && (await closer.isEnabled()); step++) {
        await closer.click();
        await settleWorldMap(target);
      }
      await expect(closer).toBeDisabled();
      expect((await worldMapState(target)).zoom).toBeCloseTo(3.5 / 1.42, 3);
      await target.screenshot({
        path: 'test-results/world-relief-detail-desktop.png',
        fullPage: true,
        animations: 'disabled',
      });
      await resetWorldMap(target, baseline);
    }
    for (const name of ['Northundria', 'Pomar Branco']) {
      await target.getByRole('button', { name, exact: true }).focus();
      await settleWorldMap(target);
      await target.getByRole('button', { name, exact: true }).click();
      await expect(target.locator('.atlas-notice')).toContainText(name + ': exploração em breve.');
      await target.getByRole('button', { name: 'Fechar aviso do território' }).click();
    }
    if (!mobile) {
      await target.getByRole('button', { name: 'Reino do Norte', exact: true }).focus();
      await settleWorldMap(target);
      await target.getByRole('button', { name: 'Reino do Norte', exact: true }).click();
      await expect(target.locator('.world-atlas h1')).toHaveText('Reino do Norte.', {
        timeout: 30000,
      });
      await ready(target);
      await target.getByRole('button', { name: 'Voltar ao mundo' }).click();
      const returned = await readyWorldRelief(target);
      expect(returned.zoom).toBeCloseTo(1, 3);
      expect(Math.hypot(returned.x - returned.homeX, returned.y - returned.homeY)).toBeLessThan(
        0.001,
      );
    }
    expect(missionWrites).toEqual([]);
    expect(
      await target.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await writeFile(
      'test-results/world-relief-' + label + '.json',
      JSON.stringify(
        {
          baseline,
          zoom: near.zoom,
          pan: { x: moved.x, y: moved.y },
          elastic,
          timing: { readyMs, totalMs: Date.now() - startedAt },
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await touch?.detach();
  }
}
async function runWorldMapOnly() {
  await page.setViewportSize({ width: 1440, height: 900 });
  await exerciseWorldRelief(page, false);
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    storageState: await page.context().storageState(),
  });
  watchErrors(touch);
  try {
    await exerciseWorldRelief(touch, true);
  } catch (error) {
    await touch.screenshot({
      path: 'test-results/world-relief-mobile-failure.png',
      fullPage: true,
    });
    throw error;
  } finally {
    await touch.close();
  }
  expect(errors).toEqual([]);
  expect(webglRasterRequests).toEqual([]);
  console.log(
    'Mundo em relevo OK: canvas sem moldura, malha detalhada, zoom/pan alteram câmera e pinos, reset, avisos e retorno do reino. Desktop/mobile; nenhuma missão publicada.',
  );
}
async function exposedMapPoint(target: Page) {
  const point = await target.locator('.kingdom-map__ground').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    for (const xf of [0.5, 0.38, 0.65, 0.25])
      for (const yf of [0.42, 0.58, 0.3, 0.7]) {
        const x = rect.left + rect.width * xf,
          y = rect.top + rect.height * yf;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
    return null;
  });
  expect(point, 'Deve haver mapa livre para zoom.').not.toBeNull();
  return point!;
}

async function exerciseRegionalNavigation(target: Page, mobile: boolean) {
  const label = mobile ? 'mobile' : 'desktop';
  const missionWrites: string[] = [];
  const recordWrites = (request: import('@playwright/test').Request) => {
    if (request.method() !== 'GET' && /^\/api\/board(?:\/|$)/.test(new URL(request.url()).pathname))
      missionWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
  };
  target.on('request', recordWrites);
  try {
    await target.goto(`${base}/#world`);
    await openNorth(target);
    await exerciseTerrainCamera(target, 'north', mobile);
    const baseline = await pins(target),
      entry = await camera(target);
    expect(
      baseline.filter((pin) => pin.visible).map((pin) => pin.name),
      'A vista inicial enquadra apenas Vigília; os demais povoados exigem navegação.',
    ).toEqual(['Vigília']);
    await assertInteractiveMarker(target, 'Vigília');
    if (!mobile) {
      const point = await exposedMapPoint(target),
        scrollBefore = await target.evaluate(() => scrollY);
      await target.mouse.move(point.x, point.y);
      await target.mouse.wheel(0, -320);
      await target.mouse.move(2, 2);
      await settleCamera(target);
      expect((await camera(target)).zoom).toBeGreaterThan(entry.zoom);
      expect(pinDelta(baseline, await pins(target))).toBeGreaterThan(8);
      expect(await target.evaluate(() => scrollY)).toBe(scrollBefore);
      await resetCamera(target, baseline);
    }
    const touch = mobile ? await target.context().newCDPSession(target) : undefined;
    try {
      await dragAcross(target, 'left', touch);
      expect(
        pinDelta(baseline, await pins(target)),
        'Arraste move cenário e construções juntos.',
      ).toBeGreaterThan(8);
      await target.screenshot({ path: `test-results/kingdom-pan-${label}.png`, fullPage: true });
      await resetCamera(target, baseline);
    } finally {
      await touch?.detach();
    }
    for (const place of baseline) {
      const marker = target.getByRole('button', { name: place.name!, exact: true });
      await marker.focus();
      await settleCamera(target);
      await assertInteractiveMarker(target, place.name!);
      await target.keyboard.press('Enter');
      const drawer = target.getByRole('complementary', { name: `Missões de ${place.name}` });
      await expect(drawer).toBeVisible();
      await drawer.getByRole('button', { name: 'Fechar lista de missões' }).click();
    }
    await resetCamera(target, baseline);
    const drawer = await openVigilia(target);
    if (mobile) {
      const tabs = drawer.getByRole('button', { name: 'Todas', exact: true });
      await tabs.tap();
      await expect(tabs).toHaveAttribute('aria-pressed', 'true');
    }
    await drawer.getByRole('button', { name: 'Registrar missão aqui' }).click();
    const dialog = target.getByRole('dialog', { name: 'Um chamado à guilda' });
    await expect(dialog.getByLabel('Local no mapa')).toHaveValue('vigilia');
    const beforeTyping = (await camera(target)).direction;
    await dialog.getByLabel('Título', { exact: true }).fill('Quebrando encantamentos');
    await dialog.getByLabel('Título', { exact: true }).press('e');
    expect(
      (await camera(target)).direction,
      'Atalhos Q/E não devem girar o mapa ao editar uma missão.',
    ).toBe(beforeTyping);
    await target.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await drawer.getByRole('button', { name: 'Fechar lista de missões' }).click();
    await target.getByRole('button', { name: 'Voltar ao mundo' }).click();
    await ready(target);
    expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(missionWrites, 'Navegar/abrir formulário não deve criar ou alterar missões.').toEqual(
      [],
    );
  } finally {
    target.off('request', recordWrites);
  }
}
async function runNavigationOnly(mobileOnly = false) {
  if (!mobileOnly) await exerciseRegionalNavigation(page, false);
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    storageState: await page.context().storageState(),
  });
  watchErrors(touch);
  try {
    await exerciseRegionalNavigation(touch, true);
  } catch (error) {
    await touch.screenshot({
      path: 'test-results/atlas-navigation-mobile-failure.png',
      fullPage: true,
    });
    throw error;
  } finally {
    await touch.close();
  }
  expect(errors).toEqual([]);
  expect(webglRasterRequests).toEqual([]);
  console.log(
    'Navegação do reino 2D OK: oito orientações, sprites, zoom, arraste e limites, seis locais por teclado, modal sem publicar e celular.',
  );
}

async function exerciseKingdomWithoutWebGL(expectedTitles: string[] = []) {
  const withoutWebgl = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    storageState: await page.context().storageState(),
  });
  watchErrors(withoutWebgl);
  try {
    await withoutWebgl.goto(`${base}/#world`);
    await ready(withoutWebgl);
    // The world remains WebGL. Block any newly created WebGL context after it
    // loads: the new regional renderer must remain fully functional in Canvas2D.
    await withoutWebgl.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        options?: unknown,
      ) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return original.call(this, type, options);
      } as typeof original;
    });
    await openNorth(withoutWebgl);
    const noGlDrawer = await openVigilia(withoutWebgl);
    await noGlDrawer.getByRole('button', { name: 'Todas', exact: true }).click();
    for (const title of expectedTitles) await expect(noGlDrawer).toContainText(title);
    await withoutWebgl.screenshot({
      path: 'test-results/kingdom-without-webgl-desktop.png',
      fullPage: true,
    });
  } finally {
    await withoutWebgl.close();
  }
}

async function exerciseKingdomAssetRecovery() {
  const recovering = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    storageState: await page.context().storageState(),
  });
  watchErrors(recovering);
  try {
    await recovering.goto(`${base}/#world`);
    await ready(recovering);
    // Simulate undecodable sprite bytes, then restore the original image.
    // This exercises real loading/retry without a deliberate HTTP console error.
    await recovering.route('**/kingdom/nature.png', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: 'invalid-image',
      }),
    );
    await clickMarker(recovering, 'Reino do Norte');
    await expect(recovering.locator('.kingdom-map')).toHaveAttribute('data-status', 'error');
    await expect(recovering.locator('.kingdom-map')).toHaveAttribute('data-assets', 'error');
    await expect(recovering.getByRole('alert')).toContainText('ilustrações do reino');
    await recovering.screenshot({ path: 'test-results/kingdom-assets-error.png', fullPage: true });
    await recovering.unroute('**/kingdom/nature.png');
    await recovering.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await ready(recovering);
    await expect(recovering.locator('.kingdom-map canvas')).toHaveCount(1);
    await openVigilia(recovering);
    await recovering.screenshot({
      path: 'test-results/kingdom-assets-recovered.png',
      fullPage: true,
    });
  } finally {
    await recovering.close();
  }
}

async function captureVisualReview() {
  // Quick visual QA uses the same isolated account and cleanup, without publishing missions.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/#world`);
  await ready(page);
  await settleCamera(page);
  await page.screenshot({
    path: 'test-results/atlas-realism-world-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await openNorth(page);
  await settleCamera(page);
  await page.screenshot({
    path: 'test-results/atlas-realism-north-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  const drawer = await openVigilia(page);
  await drawer.getByRole('button', { name: 'Fechar lista de missões' }).click();
  await maximumZoom(page);
  await page
    .locator('.world-atlas')
    .screenshot({ path: 'test-results/atlas-realism-north-detail.png', animations: 'disabled' });
  await turnForReview(page, 'right');
  await page
    .locator('.world-atlas')
    .screenshot({ path: 'test-results/atlas-realism-north-oblique.png', animations: 'disabled' });

  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    storageState: await page.context().storageState(),
  });
  watchErrors(touch);
  try {
    await touch.goto(`${base}/#world`);
    await ready(touch);
    await settleCamera(touch);
    await touch.screenshot({
      path: 'test-results/atlas-realism-world-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    await openNorth(touch);
    await settleCamera(touch);
    await touch.screenshot({
      path: 'test-results/atlas-realism-north-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await touch.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } catch (error) {
    await touch.screenshot({
      path: 'test-results/atlas-realism-mobile-failure.png',
      fullPage: true,
    });
    throw error;
  } finally {
    await touch.close();
  }
  expect(errors).toEqual([]);
  expect(webglRasterRequests).toEqual([]);
  console.log(
    'Atlas visual OK: mundo em relevo preservado, reino Canvas2D com quatro imagens locais, detalhe/giro, desktop e celular. Nenhuma missão criada.',
  );
}

async function runTerrainOnly() {
  await page.goto(`${base}/#world`);
  await openNorth(page);
  const scene = page.locator('.kingdom-map');
  await expect(scene).toHaveAttribute('data-stage', 'terrain');
  await expect(scene.locator('.kingdom-place, .kingdom-house')).toHaveCount(0);
  expect(Number(await scene.getAttribute('data-grove-count'))).toBe(0);
  expect((await camera(page)).zoom).toBe(1);
  await expect(page.getByLabel('Aproximação do mapa')).toHaveText('100%');
  await expect(page.getByRole('button', { name: 'Afastar mapa', exact: true })).toBeDisabled();
  const terrainEdges = () =>
    scene.evaluate((host) => {
      const data = (host as HTMLElement).dataset;
      const scale = Number(data.baseScale) * Number(data.zoom);
      const x = Number(data.panX);
      const y = Number(data.panY);
      const { width, height } = host.getBoundingClientRect();
      return {
        left: width / 2 + (-7500 - x) * scale,
        right: width / 2 + (7500 - x) * scale,
        top: height * 0.57 + (-7500 - y) * scale * 0.58,
        bottom: height * 0.57 + (7500 - y) * scale * 0.58,
        width,
        height,
      };
    });
  const initialEdges = await terrainEdges();
  expect(initialEdges.left).toBeLessThan(0);
  expect(initialEdges.right).toBeGreaterThan(initialEdges.width);
  expect(initialEdges.bottom).toBeGreaterThan(initialEdges.height);
  await page.screenshot({
    path: 'test-results/kingdom-terrain-entry.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Girar mapa para a direita' }).click();
  await settleCamera(page);
  expect((await camera(page)).direction).toBe(1);
  await expect(scene.locator('.kingdom-place, .kingdom-house')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/kingdom-terrain-turned.png',
    fullPage: true,
    animations: 'disabled',
  });
  for (let expectedDirection = 2; expectedDirection < 8; expectedDirection++) {
    await page.getByRole('button', { name: 'Girar mapa para a direita' }).click();
    await settleCamera(page);
    expect((await camera(page)).direction).toBe(expectedDirection);
    if (expectedDirection === 4)
      await page.screenshot({
        path: 'test-results/kingdom-terrain-opposite.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
  await resetCamera(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Aproximar mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Aproximar mapa', exact: true }).click();
  await settleCamera(page);
  await dragAcross(page, 'left');
  await settleCamera(page);
  await resetCamera(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await maximumZoom(page);
  const before = await camera(page);
  await dragAcross(page, 'left');
  expect((await camera(page)).x).not.toBe(before.x);
  await resetCamera(page);
  await maximumZoom(page);
  for (let i = 0; i < 12; i++) await dragAcross(page, 'left');
  await settleCamera(page);
  const easternEdges = await terrainEdges();
  expect(easternEdges.right).toBeCloseTo(easternEdges.width, 0);
  await page.screenshot({ path: 'test-results/kingdom-terrain-edge.png', fullPage: true });
  const edgeVariation = await scene.locator('.kingdom-map__edge-mist').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const depth = Number(canvas.closest('.kingdom-map')!.getAttribute('data-edge-mist-depth'));
    const ratio = canvas.width / canvas.clientWidth;
    const x = Math.round(canvas.width - depth * ratio * 0.55);
    const alphas: number[] = [];
    for (let y = Math.round(canvas.height * 0.2); y < canvas.height * 0.8; y += 12)
      alphas.push(context.getImageData(x, y, 1, 1).data[3]);
    return { variation: Math.max(...alphas) - Math.min(...alphas), strongest: Math.max(...alphas) };
  });
  expect(
    edgeVariation.variation,
    'A névoa deve ter invasão irregular, sem faixa uniforme.',
  ).toBeGreaterThan(25);
  expect(edgeVariation.strongest, 'A névoa dentro do mapa deve ser translúcida.').toBeLessThan(145);
  const groundFrame = await scene
    .locator('.kingdom-map__ground')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  const mistFrame = await scene
    .locator('.kingdom-map__edge-mist')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  const mistMotionBefore = await scene.locator('.kingdom-map__edge-mist').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const depth = Number(canvas.closest('.kingdom-map')!.getAttribute('data-edge-mist-depth'));
    const ratio = canvas.width / canvas.clientWidth;
    const x = Math.round(canvas.width - depth * ratio * 0.55);
    const pixels = canvas.getContext('2d')!.getImageData(x, 0, 1, canvas.height).data;
    return Array.from({ length: canvas.height }, (_, y) => pixels[y * 4 + 3]);
  });
  await page.waitForTimeout(600);
  const nextGroundFrame = await scene
    .locator('.kingdom-map__ground')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  const nextMistFrame = await scene
    .locator('.kingdom-map__edge-mist')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  const mistMotionAfter = await scene.locator('.kingdom-map__edge-mist').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const depth = Number(canvas.closest('.kingdom-map')!.getAttribute('data-edge-mist-depth'));
    const ratio = canvas.width / canvas.clientWidth;
    const x = Math.round(canvas.width - depth * ratio * 0.55);
    const pixels = canvas.getContext('2d')!.getImageData(x, 0, 1, canvas.height).data;
    return Array.from({ length: canvas.height }, (_, y) => pixels[y * 4 + 3]);
  });
  expect(nextGroundFrame, 'O terreno deve permanecer estático.').toBe(groundFrame);
  expect(nextMistFrame, 'A névoa das bordas deve se mover.').not.toBe(mistFrame);
  const mistMotion = mistMotionBefore.reduce(
    (sum, alpha, index) => sum + Math.abs(alpha - mistMotionAfter[index]),
    0,
  );
  expect(
    mistMotion / mistMotionBefore.length,
    'O movimento da névoa deve ser perceptível.',
  ).toBeGreaterThan(1.5);
  const mistBounds = await scene.locator('.kingdom-map__edge-mist').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const depth = Number(canvas.closest('.kingdom-map')!.getAttribute('data-edge-mist-depth'));
    const scale = canvas.width / canvas.clientWidth;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasVisibleMist = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        hasVisibleMist = true;
        break;
      }
    }
    return {
      depth,
      hasVisibleMist,
      center: context.getImageData(
        Math.round((canvas.clientWidth * scale) / 2),
        Math.round((canvas.clientHeight * scale) / 2),
        1,
        1,
      ).data[3],
      beyondTop: context.getImageData(
        Math.round((canvas.clientWidth * scale) / 2),
        Math.round((depth + 10) * scale),
        1,
        1,
      ).data[3],
      beyondLeft: context.getImageData(
        Math.round((depth + 10) * scale),
        Math.round((canvas.clientHeight * scale) / 2),
        1,
        1,
      ).data[3],
    };
  });
  expect(mistBounds.depth).toBeLessThanOrEqual(96);
  expect(mistBounds.hasVisibleMist, 'A névoa deve aparecer ao alcançar o perímetro do mapa.').toBe(
    true,
  );
  expect([mistBounds.center, mistBounds.beyondTop, mistBounds.beyondLeft]).toEqual([0, 0, 0]);
  await resetCamera(page);
  await maximumZoom(page);
  for (let i = 0; i < 12; i++) await dragAcross(page, 'right');
  await settleCamera(page);
  expect((await terrainEdges()).left).toBeCloseTo(0, 0);
  await page.screenshot({ path: 'test-results/kingdom-terrain-west.png', fullPage: true });
  await resetCamera(page);
  await maximumZoom(page);
  for (let i = 0; i < 12; i++) await dragAcross(page, 'up');
  await settleCamera(page);
  const southernEdges = await terrainEdges();
  expect(southernEdges.bottom).toBeCloseTo(southernEdges.height, 0);
  await page.screenshot({ path: 'test-results/kingdom-terrain-south.png', fullPage: true });
  for (let i = 0; i < 12; i++) await dragAcross(page, 'left');
  await settleCamera(page);
  const southeastCorner = await terrainEdges();
  expect(southeastCorner.right).toBeCloseTo(southeastCorner.width, 0);
  expect(southeastCorner.bottom).toBeCloseTo(southeastCorner.height, 0);
  await page.screenshot({ path: 'test-results/kingdom-terrain-southeast.png', fullPage: true });
  const mapRect = await scene.boundingBox();
  expect(mapRect).not.toBeNull();
  const dragY = mapRect!.y + mapRect!.height * 0.5;
  await page.mouse.move(mapRect!.x + mapRect!.width * 0.65, dragY);
  await page.mouse.down();
  await page.mouse.move(mapRect!.x + mapRect!.width * 0.15, dragY, { steps: 10 });
  await page.waitForTimeout(80);
  const stretchedEast = await terrainEdges();
  expect(stretchedEast.right).toBeLessThan(stretchedEast.width - 2);
  const outsideFog = await scene.locator('.kingdom-map__edge-mist').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const pixel = canvas
      .getContext('2d')!
      .getImageData(canvas.width - 3, Math.floor(canvas.height / 2), 1, 1).data;
    return [...pixel];
  });
  expect(outsideFog[3], 'Além do terreno deve haver névoa opaca.').toBe(255);
  expect(outsideFog[0]).toBeGreaterThan(190);
  const seam = await scene.locator('.kingdom-map__edge-mist').evaluate((element, edgeX) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const ratio = canvas.width / canvas.clientWidth;
    const x = Math.round(edgeX * ratio);
    const y = Math.floor(canvas.height / 2);
    return {
      samples: [6, 2, -2, -6, -12, -20, -32].map((offset) => [
        ...context.getImageData(x + Math.round(offset * ratio), y, 1, 1).data,
      ]),
    };
  }, stretchedEast.right);
  const seamAlphas = seam.samples.map((sample) => sample[3]);
  expect(seamAlphas[0]).toBe(255);
  expect(seamAlphas[1]).toBe(255);
  expect(seamAlphas[2]).toBeGreaterThan(205);
  for (let index = 1; index < seamAlphas.length; index++) {
    expect(seamAlphas[index]).toBeLessThanOrEqual(seamAlphas[index - 1] + 8);
    expect(seamAlphas[index - 1] - seamAlphas[index]).toBeLessThan(70);
  }
  expect(Math.abs(seam.samples[1][0] - seam.samples[2][0])).toBeLessThan(18);
  await page.screenshot({ path: 'test-results/kingdom-terrain-overdrag.png', fullPage: true });
  await page.mouse.up();
  await settleCamera(page);
  await resetCamera(page);
  await maximumZoom(page);
  for (let i = 0; i < 12; i++) await dragAcross(page, 'down');
  await settleCamera(page);
  expect((await terrainEdges()).top).toBeCloseTo(0, 0);
  await page.getByRole('button', { name: 'Voltar ao mundo' }).click();
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await openNorth(page);
    await expect(page.locator('.kingdom-place, .kingdom-house')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/kingdom-terrain-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(errors).toEqual([]);
  console.log(
    'Terreno OK: quatro bordas acessíveis, chão livre de objetos e nuvens, névoa externa opaca com transição irregular; desktop/celular.',
  );
}

async function runKingdomEditor() {
  await page.goto(`${base}/#world`);
  await openNorth(page);
  const scene = page.locator('.kingdom-map');
  await scene.getByRole('button', { name: 'Editar mapa' }).click();
  const editor = scene.getByRole('complementary', { name: 'Editor do mapa do reino' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Pinheiro' }).click();
  const bounds = (await scene.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * 0.42, bounds.y + bounds.height * 0.48);
  await expect(editor).toContainText('1 itens');
  await editor.getByRole('button', { name: 'Aumentar item' }).click();
  await editor.getByRole('button', { name: 'Girar item para a direita' }).click();
  await editor.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(editor).toContainText('Rascunho salvo');
  const saved = await page.request.get(`${base}/api/kingdom/editor-draft`);
  expect(saved.status()).toBe(200);
  const layout = await saved.json();
  expect(layout.revision).toBe(1);
  expect(layout.items).toHaveLength(1);
  expect(layout.items[0].kind).toBe('pine');
  expect(layout.items[0].height).toBeGreaterThan(520);
  expect(layout.items[0].direction).toBe(1);
  await page.screenshot({ path: 'test-results/kingdom-editor.png', fullPage: true });
  await page.reload();
  await openNorth(page);
  await scene.getByRole('button', { name: 'Editar mapa' }).click();
  const reopened = scene.getByRole('complementary', { name: 'Editor do mapa do reino' });
  await expect(reopened).toContainText('1 itens');
  await reopened.getByRole('button', { name: '1. Pinheiro' }).click();
  await page.waitForTimeout(550);
  const handle = await scene.evaluate((host, item) => {
    const data = (host as HTMLElement).dataset;
    const rect = host.getBoundingClientRect();
    const scale = Number(data.baseScale) * Number(data.zoom);
    return {
      x: rect.left + rect.width / 2 + (item.x - Number(data.panX)) * scale,
      y:
        rect.top +
        rect.height * 0.57 +
        (item.y - Number(data.panY)) * scale * 0.58 -
        item.height * scale * 0.45,
    };
  }, layout.items[0]);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y + 12, { steps: 5 });
  await page.mouse.up();
  const movedSave = page.waitForResponse(
    (response) =>
      response.url().includes('/api/kingdom/editor-draft') &&
      response.request().method() === 'PUT' &&
      response.ok(),
  );
  await reopened.getByRole('button', { name: 'Salvar rascunho' }).click();
  await movedSave;
  const moved = await (await page.request.get(`${base}/api/kingdom/editor-draft`)).json();
  expect(moved.items[0].x).toBeGreaterThan(layout.items[0].x);
  await reopened.getByRole('button', { name: 'Excluir item' }).click();
  await expect(reopened).toContainText('0 itens');
  await reopened.getByRole('button', { name: 'Desfazer' }).click();
  await expect(reopened).toContainText('1 itens');
  await reopened.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(reopened).toContainText('Rascunho salvo');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(reopened).toBeVisible();
  await expect(page.getByRole('button', { name: /Missões do reino/ })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/kingdom-editor-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const stale = await page.request.put(`${base}/api/kingdom/editor-draft`, {
    headers: { Origin: base },
    data: { revision: 0, items: [] },
  });
  expect(stale.status()).toBe(409);
  expect(errors).toEqual([]);
  console.log('Editor OK: catálogo, posicionamento, escala, orientação, salvamento e recarga.');
}

watchErrors(page);
await mkdir('test-results', { recursive: true });
try {
  const signup = await page.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { Origin: base },
    data: { name: 'Cartógrafa de teste', email, password: `Atlas-${randomUUID()}` },
  });
  expect(signup.status()).toBe(200);
  const character = await page.request.post(`${base}/api/characters`, {
    headers: { Origin: base },
    data: {
      name: 'Elara Cartógrafa',
      race: 'Elfo',
      class: 'Patrulheiro',
      stats: [15, 14, 13, 12, 10, 8],
    },
  });
  expect(character.status()).toBe(201);
  if (editorOnly) {
    await runKingdomEditor();
  } else if (terrainOnly) {
    await runTerrainOnly();
  } else if (worldMapOnly) {
    await runWorldMapOnly();
  } else if (regionalMobileOnly || regionalRecoveryOnly) {
    if (regionalMobileOnly) await runNavigationOnly(true);
    if (regionalRecoveryOnly) {
      await exerciseKingdomWithoutWebGL();
      await exerciseKingdomAssetRecovery();
      expect(errors).toEqual([]);
      console.log('Reino OK: Canvas2D sem WebGL e recuperação de imagem inválida.');
    }
  } else if (regionalEdgesOnly) {
    await page.goto(`${base}/#world`);
    await openNorth(page);
    await exerciseTerrainCamera(page, 'north', false, true);
    expect(errors).toEqual([]);
    expect(webglRasterRequests).toEqual([]);
    await writeFile(
      'test-results/atlas-regional-camera-edges.json',
      JSON.stringify(cameraReport, null, 2),
    );
    console.log(
      'Extremos regionais desktop OK: quatro direções até saturação, pinos estabilizados e capturas para inspeção de borda/névoa.',
    );
  } else if (navigationOnly) {
    await runNavigationOnly();
  } else if (visualOnly) {
    await captureVisualReview();
  } else {
    await page.goto(base);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    await navigate(page, 'Mundo');
    await expect(page).toHaveURL(/#world$/);
    await expect(page.getByRole('region', { name: 'Atlas interativo' })).toBeVisible();
    await ready(page);
    await expect(page.locator('.world-atlas h1')).toHaveCount(0);
    await expect(page.locator('.world-map .atlas-pin')).toHaveCount(22);
    await page.screenshot({
      path: 'test-results/world-atlas-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    await clickMarker(page, 'Northundria');
    await expect(page.locator('.atlas-notice')).toContainText('Northundria: exploração em breve.');
    await expect(page.locator('.world-atlas h1')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fechar aviso do território' }).click();
    await clickMarker(page, 'Pomar Branco');
    await expect(page.locator('.atlas-notice')).toContainText('Pomar Branco: exploração em breve.');
    await page.getByRole('button', { name: 'Fechar aviso do território' }).click();
    await openNorth(page);
    await expect(page.locator('.kingdom-place')).toHaveCount(6);
    await exerciseTerrainCamera(page, 'north');
    await page.getByRole('button', { name: 'Aproximar mapa', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Afastar mapa', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Centralizar mapa', exact: true }).click();
    await settleCamera(page);
    expect((await camera(page)).zoom).toBeCloseTo(1, 2);
    await expect(page.getByRole('button', { name: 'Afastar mapa', exact: true })).toBeEnabled();
    await page.screenshot({
      path: 'test-results/north-atlas-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    const drawer = await openVigilia(page);
    await drawer.getByRole('button', { name: 'Registrar missão aqui' }).click();
    const dialog = await fillMission(page, missionTitle);
    await expect(dialog.getByLabel('Local no mapa')).toHaveValue('vigilia');
    await expect(dialog.getByLabel('Local', { exact: true })).toHaveCount(0);
    const created = await publish(page);
    expect(created.location_id).toBe('vigilia');
    expect(created.region_id).toBe('reino-do-norte');
    expect(created.location).toBe('Vigília');
    await expect(page).toHaveURL(/#world$/);
    const mission = drawer
      .locator('.quest-card')
      .filter({ has: page.getByRole('heading', { name: missionTitle, exact: true }) });
    await expect(mission).toBeVisible();
    const stored = (
      await pool.query('SELECT id,location_id,region_id FROM board_posts WHERE id=$1', [created.id])
    ).rows;
    expect(stored).toEqual([
      { id: created.id, location_id: 'vigilia', region_id: 'reino-do-norte' },
    ]);
    const boardResponse = await page.request.get(`${base}/api/board`);
    expect(
      (await boardResponse.json()).some((item: { id: string }) => item.id === created.id),
    ).toBe(true);

    await navigate(page, 'Mural & eventos');
    await expect(page.locator('.quest-card').filter({ hasText: missionTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Publicar no mural', exact: true }).click();
    const fromBoard = await fillMission(page, boardTitle);
    await fromBoard.getByLabel('Local no mapa').selectOption('vigilia');
    const boardCreated = await publish(page);
    expect(boardCreated.location_id).toBe('vigilia');
    await expect(page).toHaveURL(/#board$/);
    await navigate(page, 'Mundo');
    await openNorth(page);
    await openVigilia(page);
    await expect(drawer.locator('.quest-card').filter({ hasText: boardTitle })).toBeVisible();
    await expect(mission).toBeVisible();
    await page.reload();
    await openNorth(page);
    await openVigilia(page);
    await expect(mission).toBeVisible();
    await expect(drawer.locator('.quest-card').filter({ hasText: boardTitle })).toBeVisible();

    const joining = page.waitForResponse(
      (response) =>
        response.url() === `${base}/api/board/${created.id}/join` &&
        response.request().method() === 'POST',
    );
    await mission.getByRole('button', { name: 'Participar', exact: true }).click();
    expect((await joining).status()).toBe(200);
    await expect(mission.getByRole('button', { name: 'Inscrito', exact: true })).toBeVisible();
    await mission.getByRole('button', { name: 'Iniciar', exact: true }).click();
    await mission.getByRole('button', { name: 'Concluir', exact: true }).click();
    await page
      .getByLabel('Resumo da missão')
      .fill('A cartógrafa explorou as trilhas e retornou a Vigília com seus registros.');
    await page.getByLabel('XP de Elara Cartógrafa', { exact: true }).fill('90');
    await page.getByRole('button', { name: 'Confirmar conclusão', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(mission).toHaveCount(0);
    await drawer.getByRole('button', { name: 'Histórico', exact: true }).click();
    await expect(mission).toContainText('Concluída');
    await expect(mission).toContainText('+90 XP');
    await drawer.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(mission).toBeVisible();
    await expect(drawer.locator('.quest-card').filter({ hasText: boardTitle })).toBeVisible();
    const dismissToast = page.getByRole('button', { name: 'Dispensar aviso' });
    if (await dismissToast.isVisible()) await dismissToast.click();
    await page.screenshot({
      path: 'test-results/atlas-missions-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });
    await drawer.getByRole('button', { name: 'Fechar lista de missões' }).click();
    await expect(drawer).toHaveCount(0);
    const allBoardPosts = (await (await page.request.get(`${base}/api/board`)).json()) as {
      kind: string;
      region_id: string | null;
      location_id: string | null;
    }[];
    const northMissions = allBoardPosts.filter(
      (item) => item.kind === 'mission' && item.region_id === 'reino-do-norte',
    );
    const kingdomButton = page.getByRole('button', { name: /^Missões do reino/ });
    await expect(kingdomButton).toHaveText(
      new RegExp(`Missões do reino\\s*${northMissions.length}$`),
    );
    const atlas = (await (await page.request.get(`${base}/api/atlas`)).json()) as {
      locations: { id: string; name: string; region_id: string }[];
    };
    const emptyLocation = atlas.locations.find(
      (item) =>
        item.region_id === 'reino-do-norte' &&
        !northMissions.some((mission) => mission.location_id === item.id),
    );
    expect(
      emptyLocation,
      'O cenário de teste precisa de ao menos um local sem missões.',
    ).toBeDefined();
    await clickMarker(page, emptyLocation!.name);
    const emptyDrawer = page.getByRole('complementary', {
      name: `Missões de ${emptyLocation!.name}`,
    });
    await expect(emptyDrawer.locator('.quest-card')).toHaveCount(0);
    await emptyDrawer.getByRole('button', { name: 'Fechar lista de missões' }).click();
    await expect(kingdomButton).toHaveText(
      new RegExp(`Missões do reino\\s*${northMissions.length}$`),
    );
    await page.getByRole('button', { name: 'Voltar ao mundo' }).click();
    await ready(page);
    await expect(page.locator('.world-atlas h1')).toHaveCount(0);

    const touch = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
      storageState: await page.context().storageState(),
    });
    watchErrors(touch);
    try {
      await touch.goto(`${base}/#world`);
      await ready(touch);
      await openNorth(touch);
      await exerciseTerrainCamera(touch, 'north', true);
      const mobileDrawer = await openVigilia(touch);
      await mobileDrawer.getByRole('button', { name: 'Todas', exact: true }).tap();
      await expect(
        mobileDrawer.getByRole('button', { name: 'Todas', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(mobileDrawer).toContainText(missionTitle);
      await expect(mobileDrawer).toContainText(boardTitle);
      expect(
        await touch.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const bounds = (await mobileDrawer.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
      await touch.screenshot({
        path: 'test-results/atlas-missions-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
      await mobileDrawer.getByRole('button', { name: 'Registrar missão aqui' }).tap();
      await expect(touch.getByRole('dialog').getByLabel('Local no mapa')).toHaveValue('vigilia');
      expect(
        await touch.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await touch.keyboard.press('Escape');
      await expect(touch.getByRole('dialog')).toHaveCount(0);
      await mobileDrawer.getByRole('button', { name: 'Fechar lista de missões' }).tap();
      await touch.getByRole('button', { name: 'Voltar ao mundo' }).tap();
      await ready(touch);
    } catch (error) {
      await touch.screenshot({ path: 'test-results/atlas-mobile-failure.png', fullPage: true });
      throw error;
    } finally {
      await touch.close();
    }

    await exerciseKingdomWithoutWebGL([missionTitle, boardTitle]);
    await exerciseKingdomAssetRecovery();
    expect(errors).toEqual([]);
    expect(webglRasterRequests, 'Os antigos mapas regionais não devem ser solicitados.').toEqual(
      [],
    );
    if (!skipCameraMatrix)
      await writeFile('test-results/atlas-camera.json', JSON.stringify(cameraReport, null, 2));
    console.log(
      'Atlas OK: reino Canvas2D, oito orientações, pan/zoom/limites, missões mapa/mural no mesmo registro SQL, conclusão/XP, histórico, persistência, desktop/celular e funcionamento sem WebGL regional.',
    );
  }
} catch (error) {
  await page.screenshot({ path: 'test-results/atlas-failure.png', fullPage: true });
  throw error;
} finally {
  const { rows } = await pool.query('SELECT id FROM "user" WHERE email=$1', [email]);
  if (rows.length) {
    await pool.query('DELETE FROM board_posts WHERE author_id=$1', [rows[0].id]);
    await pool.query('DELETE FROM "user" WHERE id=$1', [rows[0].id]);
  }
  await browser.close();
  await pool.end();
}
