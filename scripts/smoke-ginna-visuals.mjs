import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Exercise the actual nightmare and return, without touching any player data.
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/ginna-preview.html',
  `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><div id="preview"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SiteMusicProvider } from '/src/SiteMusic.tsx';
import { GinnaVision } from '/src/GinnaVision.tsx';
import { GinnaReturn } from '/src/GinnaReturn.tsx';
import '/src/styles.css';
import '/src/theme.css';
import '/src/npc-speech.css';
import '/src/stable.css';
function Preview() {
  const [vision, setVision] = React.useState(true);
  const [returning, setReturning] = React.useState(false);
  const start = React.useCallback(() => setReturning(true), []);
  const covered = React.useCallback(() => setVision(false), []);
  const finished = React.useCallback(() => setReturning(false), []);
  return React.createElement(SiteMusicProvider, null, React.createElement('main', {className:'app-shell', style:{position:'fixed', inset:0, background:"url('/stable/paddock-camp-v2.webp') center/cover"}},
    vision && React.createElement(GinnaVision, {known:true, returning, onFinished:start}),
    returning && React.createElement(GinnaReturn, {onCovered:covered, onFinished:finished})));
}
createRoot(document.getElementById('preview')).render(React.createElement(Preview));
</script></body></html>`,
);
const server = await createServer({ server: { port: 3034, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({ reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (/ginna-raised-eyes|kraken-skin/.test(response.url()) && response.status() >= 400)
    errors.push(`Textura indisponível: ${response.status()} ${response.url()}`);
});
page.on('console', (message) => {
  if (message.type() === 'error' && /shader|THREE|WebGL/i.test(message.text()))
    errors.push(message.text());
});
try {
  for (const [width, height, label] of [
    [1440, 900, 'desktop'],
    [390, 844, 'mobile'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://localhost:3034/test-results/ginna-preview.html');
    const vision = page.locator('.ginna-vision');
    await expect(vision).toBeVisible();
    await expect(vision.locator('.ginna-earth-eye[data-depth="ground"]')).toHaveCount(22);
    await expect
      .poll(() => vision.locator('.ginna-ground-eyes-canvas').getAttribute('data-renderer'))
      .toBe('webgl');
    await expect
      .poll(() =>
        vision.locator('.ginna-ground-eyes-canvas').getAttribute('data-frame').then(Number),
      )
      .toBeGreaterThan(30);
    await expect(vision.locator('.ginna-ground-eyes-canvas')).toHaveAttribute('data-emerged', '23');
    await expect(vision.locator('.ginna-ground-eyes-canvas')).toHaveAttribute(
      'data-mountain-eye-count',
      '1',
    );
    await expect(vision.locator('[data-depth="mountain"]')).toHaveAttribute(
      'data-renderer',
      'webgl',
    );
    await page.screenshot({ path: `test-results/ginna-eyes-3d-${label}.png` });
    const keeper = vision.getByRole('button', { name: 'Conversar com a cuidadora na visão' });
    const box = await keeper.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const promise = vision.getByRole('button', { name: 'Não vou machucá-los!', exact: true });
    await expect(promise).toBeVisible();
    await expect(vision).toHaveAttribute('data-heartbeat-state', 'playing');
    await expect
      .poll(() => vision.getAttribute('data-heartbeat-beats').then(Number))
      .toBeGreaterThan(1);
    const phase = Number(await vision.getAttribute('data-heartbeat-phase'));
    expect(Math.min(Math.abs(phase - 0.1), Math.abs(phase - 0.27))).toBeLessThan(0.04);
    // Hold the existing quake at a known frame to verify the far layer shares it.
    await vision.locator('.ginna-nightmare-scene').evaluate((element) => {
      const quake = element.getAnimations()[0];
      quake.pause();
      quake.currentTime = 410;
    });
    const promiseBox = await promise.boundingBox();
    await page.mouse.click(
      promiseBox.x + promiseBox.width / 2,
      promiseBox.y + promiseBox.height / 2,
    );
    const returnScene = page.locator('.ginna-return-tentacles');
    await expect(returnScene).toHaveAttribute('data-renderer', 'webgl');
    await expect(vision).toHaveAttribute('data-returning', 'true');
    await expect(vision.locator('.ginna-balloon-copy')).toHaveText(
      'Melhor assim. Estarei de olho em você.',
    );
    await expect(promise).toHaveCount(0);
    await expect(returnScene).toHaveAttribute('data-origin', 'lake');
    const quake = await vision
      .locator('.ginna-nightmare-scene')
      .evaluate((element) => getComputedStyle(element).transform);
    await expect(returnScene).toHaveAttribute('data-far-quake', quake);
    await expect
      .poll(() => returnScene.getAttribute('data-far-progress').then(Number))
      .toBeGreaterThan(0.6);
    expect(Number(await returnScene.getAttribute('data-water-ripples'))).toBeGreaterThan(0);
    await page.screenshot({ path: `test-results/ginna-tentacle-volume-sky-${label}.png` });
    await vision
      .locator('.ginna-nightmare-scene')
      .evaluate((element) => element.getAnimations()[0].play());
    await expect(returnScene).toHaveAttribute('data-stage', 'descending');
    await page.screenshot({ path: `test-results/ginna-tentacle-volume-descent-${label}.png` });
    await expect(returnScene).toHaveAttribute('data-stage', 'wrapping');
    await expect
      .poll(() => returnScene.getAttribute('data-progress').then(Number))
      .toBeGreaterThan(0.5);
    await page.screenshot({ path: `test-results/ginna-tentacle-volume-wrap-${label}.png` });
    await expect
      .poll(() => returnScene.getAttribute('data-progress').then(Number))
      .toBeGreaterThan(0.88);
    expect(Number(await returnScene.getAttribute('data-turns'))).toBeGreaterThan(2.8);
    expect(Number(await returnScene.getAttribute('data-constriction'))).toBeGreaterThan(0.5);
    await page.screenshot({ path: `test-results/ginna-tentacle-volume-enclosed-${label}.png` });
    await expect(page.locator('.ginna-return')).toHaveCount(0, { timeout: 15000 });
    await expect(vision).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  console.log('Ginna: olhos e tentáculos com volume em desktop/celular, sem erros WebGL.');
} catch (error) {
  await page.screenshot({ path: 'test-results/ginna-visuals-failure.png' });
  if (errors.length) console.error(errors.join('\n'));
  throw error;
} finally {
  await browser.close();
  await server.close();
}
