import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/ginna-entry-audio.html',
  `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><div id="preview"></div><script type="module">
import React from 'react'; import {createRoot} from 'react-dom/client';
import {SiteMusicProvider,useMusicInterlude,useSoundEffects} from '/src/SiteMusic.tsx';
import {GinnaEntry} from '/src/GinnaEntry.tsx';
import '/src/styles.css'; import '/src/theme.css'; import '/src/stable.css';
function Preview() {
 const [running,setRunning]=React.useState(new URLSearchParams(location.search).has('auto'));
 const fx=useSoundEffects(), music=useMusicInterlude();
 window.audioControls={setVolume:fx.setVolume,toggle:fx.toggle,toggleMusic:music.toggle,remove:()=>setRunning(false)};
 const covered=React.useCallback(()=>{window.audioCovered=true},[]);
 const finished=React.useCallback(()=>{window.audioFinished=true;setRunning(false)},[]);
 return React.createElement(React.Fragment,null,
  React.createElement('button',{onClick:()=>setRunning(true)},'Romper realidade'),
  running&&React.createElement(GinnaEntry,{ready:true,onCovered:covered,onFinished:finished}));
}
createRoot(document.getElementById('preview')).render(React.createElement(SiteMusicProvider,null,React.createElement(Preview)));
</script></body></html>`,
);
const server = await createServer({ server: { port: 3041, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const errors = [],
  reports = [];
async function fresh({
  muted = false,
  volume = 1,
  reducedMotion = 'no-preference',
  auto = false,
  delay = 0,
  missing = false,
} = {}) {
  const context = await browser.newContext({
    reducedMotion,
    viewport: { width: 1000, height: 700 },
  });
  await context.addInitScript(
    ({ muted, volume }) => {
      localStorage.setItem('alvorada-effects-muted', String(muted));
      localStorage.setItem('alvorada-effects-volume', String(volume));
      localStorage.setItem('alvorada-music-muted', 'true');
      window.audioTrace = [];
      window.audioContexts = [];
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(options) {
          super(options);
          this.gains = [];
          this.active = new Set();
          window.audioContexts.push(this);
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
          source.start = (when, offset, ...rest) => {
            this.active.add(source);
            window.audioTrace.push({
              event: 'start',
              offset: offset || 0,
              duration: source.buffer?.duration,
              time: document.querySelector('.ginna-entry')?.dataset.entryAudioTime,
              gesture: navigator.userActivation.hasBeenActive,
            });
            start(when, offset, ...rest);
          };
          source.stop = (...args) => {
            this.active.delete(source);
            window.audioTrace.push({ event: 'stop' });
            stop(...args);
          };
          source.addEventListener('ended', () => this.active.delete(source));
          return source;
        }
      };
    },
    { muted, volume },
  );
  const page = await context.newPage();
  if (delay || missing)
    await page.route('**/audio/ginna-reality-*.wav', async (route) => {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (missing) await route.fulfill({ status: 404, body: '' });
      else await route.continue();
    });
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(
    `http://localhost:3041/test-results/ginna-entry-audio.html${auto ? '?auto' : ''}`,
  );
  if (!auto) await page.getByRole('button', { name: 'Romper realidade' }).click();
  const root = page.locator('.ginna-entry');
  return { context, page, root };
}
const snapshot = (page) =>
  page.evaluate(() => ({
    data: { ...document.querySelector('.ginna-entry')?.dataset },
    trace: window.audioTrace,
    contexts: window.audioContexts.map((context) => ({
      state: context.state,
      active: context.active.size,
      master: context.gains[0]?.gain.value,
    })),
    covered: !!window.audioCovered,
    finished: !!window.audioFinished,
  }));
const visibility = (page, hidden) =>
  page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
async function remove(page, root) {
  await page.evaluate(() => window.audioControls.remove());
  await expect(root).toHaveCount(0);
  await expect
    .poll(async () =>
      (await snapshot(page)).contexts.every(
        (context) => context.state === 'closed' && context.active === 0,
      ),
    )
    .toBe(true);
}
try {
  for (const [name, duration, limit] of [
    ['crack', 1.15, 0.59],
    ['glass', 2.05, 0.71],
    ['mist', 2.05, 0.57],
  ]) {
    const wav = await readFile(`public/audio/ginna-reality-${name}.wav`);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(48000);
    expect((wav.length - 44) / (48000 * 4)).toBe(duration);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2)
      peak = Math.max(peak, Math.abs(wav.readInt16LE(i) / 32767));
    expect(peak).toBeLessThan(limit);
    expect(peak).toBeGreaterThan(0.5);
  }
  {
    const { context, page, root } = await fresh();
    await expect(root).toHaveAttribute('data-entry-audio-state', 'playing');
    await expect(root).toHaveAttribute('data-entry-audio-mist', /.+/, { timeout: 10000 });
    const playing = await snapshot(page);
    for (const [name, cue] of [
      ['Crack', 40],
      ['Glass', 1180],
      ['Mist', 1530],
    ]) {
      const time = Number(playing.data['entryAudio' + name]);
      expect(time).toBeGreaterThanOrEqual(cue);
      expect(time).toBeLessThan(cue + 100);
    }
    expect(
      playing.trace.filter((item) => item.event === 'start' && item.offset < 0.1),
    ).toHaveLength(3);
    expect(
      playing.trace.filter((item) => item.event === 'start').every((item) => item.gesture),
    ).toBe(true);
    expect(playing.contexts[0].master).toBeCloseTo(0.9);
    await expect(root).toHaveAttribute('data-phase', 'opening', { timeout: 10000 });
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.state).toBe('closed');
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await expect(root).toHaveCount(0, { timeout: 5000 });
    expect((await snapshot(page)).finished).toBe(true);
    reports.push({ case: 'three synchronized cues', ...playing });
    await context.close();
  }
  for (const preference of [
    { muted: true },
    { volume: 0 },
    { reducedMotion: 'reduce' },
    { auto: true },
  ]) {
    const { context, page, root } = await fresh(preference);
    if (preference.reducedMotion) await expect(root).toHaveCount(0, { timeout: 5000 });
    else
      await expect(root).toHaveAttribute(
        'data-entry-audio-state',
        preference.auto ? 'blocked' : 'muted',
      );
    const current = await snapshot(page);
    expect(current.contexts).toHaveLength(0);
    expect(current.trace).toHaveLength(0);
    if (!preference.reducedMotion) await remove(page, root);
    reports.push({ case: 'silent preferences', preference, ...current });
    await context.close();
  }
  {
    const { context, page, root } = await fresh();
    await expect(root).toHaveAttribute('data-entry-audio-crack', /.+/);
    await page.evaluate(() => window.audioControls.toggleMusic());
    expect((await snapshot(page)).data.entryAudioState).toBe('playing');
    await page.evaluate(() => window.audioControls.setVolume(0.25));
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.master).toBeCloseTo(0.225);
    await visibility(page, true);
    await expect(root).toHaveAttribute('data-entry-audio-state', 'paused');
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.state).toBe('suspended');
    const paused = await snapshot(page);
    await page.waitForTimeout(650);
    expect((await snapshot(page)).data.entryAudioTime).toBe(paused.data.entryAudioTime);
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await visibility(page, false);
    await expect(root).toHaveAttribute('data-entry-audio-state', 'playing');
    await page.evaluate(() => window.audioControls.toggle());
    await expect(root).toHaveAttribute('data-entry-audio-state', 'muted');
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await expect
      .poll(async () => Number((await snapshot(page)).data.entryAudioTime))
      .toBeGreaterThan(1600);
    await page.evaluate(() => window.audioControls.toggle());
    await expect(root).toHaveAttribute('data-entry-audio-state', 'playing');
    const resumed = await snapshot(page);
    expect(
      resumed.trace
        .filter((item) => item.event === 'start')
        .slice(-2)
        .every((item) => item.duration > 2 && item.offset > 0),
    ).toBe(true);
    await page.evaluate(() => window.audioControls.setVolume(0));
    await expect(root).toHaveAttribute('data-entry-audio-state', 'muted');
    await remove(page, root);
    reports.push({ case: 'live settings, pause, resume and cancellation', ...resumed });
    await context.close();
  }
  {
    const { context, page, root } = await fresh({ delay: 2200 });
    await expect(root).toHaveAttribute('data-entry-audio-state', 'playing', { timeout: 10000 });
    const late = await snapshot(page);
    expect(late.data.entryAudioCrack).toBeUndefined();
    expect(
      late.trace
        .filter((item) => item.event === 'start')
        .every((item) => item.duration > 2 && item.offset > 0.1),
    ).toBe(true);
    await remove(page, root);
    reports.push({ case: 'late loading skips expired crack', ...late });
    await context.close();
  }
  {
    const { context, page, root } = await fresh({ missing: true });
    await expect(root).toHaveCount(0, { timeout: 12000 });
    const failed = await snapshot(page);
    expect(failed.finished).toBe(true);
    expect(failed.trace).toHaveLength(0);
    expect(failed.contexts.every((context) => context.state === 'closed')).toBe(true);
    reports.push({ case: 'missing audio does not block scene', ...failed });
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile('test-results/ginna-entry-audio-report.json', JSON.stringify(reports, null, 2));
  console.log(
    'Entrada Ginna: trinca, vidro e névoa sincronizados; volume, mute, pausa, rede lenta, movimento reduzido e limpeza aprovados.',
  );
} finally {
  await browser.close();
  await server.close();
}
