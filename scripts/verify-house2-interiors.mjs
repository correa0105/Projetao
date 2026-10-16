import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const dir = 'test-results/house2-interiors';
await fs.mkdir(dir, { recursive: true });
const entry = [
  "import React from 'react';import{createRoot}from'react-dom/client';",
  "import{House2Interior}from'./src/House2Interior';import{House2Lighting}from'./src/House2Lighting';",
  "import{house2Furniture}from'./shared/house-v2';import{villageScenery}from'./shared/house-village-scenery';",
  "const root=createRoot(document.getElementById('root'));",
  "window.draw=(phase='afternoon',id='house-001',shadow=true,mode='room')=>root.render(<svg width='100%' height='100%' viewBox='-6 -6 12 12'><House2Lighting phase={phase}/><rect x='-6' y='-6' width='12' height='12' fill={mode==='room'?'#5d6740':'#babdab'}/>{mode==='room'?<><House2Interior id={id} instance='visual' width={9} height={9}/>{['furniture-001','furniture-002'].map((id,i)=>{const f=house2Furniture.find(f=>f.id===id);return <image key={id} href={f.image} x={i?1.7:-2.8} y='-3' width={f.width} height={f.height}/>})}</>:<g filter={shadow?'url(#h2-shadow-tree)':undefined}><image href={villageScenery([]).find(s=>s.kind==='tree').image} x='-2' y='-2' width='4' height='4'/></g>}</svg>);window.draw();",
].join('\n');
const bundle = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  platform: 'browser',
});
const html =
  '<html><style>body{margin:0}#root{width:900px;height:900px}</style><div id="root"></div><script src="/test.js"></script></html>';
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      res.setHeader('content-type', 'text/html');
      res.end(html);
      return;
    }
    if (url.pathname === '/test.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(bundle.outputFiles[0].text);
      return;
    }
    const file = path.resolve('public', '.' + decodeURIComponent(url.pathname));
    assert(file.startsWith(path.resolve('public') + path.sep));
    res.setHeader('content-type', file.endsWith('.webp') ? 'image/webp' : 'image/png');
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(3079, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3079');
  async function draw(phase, id, shadow, mode) {
    await page.evaluate((args) => window.draw(...args), [phase, id, shadow, mode]);
    await page.waitForTimeout(80);
    await page.locator('svg image').evaluateAll(async (nodes) => {
      await Promise.all(
        nodes.map((n) => {
          const im = new Image();
          im.src = n.getAttribute('href');
          return im.decode();
        }),
      );
    });
  }
  for (let n = 1; n <= 3; n++) {
    await draw('afternoon', 'house-empty-' + String(n).padStart(3, '0'), true, 'room');
    assert.equal(await page.locator('[data-house2-cutaway]').count(), 1);
    await page.screenshot({ path: dir + '/cutaway-' + n + '.png' });
  }
  await draw('afternoon', 'house-empty-004', true, 'room');
  assert.equal(await page.locator('[data-house2-window="framed"]').count(), 2);
  await page.screenshot({ path: dir + '/oak-room.png' });
  await draw('afternoon', 'house-009', true, 'room');
  await page.screenshot({ path: dir + '/stone-room.png' });
  const hashes = [],
    pixelChanges = [];
  await draw('morning', 'house-001', false, 'shadow');
  const base = await sharp(await page.screenshot())
    .raw()
    .toBuffer();
  for (const phase of ['morning', 'afternoon', 'dusk']) {
    await draw(phase, 'house-001', true, 'shadow');
    const png = await page.screenshot({ path: dir + '/shadow-' + phase + '.png' }),
      pixels = await sharp(png).raw().toBuffer();
    let changed = 0;
    for (let i = 0; i < pixels.length; i += 3)
      if (
        Math.abs(pixels[i] - base[i]) +
          Math.abs(pixels[i + 1] - base[i + 1]) +
          Math.abs(pixels[i + 2] - base[i + 2]) >
        9
      )
        changed++;
    hashes.push(createHash('sha256').update(png).digest('hex'));
    pixelChanges.push(changed);
    assert(changed > 800, 'Cast shadow must be visibly rendered: ' + phase + ' ' + changed);
  }
  assert.equal(new Set(hashes).size, 3);
  assert.deepEqual(errors, []);
  for (let n = 1; n <= 25; n++) {
    await draw('afternoon', 'house-empty-' + String(n).padStart(3, '0'), true, 'room');
    assert.equal(await page.locator('[data-house2-interior="orthographic"]').count(), 1);
  }
  await fs.writeFile(
    dir + '/result.json',
    JSON.stringify(
      {
        passed: true,
        models: 25,
        illustratedCutaways: 3,
        originalFurniture: true,
        windows: 2,
        distinctSunShadows: 3,
        pixelChanges,
        errors,
      },
      null,
      2,
    ),
  );
  console.log({ passed: true, models: 25, pixelChanges });
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
