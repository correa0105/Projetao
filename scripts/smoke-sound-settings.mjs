import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('data/shop-export/loja.json', 'utf8'));
const catalog = source.items
  .filter((item) => ['dagger', 'potion-of-healing'].includes(item.id))
  .map((item) => ({
    ...item,
    weight_lb: String(item.weight_lb),
    image_path: '/shop/items/' + item.id + '.png',
  }));
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/sound-settings.html',
  [
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body><div id="preview"></div><script type="module">',
    "import React from 'react';import {createRoot} from 'react-dom/client';",
    "import {SiteMusicProvider,MusicControls,useMusicInterlude,useSoundEffects,useLoreScrollSound} from '/src/SiteMusic.tsx';",
    "import {ProfileMenu} from '/src/ProfileMenu.tsx';import {PageHeader} from '/src/PageHeader.tsx';import {Shop} from '/src/Shop.tsx';import {GinnaVision} from '/src/GinnaVision.tsx';",
    "import '/src/styles.css';import '/src/theme.css';import '/src/alvorada.css';import '/src/journey.css';import '/src/page-header.css';import '/src/profile-menu.css';import '/src/npc-speech.css';import '/src/stable.css';",
    'const catalog=' + JSON.stringify(catalog) + ';',
    "const login=new URLSearchParams(location.search).has('login');",
    "const character={id:'sound-settings',name:'Arden',gold_cp:10000000,portrait_revision:0};",
    'function Preview(){const music=useMusicInterlude(),effects=useSoundEffects(),scroll=useLoreScrollSound();',
    "const [profileOpen,setProfileOpen]=React.useState(true),[vision,setVision]=React.useState(false),[route,setRoute]=React.useState(location.hash.slice(1)||'world');",
    "const resume=React.useRef(null);React.useEffect(()=>{const update=()=>setRoute(location.hash.slice(1)||'world');window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[]);",
    'window.soundFixture={music,effects,closeVision:()=>setVision(false)};',
    "return React.createElement('div',{className:'app-shell','data-page':login?'home':'shop','data-sound-route':route},React.createElement('main',{className:'main-shell'},",
    "login?React.createElement(React.Fragment,null,React.createElement(MusicControls,{login:true}),React.createElement('h1',null,'Entrada da guilda')):",
    "React.createElement(PageHeader,{title:'Som da guilda'},React.createElement(ProfileMenu,{character,open:profileOpen,onOpenChange:setProfileOpen},React.createElement('span',null,'Arden'))),",
    "React.createElement('div',{className:'main-content'},",
    "React.createElement('section',{style:{position:'relative',zIndex:10,padding:'90px 18px 18px'},'aria-label':'Ações da prévia'},",
    "React.createElement('output',{'data-sound-probe':true,'data-music-volume':music.volume,'data-music-muted':music.muted,'data-effects-volume':effects.volume,'data-effects-muted':effects.muted},'Preferências de som'),",
    "React.createElement('button',{onClick:scroll},'Abrir pergaminho'),",
    "React.createElement('button',{onClick:()=>{resume.current=music.beginInterlude()}},'Pausar trilha para interlúdio'),",
    "React.createElement('button',{onClick:()=>resume.current?.()},'Retomar trilha'),",
    "React.createElement('button',{onClick:()=>setVision(true)},'Abrir visão da Ginna'),",
    "...['world','lore','shop'].map(page=>React.createElement('button',{key:page,onClick:()=>{location.hash=page}},'Ir para '+page)),",
    "React.createElement('button',null,'Fora do painel')),",
    "login?React.createElement('form',{className:'login-form',style:{margin:'20px',maxWidth:'320px'}},React.createElement('label',null,'Nome',React.createElement('input'))):React.createElement(Shop,{catalog,character,onPurchased:async()=>{}})),",
    'vision&&React.createElement(GinnaVision,{known:true,onFinished:()=>setVision(false)})));}',
    "createRoot(document.getElementById('preview')).render(React.createElement(SiteMusicProvider,null,React.createElement(Preview)));",
    '</script></body></html>',
  ].join('\n'),
);

const port = Number(process.env.SOUND_SETTINGS_TEST_PORT || 3037);
const server = await createServer({ server: { port, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const errors = [];
const reports = [];
const names = {
  trigger: 'Configurações de som',
  music: 'Volume das músicas',
  effects: 'Volume dos efeitos sonoros',
};

async function fresh({
  preferences = {},
  login = false,
  viewport = { width: 1440, height: 900 },
  deniedStorage = false,
} = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  await context.addInitScript(
    ({ preferences, deniedStorage }) => {
      if (!localStorage.getItem('sound-settings-test-initialized')) {
        localStorage.clear();
        for (const [key, value] of Object.entries(preferences))
          localStorage.setItem(key, String(value));
        localStorage.setItem('sound-settings-test-initialized', 'true');
      }
      if (deniedStorage) {
        Storage.prototype.getItem = Storage.prototype.setItem = () => {
          throw new DOMException('Storage denied in fixture', 'SecurityError');
        };
      }
      window.soundTrace = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        window.soundTrace.push({
          event: 'html-play',
          source: this.getAttribute('src'),
          music: this.hasAttribute('data-site-music'),
          muted: this.muted,
          volume: this.volume,
        });
        return play.apply(this, args);
      };
      const connected = new WeakMap();
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...args) {
        connected.set(this, destination);
        return connect.call(this, destination, ...args);
      };
      const Native = window.AudioContext;
      window.soundContexts = [];
      window.AudioContext = class extends Native {
        constructor(options) {
          super(options);
          window.soundContexts.push(this);
        }
        createBufferSource() {
          const source = super.createBufferSource(),
            start = source.start.bind(source);
          source.start = (...args) => {
            let node = source,
              master = null;
            for (let i = 0; i < 10; i++) {
              node = connected.get(node);
              if (!node) break;
              if (node instanceof GainNode) master = node;
            }
            window.soundTrace.push({
              event: 'fx-start',
              duration: source.buffer?.duration,
              volume: master?.gain.value,
            });
            return start(...args);
          };
          return source;
        }
      };
    },
    { preferences, deniedStorage },
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    'http://localhost:' + port + '/test-results/sound-settings.html' + (login ? '?login' : ''),
  );
  await expect(page.locator('[data-sound-probe]')).toBeVisible();
  return { page, context };
}
const probe = (page) => page.locator('[data-sound-probe]');
const music = (page) => page.locator('audio[data-site-music]');
const scroll = (page) => page.locator('audio[data-lore-scroll-sound]');
const bell = (page) => page.locator('audio[data-shop-door-bell]');
const fxStarts = (page) =>
  page.evaluate(() => window.soundTrace.filter((event) => event.event === 'fx-start'));
const preferences = (page) =>
  page.evaluate(() => ({
    musicVolume: localStorage.getItem('alvorada-music-volume'),
    musicMuted: localStorage.getItem('alvorada-music-muted'),
    effectsVolume: localStorage.getItem('alvorada-effects-volume'),
    effectsMuted: localStorage.getItem('alvorada-effects-muted'),
  }));
async function settings(page, scope = page) {
  const trigger = scope.getByRole('button', { name: names.trigger, exact: true });
  const avatar = scope.locator('.profile-avatar');
  if ((await avatar.count()) && (await avatar.getAttribute('aria-expanded')) !== 'true')
    await avatar.click();
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  return {
    trigger,
    musicRange: scope.getByRole('slider', { name: names.music, exact: true }),
    effectsRange: scope.getByRole('slider', { name: names.effects, exact: true }),
  };
}
async function state(page, expected) {
  for (const [key, value] of Object.entries(expected))
    await expect(probe(page)).toHaveAttribute(
      'data-' + key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()),
      String(value),
    );
}
async function add(page, id) {
  const item = catalog.find((item) => item.id === id);
  await page.getByRole('textbox', { name: 'Procurar item' }).fill(item.name);
  await page
    .locator('.shop-product')
    .filter({ has: page.getByRole('heading', { name: item.name, exact: true }) })
    .locator('footer button')
    .click();
}
async function bounds(page) {
  const rect = await page.locator('.music-volume-panel').boundingBox();
  expect(rect).not.toBeNull();
  const { width, height } = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(-1);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  return rect;
}
try {
  {
    const { page, context } = await fresh();
    await state(page, {
      musicVolume: 0.4,
      musicMuted: false,
      effectsVolume: 0.4,
      effectsMuted: false,
    });
    let controls = await settings(page);
    await expect(page.getByText('Músicas', { exact: true })).toBeVisible();
    await expect(page.getByText('Efeitos sonoros', { exact: true })).toBeVisible();
    await expect(controls.musicRange).toHaveValue('40');
    await expect(controls.effectsRange).toHaveValue('40');
    await bounds(page);
    await controls.musicRange.fill('23');
    await page.getByRole('button', { name: 'Silenciar músicas', exact: true }).click();
    await state(page, {
      musicVolume: 0.23,
      musicMuted: true,
      effectsVolume: 0.4,
      effectsMuted: false,
    });
    await page.getByRole('button', { name: 'Abrir pergaminho', exact: true }).click();
    await expect
      .poll(() => scroll(page).evaluate((audio) => !audio.paused && !audio.muted))
      .toBe(true);
    expect(await scroll(page).evaluate((audio) => audio.volume)).toBeCloseTo(0.58, 3);
    await add(page, 'dagger');
    await expect(page.locator('.shop-scene')).toHaveAttribute('data-counter-audio-count', '1');
    expect((await fxStarts(page)).at(-1).volume).toBeCloseTo(0.4, 3);
    controls = await settings(page);
    await controls.musicRange.fill('65');
    await page.getByRole('button', { name: 'Silenciar efeitos sonoros', exact: true }).click();
    await state(page, {
      musicVolume: 0.65,
      musicMuted: false,
      effectsVolume: 0.4,
      effectsMuted: true,
    });
    const before = (await fxStarts(page)).length;
    await add(page, 'dagger');
    await expect(
      page.getByRole('button', { name: 'Adaga na mesa, 2 unidades', exact: true }),
    ).toBeVisible();
    expect((await fxStarts(page)).length).toBe(before);
    const scrollPlays = await page.evaluate(
      () =>
        window.soundTrace.filter(
          (event) => event.event === 'html-play' && /lore-scroll/.test(event.source),
        ).length,
    );
    await page.getByRole('button', { name: 'Abrir pergaminho', exact: true }).click();
    expect(
      await page.evaluate(
        () =>
          window.soundTrace.filter(
            (event) => event.event === 'html-play' && /lore-scroll/.test(event.source),
          ).length,
      ),
    ).toBe(scrollPlays);
    controls = await settings(page);
    await controls.effectsRange.fill('80');
    await state(page, {
      musicVolume: 0.65,
      musicMuted: false,
      effectsVolume: 0.8,
      effectsMuted: false,
    });
    await add(page, 'potion-of-healing');
    await expect(page.locator('.shop-scene')).toHaveAttribute('data-counter-audio-count', '2');
    expect((await fxStarts(page)).at(-1).volume).toBeCloseTo(0.8, 3);
    await expect
      .poll(() => music(page).evaluate((audio) => !audio.paused && audio.currentTime > 0.1))
      .toBe(true);
    const previous = await music(page).evaluate((audio) => {
      window.originalMusic = audio;
      return audio.currentTime;
    });
    await page.getByRole('button', { name: 'Ir para lore', exact: true }).click();
    await page.getByRole('button', { name: 'Ir para world', exact: true }).click();
    await expect
      .poll(() => music(page).evaluate((audio) => audio.currentTime))
      .toBeGreaterThan(previous);
    expect(await music(page).evaluate((audio) => window.originalMusic === audio)).toBe(true);
    controls = await settings(page);
    await page.screenshot({
      path: 'test-results/sound-settings-profile-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await bounds(page);
    await page.screenshot({
      path: 'test-results/sound-settings-profile-mobile.png',
      fullPage: true,
    });
    await controls.effectsRange.fill('0');
    await add(page, 'dagger');
    await expect(page.locator('.shop-scene')).toHaveAttribute('data-counter-audio-count', '2');
    await state(page, { musicVolume: 0.65, effectsVolume: 0 });
    controls = await settings(page);
    await controls.effectsRange.fill('80');
    await page.reload();
    await state(page, {
      musicVolume: 0.65,
      musicMuted: false,
      effectsVolume: 0.8,
      effectsMuted: false,
    });
    expect(await preferences(page)).toEqual({
      musicVolume: '0.65',
      musicMuted: 'false',
      effectsVolume: '0.8',
      effectsMuted: 'false',
    });
    await page.getByRole('button', { name: 'Ir para shop', exact: true }).click();
    await expect(music(page)).toHaveAttribute('src', '/audio/medieval-market.ogg');
    await expect
      .poll(() => bell(page).evaluate((audio) => !audio.paused && !audio.muted))
      .toBe(true);
    expect(await bell(page).evaluate((audio) => audio.volume)).toBe(1);
    reports.push({
      scenario: 'independent-UI-html-effects-cart-continuity-persistence',
      preferences: await preferences(page),
      trace: await page.evaluate(() => window.soundTrace),
    });
    await context.close();
  }
  {
    const legacy = { 'alvorada-music-muted': 'true', 'alvorada-music-volume': '0.23' };
    const { page, context } = await fresh({ preferences: legacy });
    await state(page, {
      musicVolume: 0.23,
      musicMuted: true,
      effectsVolume: 0.23,
      effectsMuted: true,
    });
    expect(await preferences(page)).toEqual({
      musicVolume: '0.23',
      musicMuted: 'true',
      effectsVolume: '0.23',
      effectsMuted: 'true',
    });
    let controls = await settings(page);
    await controls.effectsRange.fill('75');
    await state(page, {
      musicVolume: 0.23,
      musicMuted: true,
      effectsVolume: 0.75,
      effectsMuted: false,
    });
    await add(page, 'dagger');
    await expect(page.locator('.shop-scene')).toHaveAttribute('data-counter-audio-count', '1');
    expect((await fxStarts(page)).at(-1).volume).toBeCloseTo(0.75, 3);
    controls = await settings(page);
    await controls.musicRange.fill('55');
    await page.getByRole('button', { name: 'Silenciar efeitos sonoros', exact: true }).click();
    await page.reload();
    await state(page, {
      musicVolume: 0.55,
      musicMuted: false,
      effectsVolume: 0.75,
      effectsMuted: true,
    });
    reports.push({
      scenario: 'legacy-migration-once-then-independent-preferences',
      preferences: await preferences(page),
    });
    await context.close();
  }
  {
    const { page, context } = await fresh({
      preferences: {
        'alvorada-music-muted': 'true',
        'alvorada-music-volume': '0.15',
        'alvorada-effects-muted': 'false',
        'alvorada-effects-volume': '0.85',
      },
    });
    await state(page, {
      musicVolume: 0.15,
      musicMuted: true,
      effectsVolume: 0.85,
      effectsMuted: false,
    });
    reports.push({
      scenario: 'existing-effects-preferences-never-overwritten-by-legacy',
      preferences: await preferences(page),
    });
    await context.close();
  }
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const { page, context } = await fresh({
      login: true,
      viewport,
      preferences: { 'alvorada-music-volume': '0.61', 'alvorada-effects-volume': '0.27' },
    });
    await expect(page.locator('.entry-music')).toBeVisible();
    const controls = await settings(page);
    await expect(controls.musicRange).toHaveValue('61');
    await expect(controls.effectsRange).toHaveValue('27');
    const rect = await bounds(page);
    await controls.effectsRange.fill('52');
    await state(page, { musicVolume: 0.61, effectsVolume: 0.52 });
    await controls.musicRange.focus();
    await page.keyboard.press('End');
    await expect(controls.musicRange).toHaveValue('100');
    await state(page, { musicVolume: 1, effectsVolume: 0.52 });
    await page.keyboard.press('Home');
    await expect(controls.musicRange).toHaveValue('0');
    await state(page, { musicVolume: 0, effectsVolume: 0.52 });
    await page.screenshot({
      path:
        'test-results/sound-settings-login-' +
        (viewport.width < 600 ? 'mobile' : 'desktop') +
        '.png',
    });
    await page.keyboard.press('Escape');
    await expect(controls.trigger).toBeFocused();
    await expect(controls.trigger).toHaveAttribute('aria-expanded', 'false');
    await controls.trigger.click();
    await page.mouse.click(8, viewport.height - 8);
    await expect(controls.trigger).toHaveAttribute('aria-expanded', 'false');
    reports.push({
      scenario: 'login-keyboard-layout-' + viewport.width,
      bounds: rect,
      preferences: await preferences(page),
    });
    await context.close();
  }
  {
    const { page, context } = await fresh({
      preferences: { 'alvorada-music-volume': '0.6', 'alvorada-effects-volume': '0.25' },
    });
    await page.getByRole('button', { name: 'Pausar trilha para interlúdio', exact: true }).click();
    expect(await music(page).evaluate((audio) => audio.paused)).toBe(true);
    await page.getByRole('button', { name: 'Abrir pergaminho', exact: true }).click();
    await expect
      .poll(() => scroll(page).evaluate((audio) => !audio.paused && !audio.muted))
      .toBe(true);
    await page.getByRole('button', { name: 'Retomar trilha', exact: true }).click();
    await expect.poll(() => music(page).evaluate((audio) => !audio.paused)).toBe(true);
    await page.getByRole('button', { name: 'Abrir visão da Ginna', exact: true }).click();
    const vision = page.locator('.ginna-vision'),
      darkMusic = page.locator('audio[data-ginna-music]');
    await expect(vision).toBeVisible();
    await expect(vision).toHaveAttribute('data-heartbeat-state', 'playing');
    await expect(vision).toHaveAttribute('data-heartbeat-volume', '0.25');
    expect(await darkMusic.evaluate((audio) => audio.volume)).toBe(0.6);
    let controls = await settings(page, vision);
    await vision.getByRole('button', { name: 'Silenciar músicas', exact: true }).click();
    expect(await darkMusic.evaluate((audio) => audio.muted)).toBe(true);
    const beats = Number(await vision.getAttribute('data-heartbeat-beats'));
    await expect
      .poll(async () => Number(await vision.getAttribute('data-heartbeat-beats')))
      .toBeGreaterThan(beats);
    await controls.effectsRange.fill('80');
    await expect(vision).toHaveAttribute('data-heartbeat-volume', '0.8');
    expect(await darkMusic.evaluate((audio) => audio.muted)).toBe(true);
    await vision.getByRole('button', { name: 'Silenciar efeitos sonoros', exact: true }).click();
    await expect(vision).toHaveAttribute('data-heartbeat-state', 'muted');
    await vision.getByRole('button', { name: 'Ativar músicas', exact: true }).click();
    expect(await darkMusic.evaluate((audio) => audio.muted)).toBe(false);
    await expect(vision).toHaveAttribute('data-heartbeat-state', 'muted');
    expect(await darkMusic.evaluate((audio) => audio.volume)).toBe(0.6);
    await page.evaluate(() => window.soundFixture.closeVision());
    await expect(vision).toHaveCount(0);
    await expect
      .poll(() => music(page).evaluate((audio) => !audio.paused && !audio.muted))
      .toBe(true);
    await state(page, {
      musicVolume: 0.6,
      musicMuted: false,
      effectsVolume: 0.8,
      effectsMuted: true,
    });
    reports.push({
      scenario: 'interlude-and-Ginna-music-heartbeat-independent',
      trace: await page.evaluate(() => window.soundTrace),
    });
    await context.close();
  }
  {
    const { page, context } = await fresh({ deniedStorage: true });
    await state(page, {
      musicVolume: 0.4,
      musicMuted: false,
      effectsVolume: 0.4,
      effectsMuted: false,
    });
    const controls = await settings(page);
    await controls.musicRange.fill('12');
    await controls.effectsRange.fill('72');
    await state(page, { musicVolume: 0.12, effectsVolume: 0.72 });
    reports.push({ scenario: 'storage-denied-controls-remain-usable' });
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/sound-settings-report.json',
    JSON.stringify({ errors, reports }, null, 2) + '\n',
  );
  console.log(
    'Sound settings: independent music/effects, legacy migration, persistence, login/mobile, keyboard, HTMLAudio, Shop and Ginna passed.',
  );
} finally {
  await browser.close();
  await server.close();
}
