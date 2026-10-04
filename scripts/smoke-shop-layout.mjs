import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Real components and catalog, with no account or database required.
const source = JSON.parse(await readFile('data/shop-export/loja.json', 'utf8'));
const equipment = JSON.parse(await readFile('data/equipment-catalog.json', 'utf8'));
const catalog = [...source.items, ...equipment.filter((item) => item.active)].map((item) => ({
  ...item,
  original_name: item.original_name || item.name,
  image_path: item.image_path || `/shop/items/${item.id}.png`,
}));
expect(catalog).toHaveLength(71);
expect(new Set(catalog.map((item) => item.id)).size).toBe(71);
const names = new Map(catalog.map((item) => [item.id, item.name]));
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/shop-layout.html',
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--page-header-edge:40px;--page-header-top:24px;}</style></head><body><div id="preview"></div>
<script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {Shop} from '/src/Shop.tsx';import {SiteMusicProvider} from '/src/SiteMusic.tsx';
import {FlashMessages} from '/src/FlashMessage.tsx';
import '/src/styles.css';import '/src/alvorada.css';import '/src/journey.css';import '/src/theme.css';
import '/src/page-header.css';import '/src/npc-speech.css';
const catalog=${JSON.stringify(catalog)};
const character={id:'layout-test',name:'Arden',gold_cp:100000000};
function Preview(){return React.createElement('div',{className:'app-shell','data-page':'shop'},
React.createElement('main',{className:'main-shell'},React.createElement('div',{className:'main-content'},
React.createElement(Shop,{catalog,character,onPurchased:async()=>{}}))));}
createRoot(document.getElementById('preview')).render(React.createElement(React.Fragment,null,
React.createElement(SiteMusicProvider,null,React.createElement(Preview)),React.createElement(FlashMessages)));
</script></body></html>`,
);
const port = Number(process.env.SHOP_LAYOUT_TEST_PORT || 3038);
const server = await createServer({ server: { port, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const errors = [];
const reports = [];
const url = `http://localhost:${port}/test-results/shop-layout.html`;
const token = (page, id) => page.locator(`.shop-table-token[data-item-id="${id}"]`);
const button = (page, id) =>
  token(page, id).getByRole('button', { name: new RegExp(' na mesa, ') });
async function drop(page, id, x = 0.5, y = 0.5) {
  await page.evaluate(
    ({ id, x, y }) => {
      const surface = document.querySelector('.shop-table-surface');
      const bounds = surface.getBoundingClientRect();
      const transfer = new DataTransfer();
      transfer.setData('application/x-alvorada-shop', id);
      surface.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: bounds.left + bounds.width * x,
          clientY: bounds.top + bounds.height * y,
        }),
      );
    },
    { id, x, y },
  );
}
async function locate(page, id) {
  await page.getByRole('button', { name: /Abrir carrinho:/ }).click();
  await page
    .getByRole('button', { name: `Localizar ${names.get(id)} no balcão`, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(token(page, id)).toHaveClass(/selected/);
  await expect(button(page, id)).toBeFocused();
  await button(page, id).scrollIntoViewIfNeeded();
}
async function geometry(page) {
  return page.evaluate(() => {
    const table = document.querySelector('.shop-table-surface').getBoundingClientRect();
    const entries = [...document.querySelectorAll('.shop-table-token')].map((element) => {
      const hit = element.getBoundingClientRect();
      const art = element.querySelector('img').getBoundingClientRect();
      return {
        id: element.dataset.itemId,
        scale: Number(element.dataset.scale),
        x: Number(element.dataset.x),
        y: Number(element.dataset.y),
        z: Number(element.style.zIndex),
        selected: element.classList.contains('selected'),
        cx: hit.x + hit.width / 2,
        cy: hit.y + hit.height / 2,
        hitWidth: hit.width,
        hitHeight: hit.height,
        artWidth: art.width,
        artHeight: art.height,
        inside:
          hit.left >= table.left - 1 &&
          hit.top >= table.top - 1 &&
          hit.right <= table.right + 1 &&
          hit.bottom <= table.bottom + 1,
      };
    });
    return { table: { x: table.x, y: table.y, width: table.width, height: table.height }, entries };
  });
}
async function topItem(page, id) {
  await expect
    .poll(async () =>
      page.evaluate((id) => {
        const element = document.querySelector(`.shop-table-token[data-item-id="${id}"]`);
        const box = element.getBoundingClientRect();
        return document
          .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          ?.closest('.shop-table-token')?.dataset.itemId;
      }, id),
    )
    .toBe(id);
}
async function dragTo(page, id, x, y) {
  const box = await button(page, id).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 14 });
  await page.mouse.up();
}

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('alvorada-music-muted', 'true');
      localStorage.setItem('alvorada-effects-muted', 'true');
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    const surface = page.locator('.shop-table-surface');
    await expect(surface).toBeVisible();

    // A sparse arrangement first makes the actual artwork proportions inspectable.
    const samples = [
      'ring-of-protection',
      'potion-of-healing',
      'dagger',
      'longsword',
      'greatsword',
      'staff-of-the-magi',
      'longbow',
    ];
    for (const [index, id] of samples.entries()) {
      await drop(page, id, 0.1 + index * 0.13, 0.5);
      await expect(page.locator('.shop-table-token')).toHaveCount(index + 1);
    }
    await surface.scrollIntoViewIfNeeded();
    const proportions = (await geometry(page)).entries;
    for (let index = 1; index < samples.length; index++) {
      const previous = proportions.find((entry) => entry.id === samples[index - 1]);
      const current = proportions.find((entry) => entry.id === samples[index]);
      expect(current.scale, `${samples[index]} scale`).toBeGreaterThan(previous.scale);
      expect(current.artWidth, `${samples[index]} visible art`).toBeGreaterThan(previous.artWidth);
    }
    expect(proportions.every((entry) => entry.hitWidth >= 47 && entry.hitHeight >= 47)).toBe(true);
    expect(proportions.every((entry) => entry.inside)).toBe(true);
    await page.screenshot({
      path: `test-results/shop-layout-sizes-${viewport.width}.png`,
      fullPage: true,
    });

    await page.reload();
    await expect(surface).toBeVisible();
    for (const [index, item] of catalog.entries()) {
      await drop(page, item.id);
      await expect(page.locator('.shop-table-token')).toHaveCount(index + 1);
    }
    await expect(page.getByText(/balcão está cheio/i)).toHaveCount(0);
    await surface.scrollIntoViewIfNeeded();
    const pile = await geometry(page);
    expect(pile.entries.map((entry) => entry.id).sort()).toEqual(
      catalog.map((item) => item.id).sort(),
    );
    expect(pile.entries.every((entry) => entry.inside)).toBe(true);
    const common = pile.entries[0];
    expect(
      Math.max(
        ...pile.entries.map((entry) => Math.hypot(entry.cx - common.cx, entry.cy - common.cy)),
      ),
    ).toBeLessThan(2);
    await page.screenshot({
      path: `test-results/shop-layout-overlap-${viewport.width}.png`,
      fullPage: true,
    });

    // Covered objects remain accessible in the cart, then become the real top hit target.
    const earlierZ = pile.entries.find((entry) => entry.id === 'dagger').z;
    await locate(page, 'dagger');
    await topItem(page, 'dagger');
    const selected = (await geometry(page)).entries.find((entry) => entry.id === 'dagger');
    expect(selected.z).toBeGreaterThan(earlierZ);
    const beforeArrow = selected.x;
    await button(page, 'dagger').press('ArrowRight');
    await expect
      .poll(async () => Number(await token(page, 'dagger').getAttribute('data-x')))
      .toBeGreaterThan(beforeArrow);
    await expect(page.locator('.shop-table-token')).toHaveCount(71);

    // Focus and pointer dragging can both recover and move a token through the pile.
    await button(page, 'longsword').focus();
    await expect(token(page, 'longsword')).toHaveClass(/selected/);
    await topItem(page, 'longsword');
    const desk = await surface.boundingBox();
    await dragTo(page, 'longsword', desk.x + desk.width * 0.5, desk.y + desk.height * 0.5);
    await topItem(page, 'longsword');
    await expect(page.locator('.shop-table-token')).toHaveCount(71);

    // Release immediately after one pointer move: the ensuing click must retain that position.
    const quickStart = await button(page, 'longsword').boundingBox();
    const quickTarget = { x: desk.x + desk.width * 0.65, y: desk.y + desk.height * 0.6 };
    await page.mouse.move(
      quickStart.x + quickStart.width / 2,
      quickStart.y + quickStart.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(quickTarget.x, quickTarget.y);
    await page.mouse.up();
    const quickRelease = (await geometry(page)).entries.find((entry) => entry.id === 'longsword');
    expect(quickRelease.x).toBeCloseTo(
      (quickTarget.x - desk.x - quickRelease.hitWidth / 2) / (desk.width - quickRelease.hitWidth),
      3,
    );
    expect(quickRelease.y).toBeCloseTo(
      (quickTarget.y - desk.y - quickRelease.hitHeight / 2) /
        (desk.height - quickRelease.hitHeight),
      3,
    );

    // Pointer travel beyond the surface and repeated keys clamp to the table edges.
    await dragTo(page, 'longsword', Math.max(1, desk.x - 100), Math.max(1, desk.y - 100));
    let clamped = (await geometry(page)).entries.find((entry) => entry.id === 'longsword');
    expect(clamped.inside).toBe(true);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
    for (let n = 0; n < 42; n++) await button(page, 'longsword').press('ArrowRight');
    for (let n = 0; n < 15; n++) await button(page, 'longsword').press('ArrowDown');
    clamped = (await geometry(page)).entries.find((entry) => entry.id === 'longsword');
    expect(clamped.x).toBe(1);
    expect(clamped.y).toBe(1);
    expect(clamped.inside).toBe(true);

    let offCenterDrag = null;
    if (viewport.width > 1100) {
      await button(page, 'longbow').focus();
      await topItem(page, 'longbow');
      const before = await token(page, 'longbow').boundingBox();
      // Grabbing the corner must preserve that grip rather than snapping its center to the pointer.
      await page.mouse.move(before.x + 10, before.y + 10);
      await page.mouse.down();
      await page.mouse.move(before.x + 18, before.y + 18);
      await page.mouse.up();
      const after = await token(page, 'longbow').boundingBox();
      expect(after.x - before.x).toBeCloseTo(8, 0);
      expect(after.y - before.y).toBeCloseTo(8, 0);
      offCenterDrag = { x: after.x - before.x, y: after.y - before.y };
    }

    await page.getByRole('button', { name: /Abrir carrinho:/ }).click();
    await expect(page.getByRole('spinbutton')).toHaveCount(71);
    await expect(page.getByRole('button', { name: /Finalizar compra/ })).toBeDisabled();
    await page
      .getByRole('spinbutton', { name: `Quantidade de ${names.get('dagger')}`, exact: true })
      .fill('99');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await drop(page, 'dagger');
    await expect(button(page, 'dagger')).toHaveAttribute(
      'aria-label',
      `${names.get('dagger')} na mesa, 99 unidades`,
    );
    await expect(page.locator('.shop-table-token')).toHaveCount(71);
    await page.getByRole('button', { name: /Abrir carrinho:/ }).click();
    await page
      .getByRole('button', { name: `Remover ${names.get('dragon-orb')} do carrinho`, exact: true })
      .click();
    await expect(page.getByRole('spinbutton')).toHaveCount(70);
    await expect(page.getByRole('button', { name: /Finalizar compra/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    reports.push({
      viewport,
      count: pile.entries.length,
      commonCenter: { x: common.cx, y: common.cy },
      proportions,
      selectedZ: selected.z,
      quickRelease,
      clamped,
      offCenterDrag,
      cartAfterUnpricedRemoval: 70,
    });
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile('test-results/shop-layout-report.json', JSON.stringify(reports, null, 2));
  console.log(
    'PASS: 71 overlapping items, recoverable layers, pointer/keyboard clamp, visible artwork proportions, quantity 99 and unpriced-item guard at 1440 and 390 px.',
  );
} finally {
  await browser.close();
  await server.close();
}
