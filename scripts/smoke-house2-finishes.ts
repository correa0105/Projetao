import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { house2Houses } from '../shared/house-v2';
import { house2FinishesCatalog } from '../shared/house2-finishes';
import { house2WoodFloorTileSizes } from '../src/house2-interior-surfaces';
const out = 'test-results/house2-finishes';
await mkdir(out, { recursive: true });
await writeFile(out + '/result.json', JSON.stringify({ passed: false }));
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
const server = app.listen(3088, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 360, height: 360 }, reducedMotion: 'reduce' });
const errors: string[] = [],
  missing: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) missing.push(r.url());
});
async function show(params: Record<string, string>) {
  await page.goto('http://localhost:3088/?' + new URLSearchParams(params));
  await page.locator('[data-house2-interior]').waitFor();
  await page.evaluate(async () =>
    Promise.all(
      [...document.querySelectorAll('image')].map(async (el) => {
        const img = new Image();
        img.src = el.getAttribute('href')!;
        await img.decode();
      }),
    ),
  );
  return page.screenshot();
}
try {
  const roofs = house2FinishesCatalog.filter((f) => f.kind === 'roof'),
    floors = house2FinishesCatalog.filter((f) => f.kind === 'floor');
  expect(roofs).toHaveLength(25);
  expect(floors).toHaveLength(25);
  expect(new Set(house2FinishesCatalog.map((f) => f.id)).size).toBe(75);
  const original = await sharp(await show({ house: house2Houses[0].id, walls: 'walls-wood' }))
    .removeAlpha()
    .raw()
    .toBuffer();
  for (const [kind, entries] of [
    ['roof', roofs],
    ['floor', floors],
  ] as const) {
    const tiles = [],
      hashes = new Set<string>();
    for (const [i, f] of entries.entries()) {
      const shot = await show({ house: house2Houses[0].id, [kind]: f.id, walls: 'walls-wood' });
      hashes.add(createHash('sha256').update(shot).digest('hex'));
      tiles.push({
        input: await sharp(shot).resize(224, 224).toBuffer(),
        left: (i % 5) * 224,
        top: Math.floor(i / 5) * 224,
      });
      await expect(page.locator(`[data-house2-${kind}-finish]`)).toHaveAttribute(
        `data-house2-${kind}-finish`,
        f.id,
      );
      if (kind === 'floor') {
        const pixels = await sharp(shot).removeAlpha().raw().toBuffer();
        for (const [x0, y0] of [
          [130, 130],
          [210, 130],
          [130, 210],
          [210, 210],
        ]) {
          let difference = 0;
          for (let y = y0; y < y0 + 15; y++)
            for (let x = x0; x < x0 + 15; x++)
              for (let c = 0; c < 3; c++)
                difference += Math.abs(
                  pixels[(y * 360 + x) * 3 + c] - original[(y * 360 + x) * 3 + c],
                );
          expect(difference / (15 * 15 * 3), f.id + ' covers every floor quadrant').toBeGreaterThan(
            3,
          );
        }
        const rect = await page.locator('[data-house2-floor-finish]').evaluate((el) => ({
          x: el.getAttribute('x'),
          y: el.getAttribute('y'),
          width: el.getAttribute('width'),
          height: el.getAttribute('height'),
        }));
        const pattern = page.locator('pattern[id$="-floor"]');
        for (const key of ['x', 'y'] as const)
          await expect(pattern).toHaveAttribute(key, rect[key]!);
        const tile = house2WoodFloorTileSizes[f.id];
        for (const key of ['width', 'height'] as const)
          await expect(pattern).toHaveAttribute(key, tile ? String(tile) : rect[key]!);
      }
    }
    expect(hashes.size).toBe(25);
    await sharp({ create: { width: 1120, height: 1120, channels: 3, background: '#343b2b' } })
      .composite(tiles)
      .png()
      .toFile(out + '/' + kind + '-25.png');
  }
  // Every source roof is fitted to every target's measured bounds, independent of its canvas padding.
  for (const target of house2Houses)
    for (const finish of roofs) {
      const source = house2Houses.find((h) => h.id === finish.sourceHouse)!;
      expect(source).toBeTruthy();
      const w =
        (target.width * (target.roofBounds.right - target.roofBounds.left)) /
        (source.roofBounds.right - source.roofBounds.left);
      const x =
        -target.width / 2 + target.roofBounds.left * target.width - source.roofBounds.left * w;
      expect(x + source.roofBounds.right * w).toBeCloseTo(
        -target.width / 2 + target.roofBounds.right * target.width,
        10,
      );
    }
  for (const [i, h] of house2Houses.entries()) {
    await show({ house: h.id, roof: roofs[i].id, rotation: String((i % 4) * 90), fade: 'true' });
    await expect(page.locator('[data-house2-roof-eaves]')).toHaveAttribute(
      'data-house2-roof-eaves',
      'transparent',
    );
  }
  for (const h of house2Houses) {
    await show({ house: h.id, floor: 'floor-wood' });
    const pattern = page.locator('pattern[id$="-floor"]');
    await expect(pattern).toHaveAttribute('width', '3.6');
    await expect(pattern).toHaveAttribute('height', '3.6');
  }
  await page.setViewportSize({ width: 1200, height: 1200 });
  for (const id of ['floor-wood', 'floor-dark', 'floor-pine-planks', 'floor-cedar-planks']) {
    await show({ house: house2Houses[0].id, floor: id, furnished: 'true', rotation: '270' });
    await page.screenshot({ path: out + '/' + id + '-furnished.png' });
  }
  await show({
    house: house2Houses[0].id,
    floor: 'floor-dwarven-inlay',
    walls: 'walls-stone',
    rotation: '270',
    door: 'open',
  });
  await page.screenshot({ path: out + '/interior-270.png' });
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        roofs: 25,
        floors: 25,
        roofFits: 625,
        distinctPreviews: 50,
        floorSingleSurface: true,
        woodenFloorsUseWorldScale: true,
        woodenFloorModels: 25,
        rotatedEaves: 25,
        errors,
        missing,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS 25 telhados e 25 pisos: imagens distintas, encaixe, superfície contínua, giros e beirais.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
