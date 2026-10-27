// Original short cannon cue: pressure crack, low body and a small stereo decay.
// No third-party recording or remote asset is used.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const rate = 48000,
  seconds = 2.6,
  n = Math.round(rate * seconds),
  dry = new Float64Array(n);
let seed = 0x1a170e,
  low = 0,
  phase = 0;
function noise() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 2147483648 - 1;
}
for (let i = 0; i < n; i++) {
  const t = i / rate,
    w = noise();
  low += 0.025 * (w - low);
  phase += (2 * Math.PI * (43 + 112 * Math.exp(-t / 0.045))) / rate;
  const crack = (w - low) * Math.exp(-t / 0.032) * 0.78,
    body = (Math.sin(phase) + 0.23 * Math.sin(phase * 2.03)) * Math.exp(-t / 0.29) * 0.5,
    rumble = low * Math.exp(-t / 0.44) * 2.2,
    hiss = (w - low) * Math.exp(-t / 0.3) * 0.06;
  dry[i] =
    Math.tanh((crack + body + rumble + hiss) * Math.min(1, t / 0.0008)) *
    Math.min(1, (seconds - t) / 0.15);
}
const left = new Float64Array(n),
  right = new Float64Array(n),
  taps = [
    [0.043, 0.19],
    [0.083, 0.12],
    [0.139, 0.085],
    [0.227, 0.052],
    [0.349, 0.028],
    [0.491, 0.014],
  ];
let peak = 0,
  squares = 0;
for (let i = 0; i < n; i++) {
  let l = dry[i],
    r = dry[i];
  for (let k = 0; k < taps.length; k++) {
    const [delay, gain] = taps[k],
      a = i - Math.round(delay * rate),
      b = i - Math.round((delay + 0.007 * (k % 2 ? 1 : -1)) * rate);
    if (a >= 0) l += dry[a] * gain;
    if (b >= 0) r += dry[b] * gain;
  }
  left[i] = l;
  right[i] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const gain = 0.7 / peak,
  buffer = Buffer.alloc(44 + n * 4);
buffer.write('RIFF');
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(rate, 24);
buffer.writeUInt32LE(rate * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  const l = left[i] * gain,
    r = right[i] * gain;
  squares += l * l + r * r;
  buffer.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buffer.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
await mkdir('public/audio/vtt-siege', { recursive: true });
await writeFile('public/audio/vtt-siege/cannon-shot-v1.wav', buffer);
const asset = {
  id: 'cannon-shot',
  path: '/audio/vtt-siege/cannon-shot-v1.wav',
  sha256: createHash('sha256').update(buffer).digest('hex'),
  bytes: buffer.length,
  sampleRate: rate,
  channels: 2,
  bits: 16,
  duration: seconds,
  peakDb: 20 * Math.log10(0.7),
  rmsDb: 10 * Math.log10(squares / (n * 2)),
  source: 'Original procedural cue; scripts/build-vtt-siege-audio.mjs',
};
await writeFile(
  'data/vtt/siege-audio-20261026.json',
  JSON.stringify({ date: '2026-10-26', assets: [asset] }, null, 2) + '\n',
);
console.log(JSON.stringify(asset));
