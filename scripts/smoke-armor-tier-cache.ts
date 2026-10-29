import { chromium, expect } from '@playwright/test';
import express from 'express';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { armorPieceImage } from '../shared/armor-piece-art';
import { publicImageReplacements } from '../server/public-image-replacements';
import { optimizedPublicImages } from '../server/optimized-public-images';

const catalog = JSON.parse(await readFile('data/emporium-expansion.json', 'utf8')).items;
const ids = [1, 2, 3].map(n => `magic-armor-chain-mail-plus-${n}`);
const rows = ids.map(id => ({ id, images: [catalog.find((i: any) => i.id === id).image_path,
  ...(['head', 'bracers', 'legs', 'feet', 'shoulders'] as const).map(slot => armorPieceImage(id, slot))] }));
const app = express();
app.get('/__cache-check', (_req, res) => res.type('html').send(`<!doctype html><meta charset="utf-8"><style>body{background:#181715;color:#d8ccb6;font:18px sans-serif;padding:20px}section{display:flex;align-items:center;gap:12px;margin:20px 0}img{width:110px;height:110px;object-fit:contain;background:#25231f;border:1px solid #594a35}b{width:45px}</style><h1>Uma arte para os três níveis</h1>${rows.map((row, i) => `<section><b>+${i+1}</b>${row.images.map(url => `<img src="${url}">`).join('')}</section>`).join('')}`));
app.use(publicImageReplacements);
app.use(optimizedPublicImages(resolve('public')));
app.use(express.static(resolve('public')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(r => server.once('listening', r));
const origin = 'http://127.0.0.1:' + (server.address() as {port:number}).port;
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1000,height:650}});
  const imageRequests: string[] = [], errors: string[] = [];
  page.on('request', req => { if(req.resourceType()==='image') imageRequests.push(req.url()); });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(origin+'/__cache-check');
  await expect.poll(() => page.locator('img').evaluateAll(imgs => imgs.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.locator('img').count()).toBe(18);
  expect(imageRequests.length).toBe(6);
  expect(new Set(imageRequests).size).toBe(6);
  expect(errors).toEqual([]);
  for(const tier of [2,3]) {
    const old=`/shop/armor-parts-20261012/magic-armor-chain-mail-plus-${tier}--head.webp`;
    const r=await fetch(origin+old,{redirect:'manual'});
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe(armorPieceImage(ids[0],'head'));
  }
  await mkdir('test-results/armor-tier-art',{recursive:true});
  await page.screenshot({path:'test-results/armor-tier-art/cache.png'});
  await writeFile('test-results/armor-tier-art/cache.json',JSON.stringify({passed:true,imagesDisplayed:18,imageRequests:6,sharedAcrossThreeLevels:true},null,2));
  console.log('18 imagens exibidas com apenas 6 requisições; referências antigas continuam funcionando.');
} finally {
  await browser.close();
  await new Promise<void>(r => server.close(() => r()));
}
