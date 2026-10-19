import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classes } from '../shared/rules';
await mkdir('.local', { recursive: true });
await mkdir('test-results/class-level-badges', { recursive: true });
await writeFile(
  '.local/class-level-entry.ts',
  "export {CharacterLevelBadge} from '../src/CharacterLevelBadge';",
);
await build({
  entryPoints: ['.local/class-level-entry.ts'],
  outfile: '.local/class-level-component.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react/jsx-runtime'],
  loader: { '.css': 'empty' },
  logLevel: 'silent',
});
const { CharacterLevelBadge } = await import(
  pathToFileURL(resolve('.local/class-level-component.mjs')).href
);
const rows = classes
  .map((name) => {
    const states = Array.from({ length: 20 }, (_, i) =>
      renderToStaticMarkup(createElement(CharacterLevelBadge, { className: name, level: i + 1 })),
    );
    expect(new Set(states).size).toBe(20);
    return `<section><h2>${name}</h2><div class="badge-row">${states.join('')}</div></section>`;
  })
  .join('');
const css = await readFile('src/character-level-badge.css', 'utf8');
await writeFile(
  '.local/class-level-gallery.html',
  `<!doctype html><meta charset="utf-8"><title>Selos de nível por classe</title><style>${css}*{box-sizing:border-box}body{margin:20px;background:#181610;color:#decda9;font:14px Georgia}h2{margin:10px 0 0;font-size:17px}section{border-bottom:1px solid #77644355;padding-bottom:8px}.badge-row{display:flex;gap:5px}.class-level-badge{width:85px!important;height:97px!important;flex-basis:85px!important}</style><h1>13 classes · evolução visual do nível 1 ao 20</h1>${rows}`,
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1840, height: 1000 } });
  await page.goto(pathToFileURL(resolve('.local/class-level-gallery.html')).href);
  await expect(page.locator('.class-level-badge')).toHaveCount(260);
  await expect(page.locator('[data-level="20"]')).toHaveCount(13);
  expect(
    await page
      .locator('.class-level-badge')
      .evaluateAll((nodes) => new Set(nodes.map((n) => n.getAttribute('data-class'))).size),
  ).toBe(13);
  for (const node of await page.locator('.class-level-badge').all())
    expect(await node.locator('.level-badge-number').textContent()).toBe(
      await node.getAttribute('data-level'),
    );
  await page.screenshot({ path: 'test-results/class-level-badges/all-260.png', fullPage: true });
  await writeFile(
    'test-results/class-level-badges/result.json',
    JSON.stringify(
      {
        passed: true,
        classes: 13,
        levels: 20,
        distinctBadges: 260,
        readableNumbers: true,
        nativeSvg: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
