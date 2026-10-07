import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { houseCatalog, houseItemImage, houseFacingOptions } from '../shared/house.js';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const data = async (file) =>
  'data:image/webp;base64,' + (await fs.readFile(file)).toString('base64');
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await fs.mkdir('test-results', { recursive: true });
  for (const spec of houseCatalog.filter((s) => !['letter', 'frame'].includes(s.id))) {
    const cards = [];
    for (const view of houseFacingOptions(spec.id)) {
      const file = 'public' + houseItemImage(spec.id, view.value);
      let url = '';
      try {
        url = await data(file);
      } catch {}
      cards.push(
        `<article><header>${view.value}: ${view.label}</header>${url ? `<img src="${url}">` : 'Aguardando'}</article>`,
      );
    }
    await page.setContent(
      `<html><style>body{margin:0;background:#171d21;color:#dccdaa;font:14px Georgia;padding:12px}h2{margin:0 0 10px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}article{border:1px solid #76634a;padding:8px;height:245px;background:#282b2a}header{height:32px}img{width:100%;height:210px;object-fit:contain}</style><h2>${spec.name}: 16 vistas reais</h2><main>${cards.join('')}</main></html>`,
    );
    await page.locator('img').evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
    await page.screenshot({
      path: `test-results/house-sixteen-views-${spec.id}.png`,
      fullPage: true,
    });
  }
  console.log('Ten sixteen-view review sheets saved.');
} finally {
  await browser.close();
}
