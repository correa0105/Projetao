import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// Original synthesized cues: filtered noise, resonant strings and envelopes.
// No reference-site recordings or samples are used.
const rate = 44100,
  manifest = [];
function make(folder, name, duration, voice) {
  let seed = 0x12345678;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const n = Math.round(duration * rate),
    samples = new Float64Array(n);
  let low = 0,
    previous = 0,
    peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      noise = random();
    low += 0.075 * (noise - low);
    const high = noise - previous;
    previous = noise;
    const fade = Math.min(1, t / 0.006, (duration - t) / 0.05),
      v = voice(t, noise, low, high) * Math.max(0, fade);
    samples[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, (samples[i] / Math.max(peak, 0.05)) * 0.78));
    const r = (samples[Math.max(0, i - 17)] / Math.max(peak, 0.05)) * 0.76;
    pcm.writeInt16LE(Math.round(v * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF');
  h.writeUInt32LE(pcm.length + 36, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  const wav = Buffer.concat([h, pcm]);
  mkdirSync('public/audio/' + folder, { recursive: true });
  writeFileSync('public/audio/' + folder + '/' + name + '.wav', wav);
  manifest.push({
    path: '/audio/' + folder + '/' + name + '.wav',
    duration,
    bytes: wav.length,
    sha256: createHash('sha256').update(wav).digest('hex'),
  });
}
const osc = (f, t) => Math.sin(2 * Math.PI * f * t),
  decay = (t, k) => Math.exp(-t * k);
make(
  'vtt-attacks',
  'bow-release',
  0.65,
  (t, n, l) =>
    0.45 * (osc(178, t) + 0.35 * osc(356, t) + 0.13 * osc(712, t)) * decay(t, 14) +
    n * 0.25 * Math.exp(-(((t - 0.12) / 0.085) ** 2)) +
    l * 0.2 * decay(t, 10),
);
make(
  'vtt-attacks',
  'arrow-impact',
  0.55,
  (t, n, l, h) =>
    l * 0.8 * decay(t, 18) +
    h * 0.15 * decay(t, 55) +
    0.4 * osc(92, t) * decay(t, 20) +
    0.12 * osc(470, t) * decay(t, 16),
);
make(
  'vtt-attacks',
  'blade-impact',
  0.72,
  (t, n, l, h) =>
    h * 0.3 * decay(t, 65) +
    l * 0.4 * decay(t, 22) +
    (0.35 * osc(660, t) + 0.18 * osc(1107, t) + 0.1 * osc(1712, t)) * decay(t, 10),
);
const voices = {
  ice: (t, n, l, h) =>
    h * (0.28 + 0.2 * osc(13, t)) * decay(t, 2.3) +
    (0.15 * osc(1400, t) + 0.1 * osc(2107, t)) * decay(t, 3),
  fire: (t, n, l) => l * (1 + 0.6 * osc(19, t)) * 0.8 * decay(t, 2) + n * 0.1 * decay(t, 4),
  poison: (t, n, l) =>
    l * 0.55 * (1 + 0.6 * osc(8, t)) * decay(t, 2.5) +
    osc(170 + 70 * osc(3, t), t) * 0.12 * decay(t, 4),
  healing: (t) =>
    [392, 523.25, 659.25, 784].reduce(
      (v, f, i) =>
        v + 0.17 * osc(f, t) * decay(Math.max(0, t - i * 0.07), 2.3) * Math.min(1, t / 0.09),
      0,
    ),
  electric: (t, n, l, h) =>
    h * 0.4 * (0.55 + 0.45 * osc(47, t)) * decay(t, 5) + 0.16 * osc(90, t) * decay(t, 4),
  thunder: (t, n, l, h) =>
    l * 0.95 * decay(t, 1.9) + h * 0.3 * decay(t, 28) + osc(47, t) * 0.35 * decay(t, 3),
  arcane: (t) =>
    0.24 * osc(330 + 120 * t, t) * decay(t, 2.5) +
    0.18 * osc(661, t) * decay(t, 3) +
    0.1 * osc(991, t) * decay(t, 4),
  shield: (t) =>
    0.3 * osc(180, t) * decay(t, 4) +
    0.15 * osc(902, t) * decay(t, 2.5) +
    0.13 * osc(1438, t) * decay(t, 4),
  necrotic: (t, n, l) =>
    l * 0.45 * decay(t, 2) + (0.2 * osc(65, t) + 0.12 * osc(71, t)) * decay(t, 2.5),
  wind: (t, n, l) =>
    l * 0.65 * Math.sin(Math.PI * Math.min(1, t / 1.3)) ** 1.3 + n * 0.08 * decay(t, 2),
  water: (t, n, l) =>
    l * 0.6 * decay(t, 2) + 0.17 * osc(530 - 260 * t, t) * decay(t, 7) + n * 0.08 * decay(t, 4),
  earth: (t, n, l) => l * 0.8 * decay(t, 3.5) + (0.4 * osc(53, t) + 0.1 * osc(93, t)) * decay(t, 5),
  leaves: (t, n, l, h) =>
    h * 0.25 * (0.5 + 0.5 * osc(11, t)) * decay(t, 3) + l * 0.15 * decay(t, 3),
  portal: (t, n, l) =>
    l * 0.2 * decay(t, 2) +
    (0.25 * osc(110 + 160 * t, t) + 0.18 * osc(221 + 240 * t, t)) * decay(t, 2),
  sonic: (t, n, l) =>
    l * 0.3 * decay(t, 5) + 0.4 * osc(210 - 120 * Math.min(t, 1), t) * decay(t, 3.5),
  explosion: (t, n, l, h) =>
    h * 0.25 * decay(t, 35) + l * 0.9 * decay(t, 2.2) + 0.4 * osc(40, t) * decay(t, 3),
  swarm: (t, n, l, h) =>
    0.14 * (osc(155, t) + osc(163, t) + osc(181, t)) * decay(t, 2) + h * 0.05 * decay(t, 4),
  blades: (t, n, l, h) =>
    n * 0.22 * Math.exp(-(((t - 0.15) / 0.1) ** 2)) +
    0.17 * osc(900, t) * decay(t, 4) +
    h * 0.06 * decay(t, 5),
};
for (const [name, voice] of Object.entries(voices))
  make('vtt-effects', name, name === 'thunder' || name === 'explosion' ? 1.65 : 1.35, voice);
writeFileSync(
  'public/audio/vtt-attack-effects-manifest.json',
  JSON.stringify(
    {
      author: 'Alvorada Cinzenta',
      license: 'CC0-1.0',
      source: 'scripts/build-vtt-attack-sounds.mjs',
      files: manifest,
    },
    null,
    2,
  ) + '\n',
);
console.log('Created ' + manifest.length + ' original attack/effect cues.');
