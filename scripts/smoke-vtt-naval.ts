import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { newToken } from '../shared/vtt';
import { vehicleImage, vehicleDefinitions, type VehicleId } from '../shared/vtt-vehicles';
import {
  oceanSchema,
  vehicleMotionSchema,
  navalAtlas,
  sailMasts,
  rowingImage,
  oceanImage,
} from '../shared/vtt-naval';
import { terrainTextures } from '../shared/vtt-terrain';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3004, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  }),
  page = await ctx.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/naval', { recursive: true });
await page.addInitScript({
  content:
    "window.__name = fn => fn; const Original = window.Audio; window.__navalAudio = []; function Wrapped(src) { const a = new Original(src); window.__navalAudio.push(a); return a; } Wrapped.prototype = Original.prototype; window.Audio = Wrapped; localStorage.setItem('alvorada-effects-muted','false'); localStorage.setItem('alvorada-effects-volume','.7');",
});
try {
  const sign = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre naval',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(sign.ok()).toBe(true);
  const made = await ctx.request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'Oceano e barcos' },
  });
  expect(made.ok()).toBe(true);
  const room = await made.json(),
    path = origin + '/api/vtt/rooms/' + room.id,
    s = room.document.scenes[0];
  s.width = 2400;
  s.height = 1750;
  s.fog = false;
  s.lighting = false;
  s.grid.snap = false;
  s.grid.opacity = 0;
  s.ambient = 1;
  s.ocean = oceanSchema.parse({ seaVolume: 0, windVolume: 0 });
  const ids: VehicleId[] = ['galley', 'keelboat', 'longship', 'sailing-ship', 'warship', 'rowboat'];
  s.tokens = ids.map((id, i) => {
    const t = newToken(randomUUID(), s),
      d = vehicleDefinitions[id],
      h = id === 'rowboat' ? 250 : 650;
    Object.assign(t, {
      name: d.name,
      image: vehicleImage(id),
      vehicle: { characterId: randomUUID(), itemId: id, copy: 0 },
      vehicleMotion: vehicleMotionSchema.parse({
        sail: 'inflated',
        sailsAnimated: true,
        oarsAnimated: true,
      }),
      width: (h * d.widthFt) / d.lengthFt,
      height: h,
      x: 225 + i * 390,
      y: 800,
      layer: 'map',
      sceneryToken: true,
      bleeds: false,
    });
    return t;
  });
  const ship = s.tokens[0];
  s.terrain = [
    {
      id: randomUUID(),
      texture: 'sand',
      erase: false,
      points: [
        { x: 450, y: 1350 },
        { x: 800, y: 1300 },
      ],
      radius: 160,
      softness: 0.18,
      opacity: 1,
      textureScale: 350,
      layer: 'base',
      shape: 'rough',
    },
  ];
  const saved = await ctx.request.put(path, {
    headers: { Origin: origin },
    data: { revision: room.revision, document: room.document },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const current = async () => await (await ctx.request.get(path)).json();
  const unauth = await browser.newContext();
  expect(
    (
      await unauth.request.put(path, {
        headers: { Origin: origin },
        data: { revision: room.revision, document: room.document },
      })
    ).status(),
  ).toBe(401);
  await unauth.close();
  await page.goto(origin + '/#vtt?room=' + room.id);
  const entry = page.getByRole('region', { name: 'Preferências de entrada da mesa' });
  await expect(entry).toBeVisible({ timeout: 60000 });
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await page.waitForTimeout(1500);
  async function menu() {
    const box = await board.boundingBox(),
      zoom =
        Number(
          (
            await page
              .getByText(/^\d+%$/)
              .last()
              .innerText()
          ).replace('%', ''),
        ) / 100;
    await page.mouse.click(
      box!.x + box!.width / 2 + (ship.x - s.width / 2) * zoom,
      box!.y + box!.height / 2 + (ship.y - s.height / 2) * zoom,
      { button: 'right' },
    );
    await page
      .locator(`[data-token-id="${ship.id}"]`)
      .getByRole('button', { name: 'Configurações do token', exact: true })
      .click();
    return page.getByRole('dialog', { name: 'Configurações do token', exact: true });
  }
  const panel = await menu();
  await expect(panel.getByRole('checkbox', { name: 'Inflar velas', exact: true })).toBeChecked();
  async function toggle(name: string) {
    const response = page.waitForResponse(
      (r) => r.url() === path && r.request().method() === 'PUT',
    );
    await panel.getByRole('checkbox', { name, exact: true }).click();
    expect((await response).ok()).toBe(true);
  }
  await toggle('Inflar velas');
  await toggle('Animar velas ao vento');
  await toggle('Remar');
  const persisted = (await current()).document.scenes[0];
  expect(persisted.tokens[0].vehicleMotion).toMatchObject({
    sail: 'furled',
    sailsAnimated: false,
    oarsAnimated: false,
  });
  expect([persisted.tokens[0].x, persisted.tokens[0].y, persisted.tokens[0].rotation]).toEqual([
    ship.x,
    ship.y,
    ship.rotation,
  ]);
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(panel.getByRole('checkbox', { name: 'Remar', exact: true })).toHaveCount(1);
    const b = await panel.boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/naval/controls-${width}.png` });
  }
  await panel.getByRole('button', { name: 'Fechar painel do token' }).click();
  await page.getByRole('button', { name: 'Fechar menu do token' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Biblioteca de mapas', exact: true }).click();
  await page.getByRole('button', { name: 'Configurar mapa ' + s.name, exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Configurações do mapa', exact: true });
  await expect(settings.getByRole('switch', { name: 'Mapa de oceano', exact: true })).toBeChecked();
  await settings.getByRole('checkbox', { name: 'Animar água', exact: true }).uncheck();
  for (const name of ['Som do mar', 'Som do vento'])
    await settings.getByRole('slider', { name, exact: true }).press('ArrowRight');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await settings
      .getByRole('slider', { name: 'Som do vento', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/naval/ocean-settings-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await settings.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar à mesa', exact: true }).click();
  let savedResponse = page.waitForResponse(
    (r) => r.url() === path && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  expect((await savedResponse).ok()).toBe(true);
  expect((await current()).document.scenes[0].ocean).toMatchObject({
    enabled: true,
    animated: false,
    seaVolume: 0.05,
    windVolume: 0.05,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          ((window as any).__navalAudio as HTMLAudioElement[]).filter(
            (a) =>
              /amb-ocean-waves|amb-scene-park-wind/.test(a.src) &&
              !a.paused &&
              a.loop &&
              a.volume > 0,
          ).length,
      ),
    )
    .toBe(2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Biblioteca de mapas', exact: true }).click();
  await page.getByRole('button', { name: 'Novo oceano', exact: true }).click();
  await expect(settings.getByRole('switch', { name: 'Mapa de oceano', exact: true })).toBeChecked();
  await expect(settings.getByRole('checkbox', { name: 'Animar água', exact: true })).toBeChecked();
  await settings.getByRole('button', { name: 'Cancelar', exact: true }).click();
  savedResponse = page.waitForResponse((r) => r.url() === path && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  expect((await savedResponse).ok()).toBe(true);
  expect((await current()).document.scenes[1].ocean).toMatchObject({
    enabled: true,
    animated: true,
    seaVolume: 0,
    windVolume: 0,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          ((window as any).__navalAudio as HTMLAudioElement[]).filter(
            (a) => /amb-ocean-waves|amb-scene-park-wind/.test(a.src) && !a.paused,
          ).length,
      ),
    )
    .toBe(0);
  // Bundle the exact production renderer into this isolated browser for pixel,
  // transparency and cache/performance checks without relying on UI timing.
  await build({
    stdin: {
      contents:
        "export {renderVtt} from './src/vtt-canvas';export {terrainCacheStats} from './src/vtt-terrain-canvas';export {drawSailingRig} from './src/vtt-naval-canvas';export {drawVehiclePart,drawVehicleCovers,vehicleCoverOccupied} from './src/vtt-vehicles-canvas';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: 'iife',
    globalName: 'NavalRender',
    outfile: 'test-results/naval/render.js',
  });
  await page.goto(origin + '/audio/vtt/CREDITS.md');
  await page.addScriptTag({ path: 'test-results/naval/render.js' });
  const render = await page.evaluate(
    async ({ scene, paths, atlases, stations }) => {
      const lib = (window as any).NavalRender,
        images = new Map<string, HTMLImageElement>();
      await Promise.all(
        paths.map(async (path) => {
          const img = new Image();
          img.src = path;
          await img.decode();
          images.set(path, img);
        }),
      );
      const canvas = document.createElement('canvas');
      canvas.width = 1440;
      canvas.height = 1000;
      document.body.replaceChildren(canvas);
      const c = canvas.getContext('2d')!;
      const opts = {
        camera: { x: scene.width / 2, y: scene.height / 2, zoom: 0.56 },
        width: 1440,
        height: 1000,
        dpr: 1,
        images,
        selected: [],
        gm: true,
        preview: false,
        viewer: null,
        layer: 'map',
        ruler: [],
        draft: null,
        showWalls: false,
        ping: null,
        mapEffects: true,
        visualEffects: false,
      };
      lib.renderVtt(c, scene, opts);
      const first = lib.terrainCacheStats(canvas);
      const durations = [];
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 34));
        const start = performance.now();
        lib.renderVtt(c, scene, opts);
        durations.push(performance.now() - start);
      }
      const last = lib.terrainCacheStats(canvas),
        occupation = [];
      for (const t of scene.tokens) {
        const ys = (stations as any)[t.vehicle.itemId];
        if (!ys) continue;
        const img = images.get((atlases as any)[t.vehicle.itemId]);
        const actor = {
          ...t,
          id: crypto.randomUUID(),
          image: '',
          x: t.x,
          y: t.y + (ys[0] - 0.5) * t.height - 35,
          width: 30,
          height: 30,
          layer: 'tokens',
          sceneryToken: false,
        };
        occupation.push({
          id: t.vehicle.itemId,
          occupied: lib.vehicleCoverOccupied(t, img, [actor], true),
          hidden: lib.vehicleCoverOccupied(t, img, [{ ...actor, hidden: true }], true),
          outside: lib.vehicleCoverOccupied(t, img, [{ ...actor, x: -2000 }], true),
        });
      }
      const png = canvas.toDataURL(),
        staticCanvas = document.createElement('canvas');
      staticCanvas.width = 1440;
      staticCanvas.height = 1000;
      const sc = staticCanvas.getContext('2d')!;
      const still = structuredClone(scene);
      still.ocean.animated = false;
      still.tokens.forEach((t: any) => {
        t.vehicleMotion.sailsAnimated = false;
        t.vehicleMotion.oarsAnimated = false;
      });
      lib.renderVtt(sc, still, opts);
      await new Promise((r) => setTimeout(r, 100));
      lib.renderVtt(sc, still, opts);
      const a = staticCanvas.toDataURL();
      await new Promise((r) => setTimeout(r, 200));
      lib.renderVtt(sc, still, opts);
      const b = staticCanvas.toDataURL();
      const shoreScene = structuredClone(still);
      shoreScene.tokens = [];
      lib.renderVtt(sc, shoreScene, opts);
      const x = Math.round(1440 / 2 + (600 - scene.width / 2) * opts.camera.zoom),
        y = Math.round(1000 / 2 + (1320 - scene.height / 2) * opts.camera.zoom),
        landPixel = Array.from(sc.getImageData(x, y, 1, 1).data);
      shoreScene.terrainLayers[0].visible = false;
      lib.renderVtt(sc, shoreScene, opts);
      const waterPixel = Array.from(sc.getImageData(x, y, 1, 1).data);
      shoreScene.terrainLayers[0].visible = true;
      shoreScene.terrain = [
        ...shoreScene.terrain,
        { ...shoreScene.terrain[0], id: crypto.randomUUID(), erase: true, radius: 350 },
      ];
      lib.renderVtt(sc, shoreScene, opts);
      const erasedPixel = Array.from(sc.getImageData(x, y, 1, 1).data);
      return {
        png,
        first,
        last,
        occupation,
        staticEqual: a === b,
        landPixel,
        waterPixel,
        erasedPixel,
        medianMs: durations.sort((a, b) => a - b)[22],
        p95Ms: durations[42],
      };
    },
    {
      scene: s,
      paths: [
        ...new Set([
          oceanImage,
          rowingImage,
          ...s.tokens.map((t: any) => t.image),
          ...ids.filter((id) => sailMasts[id]).map(navalAtlas),
          ...terrainTextures.filter((t) => ['sand', 'water'].includes(t.id)).map((t) => t.image),
        ]),
      ],
      atlases: Object.fromEntries(ids.map((id) => [id, navalAtlas(id)])),
      stations: sailMasts,
    },
  );
  await writeFile(
    'test-results/naval/ocean-ships.png',
    Buffer.from(render.png.split(',')[1], 'base64'),
  );
  await writeFile(
    'test-results/naval/measured.json',
    JSON.stringify({ ...render, png: undefined }, null, 2),
  );
  expect(render.last.strokesDrawn).toBe(render.first.strokesDrawn);
  expect(render.last.shoreTilesBuilt).toBe(render.first.shoreTilesBuilt);
  expect(render.staticEqual).toBe(true);
  expect(render.landPixel).not.toEqual(render.waterPixel);
  // Canvas may switch GPU/CPU sampling after getImageData; permit only the
  // tiny channel rounding difference, never retained sand or shoreline opacity.
  expect(Math.max(...render.erasedPixel.map((v,i)=>Math.abs(v-render.waterPixel[i])))).toBeLessThanOrEqual(3);
  for (const o of render.occupation) {
    expect(o.occupied, o.id).toBe(true);
    expect(o.hidden).toBe(false);
    expect(o.outside).toBe(false);
  }
  expect(render.p95Ms).toBeLessThan(33.3);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/naval/results.json',
    JSON.stringify({ ...render, png: undefined, widths: [1440, 1024, 768, 390], errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      medianMs: render.medianMs,
      p95Ms: render.p95Ms,
      cacheStable: true,
      staticEqual: render.staticEqual,
      occupation: render.occupation,
    }),
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/naval/failure.png' }).catch(() => {});
  console.log((await page.locator('body').innerText()).slice(-4500));
  console.log(
    await page.evaluate(() => ({
      audio: ((window as any).__navalAudio || []).map((a: HTMLAudioElement) => ({
        src: a.src,
        volume: a.volume,
        paused: a.paused,
        loop: a.loop,
        ready: a.readyState,
        error: a.error?.message,
      })),
      preferences: Object.entries(localStorage).filter(
        ([k]) => k.startsWith('alvorada-vtt-media:') || k.startsWith('alvorada-effects-'),
      ),
    })),
  );
  throw e;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
