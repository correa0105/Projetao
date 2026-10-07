import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const root = 'public/house/items/house-refit-20261007';
const manifest = JSON.parse(await fs.readFile(`${root}/art-manifest.json`, 'utf8'));
const config = [
  { id: 'rug', facing: 0, x: 0.5, y: 0.92, scale: 0.55, layer: 0 },
  { id: 'sofa', facing: 7, x: 0.22, y: 0.73, scale: 0.34, layer: 3 },
  { id: 'chair', facing: 1, x: 0.76, y: 0.75, scale: 0.16, layer: 2 },
  { id: 'table', facing: 0, x: 0.5, y: 0.87, scale: 0.3, layer: 4 },
  { id: 'bench', facing: 1, x: 0.84, y: 0.89, scale: 0.23, layer: 5 },
  { id: 'chest', facing: 1, x: 0.86, y: 0.58, scale: 0.19, layer: 1 },
  { id: 'books', facing: 1, x: 0.47, y: 0.725, scale: 0.052, layer: 8 },
  { id: 'lantern', facing: 1, x: 0.55, y: 0.727, scale: 0.036, layer: 8 },
  { id: 'plant', facing: 1, x: 0.86, y: 0.48, scale: 0.085, layer: 7 },
  { id: 'statue', facing: 1, x: 0.07, y: 0.61, scale: 0.16, layer: 1 },
];
const data = async (file) =>
  `data:image/webp;base64,${(await fs.readFile(file)).toString('base64')}`;
const included = [];
for (const piece of config) {
  const asset = manifest.assets.find(
    (asset) => asset.id === piece.id && asset.facing === piece.facing,
  );
  if (asset) included.push({ ...piece, url: await data(asset.path) });
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const background = await data('public/house/rooms/hall-hearth.webp');
  await page.setContent(
    `<!doctype html><html><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}.scene{position:relative;width:100%;height:100%;background:url('${background}') center/100% 100%}.piece{position:absolute;height:auto;transform:translate(-50%,-100%);filter:drop-shadow(0 3px 4px #0005)}</style><div class=scene>${included.map((piece) => `<img class=piece alt='${piece.id}' src='${piece.url}' style='left:${piece.x * 100}%;top:${piece.y * 100}%;width:${piece.scale * (0.15 + (0.85 * (piece.y - 0.08)) / 0.76) * 100}%;z-index:${piece.layer}'>`).join('')}</div>`,
  );
  await page
    .locator('img')
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/house-refit-master-review.png' });
  await fs.writeFile(
    'test-results/house-refit-master-review.json',
    JSON.stringify(
      {
        note: 'Review-only composition; no database or product defaults changed; partial missing assets omitted.',
        included: included.map(({ url, ...piece }) => piece),
        missing: config
          .filter((piece) => !included.some((asset) => asset.id === piece.id))
          .map((piece) => piece.id),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      included: included.map((piece) => piece.id),
      missing: config
        .filter((piece) => !included.some((asset) => asset.id === piece.id))
        .map((piece) => piece.id),
    }),
  );
} finally {
  await browser.close();
}
