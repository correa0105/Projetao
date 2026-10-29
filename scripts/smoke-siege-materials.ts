import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import express from 'express';
import { resolve } from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { optimizedPublicImages } from '../server/optimized-public-images';
import { imageDeliverySide } from '../shared/image-delivery-policy';
import assert from 'node:assert/strict';

const source = '/vtt/siege-materials-20261027/projectiles-v1.png';
assert.equal(imageDeliverySide(source), null);
const original = await readFile('public' + source),
  before = createHash('sha256').update(original).digest('hex');
const stale = await sharp(original)
  .resize(960, 640)
  .webp({ quality: 84, alphaQuality: 100 })
  .toBuffer();
const app = express(),
  vite = await createServer({
    configFile: false,
    publicDir: false,
    appType: 'custom',
    cacheDir: 'test-results/.vite-siege-materials',
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
app.get('/__siege-material-check', (_req, res) =>
  res.type('html')
    .send(`<!doctype html><meta charset="utf-8"><style>body{background:#1b1c1a;color:#ddd8c7;font:14px sans-serif;margin:24px}canvas{display:block;max-width:100%;background:#b3a482;border:1px solid #776d59;margin:12px 0}small{color:#b8af9a}</style><h1>Corda e projéteis</h1><small>Desenho do VTT</small><canvas id="actual" width="720" height="280"></canvas><small>Recortes da arte original</small><canvas id="reference" width="720" height="280"></canvas><script type="module">
import{siegeMaterials,drawSiegeHarpoon,drawSiegeBall,drawSiegeRope,forgetSiegeMaterials}from'/src/vtt-siege-materials.ts';
const actual=document.querySelector('#actual').getContext('2d'),reference=document.querySelector('#reference').getContext('2d');
const original=new Image();original.src='${source}?original=1';await original.decode();
reference.drawImage(original,26,176,853,152,459,70-171*152/853/2,171,171*152/853);
reference.drawImage(original,58,436,756,502,220-86.4/2,190-86.4*502/756/2,86.4,86.4*502/756);
reference.drawImage(original,1028,534,345,347,440-37.8/2,190-37.8*347/345/2,37.8,37.8*347/345);
function draw(){const material=siegeMaterials();if(!material)return;actual.clearRect(0,0,720,280);drawSiegeRope(actual,{x:60,y:70},{x:459,y:70},180,1);actual.save();actual.translate(630,70);drawSiegeHarpoon(actual,180,1);actual.restore();actual.save();actual.translate(220,190);drawSiegeBall(actual,true,180,1);actual.restore();actual.save();actual.translate(440,190);drawSiegeBall(actual,false,180,1);actual.restore();window.__siegeReady={width:material.naturalWidth,height:material.naturalHeight,url:material.src};forgetSiegeMaterials(draw);}siegeMaterials(draw);draw();
</script>`),
);
app.use(optimizedPublicImages(resolve('public')));
app.use(express.static(resolve('public')));
app.use(vite.middlewares);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results/siege-materials', { recursive: true });
const results: unknown[] = [];
try {
  for (const mode of ['native', 'stale-960']) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 } }),
      page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (mode === 'stale-960')
      await page.route('**/vtt/siege-materials-20261027/projectiles-v1.png*', async (route) => {
        if (new URL(route.request().url()).searchParams.get('original') === '1')
          await route.continue();
        else await route.fulfill({ contentType: 'image/webp', body: stale });
      });
    await page.goto(origin + '/__siege-material-check');
    await expect
      .poll(() => page.evaluate(() => (window as any).__siegeReady || null))
      .not.toBeNull();
    const measured = await page.evaluate(() => {
      const actual = (document.querySelector('#actual') as HTMLCanvasElement).getContext('2d')!,
        reference = (document.querySelector('#reference') as HTMLCanvasElement).getContext('2d')!;
      const regions = [
        { name: 'harpoon', x: 462, y: 45, w: 172, h: 50 },
        { name: 'buried-cannonball', x: 170, y: 150, w: 100, h: 80 },
        { name: 'flying-cannonball', x: 405, y: 160, w: 70, h: 60 },
      ];
      const shapes = regions.map((region) => {
        const a = actual.getImageData(region.x, region.y, region.w, region.h).data,
          b = reference.getImageData(region.x, region.y, region.w, region.h).data;
        let overlap = 0,
          union = 0;
        for (let i = 3; i < a.length; i += 4) {
          const aa = a[i] > 80,
            bb = b[i] > 80;
          if (aa || bb) union++;
          if (aa && bb) overlap++;
        }
        return { name: region.name, overlap: overlap / union, pixels: union };
      });
      const rope = actual.getImageData(80, 68, 350, 22).data,
        colors = new Set();
      let bright = 0;
      for (let i = 0; i < rope.length; i += 4)
        if (rope[i + 3] > 80) {
          colors.add([rope[i] >> 2, rope[i + 1] >> 2, rope[i + 2] >> 2].join(','));
          if (rope[i] > 90 && rope[i + 1] > 65) bright++;
        }
      return {
        atlas: (window as any).__siegeReady,
        shapes,
        ropeColors: colors.size,
        ropeBrightPixels: bright,
      };
    });
    expect(measured.atlas.width).toBe(mode === 'native' ? 1536 : 960);
    expect(measured.atlas.url).toContain('v=native-atlas-20261029');
    for (const shape of measured.shapes) {
      expect(shape.pixels, shape.name).toBeGreaterThan(100);
      expect(shape.overlap, shape.name).toBeGreaterThan(0.82);
    }
    expect(measured.ropeColors).toBeGreaterThan(20);
    expect(measured.ropeBrightPixels).toBeGreaterThan(30);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/siege-materials/${mode}.png` });
    results.push({ mode, ...measured });
    await context.close();
  }
  assert.equal(
    createHash('sha256')
      .update(await readFile('public' + source))
      .digest('hex'),
    before,
  );
  await writeFile(
    'test-results/siege-materials/result.json',
    JSON.stringify({ passed: true, originalUnchanged: true, results }, null, 2),
  );
  console.log(
    'Corda texturizada, arpão e balas: recortes conferidos contra a arte original, entrega nativa e cópia antiga 960×640.',
  );
} finally {
  await browser.close();
  await vite.close();
  await new Promise<void>((r) => server.close(() => r()));
}
