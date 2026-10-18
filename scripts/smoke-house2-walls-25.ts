import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { house2Houses } from '../shared/house-v2';
import { house2FinishesCatalog } from '../shared/house2-finishes';
const out = 'test-results/house2-walls-25';
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
const server = app.listen(3090, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 360, height: 360 }, reducedMotion: 'reduce' }),
  errors: string[] = [],
  missing: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) missing.push(r.url());
});
async function show(params: Record<string, string>) {
  await page.goto('http://localhost:3090/?' + new URLSearchParams(params));
  await page.locator('[data-house2-interior]').waitFor();
  await page.evaluate(async () =>
    Promise.all(
      [...document.querySelectorAll('image')].map(async (el) => {
        const i = new Image();
        i.src = el.getAttribute('href')!;
        await i.decode();
      }),
    ),
  );
  return page.screenshot();
}
const raw = async (b: Buffer) => sharp(b).removeAlpha().raw().toBuffer();
function unchangedStructure(before: Buffer, after: Buffer, label: string) {
  let expanded = 0;
  for (let i = 0; i < before.length; i += 3) {
    const x = (i / 3) % 360,
      y = Math.floor(i / 3 / 360);
    // Exclude the single antialiased boundary pixel when comparing opaque materials.
    const bg =
      x > 0 &&
      x < 359 &&
      y > 0 &&
      y < 359 &&
      [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) =>
          [52, 59, 43].every((n, c) => Math.abs(before[((y + dy) * 360 + x + dx) * 3 + c] - n) < 3),
        ),
      );
    if (bg && [0, 1, 2].some((c) => Math.abs(before[i + c] - after[i + c]) > 25)) expanded++;
  }
  expect(expanded, label + ' native silhouette').toBeLessThan(25);
  for (let y = 145; y < 215; y++)
    for (let x = 145; x < 215; x++)
      for (let c = 0; c < 3; c++)
        expect(
          Math.abs(after[(y * 360 + x) * 3 + c] - before[(y * 360 + x) * 3 + c]),
          label + ' original floor',
        ).toBeLessThanOrEqual(1);
}
try {
  const walls = house2FinishesCatalog.filter((f) => f.kind === 'walls');
  expect(walls).toHaveLength(25);
  const original = await raw(await show({ house: house2Houses[0].id })),
    tiles = [],
    hashes = new Set<string>();
  for (const [index, wall] of walls.entries()) {
    const shot = await show({ house: house2Houses[0].id, walls: wall.id });
    await expect(page.locator('[data-house2-wall-finish]')).toHaveAttribute(
      'data-house2-wall-finish',
      wall.id,
    );
    hashes.add(createHash('sha256').update(shot).digest('hex'));
    unchangedStructure(original, await raw(shot), wall.id);
    const label = Buffer.from(
      `<svg width="224" height="28"><text x="5" y="19" fill="#e8dec6" font-family="sans-serif" font-size="12">${index + 1}. ${wall.name}</text></svg>`,
    );
    const tile = await sharp({
      create: { width: 224, height: 252, channels: 3, background: '#343b2b' },
    })
      .composite([
        { input: await sharp(shot).resize(224, 224).toBuffer(), left: 0, top: 0 },
        { input: label, left: 0, top: 224 },
      ])
      .png()
      .toBuffer();
    tiles.push({ input: tile, left: (index % 5) * 224, top: Math.floor(index / 5) * 252 });
  }
  expect(hashes.size).toBe(25);
  await sharp({ create: { width: 1120, height: 1260, channels: 3, background: '#343b2b' } })
    .composite(tiles)
    .png()
    .toFile(out + '/walls-25.png');
  for (const [index, house] of house2Houses.entries()) {
    const before = await raw(await show({ house: house.id })),
      after = await raw(await show({ house: house.id, walls: walls[index].id }));
    unchangedStructure(before, after, house.id);
  }
  await page.setViewportSize({ width: 1200, height: 1200 });
  for (const wall of ['walls-oak', 'walls-plaster-ivory', 'walls-basalt', 'walls-half-timber'])
    for (const rotation of [0, 90, 180, 270]) {
      await show({
        house: house2Houses[0].id,
        walls: wall,
        rotation: String(rotation),
        door: 'open',
        floor: 'floor-marble',
      });
      await expect(page.locator('[data-house2-door-leaf]')).toHaveAttribute(
        'data-door-angle',
        '90',
      );
      if (rotation === 270) await page.screenshot({ path: out + '/' + wall + '-270.png' });
    }
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        wallOptions: 25,
        distinctRenders: 25,
        models: 25,
        nativeSilhouette: true,
        originalFloorPreserved: true,
        doorRotations: [0, 90, 180, 270],
        errors,
        missing,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS 25 paredes distintas, silhueta nativa, piso preservado, 25 casas e porta em quatro rotações.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
