import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const rate = 48000,
  manifestPath = 'data/vtt/siege-audio-20261026.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const kind of ['cannon', 'harpoon']) {
  const duration = kind === 'cannon' ? 2.25 : 2.7,
    n = Math.round(duration * rate),
    mono = new Float64Array(n);
  let seed = kind === 'cannon' ? 0x120694 : 0x43782a,
    low = 0;
  const noise = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2147483648 - 1;
  };
  function contact(at, strength, material) {
    const start = Math.round(at * rate),
      tail = material === 'metal' ? 0.27 : 0.16;
    for (let j = 0; j < tail * rate && start + j < n; j++) {
      const t = j / rate,
        attack = Math.min(1, t / 0.0008),
        freq = material === 'metal' ? [427, 913, 1777, 2861] : [121, 267, 529];
      let v = 0;
      for (let k = 0; k < freq.length; k++)
        v +=
          (Math.sin(2 * Math.PI * freq[k] * t) *
            Math.exp(-t / (material === 'metal' ? 0.1 / (1 + k * 0.7) : 0.037 / (1 + k * 0.4)))) /
          (1 + k);
      mono[start + j] += strength * (v * 0.23 + noise() * Math.exp(-t / 0.009) * 0.2) * attack;
    }
  }
  if (kind === 'cannon') {
    contact(0.035, 0.7, 'metal');
    contact(0.31, 0.66, 'wood');
    contact(0.72, 0.43, 'wood');
    contact(1.09, 0.8, 'wood');
    contact(1.48, 0.35, 'metal');
    contact(1.72, 0.85, 'metal');
    for (let i = 0; i < n; i++) {
      const t = i / rate,
        w = noise();
      low += 0.09 * (w - low);
      const friction = Math.max(0, Math.sin(((t - 0.27) * Math.PI) / 0.91));
      if (t > 0.27 && t < 1.18)
        mono[i] += (w - low) * friction * 0.035 * (0.6 + 0.4 * Math.sin(t * 61));
      if (t > 1.45 && t < 1.73) mono[i] += low * 0.07;
    }
  } else {
    contact(0.035, 0.45, 'wood');
    for (let k = 0; k < 19; k++) contact(0.19 + k * 0.094, 0.12 + 0.07 * (k % 3), 'metal');
    for (let i = 0; i < n; i++) {
      const t = i / rate,
        w = noise();
      low += 0.07 * (w - low);
      const envelope = Math.max(0, Math.sin(((t - 0.14) * Math.PI) / 1.95));
      if (t > 0.14 && t < 2.09)
        mono[i] +=
          (low * 0.17 +
            Math.sin(2 * Math.PI * (179 * t + 5 * t * t) + 0.12 * Math.sin(t * 31)) * 0.025) *
          envelope;
    }
    contact(2.13, 0.75, 'metal');
    contact(2.23, 0.37, 'wood');
  }
  const left = new Float64Array(n),
    right = new Float64Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / (rate * 0.003), (n - i) / (rate * 0.025)),
      a = i - Math.round(rate * 0.006),
      b = i - Math.round(rate * 0.012);
    left[i] = (mono[i] + (a >= 0 ? mono[a] * 0.11 : 0)) * fade;
    right[i] = (mono[i] + (b >= 0 ? mono[b] * 0.09 : 0)) * fade;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = 0.67 / peak,
    bytes = Buffer.alloc(44 + n * 4);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(n * 4, 40);
  let squares = 0;
  for (let i = 0; i < n; i++) {
    const l = left[i] * gain,
      r = right[i] * gain;
    squares += l * l + r * r;
    bytes.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    bytes.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  const id = kind + '-load',
    path = `/audio/vtt-siege/${id}-v1.wav`;
  await mkdir('public/audio/vtt-siege', { recursive: true });
  await writeFile('public' + path, bytes);
  const asset = {
    id,
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    sampleRate: rate,
    channels: 2,
    bits: 16,
    duration,
    peakDb: 20 * Math.log10(0.67),
    rmsDb: 10 * Math.log10(squares / (n * 2)),
    source: 'Original mechanical foley synthesis; scripts/build-vtt-siege-loading-audio.mjs',
  };
  manifest.assets = manifest.assets.filter((a) => a.id !== id);
  manifest.assets.push(asset);
  console.log(JSON.stringify(asset));
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
