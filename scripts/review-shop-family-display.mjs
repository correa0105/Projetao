import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const old = JSON.parse(await fs.readFile('data/shop-export/loja.json')).items;
const expansion = JSON.parse(await fs.readFile('data/emporium-expansion.json')).items;
const catalog = [...old, ...expansion].map((x) => ({
  ...x,
  image_path: x.image_path || '/shop/items/' + x.id + '.png',
  ...Object.fromEntries(
    [
      'magic_family',
      'base_item',
      'damage_type',
      'rarity',
      'variant',
      'enhancement',
      'magic_kind',
    ].map((k) => [k, x.raw_data?.[k] ?? x[k]]),
  ),
}));
await fs.mkdir('test-results', { recursive: true });
await fs.writeFile(
  'test-results/shop-family-display.html',
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--page-header-edge:40px;--page-header-top:24px;}</style></head><body><div id="preview"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{Shop}from'/src/Shop.tsx';import{SiteMusicProvider}from'/src/SiteMusic.tsx';import{FlashMessages}from'/src/FlashMessage.tsx';
import'/src/styles.css';import'/src/alvorada.css';import'/src/journey.css';import'/src/theme.css';import'/src/page-header.css';import'/src/npc-speech.css';
const catalog=${JSON.stringify(catalog)};function Preview(){return React.createElement('div',{className:'app-shell','data-page':'shop'},React.createElement('main',{className:'main-shell'},React.createElement('div',{className:'main-content'},React.createElement(Shop,{catalog,character:{id:'review',name:'Revisão',gold_cp:10000000},onPurchased:async()=>{}}))));}createRoot(document.getElementById('preview')).render(React.createElement(React.Fragment,null,React.createElement(SiteMusicProvider,null,React.createElement(Preview)),React.createElement(FlashMessages)));
</script></body></html>`,
);
const server = await createServer({
  cacheDir: 'test-results/.vite-family-review',
  optimizeDeps: { entries: ['test-results/shop-family-display.html'] },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/house', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ catalog: [] }) }),
  );
  await page.goto(server.resolvedUrls.local[0] + 'test-results/shop-family-display.html');
  await page.waitForSelector('.shop-family-object');
  const count = await page.locator('.shop-product-family').count();
  assert.equal(await page.locator('.shop-family-box').count(), count);
  assert.equal(await page.locator('.shop-family-object').count(), count);
  await page.getByRole('textbox', { name: 'Procurar item' }).fill('Berserker');
  const offer = page.locator('.shop-product-family').first(),
    img = offer.locator('.shop-family-object');
  const initial = await img.getAttribute('src');
  assert(initial.includes('berserker'));
  assert(await offer.locator('.shop-product-art').isDisabled());
  const models = offer.locator('select').first(),
    options = await models
      .locator('option')
      .evaluateAll((xs) => xs.map((x) => x.value).filter(Boolean));
  assert(options.length > 1);
  await models.selectOption(options[0]);
  const chosen = await offer.getAttribute('data-item-id');
  assert(chosen);
  assert.equal(await img.getAttribute('src'), catalog.find((x) => x.id === chosen).image_path);
  assert(!(await offer.locator('.shop-product-art').isDisabled()));
  await models.selectOption(options.at(-1));
  const next = await offer.getAttribute('data-item-id');
  assert.notEqual(next, chosen);
  assert.equal(await img.getAttribute('src'), catalog.find((x) => x.id === next).image_path);
  for (const width of [1500, 760, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((i) => i.decode());
    await offer
      .locator('.shop-product-art')
      .screenshot({ path: 'test-results/shop-family-display-' + width + '.png' });
    const b = await img.boundingBox();
    assert(b.width > 20 && b.height > 20);
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS ' +
      count +
      ' family chests show their actual skin object; model changes update art and require a real purchase choice; three widths reviewed.',
  );
} finally {
  await browser.close();
  await server.close();
}
