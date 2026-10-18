import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  house2VillagePlots,
  house2HousePlacement,
  house2Houses,
  house2Furniture,
  type House2Plot,
} from '../shared/house-v2';
const label = process.argv[2] ?? 'after',
  out = 'test-results/house2-performance/' + label,
  bundle = process.argv[3] ?? out,
  width = Number(process.env.HOUSE2_PERF_WIDTH ?? 1440);
await mkdir(out, { recursive: true });
if (!process.argv[3])
  await build({
    entryPoints: ['scripts/house2-performance-fixture.tsx'],
    bundle: true,
    plugins: [
      {
        name: 'public-urls',
        setup(b) {
          b.onResolve({ filter: /^\// }, (a) =>
            a.kind === 'url-token' ? { path: a.path, external: true } : undefined,
          );
        },
      },
    ],
    format: 'iife',
    outfile: out + '/client.js',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
const plots: House2Plot[] = house2VillagePlots.map((p, i) => {
  const plot = {
    id: 'lot-' + i,
    number: i + 1,
    neighborhood_id: 'neighborhood',
    x: p.x - 3,
    y: p.y - 3,
    width: 18,
    height: 18,
    price: 1200,
    can_edit: i === 0,
    character_id: 'hero-' + i,
    owner_name: 'Morador ' + i,
    player_name: 'Jogador ' + i,
    house_id: house2Houses[i % 25].id,
    house_x: 0,
    house_y: 0,
    house_rotation: 0,
    revision: 0,
    village_slot: i + 1,
    door_open: false,
    ground: [],
  } as House2Plot;
  const at = house2HousePlacement(plot);
  return { ...plot, house_x: at.x, house_y: at.y, house_rotation: at.rotation };
});
const items = plots.flatMap((p, n) =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `piece-${n}-${i}`,
    catalog_id: house2Furniture[(i * 13) % house2Furniture.length].id,
    plot_id: p.id,
    x: p.x + 1 + (i % 6) * 2.5,
    y: p.y + 1 + Math.floor(i / 6) * 3,
    rotation: (i * 37) % 360,
    scale: 1,
    light_on: false,
  })),
);
const neighborhood = {
  id: 'neighborhood',
  name: 'Teste de fluidez',
  description: '',
  terrain: 'grass',
  available: 0,
  total: 12,
  owned: 1,
};
const app = express();
app.use(express.static('public'));
app.get('/client.js', async (_, r) => r.type('js').send(await readFile(bundle + '/client.js')));
app.get('/client.css', async (_, r) => r.type('css').send(await readFile(bundle + '/client.css')));
app.get('/', (_, r) =>
  r.send(
    '<html><head><link rel="stylesheet" href="/client.css"></head><body style="margin:0"><div id="root"></div><script src="/client.js"></script></body></html>',
  ),
);
app.use('/api', (req, res) => {
  const path = req.path;
  if (path === '/world-clock')
    return res.json({ timeMs: 15 * 3600000, revision: 0, canEdit: true });
  if (path === '/house-v2')
    return res.json({
      neighborhoods: [neighborhood],
      balance: 20000,
      inventory: items,
      finishes: [],
    });
  if (path === '/house-v2/token-library') return res.json({ sources: [] });
  if (path.endsWith('/tokens')) return res.json({ tokens: [], doors: {} });
  if (path === '/house-v2/neighborhoods/neighborhood')
    return res.json({ neighborhood, plots, items });
  return res.json({});
});
const server = app.listen(3089, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width, height: 900 },
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () =>
  Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map((m: any) => [m.name, m.value]),
  );
try {
  await page.addInitScript('window.__name = value => value;');
  const start = Date.now();
  await page.goto('http://localhost:3089');
  await page.locator('.h2-neighborhood-card').click();
  await page.locator('[data-house2-roof]').first().waitFor();
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll('svg image')].map(async (el) => {
        const i = new Image();
        i.src = el.getAttribute('href')!;
        await i.decode();
      }),
    );
  });
  const loadedMs = Date.now() - start,
    overview = {
      nodes: await page.locator('.h2-map *').count(),
      scenery: await page.locator('[data-nature-kind]').count(),
      items: await page.locator('[data-house2-catalog]').count(),
    };
  await page.mouse.move(2, 2);
  await page.screenshot({ path: out + '/overview.png' });
  await page.locator('g[data-house2-plot="lot-0"] > .h2-plot').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Fechar Terrenos', exact: true }).click();
  await page.screenshot({ path: out + '/close.png' });
  const close = {
    nodes: await page.locator('.h2-map *').count(),
    scenery: await page.locator('[data-nature-kind]').count(),
    items: await page.locator('[data-house2-catalog]').count(),
  };
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const before = await metrics();
  await page.evaluate(() => {
    const w = window as any;
    w.frameTimes = [];
    w.collect = true;
    let last = performance.now();
    const frame = (now: number) => {
      if (!w.collect) return;
      w.frameTimes.push(now - last);
      last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const startX = Math.min(700, width * 0.48),
    distance = Math.min(160, width * 0.2);
  await page.mouse.move(startX, 750);
  await page.mouse.down();
  for (let i = 0; i < 100; i++)
    await page.mouse.move(startX + Math.sin(i / 15) * distance, 750 + Math.cos(i / 15) * 65);
  await page.mouse.up();
  const after = await metrics(),
    frames = await page.evaluate(() => {
      const w = window as any;
      w.collect = false;
      return w.frameTimes as number[];
    });
  frames.sort((a, b) => a - b);
  await page.getByRole('button', { name: 'Centralizar vizinhança', exact: true }).click();
  expect(errors).toEqual([]);
  const result = {
    passed: true,
    label,
    viewport: { width, height: 900 },
    cpuThrottle: 4,
    loadedMs,
    overview,
    close,
    pan: {
      taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
      scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
      layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
      frameCount: frames.length,
      frameMedian: frames[Math.floor(frames.length * 0.5)],
      frameP95: frames[Math.floor(frames.length * 0.95)],
      longFrames: frames.filter((t) => t > 50).length,
    },
    errors,
  };
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
