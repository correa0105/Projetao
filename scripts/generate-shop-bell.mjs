import { writeFileSync } from 'node:fs';

// A swinging brass door bell: one lively trill and a softer settling swing.
const rate = 44100;
const duration = 3.2;
const samples = new Float64Array(Math.round(rate * duration));
const strikes = [
  [0.02, 1, 1], [0.13, 0.76, 1.004], [0.27, 0.58, 0.998],
  [0.82, 0.40, 1.002], [0.99, 0.26, 0.999], [1.21, 0.14, 1],
];
const partials = [[1, 1, 0.55], [2.01, 0.36, 0.38], [2.76, 0.20, 0.25], [4.07, 0.09, 0.16], [5.43, 0.035, 0.10]];
for (const [start, strength, tuning] of strikes) {
  for (let i = Math.ceil(start * rate); i < samples.length; i++) {
    const t = i / rate - start;
    const attack = 1 - Math.exp(-t / 0.0025);
    for (const [ratio, weight, decay] of partials) {
      const frequency = 1480 * ratio * tuning;
      // Slightly split resonances give the metal a natural shimmer.
      const tone = Math.sin(2 * Math.PI * frequency * t) * 0.78
        + Math.sin(2 * Math.PI * frequency * 1.003 * t) * 0.22;
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
  wav.writeInt16LE(Math.round(samples[i] / peak * 0.78 * fade * 32767), 44 + i * 2);
}
writeFileSync(new URL('../public/audio/shop-door-bell.wav', import.meta.url), wav);
console.log(`Sino gerado: ${duration}s, PCM mono ${rate} Hz, dois balanços com intensidade decrescente.`);
