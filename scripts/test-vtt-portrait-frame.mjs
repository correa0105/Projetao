import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';

const { outputFiles } = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {VttSelectionPortrait} from './src/VttSelectionPortrait';
      const token={id:'test-token',characterId:'test-character',image:'/test-topdown.webp',name:'Retrato de teste'};
      const root=createRoot(document.getElementById('root'));
      window.setPortraitEffects=enabled=>root.render(React.createElement(VttSelectionPortrait,{roomId:'test-room',token,visualEffects:enabled}));
      window.setPortraitEffects(true);`,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  loader: { '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const css =
  (await readFile('src/vtt.css', 'utf8')) +
  '\n' +
  (await readFile('src/vtt-selection-portrait.css', 'utf8'));
const fixture = process.env.PORTRAIT_FRAME_FIXTURE
  ? await readFile(process.env.PORTRAIT_FRAME_FIXTURE)
  : await sharp(
      Buffer.from(
        `<svg width="320" height="400" xmlns="http://www.w3.org/2000/svg"><path d="M96 22 Q160 0 224 22 L250 220 L70 220Z" fill="#c8a56e"/><ellipse cx="160" cy="88" rx="48" ry="60" fill="#f1c08b"/><path d="M70 185Q160 145 250 185L290 400H30Z" fill="#ad2847"/></svg>`,
      ),
    )
      .png()
      .toBuffer();
const vapor = await readFile('public/vtt/effects/portrait-wisp-v2.webp');
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  for (const [scale, fallback] of [
    [1, false],
    [1.25, false],
    [2, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: scale,
    });
    if (fallback)
      await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type === 'webgl' ? null : original.call(this, type, ...args);
        };
      });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('/portrait?'))
        return route.fulfill({ contentType: 'image/png', body: fixture });
      if (url.endsWith('/portrait-wisp-v2.webp'))
        return route.fulfill({ contentType: 'image/webp', body: vapor });
      return route.fulfill({
        contentType: 'text/html',
        body: '<html><body><div id="root" class="vtt-stage" style="height:850px;width:calc(100vw - 32px)"></div></body></html>',
      });
    });
    await page.goto('http://portrait-frame.test/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: outputFiles[0].text });
    const figure = page.locator('.vtt-selection-portrait');
    await expect(figure).toBeVisible();
    await expect(figure).toHaveAttribute('data-flowing', String(!fallback));
    await figure.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
    for (const [width, height] of [
      [1440, 850],
      [1100, 650],
      [768, 380],
      [390, 300],
      [1100, 230],
      [1920, 230],
    ]) {
      await page.setViewportSize({ width, height: height + 40 });
      await page
        .locator('#root')
        .evaluate((el, height) => (el.style.height = height + 'px'), height);
      await expect
        .poll(async () => {
          const stage = await page.locator('#root').boundingBox(),
            portrait = await figure.boundingBox();
          return portrait.y >= stage.y && portrait.y + portrait.height <= stage.y + stage.height;
        })
        .toBe(true);
      const svg = page.locator('.vtt-selection-portrait svg'),
        canvas = figure.locator('canvas');
      await expect(svg).toBeVisible();
      if (!fallback) {
        const difference = await figure.evaluate((el) => {
          const a = el.querySelector('svg').getBoundingClientRect(),
            b = el.querySelector('canvas').getBoundingClientRect();
          return { y: Math.abs(a.y - b.y), height: Math.abs(a.height - b.height) };
        });
        expect(difference.y).toBeLessThan(1);
        expect(difference.height).toBeLessThan(1);
      } else await expect(canvas).toBeHidden();
      if (!process.env.PORTRAIT_FRAME_FIXTURE) {
        const { data, info } = await sharp(await svg.screenshot())
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const point =
          (Math.round(info.height * 0.26) * info.width + Math.floor(info.width * 0.5)) * 4;
        expect(data[point]).toBeGreaterThan(220);
        expect(data[point + 1]).toBeGreaterThan(170);
        expect(data[point + 2]).toBeGreaterThan(120);
      }
      if (scale === 1)
        await figure.screenshot({ path: `test-results/portrait-frame-${width}-${height}.png` });
    }
    const before = await figure.locator('svg').boundingBox();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(figure).toHaveAttribute('data-flowing', 'false');
    await expect(figure.locator('canvas')).toBeHidden();
    expect(await figure.locator('svg').boundingBox()).toEqual(before);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => window.setPortraitEffects(false));
    await expect(figure).toHaveAttribute('data-effects', 'false');
    await expect(figure.locator('canvas')).toBeHidden();
    expect(await figure.locator('svg').boundingBox()).toEqual(before);
    if (scale === 1) await figure.screenshot({ path: 'test-results/portrait-frame-static.png' });
    await context.close();
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS face remains visible; portrait fits six window sizes; vapor overlays the same frame; reduced motion, disabled effects and missing WebGL keep one stable portrait.',
  );
} finally {
  await browser.close();
}
