import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const rate = 48000;
const sources = [
  {
    id: 'shop-wood',
    title: 'Wooden Thud (Mono)',
    author: 'Breviceps',
    page: 'https://freesound.org/people/Breviceps/sounds/449955/',
    url: 'https://cdn.freesound.org/previews/449/449955_9159316-hq.mp3',
    sha256: '8f2d2c815df5c771d1fb8a97b9bea7bc75595b56de543e4922d76923303268c1',
  },
  {
    id: 'shop-bottle',
    title: 'Bottle hitting a table',
    author: 'TheMikirog',
    page: 'https://freesound.org/people/TheMikirog/sounds/331646/',
    url: 'https://cdn.freesound.org/previews/331/331646_2503553-hq.mp3',
    sha256: 'f4d390ee18285a75c3463b3baa77556b75488f51a802d1049d2cee93849cffe7',
  },
  {
    id: 'shop-liquid',
    title: 'Water Slosh in Metal Bottle - various.mp3',
    author: 'twinpix',
    page: 'https://freesound.org/people/twinpix/sounds/536953/',
    url: 'https://cdn.freesound.org/previews/536/536953_842338-hq.mp3',
    sha256: 'c188574d178a0d896541b96cea167bd57e142ae1ef9023ee98d6cacf86f8d1cc',
  },
];
await mkdir('test-results/audio-sources', { recursive: true });
await mkdir('public/audio', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage();
const decoded = {};
try {
  for (const source of sources) {
    const file = `test-results/audio-sources/${source.id}.mp3`;
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(file, bytes);
    }
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error(`A fonte CC0 ${source.id} mudou; revise antes de regenerar.`);
    const data = await page.evaluate(
      async ({ base64, rate }) => {
        const context = new OfflineAudioContext(1, 1, rate);
        const buffer = await context.decodeAudioData(
          Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer,
        );
        const pcm = new Float32Array(buffer.length);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const input = buffer.getChannelData(channel);
          for (let i = 0; i < pcm.length; i++) pcm[i] += input[i] / buffer.numberOfChannels;
        }
        const bytes = new Uint8Array(pcm.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 16384)
          binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        return btoa(binary);
      },
      { base64: bytes.toString('base64'), rate },
    );
    const pcm = Buffer.from(data, 'base64');
    decoded[source.id] = new Float32Array(
      pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength),
    );
  }
} finally {
  await browser.close();
}

// Locate the first real recorded gesture; remove silence without creating a tone.
function onset(pcm) {
  const block = Math.round(rate * 0.012);
  const energy = [];
  for (let i = 0; i < pcm.length; i += block) {
    let sum = 0;
    for (let j = i; j < Math.min(i + block, pcm.length); j++) sum += pcm[j] ** 2;
    energy.push(Math.sqrt(sum / block));
  }
  const threshold = Math.max(...energy) * 0.16;
  return Math.max(0, (energy.findIndex((value) => value > threshold) * block) / rate - 0.008);
}
function layer(output, id, { at = 0, length, gain = 1, cutoff = 7200, release = 0.09 }) {
  const input = decoded[id];
  const start = onset(input);
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let memory = 0;
  const count = Math.min(Math.round(length * rate), input.length - Math.round(start * rate));
  for (let i = 0; i < count; i++) {
    const dst = Math.round(at * rate) + i;
    if (dst >= output.length) break;
    memory += alpha * (input[Math.round(start * rate) + i] - memory);
    const fade = Math.min(1, i / (rate * 0.003), (count - i) / (rate * release));
    output[dst] += memory * gain * fade;
  }
  return { id, start: Number(start.toFixed(4)), length, at, gain, cutoff, release };
}
function sourceGain(id, target) {
  let peak = 0;
  for (const value of decoded[id]) peak = Math.max(peak, Math.abs(value));
  return target / Math.max(0.001, peak);
}
async function wave(name, pcm) {
  let peak = 0;
  for (const value of pcm) peak = Math.max(peak, Math.abs(value));
  const normalization = 0.68 / Math.max(0.001, peak);
  const bytes = Buffer.alloc(44 + pcm.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(pcm.length * 2, 40);
  let energy = 0;
  for (let i = 0; i < pcm.length; i++) {
    const value = pcm[i] * normalization;
    energy += value ** 2;
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
  }
  await writeFile(`public/audio/${name}.wav`, bytes);
  return {
    file: `${name}.wav`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    duration: pcm.length / rate,
    peak: 0.68,
    rms: Number(Math.sqrt(energy / pcm.length).toFixed(5)),
    bytes: bytes.length,
  };
}
const wood = new Float32Array(Math.round(0.55 * rate));
const woodLayers = [layer(wood, 'shop-wood', { length: 0.49, gain: sourceGain('shop-wood', 0.6) })];
const liquid = new Float32Array(Math.round(1.08 * rate));
const liquidLayers = [
  layer(liquid, 'shop-wood', { length: 0.35, gain: sourceGain('shop-wood', 0.19), cutoff: 5200 }),
  layer(liquid, 'shop-bottle', {
    length: 0.62,
    gain: sourceGain('shop-bottle', 0.51),
    cutoff: 8200,
  }),
  layer(liquid, 'shop-liquid', {
    at: 0.055,
    length: 0.93,
    gain: sourceGain('shop-liquid', 0.36),
    cutoff: 5700,
    release: 0.17,
  }),
];
const files = {
  wood: await wave('shop-counter-wood', wood),
  liquid: await wave('shop-counter-liquid', liquid),
};
await writeFile(
  'public/audio/shop-counter-manifest.json',
  JSON.stringify(
    {
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      checked: '2026-10-04',
      generator: 'scripts/generate-shop-counter-audio.mjs',
      encoding: 'PCM WAV mono, 48 kHz, 16 bit, pico 68%',
      composition:
        'Gravações reais de impacto de madeira, recipiente na mesa e água dentro de uma garrafa; recorte do primeiro gesto, filtragem e mixagem. Nenhum bip ou oscilador sintetizado.',
      playback:
        'Impacto proporcional ao peso e tamanho, pitch entre 0,80 e 1,10 com variação pequena; mesmo volume/mute do site; vozes canceladas e contexto encerrado ao ocultar ou sair.',
      files,
      layers: { wood: woodLayers, liquid: liquidLayers },
      sources: sources.map((source) => ({ ...source, license: 'CC0-1.0', publicPreview: true })),
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ files, layers: { wood: woodLayers, liquid: liquidLayers } }, null, 2));
