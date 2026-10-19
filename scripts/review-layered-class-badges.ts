import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import layers from '../shared/class-badge-layers.json';
import { classes } from '../shared/rules';

await mkdir('.local', { recursive: true });
await mkdir('test-results/class-badge-layers', { recursive: true });
await writeFile(
  '.local/layered-class-entry.ts',
  "export {CharacterLevelBadge} from '../src/CharacterLevelBadge';",
);
await build({
  entryPoints: ['.local/layered-class-entry.ts'],
  outfile: '.local/layered-class-component.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react/jsx-runtime'],
  loader: { '.css': 'empty' },
  logLevel: 'silent',
});
const { CharacterLevelBadge } = await import(
  pathToFileURL(resolve('.local/layered-class-component.mjs')).href
);
const css = await readFile('src/character-level-badge.css', 'utf8');
const badge = (name: string, level: number) =>
  renderToStaticMarkup(createElement(CharacterLevelBadge, { className: name, level }));
const rows = classes
  .map(
    (name) =>
      `<section><h2>${name}</h2><div class="row">${Array.from({ length: 20 }, (_, i) => badge(name, i + 1)).join('')}</div></section>`,
  )
  .join('');
const details = classes
  .flatMap((name) => [1, 2, 3, 4, 5].map((t) => badge(name, t * 4)))
  .filter((html) => html.includes('data-layered-badge'))
  .join('');
const html = (detail: boolean) =>
  `<!doctype html><meta charset="utf-8"><style>${css}*{box-sizing:border-box}body{margin:24px;background:#24221e;color:#e4d8c2;font:14px Georgia}h2{margin:8px 0;font-size:17px}.row{display:flex;gap:4px}section{border-bottom:1px solid #77644355;padding:8px 0}.row .class-level-badge{width:82px!important;height:110px!important;flex-basis:82px!important;grid-template-rows:78px 24px 8px}.row .level-badge-art{width:78px!important;height:78px!important}.detail{display:grid;grid-template-columns:repeat(4,300px);gap:24px}.detail .class-level-badge{width:300px;height:330px;grid-template-rows:285px 30px 10px}.detail .level-badge-art{width:280px;height:280px}</style>${detail ? `<main class="detail">${details}</main>` : rows}`;
const publicRoot = resolve('public');
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/detail') {
    res.setHeader('Content-Type', 'text/html');
    res.end(html(url.pathname === '/detail'));
    return;
  }
  const file = resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(publicRoot + sep)) {
    res.statusCode = 403;
    res.end();
    return;
  }
  try {
    res.setHeader('Content-Type', 'image/webp');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const address = server.address();
if (!address || typeof address === 'string') throw Error('No test port');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  await page.goto(origin);
  await page
    .locator('img')
    .evaluateAll((ns) => Promise.all(ns.map((n) => (n as HTMLImageElement).decode())));
  await expect(page.locator('.class-level-badge')).toHaveCount(260);
  expect(Object.keys(layers)).toHaveLength(32);
  await expect(page.locator('[data-layered-badge]')).toHaveCount(128);
  for (const art of await page.locator('[data-layered-badge]').all()) {
    await expect(art.locator('[data-tool-layer]')).toHaveCount(2);
    await expect(art.locator('.level-badge-core')).toHaveCount(1);
    const matrices = await art.locator('.level-badge-tool').evaluateAll((ns) =>
      ns.map((n) => {
        const s = getComputedStyle(n);
        const m = new DOMMatrix(s.transform);
        return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f, origin: s.transformOrigin };
      }),
    );
    expect(matrices[0].origin).toBe(matrices[1].origin);
    for (const m of matrices) {
      expect(m.e).toBe(0);
      expect(m.f).toBe(0);
      expect(m.a).toBeCloseTo(Math.abs(m.b), 5);
      expect(m.d).toBeCloseTo(Math.abs(m.c), 5);
      expect(m.a * m.c + m.b * m.d).toBeCloseTo(0, 5);
    }
    expect(matrices[0].b).toBeCloseTo(-matrices[1].b, 5);
  }
  await page.screenshot({ path: 'test-results/class-badge-layers/all-260.png', fullPage: true });
  await page.setViewportSize({ width: 1320, height: 2900 });
  await page.goto(origin + '/detail');
  await page
    .locator('img')
    .evaluateAll((ns) => Promise.all(ns.map((n) => (n as HTMLImageElement).decode())));
  await page.screenshot({ path: 'test-results/class-badge-layers/details-32.png', fullPage: true });
  for (let row = 0; row < 8; row++)
    await page.screenshot({
      path: `test-results/class-badge-layers/detail-row-${row + 1}.png`,
      clip: { x: 0, y: row * 354, width: 1320, height: 354 },
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page
    .locator('img')
    .evaluateAll((ns) => Promise.all(ns.map((n) => (n as HTMLImageElement).decode())));
  await page.screenshot({ path: 'test-results/class-badge-layers/mobile.png' });
  await writeFile(
    'test-results/class-badge-layers/result.json',
    JSON.stringify(
      {
        passed: true,
        classes: 13,
        levels: 20,
        layeredBadgeDesigns: 32,
        layeredLevelStates: 128,
        completeRigidTools: true,
        commonRotationOrigin: true,
        allImagesDecoded: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    '260 level states; 32 layered designs; 128 layered states; images and rigid transforms passed.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r, e) => server.close((err) => (err ? e(err) : r())));
}
