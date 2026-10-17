import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const roots = ['data/vtt/nadir-refit-20261016', 'data/vtt/medieval-expansion-20261017'],
  assets = [],
  hashes = new Set();
for (const [i, root] of roots.entries()) {
  const plan = JSON.parse(await fs.readFile(root + '/prompts.json'));
  assert.equal(plan.length, i ? 170 : 255);
  for (const q of plan) {
    const r = JSON.parse(await fs.readFile(root + '/completed/' + q.id + '.json'));
    const bytes = await fs.readFile(r.public),
      sha = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, r.sha256, q.id);
    assert(!hashes.has(sha), 'Duplicate image ' + q.id);
    hashes.add(sha);
    await fs.access(r.thumbnail);
    assert(r.prompt && r.generator === 'built-in image_gen', q.id);
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let zero = 0,
      solid = 0,
      edge = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a === 0) zero++;
        if (a > 230) solid++;
        if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && a > 0) edge++;
      }
    assert(
      Math.max(info.width, info.height) >= 1000 && Math.min(info.width, info.height) >= 128,
      q.id,
    );
    if (q.kind === 'terrain') {
      assert.equal(zero, 0, q.id);
    } else {
      assert(zero > 0 && solid > 100, q.id);
      assert.equal(edge, 0, 'Clipped sprite ' + q.id);
    }
    assets.push({
      id: q.id,
      kind: q.kind,
      public: r.public,
      thumbnail: r.thumbnail,
      sha256: sha,
      dimensions: [info.width, info.height],
      transparent: q.kind !== 'terrain',
    });
  }
}
assert.equal(assets.length, 425);
const report = {
  passed: true,
  total: 425,
  sprites: 405,
  terrain: 20,
  distinctImages: hashes.size,
  assets,
};
await fs.mkdir('test-results/medieval-assets', { recursive: true });
await fs.writeFile('test-results/medieval-assets/result.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    passed: true,
    total: 425,
    sprites: 405,
    terrain: 20,
    distinctImages: hashes.size,
  }),
);
