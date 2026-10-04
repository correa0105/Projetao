import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const rate = 48000;
const sources = [
  {
    id: 'entry-crack',
    title: 'Crackle #1.wav',
    author: 'abstraktgeneriert (antes Agaxly)',
    page: 'https://freesound.org/people/abstraktgeneriert/sounds/348942/',
    url: 'https://cdn.freesound.org/previews/348/348942_3610778-hq.mp3',
    sha256: '393f3a698019dce839e907dde1b56ff6122ad7de0bc214a6c88246297e2b4cf2',
  },
  {
    id: 'entry-glass',
    title: 'Glass Break',
    author: 'avrahamy',
    page: 'https://freesound.org/people/avrahamy/sounds/141563/',
    url: 'https://cdn.freesound.org/previews/141/141563_1422573-hq.mp3',
    sha256: '3cf725050dd2a3685f0c80b165c22c63615059f3bb10695ae20ba3dd398bc7b4',
  },
  {
    id: 'entry-mist',
    title: 'Dark Whoosh',
    author: 'The-Sacha-Rush',
    page: 'https://freesound.org/people/The-Sacha-Rush/sounds/657795/',
    url: 'https://cdn.freesound.org/previews/657/657795_685248-hq.mp3',
    sha256: '32cbf655d8edc697b5a9ae8fad180f4758bc7d89e6a47fea669df79037cb6295',
  },
];
await mkdir('test-results/audio-sources', { recursive: true });
await mkdir('public/audio', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage();
const samples = {};
try {
  for (const source of sources) {
    const file = `test-results/audio-sources/${source.id}.mp3`;
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error('Fonte de áudio indisponível: ' + response.status);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(file, bytes);
    }
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error('Fonte alterada: ' + source.id);
    const channels = await page.evaluate(
      async ({ data, rate }) => {
        const context = new OfflineAudioContext(2, 1, rate);
        const decoded = await context.decodeAudioData(
          Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer,
        );
        return Array.from({ length: 2 }, (_, i) => {
          const raw = new Uint8Array(
            decoded.getChannelData(Math.min(i, decoded.numberOfChannels - 1)).buffer,
          );
          let text = '';
          for (let n = 0; n < raw.length; n += 16384)
            text += String.fromCharCode(...raw.subarray(n, n + 16384));
          return btoa(text);
        });
      },
      { data: bytes.toString('base64'), rate },
    );
    samples[source.id] = channels.map((data) => {
      const raw = Buffer.from(data, 'base64');
      return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    });
    console.log(source.id + ': ' + (samples[source.id][0].length / rate).toFixed(3) + 's');
  }
} finally {
  await browser.close();
}
function mix(length) {
  return [new Float32Array(Math.round(length * rate)), new Float32Array(Math.round(length * rate))];
}
function layer(
  output,
  id,
  {
    at = 0,
    offset = 0,
    length,
    speed = 1,
    gain = 1,
    cutoff = 10000,
    attack = 0.006,
    release = 0.08,
    reverse = false,
  },
) {
  const input = samples[id],
    alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  for (let ch = 0; ch < 2; ch++) {
    let filtered = 0;
    for (let i = 0; i < length * rate; i++) {
      const t = i / rate,
        dst = Math.round(at * rate) + i;
      if (dst >= output[ch].length) break;
      const position = (offset + (reverse ? length - t : t) * speed) * rate;
      const n = Math.floor(position),
        f = position - n;
      const value =
        n < 0 || n + 1 >= input[ch].length ? 0 : input[ch][n] * (1 - f) + input[ch][n + 1] * f;
      filtered += alpha * (value - filtered);
      const envelope = Math.min(1, t / attack) * Math.min(1, (length - t) / release);
      output[ch][dst] += filtered * gain * envelope;
    }
  }
}
async function finish(output, name, peakTarget) {
  const dry = output.map((channel) => channel.slice());
  for (let ch = 0; ch < 2; ch++) {
    for (const [delay, gain] of [
      [0.047, 0.13],
      [0.091, 0.07],
      [0.167, 0.035],
    ]) {
      const shift = Math.round(delay * rate);
      for (let i = shift; i < output[ch].length; i++)
        output[ch][i] += dry[1 - ch][i - shift] * gain;
    }
    let previous = 0,
      high = 0;
    for (let i = 0; i < output[ch].length; i++) {
      const value = output[ch][i];
      high = value - previous + high * 0.998;
      previous = value;
      output[ch][i] = Math.tanh(high * 1.2) * Math.min(1, (output[ch].length - i) / (rate * 0.14));
    }
  }
  let peak = 0,
    squares = 0;
  output.forEach((channel) =>
    channel.forEach((value) => {
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
    }),
  );
  if (!peak) throw new Error('Áudio vazio: ' + name);
  const wav = Buffer.alloc(44 + output[0].length * 4);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < output[0].length; i++)
    for (let ch = 0; ch < 2; ch++)
      wav.writeInt16LE(
        Math.round(((output[ch][i] * peakTarget) / peak) * 32767),
        44 + i * 4 + ch * 2,
      );
  await writeFile(`public/audio/${name}.wav`, wav);
  return {
    file: name + '.wav',
    duration: output[0].length / rate,
    peak: peakTarget,
    rms: (Math.sqrt(squares / (output[0].length * 2)) * peakTarget) / peak,
    sha256: createHash('sha256').update(wav).digest('hex'),
  };
}
const crack = mix(1.15);
layer(crack, 'entry-crack', { offset: 0.005, length: 0.38, gain: 1, cutoff: 10000 });
layer(crack, 'entry-crack', {
  at: 0.29,
  offset: 0.07,
  length: 0.3,
  gain: 0.5,
  speed: 0.83,
  cutoff: 8000,
});
layer(crack, 'entry-crack', {
  at: 0.68,
  offset: 0.1,
  length: 0.3,
  gain: 0.45,
  speed: 1.08,
  cutoff: 9000,
});
const glass = mix(2.05);
layer(glass, 'entry-glass', {
  offset: 0.01,
  length: 1.8,
  gain: 1,
  speed: 0.94,
  cutoff: 10000,
  release: 0.2,
});
const mist = mix(2.05);
layer(mist, 'entry-mist', {
  offset: 0.02,
  length: 1.98,
  gain: 1,
  speed: 0.74,
  cutoff: 4200,
  attack: 0.2,
  release: 0.44,
});
layer(mist, 'entry-mist', {
  at: 0.4,
  offset: 0.08,
  length: 1.6,
  gain: 0.24,
  speed: 0.61,
  cutoff: 1900,
  attack: 0.3,
  release: 0.55,
  reverse: true,
});
const files = await Promise.all([
  finish(crack, 'ginna-reality-crack', 0.58),
  finish(glass, 'ginna-reality-glass', 0.7),
  finish(mist, 'ginna-reality-mist', 0.56),
]);
await writeFile(
  'public/audio/ginna-reality-manifest.json',
  JSON.stringify(
    {
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      checked: '2026-10-04',
      generator: 'scripts/generate-ginna-entry-audio.mjs',
      encoding: 'PCM estéreo, 48 kHz, 16 bits',
      description:
        'Trinca seca em três estalos, janela de vidro quebrando com queda de lascas e sopro grave de névoa; gravações recortadas, filtradas e reverberadas.',
      sources,
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(files));
