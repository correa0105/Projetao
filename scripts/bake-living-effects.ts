import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { livingEffects } from '../shared/vtt-effects-living';
// @ts-expect-error mathematical source remains executable without a TS runtime
import { livingField } from './living-density-fields.mjs';
const dir = 'public/vtt/living-20261010',
  soundDir = 'public/audio/vtt-living-20261010',
  size = 224,
  pad = 2,
  tile = size + pad * 2,
  frames = 32,
  period = 5,
  assets: any[] = [],
  sounds: any[] = [];
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
await fs.mkdir(dir, { recursive: true });
await fs.mkdir(soundDir, { recursive: true });
for (const [index, effect] of livingEffects.entries()) {
  const rgb = [1, 3, 5].map((i) => parseInt(effect.color.slice(i, i + 2), 16));
  for (let page = 0; page < 2; page++) {
    const width = tile * 4,
      buffer = Buffer.alloc(width * width * 4);
    for (let cell = 0; cell < 16; cell++)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const [d, hot, shade] = livingField(
            effect.kind,
            ((x + 0.5) / size) * 2 - 1,
            ((y + 0.5) / size) * 2 - 1,
            ((page * 16 + cell) / frames) * Math.PI * 2,
          );
          const at = (((cell >> 2) * tile + y + pad) * width + (cell % 4) * tile + x + pad) * 4;
          for (let k = 0; k < 3; k++) {
            const stone = effect.kind === 'obsidian-sun';
            const material = stone ? [13, 17, 23][k] + shade * 18 : rgb[k] * shade;
            const light = stone ? [255, 206, 124][k] : 255;
            buffer[at + k] = Math.round(material * (1 - hot) + light * hot);
          }
          buffer[at + 3] = Math.round(d * 255);
        }
    const path = dir + '/' + effect.kind + '-' + page + '.webp';
    await sharp(buffer, { raw: { width, height: width, channels: 4 } })
      .webp({ quality: 94, alphaQuality: 100, effort: 3 })
      .toFile(path);
    const bytes = await fs.readFile(path);
    assets.push({
      kind: effect.kind,
      page,
      path: path.slice(6),
      bytes: bytes.length,
      sha256: hash(bytes),
    });
  }
  const rate = 22050,
    duration = 1.4 + (index % 4) * 0.15,
    count = Math.round(rate * duration),
    values = new Float64Array(count),
    pcm = Buffer.alloc(count * 4);
  let seed = (index + 1) * 1234567,
    low = 0,
    peak = 0.001;
  for (let j = 0; j < count; j++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const t = j / rate,
      noise = ((seed >>> 0) / 4294967296) * 2 - 1;
    low += (0.02 + (index % 5) * 0.013) * (noise - low);
    const f = 145 + ((index * 47) % 560),
      osc = (freq: number) => Math.sin(Math.PI * 2 * freq * t);
    const shimmer =
      (osc(f) * 0.3 + osc(f * 1.498) * 0.18 + osc(f * 2.76) * 0.08) *
      Math.exp(-t * (1.6 + (index % 3)));
    const air =
      low * (0.34 + (index % 5) * 0.075) * Math.pow(Math.sin((Math.PI * t) / duration), 1.7);
    const grain = noise * 0.06 * Math.exp(-t * (7 + (index % 5)));
    const envelope = Math.min(1, t / 0.04, (duration - t) / 0.16);
    values[j] = (shimmer + air + grain) * Math.max(0, envelope);
    peak = Math.max(peak, Math.abs(values[j]));
  }
  for (let j = 0; j < count; j++) {
    pcm.writeInt16LE(Math.round((values[j] / peak) * 0.65 * 32767), j * 4);
    pcm.writeInt16LE(
      Math.round((values[Math.max(0, j - 11 - index)] / peak) * 0.61 * 32767),
      j * 4 + 2,
    );
  }
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(pcm.length + 36, 4);
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
  const wav = Buffer.concat([header, pcm]),
    path = soundDir + '/' + effect.kind + '.wav';
  await fs.writeFile(path, wav);
  sounds.push({
    kind: effect.kind,
    path: path.slice(6),
    duration,
    peak: 0.65,
    sha256: hash(wav),
    bytes: wav.length,
  });
  console.log('Created ' + effect.name + ' — 32 fluid frames and original stereo cue.');
}
await fs.writeFile(
  'data/vtt/living-effects-20261010.json',
  JSON.stringify(
    {
      method:
        'Original seamless mathematical materials and synthesized sounds, references inspected without copied media',
      references: [
        'https://br.pinterest.com/pin/786089310021947590/',
        'https://library.jb2a.com/#Water%20Splash',
        'https://library.jb2a.com/#Flames',
        'https://library.jb2a.com/#Energy%20Field',
        'https://library.jb2a.com/#Ice%20Spikes',
      ],
      referenceNote:
        'Pinterest public preview partially visible behind login panel; JB2A public animation previews inspected.',
      source: 'scripts/living-density-fields.mjs',
      source_sha256: hash(await fs.readFile('scripts/living-density-fields.mjs')),
      size,
      pad,
      tile,
      frames,
      period,
      assets,
      sounds,
      review: 'pending',
    },
    null,
    2,
  ) + '\n',
);
