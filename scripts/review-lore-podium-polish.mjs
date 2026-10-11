import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
await fs.mkdir('test-results', { recursive: true });
const html =
  '<div id="root"></div><script type="module" src="/test-results/lore-podium-polish.tsx"></script>';
const jsx = `import React from 'react';import{createRoot}from'react-dom/client';import{LoreLibrary}from'/src/LoreLibrary.tsx';import{HallOfFame}from'/src/HallOfFame.tsx';import{PageHeader}from'/src/PageHeader.tsx';import'/src/styles.css';import'/src/alvorada.css';import'/src/theme.css';import'/src/page-consistency.css';import'/src/page-header.css';const view=new URLSearchParams(location.search).get('view');createRoot(document.getElementById('root')).render(<div className="app-shell" data-page={view==='lore'?'lore':'hall'}><div className="main-shell">{view==='lore'&&<PageHeader title="Crônicas & lore" children={null}/>}<main className="main-content">{view==='lore'?<LoreLibrary/>:<HallOfFame embedded={view==='embedded'}/>}</main></div></div>);`;
const currentJsx = process.argv.includes('--baseline')
  ? jsx.replace("from'/src/LoreLibrary.tsx'", "from'/.local/living-original/src/LoreLibrary.tsx'")
  : jsx;
await fs.writeFile('test-results/lore-podium-polish.html', html);
await fs.writeFile('test-results/lore-podium-polish.tsx', currentJsx);
const server = await createServer({
  cacheDir: '.local/vite-lore-podium-polish',
  optimizeDeps: {
    entries: ['test-results/lore-podium-polish.html'],
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
      path === '/api/lore-timeline'
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
      await page.goto(
        server.resolvedUrls.local[0] + 'test-results/lore-podium-polish.html?view=lore',
      );
      await page.locator('.lore-era').last().waitFor();
      await page
        .locator('.lore-timeline')
        .evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120));
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
        assert(positions.width <= width + 1);
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
          path: `test-results/lore-timeline-fixed-${width}.png`,
          fullPage: true,
        });
      results.push({ view: 'lore', motion, width, clicks: 4 });
    }
  for (const view of ['hall', 'embedded'])
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        server.resolvedUrls.local[0] + 'test-results/lore-podium-polish.html?view=' + view,
      );
      await page.locator('.hall-champion').last().waitFor();
      assert.equal(await page.locator('.hall-medal-name').count(), 0);
      const cards = await page.locator('.hall-champion').evaluateAll((es) =>
        es.map((e) => {
          const a = e.querySelector('.hall-character-art').getBoundingClientRect(),
            d = e.querySelector('.hall-champion-details').getBoundingClientRect(),
            badge = e.querySelector('.hall-place').getBoundingClientRect();
          return {
            artBottom: a.bottom,
            detailsTop: d.top,
            artTop: a.top,
            badgeBottom: badge.bottom,
            color: getComputedStyle(e).getPropertyValue('--medal-ink'),
          };
        }),
      );
      for (const card of cards) {
        assert(card.artBottom <= card.detailsTop + 1);
        assert(card.badgeBottom <= card.artTop + 1);
      }
      assert.equal(new Set(cards.map((c) => c.color)).size, 3);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page
        .locator('.hall-podium')
        .screenshot({ path: `test-results/podium-polished-${view}-${width}.png` });
      results.push({ view, width });
    }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/lore-podium-polish-metrics.json',
    JSON.stringify(results, null, 2),
  );
  console.log(
    'PASS Lore: 40 era actions, hidden-ancestor/heading/page bounds, keyboard and editor; podium: eight responsive layouts, distinct metals and nonoverlapping art.',
  );
} finally {
  await browser.close();
  await server.close();
}
