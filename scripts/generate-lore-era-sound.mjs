// Original mechanical foley: intermeshing teeth, a slowing shaft and a locking clunk.
import { writeFileSync } from 'node:fs';
const rate = 44100,
  duration = 1.05;
const samples = new Float64Array(Math.round(rate * duration));
let seed = 719273,
  low = 0;
const noise = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2147483648 - 1;
const teeth = Array.from({ length: 23 }, (_, i) => ({
  start: 0.025 + i * 0.022 + i * i * 0.00048,
  force: 0.13 + (noise() + 1) * 0.055,
}));
for (let i = 0; i < samples.length; i++) {
  const t = i / rate,
    n = noise();
  low += 0.065 * (n - low);
  const motion = t < 0.79 ? Math.sin((Math.PI * t) / 0.79) ** 0.6 : 0;
  let value = motion * (low * 0.44 + (n - low) * 0.055);
  for (const tooth of teeth) {
    const u = t - tooth.start;
    if (u >= 0 && u < 0.05)
      value += tooth.force * Math.exp(-u * 110) * (n * 0.6 + Math.sin(u * 2 * Math.PI * 860) * 0.4);
  }
  const lock = t - 0.795;
  if (lock >= 0) {
    value += Math.exp(-lock * 34) * (n * 0.26 + Math.sin(lock * 2 * Math.PI * 92) * 0.63);
    value += Math.exp(-lock * 24) * Math.sin(lock * 2 * Math.PI * 310) * 0.16;
  }
  samples[i] = value * Math.min(1, t / 0.012, (duration - t) / 0.03);
}
let peak = 0;
for (const value of samples) peak = Math.max(peak, Math.abs(value));
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF');
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
  wav.writeInt16LE(Math.round((samples[i] / peak) * 0.75 * 32767), 44 + i * 2);
writeFileSync(new URL('../public/audio/lore-era-lock.wav', import.meta.url), wav);
console.log(`Engrenagens e tranco: ${duration}s, PCM mono ${rate}Hz.`);
