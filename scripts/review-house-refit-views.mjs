import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Technical review sheets only. Display real renders unchanged; don't mirror,
// warp or synthesize a direction from another image.
const root = 'public/house/items/house-refit-20261007';
const manifest = JSON.parse(await fs.readFile(`${root}/art-manifest.json`, 'utf8'));
const catalog = JSON.parse(await fs.readFile('data/house-refit-catalog.json', 'utf8'));
const directions = [
  'Frente',
  'Frente / direita',
  'Direita',
  'Trás / direita',
  'Trás',
  'Trás / esquerda',
  'Esquerda',
  'Frente / esquerda',
];
const escape = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const cards = [];
for (const spec of catalog) {
  const views = [];
  for (let facing = 0; facing < 8; facing++) {
    const asset = manifest.assets.find((asset) => asset.id === spec.id && asset.facing === facing);
    views.push({
      facing,
      src: asset
        ? `data:image/webp;base64,${(await fs.readFile(asset.path)).toString('base64')}`
        : '',
      size: asset ? `${asset.width} × ${asset.height}` : 'Aguardando arte real',
    });
  }
  cards.push({ spec, views });
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2048, height: 1200 } });
  await page.setContent(`<!doctype html><html><meta charset=utf-8><style>
    *{box-sizing:border-box}body{margin:0;background:#171d21;color:#dccdaa;font:15px Georgia,serif}
    section{padding:12px}h2{margin:0 0 8px;font-size:20px}.views{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
    article{min-width:0;height:288px;border:1px solid #786950;background:#252a2c;padding:9px}
    h3{margin:0;font-size:15px}.art{height:220px;display:flex;align-items:center;justify-content:center;margin:5px 0;
    background:linear-gradient(#353630,#343431 80%,#685c48 80%,#44392c);overflow:hidden}
    img{display:block;max-width:100%;max-height:100%;object-fit:contain}small{color:#bdaf94}
    .missing{color:#bf8d69;font-size:13px}.default{border-color:#d5a753}
    </style>${cards.map(({ spec, views }) => `<section data-review-id="${spec.id}"><h2>${escape(spec.name)} (${spec.id}) — inicial: ${spec.default_facing}</h2><div class=views>${views.map((view) => `<article class="${view.facing === spec.default_facing ? 'default' : ''}"><h3>${view.facing}: ${directions[view.facing]}</h3><div class=art>${view.src ? `<img src="${view.src}">` : '<span class=missing>Vista ainda não gerada</span>'}</div><small>${view.size}</small></article>`).join('')}</div></section>`).join('')}`);
  await page
    .locator('img')
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/house-refit-all-views.png', fullPage: true });
  for (const { spec } of cards) {
    await page.locator(`[data-review-id="${spec.id}"] .views`).evaluate((element) => {
      element.style.gridTemplateColumns = 'repeat(4, 1fr)';
    });
    await page
      .locator(`[data-review-id="${spec.id}"]`)
      .screenshot({ path: `test-results/house-refit-views-${spec.id}.png` });
  }
  console.log(
    JSON.stringify({
      reviewed_views: manifest.assets.length,
      expected_views: 80,
      sheets: 11,
      missing: manifest.missing,
    }),
  );
} finally {
  await browser.close();
}
