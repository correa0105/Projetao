import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// The real Stable mounts its own lazy vision, entry and return. No private API or database.
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/ginna-entry.html',
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><div id="preview"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {Stable} from '/src/Stable.tsx';import {SiteMusicProvider} from '/src/SiteMusic.tsx';
import {PageHeader} from '/src/PageHeader.tsx';import {Navigation} from '/src/Navigation.tsx';import {FlashMessages} from '/src/FlashMessage.tsx';
import '/src/styles.css';import '/src/alvorada.css';import '/src/journey.css';import '/src/theme.css';
import '/src/page-header.css';import '/src/npc-speech.css';
const character={id:'entry-test',name:'Arden',gold_cp:100000};
function Preview(){const [route,setRoute]=React.useState(location.hash.slice(1)||'stable');
React.useEffect(()=>{const change=()=>setRoute(location.hash.slice(1)||'stable');addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change)},[]);
window.entryFixture={navigate:(page)=>{location.hash=page},purchased:0};
return React.createElement('div',{className:'app-shell','data-page':route},React.createElement('main',{className:'main-shell'},
React.createElement(PageHeader,{title:route==='stable'?'Estábulo':'Mundo'}),React.createElement('div',{className:'main-content'},
route==='stable'?React.createElement(Stable,{character,onPurchased:async()=>{window.entryFixture.purchased++}}):
React.createElement('section',{'aria-label':'Destino da navegação'},React.createElement('button',{autoFocus:true},'Continuar no mundo')))),
React.createElement(Navigation,{page:route,go:(page)=>{location.hash=page}}),
React.createElement('button',{'data-day-nav':true,onClick:()=>{location.hash='world'},style:{position:'fixed',top:'18px',right:'18px',width:'100px',height:'34px',zIndex:2147483647,background:'#ff00ff',border:0}},'HUD diurno'));}
createRoot(document.getElementById('preview')).render(React.createElement(React.StrictMode,null,
React.createElement(SiteMusicProvider,null,React.createElement(Preview)),React.createElement(FlashMessages)));
</script></body></html>`,
);
const port = Number(process.env.GINNA_ENTRY_TEST_PORT || 3040);
const server = await createServer({ server: { port, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const reports = [];
const errors = [];
const url = `http://localhost:${port}/test-results/ginna-entry.html#stable`;

async function fresh({
  reducedMotion = 'no-preference',
  viewport = { width: 1440, height: 900 },
  holdVisionImage = false,
} = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const page = await context.newPage();
  let releaseImage;
  const imageReady = new Promise((resolve) => {
    releaseImage = resolve;
  });
  if (holdVisionImage)
    await page.route('**/stable/ginna-shadow.webp', async (route) => {
      await imageReady;
      await route.continue().catch(() => {});
    });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.stable-page')).toBeVisible();
  await expect(page.locator('.stable-keeper-trigger img')).toHaveAttribute(
    'src',
    '/stable/ginna.webp',
  );
  return { page, context, releaseImage };
}
async function prepareEntry(page) {
  const keeper = page.locator('.stable-keeper .stable-keeper-trigger');
  await keeper.click();
  const warning = page.locator('.stable-field [data-ginna-question="warning"]');
  for (let index = 0; index < 4; index++) {
    await warning.click();
    await expect(page.locator('.ginna-vision')).toHaveCount(0);
    await expect(page.locator('.ginna-entry')).toHaveCount(0);
  }
  await expect(warning).toHaveText('E se ninguém ficar sabendo?');
  await page.evaluate(() => {
    const samples = [];
    let stopped = false;
    const read = () => {
      const entry = document.querySelector('.ginna-entry');
      const vision = document.querySelector('.ginna-vision');
      const fog = entry?.querySelector('.ginna-reality-fog');
      const ctx = fog?.getContext('2d');
      const coverage =
        ctx && fog.width
          ? [
              [0, 0],
              [0.5, 0.5],
              [0.99, 0.99],
            ].map(([x, y]) => [
              ...ctx.getImageData(Math.floor(x * fog.width), Math.floor(y * fog.height), 1, 1).data,
            ])
          : [];
      samples.push({
        time: performance.now(),
        phase: entry?.dataset.phase || 'absent',
        motion: entry?.dataset.motion || null,
        entryOpen: Boolean(entry?.open),
        entryModal: Boolean(entry?.matches(':modal')),
        vision: Boolean(vision),
        visionOpen: Boolean(vision?.open),
        coverage,
        stage: fog?.dataset.stage || null,
        flakes: Number(fog?.dataset.flakes || 0),
        shards: entry?.querySelectorAll('.ginna-reality-piece').length || 0,
        active: document.activeElement?.className || document.activeElement?.tagName,
        width: innerWidth,
        height: innerHeight,
      });
    };
    const mutations = new MutationObserver(read);
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'data-phase', 'data-ginna-vision'],
    });
    const frame = () => {
      if (stopped) return;
      read();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.entrySamples = samples;
    window.stopEntrySamples = () => {
      stopped = true;
      mutations.disconnect();
    };
  });
  return warning;
}
async function clickMoving(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function magentaPixels(buffer) {
  const { data } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let index = 0; index < data.length; index += 3)
    if (data[index] > 240 && data[index + 1] < 20 && data[index + 2] > 240) count++;
  return count;
}
async function visionGeometry(page) {
  return page.evaluate(() => {
    const geometry = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        offsetLeft: element.offsetLeft,
        offsetTop: element.offsetTop,
        left: style.left,
        top: style.top,
        transform: style.transform,
        inlineLeft: element.style.left,
        inlineTop: element.style.top,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      };
    };
    return {
      window: { x: scrollX, y: scrollY, width: innerWidth, height: innerHeight },
      active: document.activeElement?.outerHTML.slice(0, 400),
      dialog: geometry('.ginna-vision'),
      scene: geometry('.ginna-nightmare-scene'),
      keeper: geometry('.ginna-vision-keeper'),
      trigger: geometry('.ginna-vision .stable-keeper-trigger'),
      portrait: geometry('.ginna-vision-figure'),
      balloon: geometry('.ginna-vision .ginna-balloon'),
      response: geometry('.ginna-vision .ginna-questions button'),
    };
  });
}
async function verifyReturn(page, label, motion) {
  const vision = page.locator('.ginna-vision');
  await clickMoving(
    page,
    vision.getByRole('button', { name: 'Conversar com a cuidadora na visão' }),
  );
  const promise = vision.getByRole('button', { name: 'Não vou machucá-los!', exact: true });
  await expect(promise).toBeVisible();
  await clickMoving(page, promise);
  const recovery = page.locator('.ginna-return');
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute('data-motion', motion);
  await expect(vision).toHaveAttribute('data-returning', 'true');
  await expect(vision.locator('.ginna-balloon-copy')).toHaveText(
    'Melhor assim. Estarei de olho em você.',
  );
  await expect(page.locator('.ginna-entry')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(recovery).toBeVisible();
  await expect(recovery.locator('.ginna-return-tentacles')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  await expect(recovery).toHaveCount(0, { timeout: 15000 });
  await expect(vision).toHaveCount(0);
  await expect(page.locator('.stable-keeper .stable-keeper-trigger')).toBeFocused();
  await expect(page.locator('.stable-keeper-trigger img')).toHaveAttribute(
    'src',
    '/stable/ginna.webp',
  );
  await expect(page.locator('.stable-field > .ginna-balloon')).toContainText(
    'Melhor assim. Estarei de olho em você.',
  );
  await page.screenshot({ path: `test-results/ginna-entry-return-${label}.png` });
}

try {
  for (const { label, viewport, reducedMotion, motion } of [
    {
      label: 'desktop',
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
      motion: 'full',
    },
    {
      label: 'mobile',
      viewport: { width: 390, height: 844 },
      reducedMotion: 'no-preference',
      motion: 'full',
    },
    {
      label: 'mobile-reduced',
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      motion: 'reduced',
    },
  ]) {
    const { page, context, releaseImage } = await fresh({
      viewport,
      reducedMotion,
      holdVisionImage: true,
    });
    const warning = await prepareEntry(page);
    expect(await magentaPixels(await page.screenshot())).toBeGreaterThan(1000);
    const buyBounds = await page
      .getByRole('button', { name: 'Comprar conjunto', exact: true })
      .boundingBox();
    await warning.click();
    const entry = page.locator('.ginna-entry');
    await expect(entry).toHaveAttribute('data-motion', motion);
    await expect(entry).toHaveAttribute('data-phase', 'closing');
    await expect(page.locator('.ginna-vision')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(entry).toBeVisible();
    await page.mouse.click(buyBounds.x + buyBounds.width / 2, buyBounds.y + buyBounds.height / 2);
    expect(await page.evaluate(() => window.entryFixture.purchased)).toBe(0);
    await expect(page.getByRole('dialog', { name: /Confirmar compra/ })).toHaveCount(0);
    await entry.evaluate((element) => {
      window.entryCleanup = { element, animations: element.getAnimations({ subtree: true }) };
    });
    if (motion === 'full')
      await page.screenshot({ path: `test-results/ginna-entry-closing-${label}.png` });
    if (motion === 'full') {
      await expect(entry.locator('.ginna-reality-snapshot')).toHaveCount(0);
      await expect(entry.locator('.ginna-reality-fog')).toHaveAttribute('data-stage', 'branches');
      await page.screenshot({ path: `test-results/ginna-entry-branches-${label}.png` });
      await expect(entry.locator('.ginna-reality-fog')).toHaveAttribute('data-stage', 'flakes');
      await page.screenshot({ path: `test-results/ginna-entry-shattering-${label}.png` });
    }
    await page.waitForFunction(
      () => document.querySelector('.ginna-entry')?.dataset.phase === 'closed',
    );
    const closed = await page.screenshot({ path: `test-results/ginna-entry-closed-${label}.png` });
    const colors = await sharp(closed).removeAlpha().stats();
    expect(colors.channels.every((channel) => channel.max < 3)).toBe(true);
    await expect(page.locator('.ginna-vision')).toHaveAttribute('data-entering', 'true');
    expect(
      await page
        .locator('.ginna-vision')
        .evaluate((element) => element.open && element.matches(':modal')),
    ).toBe(true);
    expect(
      await entry.evaluate(
        (element) =>
          element.matches(':modal') &&
          document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.ginna-entry') ===
            element,
      ),
    ).toBe(true);
    // The dark portrait is deliberately delayed: opening must wait for its actual decode.
    await expect(entry).toHaveAttribute('data-phase', 'closed');
    await page.mouse.click(viewport.width - 40, 35);
    expect(new URL(page.url()).hash).toBe('#stable');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ginna-vision .ginna-questions button')).toHaveCount(0);
    releaseImage();
    await page.waitForFunction(
      () => document.querySelector('.ginna-entry')?.dataset.phase === 'opening',
    );
    await expect(page.locator('.ginna-vision')).toBeVisible();
    if (motion === 'full') await page.waitForTimeout(430);
    const opening = await page.screenshot({
      path: `test-results/ginna-entry-opening-${label}.png`,
    });
    expect(await magentaPixels(opening)).toBe(0);
    await expect(entry).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.ginna-vision')).toBeVisible();
    await expect(page.locator('.ginna-vision [data-ginna-music]')).toHaveCount(1);
    await expect(page.locator('.ginna-vision .ginna-earth-eye')).toHaveCount(23);
    expect(
      await page.evaluate(() =>
        document.querySelector('.ginna-vision').contains(document.activeElement),
      ),
    ).toBe(true);
    const samples = await page.evaluate(() => {
      window.stopEntrySamples();
      return window.entrySamples;
    });
    const firstVision = samples.findIndex((sample) => sample.vision);
    expect(firstVision).toBeGreaterThan(0);
    expect(samples[firstVision].phase).toBe('closed');
    expect(samples.some((sample) => sample.phase === 'closing' && !sample.vision)).toBe(true);
    expect(samples.some((sample) => sample.phase === 'opening' && sample.vision)).toBe(true);
    expect(
      samples.filter((sample) => sample.phase === 'closing').every((sample) => !sample.vision),
    ).toBe(true);
    const covered = samples[firstVision];
    expect(covered.coverage).toHaveLength(3);
    expect(covered.coverage.every((pixel) => pixel.join(',') === '0,0,0,255')).toBe(true);
    expect(covered.shards).toBe(0);
    if (motion === 'full') {
      expect(covered.stage).toBe('covered');
      expect(covered.flakes).toBe(0);
      for (const stage of ['fissure', 'branches', 'flakes', 'mist'])
        expect(samples.some((sample) => sample.stage === stage && !sample.vision)).toBe(true);
      const early = samples.filter((sample) => sample.stage === 'branches');
      expect(early.length).toBeGreaterThan(0);
      expect(
        early.every((sample) => sample.coverage[0][3] === 0 && sample.coverage[2][3] === 0),
      ).toBe(true);
      expect(samples.some((sample) => sample.flakes > 0)).toBe(true);
    }
    expect(
      await page.evaluate(
        () =>
          !window.entryCleanup.element.isConnected &&
          !window.entryCleanup.element.open &&
          window.entryCleanup.animations.every((animation) => animation.playState === 'idle'),
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/ginna-entry-open-${label}.png` });
    await verifyReturn(page, label, motion);
    reports.push({
      label,
      motion,
      samples,
      blackFrame: colors.channels.map((channel) => channel.max),
      openingDayHudPixels: await magentaPixels(opening),
      returnPreserved: true,
    });
    console.log(
      `${label}: central fissure, branches and flakes; scene swap fully covered, input blocked, focus restored and cleanup verified.`,
    );
    if (label === 'desktop') {
      // Native click/focus on the second entry must not scroll the oversized nightmare scene.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const secondWarning = await prepareEntry(page);
      await secondWarning.click();
      await expect(page.locator('.ginna-vision')).toBeVisible();
      await expect(page.locator('.ginna-entry')).toHaveCount(0);
      const beforeClick = await visionGeometry(page);
      await page
        .locator('.ginna-vision')
        .getByRole('button', { name: 'Conversar com a cuidadora na visão' })
        .click();
      await expect(
        page.getByRole('button', { name: 'Não vou machucá-los!', exact: true }),
      ).toBeVisible();
      const afterClick = await visionGeometry(page);
      await page.locator('.ginna-vision').evaluate((element) => {
        element.scrollLeft = 230;
        element.scrollTop = 120;
        element.scrollTo(350, 160);
      });
      const afterScrollAttempt = await visionGeometry(page);
      const diagnostic = {
        label: 'desktop-return-resize-mobile-second-entry',
        beforeClick,
        afterClick,
        afterScrollAttempt,
      };
      await writeFile(
        'test-results/ginna-entry-resize-diagnostic.json',
        JSON.stringify(diagnostic, null, 2),
      );
      await page.screenshot({ path: 'test-results/ginna-entry-resize-mobile-response.png' });
      console.log(
        JSON.stringify({
          label: diagnostic.label,
          balloon: {
            x: afterClick.balloon.x,
            right: afterClick.balloon.x + afterClick.balloon.width,
          },
          scrollAfterFocus: { x: afterClick.dialog.scrollLeft, y: afterClick.dialog.scrollTop },
          scrollAfterAttempt: {
            x: afterScrollAttempt.dialog.scrollLeft,
            y: afterScrollAttempt.dialog.scrollTop,
          },
        }),
      );
      expect(afterClick.balloon.x).toBeGreaterThanOrEqual(6);
      expect(afterClick.balloon.x + afterClick.balloon.width).toBeLessThanOrEqual(390);
      expect(afterClick.dialog.scrollLeft).toBe(0);
      expect(afterClick.dialog.scrollTop).toBe(0);
      expect(afterScrollAttempt.dialog.scrollLeft).toBe(0);
      expect(afterScrollAttempt.dialog.scrollTop).toBe(0);
      expect(afterScrollAttempt.scene.x).toBe(afterClick.scene.x);
      expect(afterScrollAttempt.scene.y).toBe(afterClick.scene.y);
      expect(afterScrollAttempt.balloon.x).toBe(afterClick.balloon.x);
      expect(afterScrollAttempt.balloon.y).toBe(afterClick.balloon.y);
      await page.evaluate(() => window.stopEntrySamples());
      await verifyReturn(page, 'desktop-to-mobile-second-entry', 'reduced');
      reports.push({ ...diagnostic, returnPreserved: true });
    }
    await context.close();
  }

  // Leaving mid-close must cancel the component, animations and callbacks rather than reopening it later.
  const { page, context } = await fresh();
  const warning = await prepareEntry(page);
  await warning.click();
  await expect(page.locator('.ginna-entry')).toHaveAttribute('data-phase', 'closing');
  await page.locator('.ginna-entry').evaluate((element) => {
    window.cancelledEntry = { element, animations: element.getAnimations({ subtree: true }) };
  });
  await page.evaluate(() => window.entryFixture.navigate('world'));
  await expect(page.getByRole('region', { name: 'Destino da navegação' })).toBeVisible();
  await expect(page.locator('.stable-page,.ginna-entry,.ginna-vision,.ginna-return')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Continuar no mundo' }).click();
  await expect(page.getByRole('button', { name: 'Continuar no mundo' })).toBeFocused();
  await page.waitForTimeout(4200);
  await expect(page.locator('.ginna-entry,.ginna-vision,.ginna-return')).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        !window.cancelledEntry.element.isConnected &&
        !window.cancelledEntry.element.open &&
        window.cancelledEntry.animations.every((animation) => animation.playState === 'idle'),
    ),
  ).toBe(true);
  await page.evaluate(() => window.stopEntrySamples());
  await page.evaluate(() => window.entryFixture.navigate('stable'));
  await expect(page.locator('.stable-keeper-trigger img')).toHaveAttribute(
    'src',
    '/stable/ginna.webp',
  );
  await page.locator('.stable-keeper .stable-keeper-trigger').click();
  await expect(page.locator('[data-ginna-question="warning"]')).toHaveText(
    'E se eu fizer mal a ele?',
  );
  await expect(page.locator('.ginna-entry,.ginna-vision')).toHaveCount(0);
  reports.push({ label: 'navigate-during-closing', cancelled: true, remountFresh: true });
  await context.close();
  expect(errors).toEqual([]);
  await writeFile('test-results/ginna-entry-report.json', JSON.stringify(reports, null, 2));
  console.log(
    'PASS: fractured reality and dark mist full/reduced, covered scene swap, modal input, focus, cancellation/navigation and existing tentacle return.',
  );
} finally {
  await browser.close();
  await server.close();
}
