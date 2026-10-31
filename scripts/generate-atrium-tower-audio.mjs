// Original deterministic synthesis. No recordings, samples or external compositions.
// node scripts/generate-atrium-tower-audio.mjs /path/to/ffmpeg
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const ffmpeg = process.argv[2];
assert(ffmpeg, 'Pass the path to ffmpeg.');
const rate = 32000,
  seconds = 96,
  length = rate * seconds;
const out = 'public/audio',
  scratch = '.local/atrio-ambientacao-20261031/audio';
await mkdir(scratch, { recursive: true });
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 20261031;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
function note(mix, at, midi, duration, gain, instrument, pan) {
  const f = hz(midi),
    n = Math.round(duration * rate);
  const left = Math.sqrt((1 - pan) / 2),
    right = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      p = 2 * Math.PI * f * t;
    const attack = Math.min(1, t / (instrument === 'strings' ? 1.4 : 0.045));
    const release = Math.min(1, (duration - t) / (instrument === 'strings' ? 1.8 : 0.8));
    let signal;
    if (instrument === 'harp') {
      signal =
        (Math.sin(p) +
          0.32 * Math.sin(2 * p) * Math.exp(-t * 2) +
          0.13 * Math.sin(3 * p) * Math.exp(-t * 3)) *
        Math.exp(-t * 1.1);
    } else if (instrument === 'bell') {
      signal =
        (Math.sin(p) +
          0.2 * Math.sin(p * 2.003) * Math.exp(-t) +
          0.06 * Math.sin(p * 3.97) * Math.exp(-t * 2)) *
        Math.exp(-t * 0.7);
    } else if (instrument === 'flute') {
      signal =
        (Math.sin(p + 0.018 * Math.sin(t * 31)) +
          0.12 * Math.sin(2 * p) +
          0.035 * Math.sin(3 * p)) *
        (0.9 + 0.1 * Math.sin(t * 2.8));
    } else {
      signal =
        (Math.sin(p + 0.026 * Math.sin(t * 25)) +
          0.3 * Math.sin(p * 1.0018) +
          0.18 * Math.sin(2 * p) +
          0.07 * Math.sin(3 * p)) *
        0.65;
    }
    const index = ((Math.round(at * rate) + i) % length) * 2;
    const value = signal * attack * release * gain;
    mix[index] += value * left;
    mix[index + 1] += value * right;
  }
}
const manifests = [];
async function save(name, mix, duration, description, loop = false) {
  if (loop) {
    const dry = mix.slice(),
      frames = mix.length / 2;
    for (const [delay, gain] of [
      [0.193, 0.17],
      [0.317, 0.13],
      [0.521, 0.11],
      [0.887, 0.08],
      [1.339, 0.055],
      [2.131, 0.035],
    ]) {
      const shift = Math.round(delay * rate);
      for (let i = 0; i < frames; i++) {
        const index = ((i + shift) % frames) * 2;
        mix[index] += dry[i * 2 + 1] * gain;
        mix[index + 1] += dry[i * 2] * gain;
      }
    }
  }
  let peak = 0,
    square = 0;
  for (const x of mix) {
    peak = Math.max(peak, Math.abs(x));
    square += x * x;
  }
  const gain = Math.min(0.78 / peak, (loop ? 0.105 : 0.15) / Math.sqrt(square / mix.length));
  const pcm = Buffer.alloc(mix.length * 2);
  for (let i = 0; i < mix.length; i++)
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * gain)) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  const wav = `${scratch}/${name}.wav`,
    target = `${out}/${name}.ogg`;
  await writeFile(wav, Buffer.concat([header, pcm]));
  execFileSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      wav,
      '-c:a',
      'libvorbis',
      '-q:a',
      '4',
      '-metadata',
      'artist=Alvorada Cinzenta',
      '-metadata',
      'copyright=CC0 1.0; original procedural synthesis',
      target,
    ],
    { windowsHide: true },
  );
  const bytes = await readFile(target);
  manifests.push({
    file: target,
    description,
    seconds: duration,
    sampleRate: rate,
    channels: 2,
    loop,
    peak: peak * gain,
    rms: Math.sqrt(square / mix.length) * gain,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
for (const tower of [false, true]) {
  const mix = new Float32Array(length * 2);
  const chords = tower
    ? [
        [43, 50, 58],
        [39, 46, 55],
        [46, 53, 60],
        [41, 48, 56],
      ]
    : [
        [50, 57, 64],
        [48, 55, 62],
        [53, 60, 67],
        [45, 52, 60],
      ];
  const melody = tower
    ? [74, 69, 70, 65, 67, 62, 65, 69, 67, 65, 62, 58]
    : [74, 76, 81, 79, 76, 74, 72, 69, 72, 76, 74, 69];
  for (let bar = 0; bar < 12; bar++) {
    const chord = chords[bar % 4],
      at = bar * 8;
    chord.forEach((pitch, i) =>
      note(mix, at, pitch, 11, tower ? 0.042 : 0.027, 'strings', (i - 1) * 0.45),
    );
    note(
      mix,
      at + 1,
      melody[bar],
      tower ? 4 : 3.5,
      tower ? 0.055 : 0.062,
      tower ? 'bell' : 'flute',
      tower ? -0.4 : 0.15,
    );
    if (!tower)
      for (let beat = 0; beat < 6; beat++)
        note(
          mix,
          at + beat * 1.25,
          chord[beat % 3] + 12,
          3.8,
          0.095,
          'harp',
          beat % 2 ? 0.5 : -0.5,
        );
    else {
      note(mix, at + 4.5, chord[1] + 12, 5, 0.035, 'bell', 0.65);
      note(mix, at + 2, chord[0] - 12, 8, 0.055, 'strings', 0);
    }
  }
  await save(
    tower ? 'tower-beyond-the-veil-20261031' : 'atrium-lantern-vigil-20261031',
    mix,
    seconds,
    tower
      ? 'Além do Véu: cordas graves e sinos distantes, tema original da torre.'
      : 'Vigília das Lanternas: harpa, sopro suave e cordas, tema original do átrio.',
    true,
  );
}
const duration = 4.2,
  wind = new Float32Array(Math.round(rate * duration) * 2);
let low = 0,
  rumble = 0;
for (let i = 0; i < wind.length / 2; i++) {
  const t = i / rate,
    white = random() * 2 - 1;
  low += 0.11 * (white - low);
  rumble += 0.006 * (white - rumble);
  const envelope = Math.sin((Math.PI * t) / duration) ** 0.75;
  const gusts = 0.45 + 0.25 * Math.sin(t * 5.1) ** 2 + 0.3 * Math.sin(t * 2.3) ** 2;
  const signal = (low - rumble * 0.6) * envelope * gusts;
  const pan = -0.8 + (1.6 * t) / duration;
  wind[i * 2] = signal * Math.sqrt((1 - pan) / 2);
  wind[i * 2 + 1] = signal * Math.sqrt((1 + pan) / 2);
}
await save(
  'atrium-corridor-wind-20261031',
  wind,
  duration,
  'Vento de ruído filtrado, com rajadas que atravessam o panorama estéreo.',
);
await writeFile(
  `${out}/atrium-tower-20261031-license.txt`,
  'Alvorada Cinzenta — Átrio e Torre (2026-10-31)\n\nOriginal deterministic synthesis by scripts/generate-atrium-tower-audio.mjs.\nNo third-party recordings, samples, melodies or commercial soundtracks.\nThese three recordings are dedicated to the public domain under CC0 1.0.\nCommercial use, modification and redistribution are permitted.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n\n' +
    manifests.map((a) => a.file.split('/').at(-1)).join('\n') +
    '\n',
);
await writeFile(
  'data/atrium-tower-audio-20261031.json',
  JSON.stringify(
    {
      license: 'CC0-1.0',
      origin: 'Original deterministic synthesis, no external samples',
      generator: 'scripts/generate-atrium-tower-audio.mjs',
      assets: manifests,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(manifests));
