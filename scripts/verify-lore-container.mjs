import fs from 'node:fs/promises';
import {INITIAL_RULEBOOK} from '../shared/rulebook.ts';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
await fs.mkdir('test-results', { recursive: true });
const html =
  '<div id="root"></div><script type="module" src="/test-results/lore-container.tsx"></script>';
const jsx = "import React from 'react';import{createRoot}from'react-dom/client';import{LoreLibrary}from'/src/LoreLibrary.tsx';import{Rulebook}from'/src/Rulebook.tsx';import{SiteMusicProvider}from'/src/SiteMusic.tsx';import{PageHeader}from'/src/PageHeader.tsx';import'/src/styles.css';import'/src/alvorada.css';import'/src/journey.css';import'/src/theme.css';import'/src/page-consistency.css';import'/src/page-header.css';const view=new URLSearchParams(location.search).get('view');createRoot(document.getElementById('root')).render(<SiteMusicProvider><div className=\"app-shell\" data-page={view==='rules'?'rules':'lore'}><div className=\"main-shell\"><PageHeader title={view==='rules'?'Regras da mesa':'Crônicas & lore'} children={null}/><main className=\"main-content\"><div className=\"page-header-spacer\" aria-hidden=\"true\"/>{view==='rules'?<Rulebook active={true}/>:<LoreLibrary/>}</main></div></div></SiteMusicProvider>);";
const currentJsx = process.argv.includes('--baseline')
  ? jsx.replace("from'/src/LoreLibrary.tsx'", "from'/.local/living-original/src/LoreLibrary.tsx'")
  : jsx;
await fs.writeFile('test-results/lore-container.html', html);
await fs.writeFile('test-results/lore-container.tsx', currentJsx);
const server = await createServer({
  cacheDir: '.local/vite-lore-container',
  optimizeDeps: {
    entries: ['test-results/lore-container.html'],
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
const eraIds = Array.from({ length: 6 }, (_, i) => `dcf66218-0b9f-4ab1-8558-7e1916f8810${i}`);
const timeline = {
  revision: 1,
  can_edit: true,
  document: {
    title: 'Linha temporal',
    eras: eraIds.map((id, i) => ({
      id,
      year: ['Indefinido', '10 mil anos', '9.320 anos', '7.320 anos', '3.320 anos', 'Mil anos'][i],
      title: i === 5 ? 'Alvorada Cinzenta' : '',
      description: 'Registro da era',
      revealed: i === 5,
      folder_ids: [],
    })),
  },
};
const hall = {
  revision: 1,
  can_edit: false,
  document: {
    title: 'Hall da Fama',
    intro: 'Nomes gravados na história',
    weights: { level: 10, achievement: 10, mission: 10, title: 10 },
  },
  entries: [1, 2, 3].map((i) => ({
    id: 'hero-' + i,
    user_id: 'user-' + i,
    rank: i,
    name: ['Lyra dos Ventos', 'Thorin Guardião da Aurora', 'Nana'][i - 1],
    owner_name: 'Aventureiro ' + i,
    class: 'Guerreiro',
    race: 'Humano',
    level: 15 - i,
    score: 400 - i * 35,
    missions: 30 - i,
    achievements: 20 - i,
    titles: 9 - i,
    prestige: 200 - i,
    rating: 4.9 - i * 0.1,
    rating_count: 5,
    portrait: '/character-silhouette-v2.png',
    parts: { level: 40, titles: 30, missions: 20, achievements: 30 },
  })),
};
const results = [],
  errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/rulebook' ? {document:INITIAL_RULEBOOK,revision:1,can_edit:true} : path === '/api/lore-timeline'
        ? timeline
        : path === '/api/lore'
          ? {
              can_edit: true,
              regions: [
                {
                  id: 'reino-do-norte',
                  name: 'Reino do Norte',
                  description: 'Arquivos preservados',
                },
              ],
              folders: [],
              pages: [],
            }
          : path === '/api/hall'
            ? hall
            : {};
    await route.fulfill({ json: data });
  });
  for (const motion of ['reduce', 'no-preference'])
    for (const width of [1898, 1440, 768, 390, 320]) {
      await page.emulateMedia({ reducedMotion: motion });
      await page.setViewportSize({ width, height: 920 });
      await page.goto(server.resolvedUrls.local[0]+'test-results/lore-container.html?view=rules');await page.locator('.rb-hero').waitFor();const ruleBounds=await page.locator('.rulebook').boundingBox();
      await page.goto(
        server.resolvedUrls.local[0] + 'test-results/lore-container.html?view=lore',
      );
      await page.locator('.lore-era').last().waitFor();
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
      await page
        .locator('.lore-timeline')
        .evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120));
      const loreBounds=await page.locator('.lore-library').boundingBox(),heroBounds=await page.locator('.lore-scene').boundingBox(),headerBounds=await page.locator('.page-header').boundingBox();
      assert(Math.abs(loreBounds.width-ruleBounds.width)<1,'Same width as Regras at '+width);assert(Math.abs(loreBounds.x-ruleBounds.x)<1,'Same margin as Regras at '+width);assert(loreBounds.width<=1380);assert(heroBounds.y>=headerBounds.y+headerBounds.height+20,'Header clearance');
      const scrollBefore = await page.evaluate(() => scrollY);
      const heading = await page.locator('.page-header h1').boundingBox();
      for (const i of [0, 4, 5]) {
        await page.locator('.lore-era').nth(i).click();
        await page.waitForFunction(
          () => document.querySelector('.lore-timeline')?.dataset.phase === 'idle',
        );
        const bounds = await page.locator('.page-header h1').boundingBox();
        const positions = await page.evaluate(() => ({
          x: scrollX,
          width: document.documentElement.scrollWidth,
          scene: document.querySelector('.lore-scene').scrollLeft,
        }));
        assert.equal(positions.x, 0);
        assert.equal(positions.scene, 0, 'hidden scene shifted after era click');
        assert(
          Math.abs((await page.evaluate(() => scrollY)) - scrollBefore) < 1,
          'visible timeline click moved the whole page vertically',
        );
        if(positions.width>width+1){await page.screenshot({path:'test-results/lore-container-overflow.png',fullPage:true});console.log(JSON.stringify({width,positions,overflow:await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,class:e.className,rect:e.getBoundingClientRect().toJSON()})).filter(e=>e.rect.right>innerWidth+1||e.rect.left<0).slice(0,20))}));}
        assert(positions.width <= width + 1,JSON.stringify({width,positions}));
        assert(Math.abs(heading.x - bounds.x) < 1, 'title shifted horizontally');
      }
      // Focus/keyboard navigation stays inside the timeline even in the scrollable mobile strip.
      await page.locator('.lore-era').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.lore-timeline')?.dataset.phase === 'idle',
      );
      assert.equal(await page.evaluate(() => document.querySelector('.lore-scene').scrollLeft), 0);
      await page.getByRole('button', { name: 'Editar eras' }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
      if (motion === 'no-preference')
        await page.screenshot({
          path: `test-results/lore-container-${width}.png`,
          fullPage: true,
        });
      results.push({ view: 'lore', motion, width, clicks: 4 });
    }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/lore-container-metrics.json',
    JSON.stringify(results, null, 2),
  );
  console.log(
    'PASS Lore container: same bounds as Regras in five widths, header clearance, timeline keyboard/clicks and editor retained.',
  );
} finally {
  await browser.close();
  await server.close();
}
