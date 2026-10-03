import { writeFileSync } from 'node:fs';

// Dry, close door-mounted brass bell. Inharmonic shell modes and clapper contact;
// no reverberation, chorus or echo. The return swing loses energy and slows down.
const rate = 44100;
const duration = 2.25;
const samples = new Float64Array(Math.round(rate * duration));
const strikes = [
  [0.005, 1, 1], [0.095, 0.90, 1.002], [0.205, 0.72, 0.999],
  [0.55, 0.49, 1], [0.68, 0.34, 1.001], [0.85, 0.18, 0.998],
];
const partials = [
  [830, 0.42, 0.18], [1370, 1, 0.24], [1925, 0.68, 0.19],
  [2860, 0.44, 0.13], [3810, 0.26, 0.085], [5240, 0.12, 0.045],
  [6970, 0.055, 0.025],
];
let randomState = 1937;
const noise = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 2147483648 - 1;
};
for (const [start, strength, tuning] of strikes) {
  for (let i = Math.ceil(start * rate); i < samples.length; i++) {
    const t = i / rate - start;
    const attack = 1 - Math.exp(-t / 0.00035);
    // Audible clapper contact makes each strike feel physically close.
    samples[i] += strength * 0.32 * noise() * attack * Math.exp(-t / 0.003);
    for (const [frequency, weight, decay] of partials) {
      const tone = Math.sin(2 * Math.PI * frequency * tuning * t);
      samples[i] += strength * weight * attack * Math.exp(-t / decay) * tone;
    }
  }
}
const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
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
for (let i = 0; i < samples.length; i++) {
  const fade = Math.min(1, (samples.length - 1 - i) / (rate * 0.15));
  // Gentle saturation lifts the body of the bell without digital clipping.
  const sample = Math.tanh(samples[i] / peak * 1.6) / Math.tanh(1.6);
  wav.writeInt16LE(Math.round(sample * 0.92 * fade * 32767), 44 + i * 2);
}
writeFileSync(new URL('../public/audio/shop-door-bell.wav', import.meta.url), wav);
console.log(`Sino gerado: ${duration}s, PCM mono ${rate} Hz, dois balanços com intensidade decrescente.`);
