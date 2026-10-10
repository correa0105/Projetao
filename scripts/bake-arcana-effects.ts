import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { arcanaEffects } from '../shared/vtt-effects-arcana';
// @ts-expect-error mathematical generator is a standalone JavaScript module
import { densityField } from './arcana-density-fields.mjs';
const dir = 'public/vtt/arcana-20261010',
  size = 192,
  pad = 2,
  tile = size + pad * 2,
  frames = 32,
  assets = [];
await fs.mkdir(dir, { recursive: true });
for (const effect of arcanaEffects) {
  const rgb = [1, 3, 5].map((i) => parseInt(effect.color.slice(i, i + 2), 16));
  for (let page = 0; page < 2; page++) {
    const width = tile * 4,
      buffer = Buffer.alloc(width * width * 4);
    for (let cell = 0; cell < 16; cell++)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const [density, hot, shade] = densityField(
            effect.kind,
            ((x + 0.5) / size) * 2 - 1,
            ((y + 0.5) / size) * 2 - 1,
            ((page * 16 + cell) / frames) * Math.PI * 2,
          );
          const at = (((cell >> 2) * tile + y + pad) * width + (cell % 4) * tile + x + pad) * 4;
          for (let k = 0; k < 3; k++)
            buffer[at + k] = Math.round(rgb[k] * shade * (1 - hot) + 255 * hot);
          buffer[at + 3] = Math.round(density * 255);
        }
    const output = dir + '/' + effect.kind + '-' + page + '.webp';
    await sharp(buffer, { raw: { width, height: width, channels: 4 } })
      .webp({ quality: 92, alphaQuality: 100, effort: 3 })
      .toFile(output);
    assets.push({
      kind: effect.kind,
      page,
      path: output.slice('public'.length),
      sha256: createHash('sha256')
        .update(await fs.readFile(output))
        .digest('hex'),
    });
  }
  console.log('Baked ' + effect.name + ' with 32 original evolving density frames.');
}
const source = await fs.readFile('scripts/arcana-density-fields.mjs');
await fs.mkdir('data/vtt', { recursive: true });
await fs.writeFile(
  'data/vtt/arcana-effects-20261010.json',
  JSON.stringify(
    {
      method:
        'Original periodic mathematical density fields, code-native Canvas animation, no copied reference assets',
      references: [
        'https://br.pinterest.com/pin/786089310021947590/',
        'https://library.jb2a.com/#Shield',
      ],
      source: 'scripts/arcana-density-fields.mjs',
      source_sha256: createHash('sha256').update(source).digest('hex'),
      size,
      pad,
      tile,
      frames,
      period: 4,
      assets,
      review: 'pending',
    },
    null,
    2,
  ) + '\n',
);
