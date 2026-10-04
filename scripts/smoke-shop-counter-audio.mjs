import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('data/shop-export/loja.json', 'utf8'));
const equipment = JSON.parse(await readFile('data/equipment-catalog.json', 'utf8'));
const audioManifest = JSON.parse(await readFile('public/audio/shop-counter-manifest.json', 'utf8'));
// Mirror the active seed, including the six extensions and the plate bundle.
const catalog = [...source.items, ...equipment.filter((item) => item.active)].map((item) => ({
  ...item,
  original_name: item.original_name || item.name,
  weight_lb: String(item.id === 'plate-armor' ? 27 : item.weight_lb),
  image_path: item.image_path || `/shop/items/${item.id}.png`,
}));
// The expected contact materials follow the objects depicted in the catalog art.
// Mixed kits use the container touching the tabletop, not their individual contents.
const materialItems = {
  wood: [
    'shortbow',
    'longbow',
    'bucket',
    'chest',
    'quarterstaff',
    'staff-of-the-magi',
    'torch',
    'basket',
  ],
  liquid: [
    'antitoxin',
    'alchemists-fire',
    'acid',
    'oil',
    'potion-of-growth',
    'potion-of-healing',
    'potion-of-climbing',
    'potion-of-heroism',
    'potion-of-flying',
  ],
  waterskin: ['waterskin'],
  metal: [
    'dagger',
    'immovable-rod',
    'hunting-trap',
    'plate-armor',
    'lock',
    'tinderbox',
    'shield',
    'greatsword',
    'longsword',
    'grappling-hook',
    'hooded-lantern',
    'shovel',
    'crowbar',
    'breastplate',
    'rapier',
    'ring-of-invisibility',
    'ring-of-protection',
    'ring-of-regeneration',
    'cosmetic-necklace',
    'cosmetic-tiara',
    'bell',
    'caltrops',
  ],
  chain: ['manacles', 'chain', 'chain-mail'],
  spheres: ['ball-bearings'],
  glass: ['glass-bottle', 'goggles-of-night', 'crystal-ball', 'dragon-orb'],
  paper: ['book', 'spell-scroll-cantrip', 'cigar'],
  leather: [
    'leather-armor',
    'component-pouch',
    'bag-of-holding',
    'boots-of-elvenkind',
    'studded-leather',
    'healers-kit',
    'climbers-kit',
    'backpack',
    'slippers-of-spider-climbing',
    'cosmetic-gloves',
    'cosmetic-boots',
  ],
  cloth: [
    'tent',
    'blanket',
    'hempen-rope-50-feet',
    'cloak-of-displacement',
    'cloak-of-protection',
    'rations',
    'bedroll',
    'cosmetic-cape',
    'candle',
  ],
};
const expectedMaterials = new Map(
  Object.entries(materialItems).flatMap(([kind, ids]) => ids.map((id) => [id, kind])),
);
// Similar magical and cosmetic objects retain their own subject, not one shared sales line.
const individualTopics = {
  'bag-of-holding': /bolsa.*tamanho/i,
  'spell-scroll-cantrip': /truque.*pergaminho/i,
  'potion-of-climbing': /[Ee]scalada.*engarrafada/,
  'potion-of-flying': /[Vv]oo.*frasco/,
  'cloak-of-protection': /proteção.*encanto/i,
  'crystal-ball': /vidência/i,
  'ring-of-protection': /proteção.*enfeite/i,
  'ring-of-regeneration': /regeneração.*anel/i,
  'ring-of-invisibility': /esconder.*olhos/i,
  'staff-of-the-magi': /cajado.*conjurador/i,
  'cosmetic-cape': /capa.*não tem encantamento/i,
  'cosmetic-necklace': /prata.*gema azul/i,
  'cosmetic-tiara': /gema azul.*tiara/i,
  'cosmetic-gloves': /luvas.*couro castanho/i,
  'cosmetic-boots': /botas.*sem o encanto das élficas/i,
  cigar: /enrolado à mão.*taverna/i,
};
expect(catalog).toHaveLength(71);
expect(new Set(catalog.map((item) => item.id)).size).toBe(71);
expect([...expectedMaterials.keys()].sort()).toEqual(catalog.map((item) => item.id).sort());
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/shop-counter-audio.html',
  `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--page-header-edge:40px;--page-header-top:24px;}</style></head>
<body><div id="preview"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {Shop} from '/src/Shop.tsx';
import {SiteMusicProvider,useMusicInterlude,useSoundEffects} from '/src/SiteMusic.tsx';
import {FlashMessages} from '/src/FlashMessage.tsx';
import '/src/styles.css';import '/src/alvorada.css';import '/src/journey.css';import '/src/theme.css';
import '/src/page-header.css';import '/src/npc-speech.css';
const catalog=${JSON.stringify(catalog)};
const character={id:'sound-test',name:'Arden',gold_cp:10000000};
function Preview(){const [active,setActive]=React.useState(true);const {setVolume,toggle}=useSoundEffects();const music=useMusicInterlude();
window.counterControls={setVolume,toggle,setMusicVolume:music.setVolume,toggleMusic:music.toggle,remove:()=>setActive(false)};
return React.createElement('div',{className:'app-shell','data-page':'shop'},
React.createElement('main',{className:'main-shell'},React.createElement('div',{className:'main-content'},
active&&React.createElement(Shop,{catalog,character,onPurchased:async()=>{}}))));}
createRoot(document.getElementById('preview')).render(React.createElement(React.Fragment,null,
React.createElement(SiteMusicProvider,null,React.createElement(Preview)),React.createElement(FlashMessages)));
</script></body></html>`,
);
const port = Number(process.env.SHOP_COUNTER_TEST_PORT || 3035);
const server = await createServer({ server: { port, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const errors = [];
const reports = [];
async function fresh({
  muted = false,
  volume = 0.65,
  viewport = { width: 1440, height: 900 },
  deferAudio = false,
  audioUnavailable = false,
  failedAudioKind = null,
} = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ({ muted, volume, audioUnavailable, audioFiles }) => {
      localStorage.setItem('alvorada-effects-muted', String(muted));
      localStorage.setItem('alvorada-effects-volume', String(volume));
      localStorage.setItem('alvorada-music-muted', 'false');
      localStorage.setItem('alvorada-music-volume', '0.4');
      window.counterTrace = [];
      window.counterContexts = [];
      if (audioUnavailable) {
        window.AudioContext = class {
          constructor() {
            throw new Error('Dispositivo de áudio indisponível no teste.');
          }
        };
        return;
      }
      const Native = window.AudioContext;
      const connected = new WeakMap();
      const bufferFiles = new WeakMap();
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...args) {
        connected.set(this, destination);
        return connect.call(this, destination, ...args);
      };
      window.AudioContext = class extends Native {
        constructor(options) {
          super(options);
          this.voices = new Set();
          this.gains = [];
          window.counterContexts.push(this);
          window.counterTrace.push({
            event: 'context',
            gesture: navigator.userActivation.hasBeenActive,
          });
        }
        async decodeAudioData(bytes) {
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice(0))),
          )
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
          const buffer = await super.decodeAudioData(bytes);
          bufferFiles.set(buffer, audioFiles[hash]);
          return buffer;
        }
        createGain() {
          const gain = super.createGain();
          this.gains.push(gain);
          return gain;
        }
        createBufferSource() {
          const source = super.createBufferSource(),
            start = source.start.bind(source),
            stop = source.stop.bind(source);
          source.start = (...args) => {
            const filter = connected.get(source),
              gain = connected.get(filter),
              master = connected.get(gain);
            this.voices.add(source);
            window.counterTrace.push({
              event: 'start',
              file: bufferFiles.get(source.buffer),
              duration: source.buffer?.duration,
              pitch: source.playbackRate.value,
              gain: gain?.gain.value,
              volume: master?.gain.value,
              gesture: navigator.userActivation.hasBeenActive,
            });
            start(...args);
          };
          source.stop = (...args) => {
            this.voices.delete(source);
            window.counterTrace.push({ event: 'stop' });
            stop(...args);
          };
          source.addEventListener('ended', () => this.voices.delete(source));
          return source;
        }
      };
    },
    {
      muted,
      volume,
      audioUnavailable,
      audioFiles: Object.fromEntries(
        Object.values(audioManifest.files).map((file) => [file.sha256, file.file]),
      ),
    },
  );
  const page = await context.newPage();
  let failedAudioRequests = 0;
  const failedAudioPath = failedAudioKind ? `/audio/shop-counter-${failedAudioKind}.wav` : null;
  if (failedAudioPath)
    await page.route(`**${failedAudioPath}`, async (route) => {
      failedAudioRequests++;
      await route.fulfill({
        status: 503,
        contentType: 'text/plain',
        body: 'Falha isolada no teste.',
      });
    });
  let releaseAudio;
  const audioGate = new Promise((resolve) => {
    releaseAudio = resolve;
  });
  if (deferAudio)
    await page.route('**/audio/shop-counter-*.wav', async (route) => {
      await audioGate;
      await route.continue().catch(() => {});
    });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      /shop-counter-.*\.wav/.test(response.url()) &&
      response.status() !== 200 &&
      !response.url().endsWith(failedAudioPath || '\u0000')
    )
      errors.push(response.url());
  });
  await page.goto(`http://localhost:${port}/test-results/shop-counter-audio.html`);
  await expect(page.locator('.shop-scene')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.counterControls)).toBe(true);
  return { page, context, releaseAudio, failedAudioRequests: () => failedAudioRequests };
}
const root = (page) => page.locator('.shop-scene');
const starts = (page) =>
  page.evaluate(() => window.counterTrace.filter((event) => event.event === 'start'));
async function buy(page, itemId) {
  const item = catalog.find((item) => item.id === itemId);
  await page.getByRole('textbox', { name: 'Procurar item' }).fill(item.name);
  await page
    .locator('.shop-product')
    .filter({ has: page.getByRole('heading', { name: item.name, exact: true }) })
    .locator('footer button')
    .click();
}
async function count(page, amount) {
  await expect(root(page)).toHaveAttribute('data-counter-audio-count', String(amount));
}
async function silent(page, action) {
  const before = (await starts(page)).length;
  await action();
  await page.waitForTimeout(100);
  expect((await starts(page)).length).toBe(before);
}
try {
  {
    const { page, context } = await fresh({ muted: true });
    const comments = [];
    for (const item of catalog) {
      await page.getByRole('textbox', { name: 'Procurar item' }).fill(item.name);
      await page.getByRole('button', { name: `Examinar ${item.name}`, exact: true }).click();
      const speech = page.getByRole('status', { name: 'Comentário do vendedor' }).locator('span');
      await expect(speech).toBeVisible();
      const text = (await speech.innerText()).trim();
      expect(text.length, item.id).toBeGreaterThan(20);
      expect(text, item.id).not.toBe(`${item.name}. Examine à vontade antes de decidir.`);
      if (individualTopics[item.id]) expect(text, item.id).toMatch(individualTopics[item.id]);
      comments.push({ id: item.id, text });
    }
    expect(new Set(comments.map((comment) => comment.text)).size).toBe(71);
    await count(page, 0);
    expect((await starts(page)).length).toBe(0);
    await expect(page.locator('.shop-table-token')).toHaveCount(0);
    reports.push({ scenario: '71-individual-merchant-comments-examination-silent', comments });
    await context.close();
  }
  {
    const { page, context } = await fresh();
    const placements = [];
    expect(new Set(Object.keys(materialItems))).toEqual(new Set(Object.keys(audioManifest.files)));
    expect(new Set(Object.values(audioManifest.files).map((file) => file.file)).size).toBe(10);
    for (const [index, item] of catalog.entries()) {
      await buy(page, item.id);
      await count(page, index + 1);
      const kind = expectedMaterials.get(item.id);
      await expect(root(page)).toHaveAttribute('data-counter-audio-item', item.id);
      await expect(root(page)).toHaveAttribute('data-counter-audio-kind', kind);
      const trace = (await starts(page)).at(-1);
      expect(trace.file, item.id).toBe(audioManifest.files[kind].file);
      expect(trace.duration, item.id).toBeCloseTo(audioManifest.files[kind].duration, 2);
      expect(trace.gesture, item.id).toBe(true);
      placements.push({ id: item.id, kind, file: audioManifest.files[kind].file, ...trace });
      await page.getByRole('button', { name: `Remover ${item.name} da mesa`, exact: true }).click();
      await expect(page.locator('.shop-table-token')).toHaveCount(0);
      await count(page, index + 1);
    }
    expect((await starts(page)).length).toBe(71);
    reports.push({ scenario: '71-real-catalog-material-placements', placements });
    await context.close();
  }
  {
    const { page, context, failedAudioRequests } = await fresh({ failedAudioKind: 'chain' });
    await buy(page, 'chain');
    await expect(page.locator('.shop-table-token')).toHaveCount(1);
    await expect(root(page)).toHaveAttribute('data-counter-audio-state', 'unavailable');
    await count(page, 0);
    expect(failedAudioRequests()).toBeGreaterThan(0);
    for (const [index, id] of ['dagger', 'quarterstaff', 'potion-of-healing'].entries()) {
      await buy(page, id);
      await count(page, index + 1);
      await expect(root(page)).toHaveAttribute(
        'data-counter-audio-kind',
        expectedMaterials.get(id),
      );
    }
    await expect(page.locator('.shop-table-token')).toHaveCount(4);
    await page.getByRole('button', { name: /Abrir carrinho/ }).click();
    for (const id of ['chain', 'dagger', 'quarterstaff', 'potion-of-healing']) {
      const item = catalog.find((item) => item.id === id);
      await expect(
        page.getByRole('spinbutton', { name: `Quantidade de ${item.name}` }),
      ).toHaveValue('1');
    }
    await expect(page.getByRole('button', { name: /Finalizar compra/ })).toBeEnabled();
    reports.push({
      scenario: 'one-wave-unavailable-other-materials-and-cart-continue',
      failedAudioRequests: failedAudioRequests(),
      trace: await starts(page),
    });
    await context.close();
  }
  {
    const { page, context } = await fresh();
    expect(await page.evaluate(() => window.counterContexts.length)).toBe(0);
    await page.getByRole('textbox', { name: 'Procurar item' }).fill('Adaga');
    await silent(page, () =>
      page.getByRole('button', { name: 'Examinar Adaga', exact: true }).click(),
    );
    await buy(page, 'dagger');
    await count(page, 1);
    await expect(root(page)).toHaveAttribute('data-counter-audio-kind', 'metal');
    await buy(page, 'dagger');
    await count(page, 2);
    await expect(
      page.getByRole('button', { name: 'Adaga na mesa, 2 unidades', exact: true }),
    ).toBeVisible();
    await buy(page, 'plate-armor');
    await count(page, 3);
    await expect(root(page)).toHaveAttribute('data-counter-audio-kind', 'metal');
    await expect(root(page)).toHaveAttribute('data-counter-audio-weight', '65.000');
    const heavy = (await starts(page)).at(-1),
      light = (await starts(page))[0];
    expect(heavy.gain).toBeGreaterThan(light.gain);
    expect(heavy.pitch).toBeLessThan(light.pitch);
    await buy(page, 'potion-of-healing');
    await count(page, 4);
    expect((await starts(page)).at(-1).duration).toBeCloseTo(
      audioManifest.files.liquid.duration,
      2,
    );
    await expect(root(page)).toHaveAttribute('data-counter-audio-kind', 'liquid');
    // Keyboard activation adds the same item and produces one placement.
    await page.locator('.shop-product footer button').focus();
    await page.keyboard.press('Enter');
    await count(page, 5);
    await silent(page, () => page.getByRole('button', { name: /Poção de cura na mesa/ }).click());
    await page.getByRole('button', { name: /Abrir carrinho/ }).click();
    await page.getByRole('spinbutton', { name: 'Quantidade de Poção de cura' }).fill('99');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await silent(page, () => buy(page, 'potion-of-healing'));
    await expect(root(page)).toHaveAttribute('data-counter-audio-count', '5');
    reports.push({
      scenario: 'click,duplicate,heavy,liquid,keyboard,limit99',
      trace: await starts(page),
    });
    await page.screenshot({ path: 'test-results/shop-counter-audio-desktop.png', fullPage: true });
    await context.close();
  }
  {
    const { page, context } = await fresh();
    await page.getByRole('textbox', { name: 'Procurar item' }).fill('Adaga');
    await page
      .getByRole('button', { name: 'Examinar Adaga', exact: true })
      .dragTo(page.locator('.shop-table-surface'));
    await count(page, 1);
    const token = page.getByRole('button', { name: 'Adaga na mesa, 1 unidades', exact: true });
    await silent(page, () => token.click());
    const box = await token.boundingBox(),
      desk = await page.locator('.shop-table-surface').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(desk.x + 70, desk.y + 80, { steps: 8 });
    await page.mouse.up();
    await count(page, 2);
    const moved = await token.boundingBox();
    expect(Math.abs(moved.x - box.x)).toBeGreaterThan(8);
    await silent(page, async () => {
      const b = await token.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.up();
    });
    reports.push({ scenario: 'HTML5drop,realreposition,tap', trace: await starts(page) });
    await context.close();
  }
  {
    const { page, context } = await fresh({ muted: true });
    await buy(page, 'dagger');
    await expect(page.locator('.shop-table-token')).toHaveCount(1);
    await count(page, 0);
    expect(await page.evaluate(() => window.counterContexts.length)).toBe(0);
    await page.evaluate(() => window.counterControls.toggle());
    await buy(page, 'potion-of-healing');
    await count(page, 1);
    await page.evaluate(() => window.counterControls.setVolume(0.2));
    await page.waitForTimeout(90);
    await buy(page, 'oil');
    await count(page, 2);
    expect((await starts(page)).at(-1).volume).toBeCloseTo(0.2, 2);
    await page.evaluate(() => window.counterControls.toggle());
    await expect(root(page)).toHaveAttribute('data-counter-audio-active', '0');
    await expect
      .poll(() =>
        page.evaluate(() => window.counterContexts.every((context) => context.state === 'closed')),
      )
      .toBe(true);
    await silent(page, () => buy(page, 'dagger'));
    await page.evaluate(() => window.counterControls.setVolume(0));
    await silent(page, () => buy(page, 'dagger'));
    reports.push({ scenario: 'mute,volume,zero', trace: await starts(page) });
    await context.close();
  }
  {
    const { page, context } = await fresh();
    await buy(page, 'potion-of-healing');
    await count(page, 1);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(root(page)).toHaveAttribute('data-counter-audio-state', 'hidden');
    await expect(root(page)).toHaveAttribute('data-counter-audio-active', '0');
    await expect
      .poll(() =>
        page.evaluate(() => window.counterContexts.every((context) => context.state === 'closed')),
      )
      .toBe(true);
    await silent(page, () => buy(page, 'dagger'));
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(150);
    await count(page, 1);
    await buy(page, 'dagger');
    await count(page, 2);
    expect(await page.evaluate(() => window.counterContexts.length)).toBe(2);
    await page.evaluate(() => {
      window.savedCounterRoot = document.querySelector('.shop-scene');
      window.counterControls.remove();
    });
    await expect(page.locator('.shop-scene')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => window.counterContexts.every((context) => context.state === 'closed')),
      )
      .toBe(true);
    expect(await page.evaluate(() => window.savedCounterRoot.dataset.counterAudioState)).toBe(
      'disposed',
    );
    await page.waitForTimeout(100);
    expect((await starts(page)).length).toBe(2);
    reports.push({ scenario: 'hidden,return,unmount', trace: await starts(page) });
    await context.close();
  }
  {
    const { page, context } = await fresh({ audioUnavailable: true });
    await buy(page, 'dagger');
    await expect(page.locator('.shop-table-token')).toHaveCount(1);
    await count(page, 0);
    await expect(root(page)).toHaveAttribute('data-counter-audio-state', 'unavailable');
    expect((await starts(page)).length).toBe(0);
    reports.push({ scenario: 'audio-unavailable-cart-still-works', trace: [] });
    await context.close();
  }
  {
    const { page, context, releaseAudio } = await fresh({ deferAudio: true });
    await buy(page, 'potion-of-healing');
    await expect(page.locator('.shop-table-token')).toHaveCount(1);
    await count(page, 0);
    await page.evaluate(() => window.counterControls.toggle());
    releaseAudio();
    await page.waitForTimeout(250);
    await count(page, 0);
    await expect(root(page)).toHaveAttribute('data-counter-audio-state', 'muted');
    await expect
      .poll(() =>
        page.evaluate(() => window.counterContexts.every((context) => context.state === 'closed')),
      )
      .toBe(true);
    await page.evaluate(() => window.counterControls.toggle());
    await buy(page, 'dagger');
    await count(page, 1);
    reports.push({ scenario: 'cancel-pending-decode', trace: await starts(page) });
    await context.close();
  }
  {
    const { page, context } = await fresh();
    await buy(page, 'dagger');
    await count(page, 1);
    let releaseCheckout;
    const checkoutGate = new Promise((resolve) => {
      releaseCheckout = resolve;
    });
    await page.route('**/api/shop/checkout', async (route) => {
      await checkoutGate;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Compra recusada no teste.' }),
      });
    });
    await page.getByRole('button', { name: /Abrir carrinho/ }).click();
    await page.getByRole('button', { name: /Finalizar compra/ }).click();
    await expect(page.getByRole('button', { name: 'Finalizando…' })).toBeDisabled();
    await silent(page, () =>
      page.evaluate(() => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('application/x-alvorada-shop', 'potion-of-healing');
        document
          .querySelector('.shop-table-surface')
          .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
      }),
    );
    releaseCheckout();
    await expect(page.getByText('Compra recusada no teste.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Finalizar compra/ })).toBeEnabled();
    await count(page, 1);
    await expect(page.locator('.shop-table-token')).toHaveCount(1);
    reports.push({ scenario: 'busy-add-and-failed-checkout-silent', trace: await starts(page) });
    await context.close();
  }
  {
    const { page, context } = await fresh({ viewport: { width: 390, height: 844 }, volume: 0.4 });
    await buy(page, 'potion-of-healing');
    await count(page, 1);
    expect((await starts(page)).at(-1).volume).toBeCloseTo(0.4, 2);
    await page.screenshot({ path: 'test-results/shop-counter-audio-mobile.png', fullPage: true });
    await context.close();
  }
  {
    const { page, context } = await fresh();
    let full = false;
    for (const item of catalog) {
      const before = (await starts(page)).length;
      await buy(page, item.id);
      const countTokens = await page.locator('.shop-table-token').count();
      if (
        await page
          .getByText('A mesa está cheia. Retire um item ou finalize o carrinho.', { exact: true })
          .isVisible()
      ) {
        await page.waitForTimeout(120);
        expect((await starts(page)).length).toBe(before);
        full = true;
        reports.push({ scenario: 'fullcounter', tokens: countTokens });
        break;
      }
      await expect.poll(async () => (await starts(page)).length).toBe(before + 1);
    }
    expect(full).toBe(true);
    expect(
      await page.evaluate(() =>
        window.counterContexts.every((context) => context.voices.size <= 6),
      ),
    ).toBe(true);
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/shop-counter-audio-report.json',
    JSON.stringify({ errors, reports }, null, 2) + '\n',
  );
  console.log(
    'Shop counter audio: 71 comments/material placements, isolated WAV failure, DnD, heavy/liquid, mute/volume, full/99, visibility and disposal passed.',
  );
} finally {
  await browser.close();
  await server.close();
}
