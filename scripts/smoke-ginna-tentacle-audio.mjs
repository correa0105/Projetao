import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/ginna-tentacle-audio.html',
  `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><div id="preview"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {SiteMusicProvider,useMusicInterlude,useSoundEffects} from '/src/SiteMusic.tsx';
import {GinnaReturn} from '/src/GinnaReturn.tsx';
import '/src/styles.css'; import '/src/theme.css'; import '/src/stable.css';
function Preview() {
  const [running,setRunning]=React.useState(new URLSearchParams(location.search).has('auto'));
  const {setVolume,toggle}=useSoundEffects();
  const music=useMusicInterlude();
  window.audioControls={setVolume,toggle,setMusicVolume:music.setVolume,toggleMusic:music.toggle,remove:()=>setRunning(false)};
  const covered=React.useCallback(()=>{window.audioCovered=true},[]);
  const finished=React.useCallback(()=>{window.audioFinished=true;setRunning(false)},[]);
  return React.createElement(React.Fragment,null,
    React.createElement('button',{onClick:()=>setRunning(true)},'Iniciar retorno'),
    running&&React.createElement(GinnaReturn,{onCovered:covered,onFinished:finished}));
}
createRoot(document.getElementById('preview')).render(React.createElement(SiteMusicProvider,null,React.createElement(Preview)));
</script></body></html>`,
);
const server = await createServer({ server: { port: 3036, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const errors = [];

async function fresh({
  muted = false,
  volume = 1,
  reducedMotion = 'no-preference',
  auto = false,
  slowAudio = false,
} = {}) {
  const context = await browser.newContext({ reducedMotion });
  await context.addInitScript(
    ({ muted, volume }) => {
      localStorage.setItem('alvorada-effects-muted', String(muted));
      localStorage.setItem('alvorada-effects-volume', String(volume));
      localStorage.setItem('alvorada-music-muted', 'false');
      localStorage.setItem('alvorada-music-volume', '0.4');
      window.audioTrace = [];
      window.audioContexts = [];
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(options) {
          super(options);
          this.gains = [];
          this.active = new Set();
          window.audioContexts.push(this);
          window.audioTrace.push({
            event: 'context',
            gesture: navigator.userActivation.hasBeenActive,
          });
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
              time: document.querySelector('.ginna-return')?.dataset.tentacleAudioTime,
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
  if (slowAudio)
    await page.route('**/audio/ginna-tentacle-*.wav', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1900));
      await route.continue();
    });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (/ginna-tentacle-.*\.wav/.test(response.url()) && response.status() >= 400)
      errors.push(response.url());
  });
  await page.goto(
    `http://localhost:3036/test-results/ginna-tentacle-audio.html${auto ? '?auto' : ''}`,
  );
  if (!auto) await page.getByRole('button', { name: 'Iniciar retorno' }).click();
  const root = page.locator('.ginna-return');
  await expect(root).toBeVisible();
  return { context, page, root };
}
const snapshot = (page) =>
  page.evaluate(() => ({
    data: { ...document.querySelector('.ginna-return')?.dataset },
    trace: window.audioTrace,
    contexts: window.audioContexts.map((context) => ({
      state: context.state,
      active: context.active.size,
      master: context.gains[0]?.gain.value,
    })),
    covered: !!window.audioCovered,
    finished: !!window.audioFinished,
  }));
async function visibility(page, hidden) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
try {
  // Validate actual output headroom/duration, not only diagnostic attributes.
  for (const [name, duration] of [
    ['emergence', 2.6],
    ['wrapping', 2.9],
  ]) {
    const wav = await readFile(`public/audio/ginna-tentacle-${name}.wav`);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(48000);
    expect((wav.length - 44) / (48000 * 4)).toBe(duration);
    let peak = 0,
      energy = 0;
    for (let i = 44; i < wav.length; i += 2) {
      const sample = wav.readInt16LE(i) / 32767;
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(peak).toBeLessThan(0.821);
    expect(Math.sqrt(energy / ((wav.length - 44) / 2))).toBeGreaterThan(0.08);
  }
  const preview = await readFile('public/audio/ginna-tentacle-preview.wav');
  const emergence = await readFile('public/audio/ginna-tentacle-emergence.wav');
  const wrapping = await readFile('public/audio/ginna-tentacle-wrapping.wav');
  expect(preview.subarray(44, emergence.length).equals(emergence.subarray(44))).toBe(true);
  expect(preview.subarray(44 + 2700 * 48 * 4).equals(wrapping.subarray(44))).toBe(true);
  {
    const { context, page, root } = await fresh();
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'playing');
    await expect(root).toHaveAttribute('data-tentacle-audio-emergence', '1');
    expect(Number(await root.getAttribute('data-tentacle-audio-emergence-time'))).toBe(0);
    const first = await snapshot(page);
    expect(first.trace.find((item) => item.event === 'context').gesture).toBe(true);
    expect(first.trace.find((item) => item.event === 'start').offset).toBe(0);
    expect(first.contexts[0].master).toBe(1);
    await expect(root).toHaveAttribute('data-tentacle-audio-wrapping', '1', { timeout: 10000 });
    const wrapTime = Number(await root.getAttribute('data-tentacle-audio-wrapping-time'));
    expect(wrapTime).toBeGreaterThanOrEqual(2700);
    expect(wrapTime).toBeLessThan(2781);
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'finished', { timeout: 10000 });
    await expect(root).toHaveAttribute('data-tentacle-audio-context', 'closed');
    const done = await snapshot(page);
    expect(done.covered).toBe(false);
    expect(done.contexts[0].active).toBe(0);
    expect(
      done.trace.filter(
        (item) =>
          item.event === 'start' && Math.abs(item.duration - 2.9) < 0.01 && item.offset < 0.081,
      ),
    ).toHaveLength(1);
    await expect(root).toHaveCount(0, { timeout: 5000 });
    expect((await snapshot(page)).covered).toBe(true);
    await context.close();
    console.log(
      'Retorno real: impacto em 0 ms, envolvimento em ' +
        wrapTime +
        ' ms; contexto fechado antes da respiração.',
    );
  }
  for (const preference of [{ muted: true }, { volume: 0 }, { reducedMotion: 'reduce' }]) {
    const { context, page, root } = await fresh(preference);
    await expect(root).toHaveAttribute(
      'data-tentacle-audio-state',
      preference.reducedMotion ? 'reduced' : 'muted',
    );
    const current = await snapshot(page);
    expect(current.contexts).toHaveLength(0);
    expect(current.trace).toHaveLength(0);
    await page.evaluate(() => window.audioControls.remove());
    await expect(root).toHaveCount(0);
    expect((await snapshot(page)).contexts).toHaveLength(0);
    await context.close();
  }
  console.log('Mute, volume zero e movimento reduzido: nenhum contexto ou impacto.');
  {
    const { context, page, root } = await fresh({ slowAudio: true });
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'playing', { timeout: 6000 });
    expect(Number(await root.getAttribute('data-tentacle-audio-emergence-time'))).toBeGreaterThan(
      400,
    );
    expect(
      (await snapshot(page)).trace.find((item) => item.event === 'start').offset,
    ).toBeGreaterThan(0.4);
    await page.evaluate(() => window.audioControls.remove());
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.state).toBe('closed');
    await context.close();
    console.log('Rede lenta não segura a animação; efeito disponível retoma sua posição atual.');
  }
  {
    const { context, page, root } = await fresh({ auto: true });
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'blocked');
    await expect
      .poll(async () => Number((await snapshot(page)).data.tentacleAudioTime))
      .toBeGreaterThan(320);
    expect((await snapshot(page)).contexts).toHaveLength(0);
    await page.mouse.click(10, 10);
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'playing');
    const unlocked = await snapshot(page);
    expect(unlocked.trace.find((item) => item.event === 'start').offset).toBeGreaterThan(0.3);
    await page.evaluate(() => window.audioControls.remove());
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.state).toBe('closed');
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await context.close();
    console.log(
      'Carregamento automático bloqueado; gesto tardio retoma o trecho atual, sem repetir impacto.',
    );
  }
  {
    const { context, page, root } = await fresh();
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'playing');
    await expect
      .poll(async () => Number((await snapshot(page)).data.tentacleAudioTime))
      .toBeGreaterThan(500);
    await page.evaluate(() => window.audioControls.toggle());
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'muted');
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await expect
      .poll(async () => Number((await snapshot(page)).data.tentacleAudioTime))
      .toBeGreaterThan(850);
    await page.evaluate(() => window.audioControls.toggle());
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'playing');
    const unmuted = await snapshot(page);
    expect(unmuted.trace.filter((item) => item.event === 'start').at(-1).offset).toBeGreaterThan(
      0.8,
    );
    await page.evaluate(() => window.audioControls.setVolume(0.25));
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.master).toBe(0.25);
    await visibility(page, true);
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'paused');
    const paused = await snapshot(page);
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.state).toBe('suspended');
    await page.waitForTimeout(700);
    expect((await snapshot(page)).data.tentacleAudioTime).toBe(paused.data.tentacleAudioTime);
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await visibility(page, false);
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'playing');
    expect(
      Number((await snapshot(page)).data.tentacleAudioTime) - Number(paused.data.tentacleAudioTime),
    ).toBeLessThan(250);
    await page.evaluate(() => window.audioControls.setVolume(0));
    await expect(root).toHaveAttribute('data-tentacle-audio-state', 'muted');
    expect((await snapshot(page)).contexts[0].active).toBe(0);
    await page.evaluate(() => window.audioControls.remove());
    await expect.poll(async () => (await snapshot(page)).contexts[0]?.state).toBe('closed');
    await context.close();
    console.log(
      'Volume em tempo real, mute sem replay, pausa de relógio e cancelamento sem fontes ativas.',
    );
  }
  expect(errors).toEqual([]);
  console.log(
    'Áudio de tentáculos: Edge, WAV sem clipping, integração sem banco e limpeza aprovados.',
  );
} finally {
  await browser.close();
  await server.close();
}
