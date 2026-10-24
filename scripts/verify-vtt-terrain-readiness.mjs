import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: {
    contents: "export {drawTerrain,terrainCacheStats} from './src/vtt-terrain-canvas'; export {terrainTextures} from './shared/vtt-terrain'; export {newScene} from './shared/vtt';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'QA',
});
const data = 'data:image/webp;base64,' + (await readFile('public/vtt/terrain-v4-20261013/grass.webp')).toString('base64');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="400" height="400"></canvas>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const report = await page.evaluate(async data => {
    const image = new Image();
    image.src = data;
    await image.decode();
    // Image dimensions may be available while the response is still streaming.
    // Hold that state deterministically, then finish without replacing the image.
    let complete = false;
    Object.defineProperty(image, 'complete', { get: () => complete });
    const scene = QA.newScene('9c74c603-0a2b-4c27-a947-32ed17541e5a');
    scene.width = scene.height = 400;
    scene.terrain = [{ id: 'saved-paint', texture: 'grass', layer: 'base', shape: 'round', erase: false,
      radius: 160, softness: .3, opacity: 1, textureScale: 280, points: [{ x: 200, y: 200 }] }];
    const canvas = document.querySelector('canvas'), context = canvas.getContext('2d');
    const options = { camera: { x: 200, y: 200, zoom: 1 }, dpr: 1, images: new Map([[QA.terrainTextures[0].image, image]]), gm: true };
    const paint = () => {
      context.clearRect(0, 0, 400, 400);
      QA.drawTerrain(context, scene, options);
      return canvas.toDataURL();
    };
    const loading = paint(), before = QA.terrainCacheStats(canvas);
    complete = true;
    const loaded = paint(), after = QA.terrainCacheStats(canvas);
    paint();
    const cached = QA.terrainCacheStats(canvas);
    const fresh = document.createElement('canvas');
    fresh.width = fresh.height = 400;
    QA.drawTerrain(fresh.getContext('2d'), scene, options);
    return {
      dimensionsWhileLoading: image.naturalWidth,
      repainted: loaded !== loading,
      matchesFresh: loaded === fresh.toDataURL(),
      rebuiltOnReady: after.tilesBuilt > before.tilesBuilt,
      reusedAfterReady: cached.tilesBuilt === after.tilesBuilt && cached.strokesDrawn === after.strokesDrawn,
      image: loaded,
    };
  }, data);
  await mkdir('test-results/terrain-readiness', { recursive: true });
  await writeFile('test-results/terrain-readiness/loaded.png', Buffer.from(report.image.split(',')[1], 'base64'));
  delete report.image;
  await writeFile('test-results/terrain-readiness/result.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert(report.repainted && report.matchesFresh && report.rebuiltOnReady, 'Saved brushes must repaint when an image completes without changing dimensions');
  assert(report.reusedAfterReady, 'Ready textures must retain the terrain cache');
} finally {
  await browser.close();
}
