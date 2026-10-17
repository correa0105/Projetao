import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { House2Ground } from '../src/House2Ground';
import type { House2GroundStroke, House2Plot } from '../shared/house-v2';
import { terrainTextures } from '../shared/vtt-terrain';

const output = 'test-results/house2-ground-blend';
await mkdir(output, { recursive: true });
await writeFile(output + '/result.json', JSON.stringify({ passed: false }));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 700, height: 700 },
  deviceScaleFactor: 1,
});
const plot = { id: 'blend-fixture', x: 0, y: 0, width: 12, height: 12 };
function fill(material: House2GroundStroke['material'], from = 0, to = 12) {
  return Array.from({ length: Math.floor(to - from) + 1 }, (_, i) => ({
    material,
    width: 3,
    points: [
      { x: from + i, y: 0 },
      { x: from + i, y: 12 },
    ],
  }));
}
async function scene(ground: House2GroundStroke[], colors = false, background = false) {
  let markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="-1 -1 14 14">
      {background && (
        <>
          <defs>
            <pattern id="base" width="4" height="4" patternUnits="userSpaceOnUse">
              <image
                href={terrainTextures.find((t) => t.id === 'grass-reference-sparse')!.image}
                width="4"
                height="4"
              />
            </pattern>
          </defs>
          <rect x="-1" y="-1" width="14" height="14" fill="url(#base)" />
        </>
      )}
      <House2Ground plots={[{ ...plot, ground } as House2Plot]} />
    </svg>,
  );
  const sources = [...new Set([...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
  for (const src of sources) {
    const color = src.includes('stone') ? '#ff0000' : '#0000ff';
    const bytes = colors
      ? Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`,
        )
      : await readFile('public' + src);
    const type = colors ? 'image/svg+xml' : src.endsWith('.png') ? 'image/png' : 'image/webp';
    markup = markup.replaceAll(
      `href="${src}"`,
      `href="data:${type};base64,${bytes.toString('base64')}"`,
    );
  }
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`,
  );
  await page.locator('image').evaluateAll(async (nodes) => {
    await Promise.all(
      nodes.map((node) => {
        const image = new Image();
        image.src = node.getAttribute('href')!;
        return image.decode();
      }),
    );
  });
  return page.screenshot({ omitBackground: true });
}
try {
  const solid = await scene(fill('stone'), true);
  await writeFile(output + '/plot-boundary.png', solid);
  const image = await sharp(solid).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x: number, y: number) =>
    image.data[(Math.round(y * 50 + 50) * image.info.width + Math.round(x * 50 + 50)) * 4 + 3];
  for (const [x, y] of [
    [-0.1, 6],
    [12.1, 6],
    [6, -0.1],
    [6, 12.1],
    [0, 6],
    [12, 6],
  ])
    expect(alpha(x, y), `paint outside ownership at ${x},${y}`).toBeLessThanOrEqual(2);
  expect(alpha(6, 6)).toBeGreaterThan(250);
  const transition = Array.from({ length: 101 }, (_, i) => alpha(i / 100, 6));
  expect(transition.filter((a) => a > 8 && a < 247).length).toBeGreaterThan(25);
  expect(Math.max(...transition.slice(1).map((a, i) => Math.abs(a - transition[i])))).toBeLessThan(
    20,
  );
  const contact = await scene([...fill('stone'), ...fill('earth', 6, 12)], true);
  await writeFile(output + '/material-contact.png', contact);
  const contactPixels = await sharp(contact)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const row = Math.round(6 * 50 + 50);
  let mixed = 0;
  for (let x = 4 * 50 + 50; x < 7 * 50 + 50; x++) {
    const at = (row * contactPixels.info.width + x) * 4;
    if (
      contactPixels.data[at] > 10 &&
      contactPixels.data[at + 2] > 10 &&
      contactPixels.data[at + 3] > 250
    )
      mixed++;
  }
  expect(mixed).toBeGreaterThan(20);
  const preview = await scene(
    [
      ...fill('cobblestone'),
      ...fill('grass-reference-light', 7, 12),
      {
        material: 'earth',
        width: 2,
        points: [
          { x: 0, y: 10 },
          { x: 4, y: 8 },
          { x: 8, y: 12 },
        ],
      },
    ],
    false,
    true,
  );
  await writeFile(output + '/natural-materials.png', preview);
  await writeFile(
    output + '/result.json',
    JSON.stringify(
      {
        passed: true,
        ownershipBoundaryTransparent: true,
        continuousMargin: true,
        materialsMix: true,
        mixedContactPixels: mixed,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS House 2.0: terreno preenchido sem corte retangular, transição contínua e mistura de materiais sem invadir o vizinho.',
  );
} finally {
  await browser.close();
}
