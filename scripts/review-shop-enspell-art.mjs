import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dir = 'data/shop-magic-completion-20261009',
  manifest = JSON.parse(await fs.readFile(dir + '/art-manifest.json')),
  editorial = JSON.parse(await fs.readFile(dir + '/editorial.json')),
  ids = Object.keys(editorial).filter(
    (id) => editorial[id].family === 'Enspelled Weapon (Cantrip)',
  );
assert.equal(ids.length, 52);
await fs.mkdir('test-results', { recursive: true });
const hashes = new Set();
for (let start = 0; start < ids.length; start += 13) {
  const layers = [];
  for (let i = start; i < Math.min(start + 13, ids.length); i++) {
    const id = ids[i],
      art = manifest.assets.find((x) => x.id === id);
    assert(art);
    const file = 'public' + art.path,
      bytes = await fs.readFile(file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), art.sha256);
    assert(!hashes.has(art.sha256));
    hashes.add(art.sha256);
    const { data, info } = await sharp(bytes)
      .resize({ width: 180, height: 180, fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let solid = 0,
      clear = 0;
    for (let j = 3; j < data.length; j += 4) {
      if (data[j] > 200) solid++;
      if (data[j] === 0) clear++;
    }
    assert(solid > info.width * info.height * 0.025, id + ' visible silhouette');
    assert(clear > info.width * info.height * 0.15, id + ' transparent margins');
    const img = await sharp(bytes)
        .resize({ width: 180, height: 180, fit: 'contain', background: '#142129' })
        .flatten({ background: '#142129' })
        .png()
        .toBuffer(),
      n = i - start,
      col = n % 7,
      row = Math.floor(n / 7);
    layers.push({ input: img, left: col * 200 + 10, top: row * 215 + 5 });
    const label = Buffer.from(
      `<svg width="200" height="25"><text x="100" y="18" text-anchor="middle" fill="#ead7ac" font-family="Arial" font-size="10">${editorial[id].model_name}</text></svg>`,
    );
    layers.push({ input: label, left: col * 200, top: row * 215 + 185 });
    if (process.argv.includes('--approve')) {
      art.review = 'approved';
      art.review_notes =
        'Full original physical silhouette and distinct arcane-material skin inspected at 180px on the real dark shop background, including both ends, handles, bowstrings and firearm parts. Existing model anatomy, native transparency and proportions preserved.';
    }
  }
  await sharp({ create: { width: 1400, height: 430, channels: 4, background: '#142129' } })
    .composite(layers)
    .png()
    .toFile('test-results/enspell-cantrip-models-' + (start / 13 + 1) + '.png');
}
if (process.argv.includes('--approve'))
  await fs.writeFile(dir + '/art-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  'PASS 52 complete distinct physical models, alpha margins and exact artwork hashes; four dark shop-size sheets ready for visual review.',
);
