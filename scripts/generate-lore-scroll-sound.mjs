// Original paper foley synthesis: a dry unfurl, irregular folds and a final soft rustle.
// No recordings or third-party audio are used. Run with Node to regenerate the asset.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rate = 44100;
const duration = 1.24;
const samples = new Float64Array(Math.round(rate * duration));
let seed = 835712,
  low = 0,
  soft = 0;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}
function fold(t, start, length, strength) {
  const u = (t - start) / length;
  return u > 0 && u < 1 ? strength * Math.sin(Math.PI * u) ** 1.7 : 0;
}
const creases = Array.from({ length: 28 }, (_, i) => ({
  start: 0.1 + i * 0.031 + (noise() + 1) * 0.012,
  length: 0.009 + (noise() + 1) * 0.01,
  strength: 0.18 + (noise() + 1) * 0.1,
}));
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  const random = noise();
  low += 0.32 * (random - low);
  soft += 0.07 * (random - soft);
  const motion = fold(t, 0.02, 0.36, 0.45) + fold(t, 0.25, 0.59, 0.8) + fold(t, 0.78, 0.34, 0.27);
  const flutter = 0.75 + 0.15 * Math.sin(t * 109) + 0.1 * Math.sin(t * 193 + 0.8);
  const crackle = creases.reduce(
    (sum, crease) => sum + fold(t, crease.start, crease.length, crease.strength),
    0,
  );
  samples[i] = motion * flutter * (low - soft) + crackle * 0.38 * (random - low);
}
const peak = Math.max(...samples.map(Math.abs));
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++)
  wav.writeInt16LE(Math.round((samples[i] / peak) * 0.72 * 32767), 44 + i * 2);
writeFileSync(fileURLToPath(new URL('../public/audio/lore-scroll-open.wav', import.meta.url)), wav);
console.log(`Pergaminho: ${duration}s, PCM mono ${rate}Hz, ${wav.length} bytes.`);
