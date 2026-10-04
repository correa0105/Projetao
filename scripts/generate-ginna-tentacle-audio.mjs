import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

// Real, public CC0 recordings supply the water, animal voice and wet friction.
// The browser only decodes compressed sources offline; no sound is played here.
const rate = 48000;
const sources = [
  {
    id: 'lake',
    title: 'jump-into-water.flac',
    author: 'yurkobb',
    page: 'https://freesound.org/people/yurkobb/sounds/280219/',
    url: 'https://cdn.freesound.org/previews/280/280219_2023784-hq.mp3',
    sha256: '237a169a18640dc034a30048d6419d9ae6111e56b64ae5381f1357f9baa65f0e',
    take: [0, 4.686],
  },
  {
    id: 'splash',
    title: 'Big Water Splash',
    author: 'qubodup',
    page: 'https://freesound.org/people/qubodup/sounds/442773/',
    url: 'https://cdn.freesound.org/previews/442/442773_71257-hq.mp3',
    sha256: 'b8227adae409996ceee3481c7057ceda717575fa7569cec5d9d0ee1b94a8fe33',
    take: [0, 2.172],
  },
  {
    id: 'animal',
    title: 'Monster Growl Ashtur.wav',
    author: 'FK_Prod',
    page: 'https://freesound.org/people/FK_Prod/sounds/188949/',
    url: 'https://cdn.freesound.org/previews/188/188949_3517340-hq.mp3',
    sha256: '827be7c7a585dba025837fbf0b2913d51fbba245ee8a97e42aeb2de6b1312e80',
    take: [0, 7.5],
  },
  {
    id: 'wet',
    title: 'Rubber Skid.mp3',
    author: 'shatterstars',
    page: 'https://freesound.org/people/shatterstars/sounds/492071/',
    url: 'https://cdn.freesound.org/previews/492/492071_5186268-hq.mp3',
    sha256: '0bb0f79e0dfa6ef9908a8c65c192b12b48ee596c348fdd5a21b162a05a1c394b',
    take: [0, 14],
  },
  {
    id: 'friction',
    title: 'LAABI_Rami_2014_2015_Roar.wav',
    author: 'univ_lyon3',
    page: 'https://freesound.org/people/univ_lyon3/sounds/250683/',
    url: 'https://cdn.freesound.org/previews/250/250683_2465261-hq.mp3',
    sha256: '9ab622503dbe72aedd4d896fda147146e532e6138e200f732918e772c50e5486',
    take: [0, 3.079],
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
    const path = `test-results/audio-sources/${source.id}.mp3`;
    let bytes;
    try {
      bytes = await readFile(path);
    } catch {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(path, bytes);
    }
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error(`A fonte CC0 ${source.id} mudou; revise antes de regenerar.`);
    const decoded = await page.evaluate(
      async ({ data, take, rate }) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const context = new OfflineAudioContext(2, 1, rate);
        const buffer = await context.decodeAudioData(bytes.buffer);
        const start = Math.round(take[0] * rate);
        const end = Math.min(buffer.length, start + Math.round(take[1] * rate));
        return Array.from({ length: 2 }, (_, channel) => {
          const pcm = buffer
            .getChannelData(Math.min(channel, buffer.numberOfChannels - 1))
            .slice(start, end);
          const uint8 = new Uint8Array(pcm.buffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i += 16384)
            binary += String.fromCharCode(...uint8.subarray(i, i + 16384));
          return btoa(binary);
        });
      },
      { data: bytes.toString('base64'), take: source.take, rate },
    );
    samples[source.id] = decoded.map((data) => {
      const bytes = Buffer.from(data, 'base64');
      return new Float32Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
    });
  }
} finally {
  await browser.close();
}

function mix(seconds) {
  return [
    new Float32Array(Math.round(seconds * rate)),
    new Float32Array(Math.round(seconds * rate)),
  ];
}
function sample(pcm, position) {
  const i = Math.floor(position);
  if (i < 0 || i + 1 >= pcm.length) return 0;
  return pcm[i] + (pcm[i + 1] - pcm[i]) * (position - i);
}
function layer(
  output,
  id,
  {
    at = 0,
    offset = 0,
    speed = 1,
    gain = 1,
    length,
    cutoff = 6000,
    pan = 0,
    move = 0,
    attack = 0.025,
    release = 0.3,
  },
) {
  const source = samples[id];
  const duration =
    length ?? Math.min((source[0].length / rate - offset) / speed, output[0].length / rate - at);
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  const memory = [0, 0];
  for (let i = 0; i < Math.round(duration * rate); i++) {
    const t = i / rate;
    const dst = Math.round(at * rate) + i;
    if (dst < 0 || dst >= output[0].length) continue;
    const envelope = Math.min(1, t / attack) * Math.min(1, (duration - t) / release);
    const position = (offset + t * speed) * rate;
    const direction = Math.max(-0.8, Math.min(0.8, pan + move * Math.sin(t * 2.7)));
    for (let ch = 0; ch < 2; ch++) {
      memory[ch] += alpha * (sample(source[ch], position) - memory[ch]);
      output[ch][dst] +=
        memory[ch] * gain * envelope * Math.sqrt((1 + (ch ? direction : -direction)) / 2);
    }
  }
}
function sub(output, at, length, gain) {
  let random = 173821;
  let noise = 0;
  for (let i = 0; i < length * rate; i++) {
    const t = i / rate,
      dst = Math.round(at * rate) + i;
    if (dst >= output[0].length) break;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    noise += 0.014 * (random / 2147483648 - 1 - noise);
    const envelope =
      Math.min(1, t / 0.035) * Math.exp(-t / 0.32) * Math.min(1, (length - t) / 0.12);
    const body =
      (noise * 2 +
        Math.sin(2 * Math.PI * (34 * t + 10 * 0.07 * (1 - Math.exp(-t / 0.07)))) * 0.25) *
      envelope *
      gain;
    output[0][dst] += body;
    output[1][dst] += body;
  }
}
function finish(output, name) {
  // Short, dark room reflections, a DC blocker and gentle saturation before
  // peak normalization. Both scenes leave headroom for the ducked soundtrack.
  const dry = output.map((channel) => channel.slice());
  for (let ch = 0; ch < 2; ch++) {
    for (const [delay, gain] of [
      [0.043, 0.13],
      [0.087, 0.085],
      [0.143, 0.05],
      [0.221, 0.025],
    ]) {
      const shift = Math.round(delay * rate);
      for (let i = shift; i < output[ch].length; i++)
        output[ch][i] += dry[1 - ch][i - shift] * gain;
    }
    let previous = 0,
      high = 0;
    for (let i = 0; i < output[ch].length; i++) {
      const raw = output[ch][i];
      high = raw - previous + high * 0.9975;
      previous = raw;
      const end = Math.min(1, (output[ch].length - i) / (rate * 0.16));
      output[ch][i] = Math.tanh(high * 1.55) * end;
    }
  }
  let peak = 0,
    energy = 0;
  for (const channel of output)
    for (const value of channel) {
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
  const strength = 0.82 / peak;
  for (const channel of output) for (let i = 0; i < channel.length; i++) channel[i] *= strength;
  console.log(
    `${name}: ${(output[0].length / rate).toFixed(2)}s, peak .82, RMS ${(Math.sqrt(energy / (output[0].length * 2)) * strength).toFixed(4)}`,
  );
  return writeWave(output, name);
}
function writeWave(output, name) {
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
    for (let ch = 0; ch < 2; ch++) {
      wav.writeInt16LE(Math.round(output[ch][i] * 32767), 44 + i * 4 + ch * 2);
    }
  return writeFile(`public/audio/${name}.wav`, wav);
}

const emergence = mix(2.6);
layer(emergence, 'lake', {
  at: 0.015,
  offset: 0.05,
  speed: 0.83,
  gain: 0.8,
  cutoff: 4200,
  length: 2.55,
});
layer(emergence, 'splash', { at: 0.055, speed: 0.68, gain: 0.65, cutoff: 3400, length: 2.54 });
layer(emergence, 'animal', {
  at: 0.08,
  offset: 0.2,
  speed: 0.73,
  gain: 1.05,
  cutoff: 2900,
  length: 2.52,
  attack: 0.065,
  release: 0.5,
  move: 0.12,
});
layer(emergence, 'friction', {
  at: 0.16,
  offset: 0.15,
  speed: 0.6,
  gain: 0.16,
  cutoff: 1250,
  length: 2.44,
});
sub(emergence, 0.065, 0.95, 0.7);

const wrapping = mix(2.9);
layer(wrapping, 'animal', {
  offset: 3.8,
  speed: 0.67,
  gain: 0.6,
  cutoff: 1600,
  length: 2.9,
  attack: 0.12,
  release: 0.28,
  move: 0.48,
});
layer(wrapping, 'friction', {
  offset: 0.12,
  speed: 0.58,
  gain: 0.6,
  cutoff: 2300,
  length: 2.9,
  attack: 0.11,
  release: 0.25,
  pan: -0.25,
  move: 0.55,
});
for (const [at, offset, gain, pan] of [
  [0, 0.2, 0.7, -0.48],
  [0.68, 2.4, 0.75, 0.5],
  [1.34, 5.1, 0.85, -0.5],
  [2.05, 8.4, 1, 0.3],
]) {
  layer(wrapping, 'wet', {
    at,
    offset,
    speed: 0.48,
    gain,
    cutoff: 2600,
    length: 0.83,
    pan,
    attack: 0.045,
    release: 0.22,
  });
  sub(wrapping, at, 0.62, 0.3 + at * 0.04);
}
layer(wrapping, 'lake', {
  at: 0.06,
  offset: 1.9,
  speed: 0.7,
  gain: 0.25,
  cutoff: 1950,
  length: 2.8,
  move: 0.65,
});
await finish(emergence, 'ginna-tentacle-emergence');
await finish(wrapping, 'ginna-tentacle-wrapping');
const preview = mix(5.6);
for (let ch = 0; ch < 2; ch++) {
  preview[ch].set(emergence[ch], 0);
  preview[ch].set(wrapping[ch], Math.round(2.7 * rate));
}
await writeWave(preview, 'ginna-tentacle-preview');
await writeFile(
  'public/audio/ginna-tentacles-manifest.json',
  JSON.stringify(
    {
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      checked: '2026-10-04',
      encoding: 'PCM WAV estéreo, 48 kHz, 16 bit, pico 82%',
      generator: 'scripts/generate-ginna-tentacle-audio.mjs',
      composition:
        'Gravações reais de água, rugido de leão/elefante e atrito molhado, recortadas, desaceleradas, filtradas e mixadas. Grave discreto original e reverberação curta. Sem áudio extraído de filmes.',
      files: {
        emergence: 'ginna-tentacle-emergence.wav',
        wrapping: 'ginna-tentacle-wrapping.wav',
        preview: 'ginna-tentacle-preview.wav',
      },
      timing: { emergence: 0, wrapping: 2700, end: 5600 },
      playback:
        'Relógio dos tentáculos; trilha da visão atenuada durante os efeitos; mute/volume gerais, pausa em aba oculta, silêncio em movimento reduzido. Contexto encerrado antes do fechar dos olhos e da respiração.',
      sources: sources.map(({ take, ...source }) => ({
        ...source,
        license: 'CC0-1.0',
        publicPreview: true,
      })),
    },
    null,
    2,
  ) + '\n',
);
