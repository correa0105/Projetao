import { writeFileSync } from 'node:fs';

// Lively double door chime: bright alternating bells in two quick fluttering bursts.
// A softer return flutter settles into the natural ringing of the metal.
const rate = 44100;
const duration = 2.1;
const samples = new Float64Array(Math.round(rate * duration));
const strikes = [
  [0.005, 0.85, 1], [0.075, 1, 1.25], [0.145, 0.88, 1],
  [0.22, 0.92, 1.25], [0.30, 0.65, 1], [0.39, 0.62, 1.25],
  [0.64, 0.48, 1], [0.725, 0.43, 1.25], [0.825, 0.32, 1],
  [0.94, 0.25, 1.25], [1.075, 0.13, 1],
];
const partials = [
  [1760, 1, 0.28], [3528, 0.28, 0.15], [4740, 0.12, 0.09],
  [6500, 0.045, 0.045], [930, 0.08, 0.055],
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
    samples[i] += strength * 0.07 * noise() * attack * Math.exp(-t / 0.002);
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
  const sample = Math.tanh(samples[i] / peak * 1.15) / Math.tanh(1.15);
  wav.writeInt16LE(Math.round(sample * 0.92 * fade * 32767), 44 + i * 2);
}
writeFileSync(new URL('../public/audio/shop-door-bell.wav', import.meta.url), wav);
console.log(`Sino gerado: ${duration}s, PCM mono ${rate} Hz, dois balanços com intensidade decrescente.`);
