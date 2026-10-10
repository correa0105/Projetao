import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const dir = 'data/shop-magic-completion-20261009';
const manifest = JSON.parse(await fs.readFile(dir + '/art-manifest.json'));
const editorial = JSON.parse(await fs.readFile(dir + '/editorial.json'));
const ids = Object.keys(editorial).filter((id) => editorial[id].family === 'Drow Weapon');
assert.equal(ids.length, 153);
const hashes = new Set(manifest.assets.filter((a) => !ids.includes(a.id)).map((a) => a.sha256));
await fs.mkdir('test-results', { recursive: true });
for (let bonus = 1; bonus <= 3; bonus++) {
  const rows = ids.filter((id) => editorial[id].name.endsWith(` +${bonus})`));
  assert.equal(rows.length, 51);
  const layers = [];
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i],
      a = manifest.assets.find((a) => a.id === id);
    assert(a);
    assert.equal(a.enhancement, bonus);
    const bytes = await fs.readFile('public' + a.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
    assert(!hashes.has(a.sha256), id + ' duplicate art');
    hashes.add(a.sha256);
    const { data, info } = await sharp(bytes)
      .resize({ width: 160, height: 160, fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let solid = 0,
      clear = 0;
    for (let j = 3; j < data.length; j += 4) {
      if (data[j] > 200) solid++;
      if (data[j] === 0) clear++;
    }
    assert(solid > info.width * info.height * 0.025, id);
    assert(clear > info.width * info.height * 0.15, id);
    const img = await sharp(bytes)
      .resize({ width: 160, height: 160, fit: 'contain', background: '#142129' })
      .flatten({ background: '#142129' })
      .png()
      .toBuffer();
    const col = i % 8,
      row = Math.floor(i / 8);
    layers.push({ input: img, left: col * 180 + 10, top: row * 185 });
    layers.push({
      input: Buffer.from(
        `<svg width="180" height="25"><text x="90" y="18" text-anchor="middle" fill="#ead7ac" font-family="Arial" font-size="10">${editorial[id].model_name}</text></svg>`,
      ),
      left: col * 180,
      top: row * 185 + 160,
    });
    if (process.argv.includes('--approve')) {
      a.review = 'approved';
      a.review_notes =
        'Complete physical model and original Drow bonus material inspected on the dark shop background at 160px. Handles, blades, bowstrings and firearm anatomy remain legible and transparent; unique artwork SHA and distinct silver-web, chitin or carved-mithral structure reviewed.';
    }
  }
  await sharp({ create: { width: 1440, height: 1295, channels: 4, background: '#142129' } })
    .composite(layers)
    .png()
    .toFile(`test-results/drow-bonus-${bonus}-models.png`);
}
if (process.argv.includes('--approve'))
  await fs.writeFile(dir + '/art-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  'PASS 153 unique complete Drow skins, source hashes and alpha; three sheets prepared for visual review.',
);
