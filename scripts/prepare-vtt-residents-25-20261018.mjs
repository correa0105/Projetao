import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = 'data/vtt/residents-25-20261018',
  plan = JSON.parse(await fs.readFile(root + '/prompts.json'));
const additions = [],
  tiles = [],
  hashes = new Set();
for (const [i, row] of plan.entries()) {
  const metadata = JSON.parse(await fs.readFile(root + '/completed/' + row.id + '.json'));
  assert.equal(metadata.prompt, row.prompt, 'Outdated candidate ' + row.id);
  assert.equal(metadata.image, row.image);
  const image = await fs.readFile('public' + row.image),
    m = await sharp(image).metadata(),
    s = await sharp(image).stats();
  assert(m.hasAlpha && s.channels[3].min === 0 && s.channels[3].max === 255, row.id + ' alpha');
  const hash = createHash('sha256').update(image).digest('hex');
  assert.equal(hash, metadata.sha256);
  hashes.add(hash);
  additions.push({
    id: row.id,
    name: row.name,
    category: 'Moradores',
    width: 1,
    height: 1,
    image: row.image,
    thumbnail: row.thumbnail,
    actor: true,
    species: row.species,
    notes: row.name.replace(' · ', ': ') + '. Morador da vila, com ofício e aparência próprios.',
    bodyScale: row.bodyScale,
  });
  const label = Buffer.from(
    `<svg width="224" height="34"><text x="6" y="21" fill="#e6dec5" font-family="sans-serif" font-size="11">${row.id.slice(-3)} · ${row.name}</text></svg>`,
  );
  const tile = await sharp({
    create: { width: 224, height: 258, channels: 3, background: '#28312b' },
  })
    .composite([
      { input: await sharp(image).resize(216, 216).toBuffer(), left: 4, top: 4 },
      { input: label, left: 0, top: 222 },
    ])
    .png()
    .toBuffer();
  tiles.push({ input: tile, left: (i % 5) * 224, top: Math.floor(i / 5) * 258 });
}
assert.equal(hashes.size, 25);
assert.equal(additions.length, 25);
const catalogPath = 'shared/vtt-village-catalog.json',
  catalog = JSON.parse(await fs.readFile(catalogPath)),
  ids = new Set(additions.map((a) => a.id));
await fs.writeFile(
  catalogPath,
  JSON.stringify([...catalog.filter((a) => !ids.has(a.id)), ...additions], null, 2) + '\n',
);
await sharp({ create: { width: 1120, height: 1290, channels: 3, background: '#28312b' } })
  .composite(tiles)
  .png()
  .toFile(root + '/review.png');
await fs.writeFile(
  root + '/assets.json',
  JSON.stringify(
    {
      passed: true,
      additions: 25,
      totalResidents: 50,
      distinct: 25,
      alpha: true,
      files: plan.flatMap((a) => [a.image, a.thumbnail]),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Prepared 25 residents, transparent art, thumbnails and a contact sheet; 50 residents total.',
);
