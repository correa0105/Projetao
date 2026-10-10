import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
const completion = JSON.parse(
  await fs.readFile('data/shop-magic-completion-20261009/catalog.json'),
);
const items = completion.items.map((x) => ({ ...x, rarity: x.raw_data.rarity }));
await fs.mkdir('test-results', { recursive: true });
await fs.writeFile(
  'test-results/shop-magic-completion.html',
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="preview"></div><script type="module">
import React from'react';import{createRoot}from'react-dom/client';import{Shop}from'/src/Shop.tsx';import{SiteMusicProvider}from'/src/SiteMusic.tsx';import{FlashMessages}from'/src/FlashMessage.tsx';
import'/src/styles.css';import'/src/alvorada.css';import'/src/journey.css';import'/src/theme.css';import'/src/page-header.css';import'/src/npc-speech.css';
createRoot(document.getElementById('preview')).render(React.createElement(SiteMusicProvider,null,React.createElement('div',{className:'app-shell','data-page':'shop'},React.createElement('main',{className:'main-shell'},React.createElement('div',{className:'main-content'},React.createElement(Shop,{catalog:${JSON.stringify(items)},character:{id:'review',name:'Revisão',gold_cp:10000000},onPurchased:async()=>{}})))),React.createElement(FlashMessages)));
</script></body></html>`,
);
const server = await createServer({
  cacheDir: 'test-results/.vite-magic-review',
  optimizeDeps: { entries: ['test-results/shop-magic-completion.html'] },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/house', (r) =>
    r.fulfill({ contentType: 'application/json', body: '{"catalog":[]}' }),
  );
  await page.route('**/api/catalog/*/rules', (r) => {
    const id = r.request().url().split('/').at(-2),
      x = items.find((x) => x.id === id);
    assert(x);
    return r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        title: x.name,
        description: x.raw_data.rules_summary,
        source_name: x.raw_data.source_book + ' · resumo original do projeto',
        source_url: x.source_url,
        reference_url: x.source_url,
        edition: x.raw_data.source_edition,
        project_content: false,
      }),
    });
  });
  await page.goto(server.resolvedUrls.local[0] + 'test-results/shop-magic-completion.html', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('.shop-product', { timeout: 60000 });
  const search = page.getByRole('textbox', { name: 'Procurar item' });
  for (const x of items) {
    await search.fill(x.name);
    const card = page.locator(`.shop-product[data-item-id="${x.id}"]`);
    await expect(card).toBeVisible();
    const img = card.locator('.shop-product-art img');
    await img.evaluate((i) => i.decode());
    assert.equal(await img.getAttribute('src'), x.image_path);
    assert(await img.evaluate((i) => i.naturalWidth > 0));
    await card.locator('.shop-product-art').click();
    await expect(
      page.locator('.merchant-speech').filter({ hasText: x.merchant_comment }),
    ).toHaveCount(1);
    await card.getByRole('button', { name: 'O que este item faz?' }).click();
    const dialog = page.getByRole('dialog', { name: x.name });
    await expect(dialog.locator('.item-info-description')).toHaveText(x.raw_data.rules_summary);
    await expect(dialog.getByRole('link', { name: 'Consultar no 5etools' })).toHaveAttribute(
      'href',
      x.source_url,
    );
    await dialog.getByRole('button', { name: 'Fechar explicação' }).click();
  }
  await search.fill('');
  for (const width of [1500, 760, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.screenshot({
      path: `test-results/shop-magic-completion-${width}.png`,
      fullPage: true,
    });
    assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width + 1);
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${items.length} new item images, individual merchant speeches and source descriptions; responsive shop in three widths.`,
  );
} finally {
  await browser.close();
  await server.close();
}
