import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
await fs.mkdir('test-results', { recursive: true });
await fs.writeFile(
  'test-results/pet-cards.html',
  '<div id="root"></div><script type="module" src="/test-results/pet-cards.tsx"></script>',
);
await fs.writeFile(
  'test-results/pet-cards.tsx',
  `import React from 'react';import{createRoot}from'react-dom/client';import{PetShop}from'/src/PetShop.tsx';import'/src/styles.css';import'/src/theme.css';import'/src/alvorada.css';const poor=new URLSearchParams(location.search).has('poor');createRoot(document.getElementById('root')).render(<div className="app-shell" data-page="pets"><main className="main-content"><PetShop character={{id:'c49e91fb-a870-4587-820e-72eb7bdc0334',name:'Arden',gold_cp:poor?0:100000,gold_unlimited:false} as any} onPurchased={async()=>{window.purchased=true;}}/></main></div>);`,
);
const server = await createServer({
  publicDir: 'dist/client',
  cacheDir: '.local/vite-pet-cards',
  optimizeDeps: {
    entries: ['test-results/pet-cards.html'],
    include: [
      'react',
      'react-dom/client',
      'react/jsx-runtime',
      'better-auth/react',
      'lucide-react',
    ],
  },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const pets = [
  ['dog', 'Cão', 1000],
  ['cat', 'Gato', 1500],
  ['rabbit', 'Coelho', 500],
  ['owl', 'Coruja', 3000],
  ['fox', 'Raposa', 4000],
  ['raven', 'Corvo', 2000],
  ['frog', 'Sapo', 200],
  ['snake', 'Cobra', 1200],
  ['rat', 'Rato', 300],
  ['guinea-pig', 'Porquinho-da-índia', 600],
];
const variants = [
  ['dog', 'shepherd', 'Pastor da estrada'],
  ['cat', 'longhair', 'Gato de pelagem longa'],
  ['rabbit', 'runic', 'Coelho rúnico'],
  ['owl', 'horned', 'Coruja de olhos âmbar'],
  ['raven', 'shadow', 'Corvo das sombras'],
  ['snake', 'emerald', 'Serpente esmeralda'],
  ['rat', 'fluffy', 'Rato de pelagem longa'],
];
const breeds = [
  ...pets.map(([pet_id, name]) => ({
    pet_id,
    appearance: 'original',
    name: name + ' clássico',
    revision: 0,
  })),
  ...variants.map(([pet_id, appearance, name]) => ({ pet_id, appearance, name, revision: 0 })),
];
let canEdit = false;
const bodies = [],
  errors = [],
  missing = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/pets/')) missing.push(r.url());
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/pets/catalog') return route.fulfill({ json: { breeds, can_edit: canEdit } });
    if (path === '/api/pets/purchase') {
      const b = route.request().postDataJSON();
      bodies.push(b);
      await new Promise((r) => setTimeout(r, 100));
      return route.fulfill({ json: { pet: { ...b, id: 'owned-new', name: b.name } } });
    }
    return route.fulfill({ json: {} });
  });
  for (const width of [1440, 1050, 768, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(server.resolvedUrls.local[0] + 'test-results/pet-cards.html');
    const list = page.getByLabel('Mascotes à venda'),
      rows = list.getByRole('button');
    await expect(rows).toHaveCount(10);
    await expect(page.locator('.pet-shop-purchase select')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Levar este companheiro', exact: true }),
    ).toBeDisabled();
    for (let i = 0; i < 10; i++) {
      await rows.nth(i).click();
      await expect(rows.nth(i)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.pet-shop-preview .pet-art')).toHaveAttribute(
        'data-pet',
        pets[i][0],
      );
      assert((await rows.nth(i).locator('.pet-art').boundingBox()).width >= 48);
      const variant = variants.find((v) => v[0] === pets[i][0]);
      if (variant) {
        const form = page.getByRole('button', { name: 'Aparência · ' + variant[2], exact: true });
        await form.click();
        await expect(rows.nth(i).locator('.pet-art')).toHaveAttribute(
          'data-appearance',
          variant[1],
        );
        await expect(page.locator('.pet-shop-preview .pet-art')).toHaveAttribute(
          'data-appearance',
          variant[1],
        );
        assert(
          await form
            .locator('span')
            .last()
            .evaluate((e) => parseFloat(getComputedStyle(e).fontSize) <= 12),
        );
      } else {
        await expect(page.locator('.pet-appearances')).toHaveCount(0);
        await expect(page.locator('.pet-breed-heading')).toHaveCount(0);
      }
    }
    await rows.first().click();
    await page.getByRole('button', { name: 'Aparência · Pastor da estrada', exact: true }).click();
    await expect(rows.first().locator('.pet-art')).toHaveAttribute('data-appearance', 'shepherd');
    await page.getByRole('textbox', { name: 'Nome do mascote', exact: true }).fill('Guará');
    const buy = page.getByRole('button', { name: 'Levar este companheiro', exact: true });
    await expect(buy).toBeEnabled();
    const positions = await page.locator('.pet-shop-purchase').evaluate((e) => {
      const a = e.getBoundingClientRect(),
        l = e.querySelector('.pet-shop-animal-list').getBoundingClientRect(),
        d = e.querySelector('.pet-shop-details').getBoundingClientRect();
      return { x: a.x, right: a.right, listBottom: l.bottom, detailTop: d.top };
    });
    assert(positions.x >= 0 && positions.right <= width + 1);
    assert(positions.listBottom <= positions.detailTop);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await list.evaluate((e) => (e.scrollTop = 0));
    await page
      .locator('.pet-shop-purchase')
      .screenshot({ path: 'test-results/pet-cards-' + width + '.png' });
  }
  await page.getByRole('button', { name: 'Levar este companheiro', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Guará agora acompanha' })).toBeVisible();
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].pet_id, 'dog');
  assert.equal(bodies[0].appearance, 'shepherd');
  assert.equal(bodies[0].name, 'Guará');
  assert.equal(bodies[0].character_id, 'c49e91fb-a870-4587-820e-72eb7bdc0334');
  assert.match(bodies[0].idempotency_key, /^[a-f0-9-]{36}$/);
  await page.getByRole('button', { name: 'Gato · 15 PO', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do mascote', exact: true })).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'Levar este companheiro', exact: true }),
  ).toBeDisabled();
  await page.goto(server.resolvedUrls.local[0] + 'test-results/pet-cards.html?poor');
  await page.getByRole('textbox', { name: 'Nome do mascote', exact: true }).fill('Sem saldo');
  await expect(
    page.getByRole('button', { name: 'Levar este companheiro', exact: true }),
  ).toBeDisabled();
  canEdit = true;
  await page.goto(server.resolvedUrls.local[0] + 'test-results/pet-cards.html');
  await page.getByRole('button', { name: 'Editar raça · Cão clássico' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  console.log(
    'PASS pet cards: ten illustrated species, appearances, six widths, selection/reset, purchase payload, empty name/balance guards and breed editor.',
  );
} finally {
  await browser.close();
  await server.close();
}
