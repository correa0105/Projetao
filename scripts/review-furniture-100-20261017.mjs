import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = 'data/vtt/furniture-100-20261017',
  plan = JSON.parse(await fs.readFile(root + '/prompts.json')),
  hashes = new Set(),
  done = [];
for (const p of plan) {
  let b;
  try {
    b = await fs.readFile('public' + p.image);
  } catch (e) {
    if (e.code === 'ENOENT') continue;
    throw e;
  }
  const m = JSON.parse(
      (await fs.readFile(`${root}/completed/${p.id}.json`, 'utf8')).replace(/^\uFEFF/, ''),
    ),
    hash = createHash('sha256').update(b).digest('hex');
  assert.equal(m.sha256, hash, p.id);
  assert(!hashes.has(hash), 'Duplicate ' + p.id);
  hashes.add(hash);
  const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let zero = 0,
    solid = 0,
    edge = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (!a) zero++;
      if (a > 230) solid++;
      if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && a) edge++;
    }
  assert(zero > 100 && solid > 100 && edge === 0, 'Transparency/clipping ' + p.id);
  assert.equal(Math.max(info.width, info.height), 1280);
  assert.equal(m.generator, 'built-in image_gen');
  assert(Math.abs(info.width / info.height - p.width / p.height) < 0.015, p.id);
  await fs.access('public' + p.thumbnail);
  done.push({ ...p, sha256: hash, dimensions: [info.width, info.height] });
}
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
for (let page = 0; page < 5; page++) {
  const items = done.filter(
      (p) => Number(p.id.slice(-3)) >= 151 + page * 20 && Number(p.id.slice(-3)) < 171 + page * 20,
    ),
    images = [];
  if (!items.length) continue;
  for (const p of items) {
    const n = Number(p.id.slice(-3)) - 151 - page * 20,
      x = (n % 4) * 270,
      y = Math.floor(n / 4) * 270;
    const sprite = await sharp('public' + p.image)
      .resize(244, 218, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });
    images.push({
      input: sprite.data,
      left: x + Math.round((270 - sprite.info.width) / 2),
      top: y + Math.round((228 - sprite.info.height) / 2),
    });
    const label = Buffer.from(
      `<svg width="270" height="40"><text x="135" y="14" text-anchor="middle" fill="#f1e4c6" font-family="Arial" font-size="11">${p.id}</text><text x="135" y="31" text-anchor="middle" fill="#f1e4c6" font-family="Arial" font-size="12">${escape(p.name)}</text></svg>`,
    );
    images.push({ input: label, left: x, top: y + 228 });
  }
  await sharp({ create: { width: 1080, height: 1350, channels: 4, background: '#343b2b' } })
    .composite(images)
    .png()
    .toFile(`${root}/review-${page + 1}.png`);
}
await fs.mkdir('test-results/furniture-100', { recursive: true });
await fs.writeFile(
  'test-results/furniture-100/assets.json',
  JSON.stringify(
    {
      passed: done.length === 100,
      total: 100,
      available: done.length,
      distinct: hashes.size,
      transparent: true,
      unclipped: true,
      assets: done,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    available: done.length,
    total: 100,
    distinct: hashes.size,
    transparent: true,
    unclipped: true,
  }),
);
