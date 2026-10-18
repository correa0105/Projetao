import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { house2Houses } from '../shared/house-v2';
const out = 'test-results/house2-wall-surfaces';
await mkdir(out, { recursive: true });
await build({
  entryPoints: ['scripts/house2-wall-surfaces-fixture.tsx'],
  bundle: true,
  format: 'iife',
  outfile: out + '/client.js',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const app = express();
app.use(express.static('public'));
app.get('/client.js', async (_, r) => r.type('js').send(await readFile(out + '/client.js')));
app.get('/', (_, r) =>
  r.send(
    '<html><body style="margin:0;background:#343b2b"><div id="root" style="width:100vw;height:100vh"></div><script src="/client.js"></script></body></html>',
  ),
);
const server = app.listen(3087, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 320, height: 320 }, reducedMotion: 'reduce' }),
  errors: string[] = [],
  missing: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) missing.push(r.url());
});
const samples: Buffer[] = [],
  bg = [52, 59, 43];
async function show(house: string, walls = '', rotation = 0, door = '', floor = '') {
  await page.goto(
    'http://localhost:3087/?' +
      new URLSearchParams({ house, walls, rotation: String(rotation), door, floor }),
  );
  await page.locator('[data-house2-interior]').waitFor();
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll('image')].map(async (el) => {
        const i = new Image();
        i.src = el.getAttribute('href')!;
        await i.decode();
      }),
    );
  });
  return page.screenshot();
}
const pixels = (b: Buffer) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
try {
  for (const h of house2Houses) {
    const original = await pixels(await show(h.id)),
      wood = await pixels(await show(h.id, 'walls-wood'));
    let woodDiff = 0;
    for (let i = 0; i < original.data.length; i += 4)
      for (let c = 0; c < 3; c++) woodDiff += Math.abs(original.data[i + c] - wood.data[i + c]);
    expect(woodDiff / (320 * 320 * 3), h.id + ' native timber preserved').toBeLessThan(1);
    for (const walls of ['walls-stone', 'walls-brick']) {
      const buffer = await show(h.id, walls),
        after = await pixels(buffer);
      let expanded = 0,
        changed = 0;
      for (let i = 0; i < original.data.length; i += 4) {
        const wasBackground = bg.every((v, c) => Math.abs(original.data[i + c] - v) < 3),
          different = [0, 1, 2].some(
            (c) => Math.abs(after.data[i + c] - original.data[i + c]) > 25,
          );
        if (different) changed++;
        if (wasBackground && different) expanded++;
      }
      expect(expanded, h.id + ' new frame must follow native silhouette').toBeLessThan(25);
      expect(changed, h.id + ' material really changes').toBeGreaterThan(50);
      // Furniture and the central floor must retain their original pixels.
      for (let y = 145; y < 175; y++)
        for (let x = 145; x < 175; x++)
          for (let c = 0; c < 3; c++)
            expect(after.data[(y * 320 + x) * 4 + c]).toBe(original.data[(y * 320 + x) * 4 + c]);
      if (walls === 'walls-stone') samples.push(buffer);
    }
  }
  for (const rotation of [0, 90, 180, 270]) {
    await show(house2Houses[0].id, 'walls-stone', rotation, 'open', 'floor-marble');
    await expect(page.locator('[data-house2-door-leaf]')).toHaveAttribute('data-door-angle', '90');
    await expect(page.locator('[data-house2-floor-finish]')).toHaveAttribute(
      'data-house2-floor-finish',
      'floor-marble',
    );
    await expect(page.locator('[data-house2-wall-replacement]')).toHaveAttribute(
      'data-house2-wall-replacement',
      'native-silhouette',
    );
  }
  const composite = [];
  for (let i = 0; i < samples.length; i++)
    composite.push({
      input: await sharp(samples[i]).resize(224, 224).toBuffer(),
      left: (i % 5) * 224,
      top: Math.floor(i / 5) * 224,
    });
  await sharp({ create: { width: 1120, height: 1120, channels: 4, background: '#343b2b' } })
    .composite(composite)
    .png()
    .toFile(out + '/stone-25.png');
  await page.setViewportSize({ width: 1200, height: 1200 });
  for (const walls of ['walls-wood', 'walls-stone', 'walls-brick'])
    await writeFile(out + '/' + walls + '-270.png', await show(house2Houses[0].id, walls, 270));
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        houses: 25,
        materials: 3,
        woodPreservesNativeArt: true,
        noLargerFrame: true,
        floorPixelsUnchanged: true,
        doorAndFloorTogether: true,
        rotations: [0, 90, 180, 270],
        errors,
        missing,
      },
      null,
      2,
    ),
  );
  console.log('PASS 25 casas, três paredes, silhueta, piso preservado e porta em quatro rotações.');
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
