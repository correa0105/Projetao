import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
const dir = 'test-results/house2-architecture';
await fs.mkdir(dir, { recursive: true });
const source = [
  "import React from'react';import{createRoot}from'react-dom/client';import{House2Interior}from'./src/House2Interior';import{House2VillageRoofs}from'./src/House2Village';import{House2Lighting}from'./src/House2Lighting';import{house2Houses,house2Furniture}from'./shared/house-v2';",
  "const root=createRoot(document.getElementById('root'));",
  "window.draw=(n=1,angle=0,opened=true)=>{const h=house2Houses[n-1],f=house2Furniture.find(f=>f.id==='furniture-025');const p={id:'visual',number:n,x:-6,y:-6,width:12,height:12,neighborhood_id:'test',price:1200,character_id:'owner',owner_name:'Aurora',player_name:'Aurora',can_edit:true,house_id:h.id,house_x:0,house_y:0,house_rotation:angle,revision:1,village_slot:n};root.render(<svg width='900' height='900' viewBox='-6 -6 12 12'><House2Lighting phase='afternoon'/><rect x='-6' y='-6' width='12' height='12' fill='#67734b'/>{opened&&<g transform={'rotate('+angle+')'}><House2Interior id={h.id} instance='visual' width={h.width} height={h.height}/>{[[0,-2.65,0],[2.65,-1,90],[-1.5,2.65,180],[-2.65,1,270]].map(([x,y,r],i)=><g key={i} transform={'translate('+x+' '+y+') rotate('+r+')'}><image href={f.image} x={-f.width/2} y={-f.height/2} width={f.width} height={f.height}/></g>)}</g>}<House2VillageRoofs plots={[p]} interior={opened?p.id:null} selected={null} hover={null} choose={()=>{}} enter={()=>{}} onHover={()=>{}}/></svg>)};window.draw();",
].join('\n');
const bundle = await build({
  stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  platform: 'browser',
});
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<html><style>body{margin:0}</style><div id="root"></div><script src="/test.js"></script></html>',
      );
      return;
    }
    if (url.pathname === '/test.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(bundle.outputFiles[0].text);
      return;
    }
    const file = path.resolve('public', '.' + decodeURIComponent(url.pathname));
    assert(file.startsWith(path.resolve('public') + path.sep));
    res.setHeader('content-type', 'image/webp');
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(3081, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3081');
  const results = [];
  async function draw(n, angle, opened) {
    await page.evaluate((a) => window.draw(...a), [n, angle, opened]);
    await page.waitForTimeout(70);
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
    const id = String(n).padStart(3, '0'),
      interior = '/house2/interior-plan-' + id + '-v3-20261016.webp',
      roof = '/house2/roof-plan-' + id + '-v1-20261016.webp';
    const a = await sharp('public' + interior)
        .resize(1200, 1200)
        .ensureAlpha()
        .raw()
        .toBuffer(),
      b = await sharp('public' + roof)
        .resize(1248, 1248)
        .extract({ left: 24, top: 24, width: 1200, height: 1200 })
        .ensureAlpha()
        .raw()
        .toBuffer();
    let opaque = 0,
      uncovered = 0;
    for (let i = 3; i < a.length; i += 4)
      if (a[i] >= 230) {
        opaque++;
        if (b[i] < 230) uncovered++;
      }
    const coverage = 1 - uncovered / opaque;
    assert(
      coverage >= 0.9995,
      'Roof must cover the complete interior footprint: ' + n + ' ' + coverage,
    );
    for (const angle of [0, 90, 180, 270]) {
      await draw(n, angle, true);
      assert.equal(await page.locator('[data-house2-interior]').count(), 1);
      assert.equal(await page.locator('[data-house2-fixed]').count(), 0);
      await page.screenshot({ path: dir + '/room-' + n + '-' + angle + '.png' });
      await draw(n, angle, false);
      assert.equal(await page.locator('[data-house2-interior]').count(), 0);
      assert.equal(await page.locator('[data-house2-fixed] image').getAttribute('href'), roof);
      assert.equal(await page.locator('[data-house2-fixed] image').getAttribute('width'), '9.36');
      await page.screenshot({ path: dir + '/roof-' + n + '-' + angle + '.png' });
    }
    results.push({
      id: 'house-empty-' + id,
      roofCoverage: coverage,
      angles: 4,
      originalFurniture: true,
      matchedRoof: true,
      closedInteriorHidden: true,
    });
  }
  assert.deepEqual(errors, []);
  const result = { passed: true, results, errors };
  await fs.writeFile(dir + '/result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
