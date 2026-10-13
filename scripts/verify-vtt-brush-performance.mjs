import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['src/vtt-terrain-canvas.ts'], bundle: true, write: false,
  format: 'iife', globalName: 'Terrain', platform: 'browser' });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const baseline = process.env.BRUSH_BASELINE_JS ? await readFile(process.env.BRUSH_BASELINE_JS, 'utf8') : null;
const url = 'data:image/webp;base64,' + (await readFile('public/vtt/scenery-v2-20261012/terrain-grass.webp')).toString('base64');
await mkdir('test-results/brush-performance', { recursive: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="2560" height="1600"></canvas>');
  if (baseline) await page.addScriptTag({ content: baseline.replace(/\bTerrain\b/g, 'TerrainBefore') });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const report = await page.evaluate(async ({ url, baseline }) => {
    const image = new Image(); image.src = url; await image.decode();
    const images = new Map([['/vtt/scenery-v2-20261012/terrain-grass.webp', image]]);
    const options = { images, camera: { x: 640, y: 400, zoom: 1 }, dpr: 2 };
    const make = i => ({ id: String(i), texture: 'grass', erase: i % 9 === 8, radius: 45, softness: .5,
      opacity: .8, textureScale: 280, shape: 'round', layer: i % 2 ? 'top' : 'base',
      points: Array.from({ length: 80 }, (_, p) => ({ x: 50 + (i % 10) * 100 + p * 3, y: 60 + Math.floor(i / 10) * 70 + Math.sin(p * .2) * 20 })) });
    const scene = { id: 'performance', width: 16000, height: 16000, terrain: Array.from({ length: 120 }, (_, i) => make(i)),
      terrainLayers: [{ id: 'base', visible: true, opacity: 1 }, { id: 'top', visible: true, opacity: .8 }] };
    const draft = i => ({ ...make(121), id: 'draft', points: Array.from({ length: 20 + i }, (_, p) => ({ x: 300 + p * 3, y: 400 + Math.sin(p * .2) * 20 })) });
    const time = (fn, n = 1) => { const start = performance.now(); for (let i = 0; i < n; i++) fn(i); return (performance.now() - start) / n; };
    const c = document.querySelector('canvas').getContext('2d');
    const benchmark = engine => {
      const canvas = document.createElement('canvas'); canvas.width = 2560; canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      const coldMs = time(() => engine.drawTerrain(ctx, scene, options));
      engine.drawTerrain(ctx, scene, { ...options, terrainDraft: draft(0) });
      const paintMs = time(i => engine.drawTerrain(ctx, scene, { ...options, terrainDraft: draft(i + 1) }), 12);
      const panMs = time(i => engine.drawTerrain(ctx, scene, { ...options, camera: { x: 650 + i * 2, y: 400, zoom: 1 } }), 12);
      const stationaryMs = time(() => engine.drawTerrain(ctx, scene, options), 60);
      const cloneMs = time(() => engine.drawTerrain(ctx, structuredClone(scene), options), 12);
      return { coldMs, paintMs, panMs, stationaryMs, cloneMs };
    };
    const after = benchmark(Terrain), before = baseline ? benchmark(TerrainBefore) : null;
    Terrain.drawTerrain(c, scene, options);
    const start = Terrain.terrainCacheStats(c.canvas);
    Terrain.drawTerrain(c, scene, options); Terrain.drawTerrain(c, structuredClone(scene), options);
    Terrain.drawTerrain(c, scene, { ...options, camera: { x: 648, y: 402, zoom: 1 } });
    const reused = Terrain.terrainCacheStats(c.canvas);
    const paints = {};
    for (const shape of ['round', 'square', 'rough']) {
      Terrain.drawTerrain(c, scene, { ...options, terrainDraft: { ...draft(0), shape } });
      const warm = Terrain.terrainCacheStats(c.canvas);
      const ms = time(i => Terrain.drawTerrain(c, scene, { ...options, terrainDraft: { ...draft(i + 1), shape } }), 8);
      const latest = { ...draft(9), shape };
      Terrain.drawTerrain(c, scene, { ...options, terrainDraft: latest });
      const priorCommit = Terrain.terrainCacheStats(c.canvas);
      const committed = { ...scene, terrain: [...scene.terrain, latest] };
      Terrain.drawTerrain(c, committed, options);
      const committedStats = Terrain.terrainCacheStats(c.canvas);
      paints[shape] = { ms, warm, priorCommit, committed: committedStats };
      Terrain.drawTerrain(c, scene, options); // Undo invalidates the affected tiles.
    }
    const wide = { ...draft(0), radius: 500, softness: 1 };
    Terrain.drawTerrain(c, scene, { ...options, terrainDraft: wide });
    const wideBrushMs = time(i => Terrain.drawTerrain(c, scene, { ...options, terrainDraft: { ...wide, points: [{ x: 600 + i, y: 400 }] } }), 5);
    const cache = Terrain.terrainCacheStats(c.canvas);
    // Move through a large map: discarded tiles must not accumulate indefinitely.
    const sparse = { ...scene, id: 'large-map', terrain: Array.from({ length: 120 }, (_, i) => ({ ...make(i), points: [{ x: 500 + (i % 12) * 1000, y: 500 + Math.floor(i / 12) * 1000 }], softness: 0 })) };
    for (let i = 0; i < 24; i++) Terrain.drawTerrain(c, sparse, { ...options, camera: { x: 500 + (i % 12) * 1000, y: 500 + Math.floor(i / 12) * 1000, zoom: 1 } });
    const bounded = Terrain.terrainCacheStats(c.canvas);
    return { viewport: '1280 × 800, DPR 2', strokes: 120, points: 9600, before, after, start, reused, paints, wideBrushMs, cache, bounded };
  }, { url, baseline: !!baseline });
  await writeFile('test-results/brush-performance/result.json', JSON.stringify({ passed: false, ...report }, null, 2));
  assert.equal(report.start.strokesDrawn, report.reused.strokesDrawn, 'Camera, animation and cloned token documents must reuse paint');
  assert.equal(report.start.tilesBuilt, report.reused.tilesBuilt, 'Warm navigation must reuse tiles');
  for (const [shape, value] of Object.entries(report.paints)) {
    assert.equal(value.priorCommit.tilesBuilt, value.warm.tilesBuilt, shape + ' must not replay old paint while dragging');
    assert.equal(value.committed.tilesBuilt, value.priorCommit.tilesBuilt, shape + ' commits only the new stroke');
  }
  assert(report.bounded.cacheBytes <= 96 * 1024 * 1024);
  assert(report.bounded.maskBytes <= 24 * 1024 * 1024);
  if (report.before) {
    assert(report.after.paintMs < report.before.paintMs * .2, 'Painting must be at least five times faster');
    assert(report.after.panMs < report.before.panMs * .1, 'Warm navigation must be at least ten times faster');
  }
  await writeFile('test-results/brush-performance/result.json', JSON.stringify({ passed: true, ...report }, null, 2));
  console.log(JSON.stringify({ passed: true, before: report.before, after: report.after, shapes: Object.fromEntries(Object.entries(report.paints).map(([key, value]) => [key, value.ms])), wideBrushMs: report.wideBrushMs, memoryMiB: (report.cache.cacheBytes + report.cache.maskBytes) / 1048576 }));
} finally { await browser.close(); }
