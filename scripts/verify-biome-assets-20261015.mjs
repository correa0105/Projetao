import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const plan = await read('data/vtt/biomes-20261015/plan.json');
const ready = await read('data/vtt/biomes-20261015/ready.json');
const nature = await read('shared/vtt-biome-nature-20261015.json');
const trees = await read('shared/vtt-biome-trees-20261015.json');
const houses = await read('shared/vtt-biome-houses-20261015.json');
assert.equal(plan.items.length, 142);
assert.equal(new Set(plan.items.map(a => a.id)).size, 142);
assert.equal(nature.filter(a => a.category === 'Floresta').length, 40);
if (process.argv.includes('--complete')) {
  assert.equal(ready.reviewed, 142);
  assert.equal(ready.images, 162);
  assert.equal(nature.length, 120);
  assert.equal(trees.length, 20);
  assert.equal(houses.length, 20);
  assert.equal(ready.paints.length, 2);
  for (const category of ['Pântano', 'Neve']) {
    assert.equal(nature.filter(a => a.category === category).length, 40);
    assert.equal(trees.filter(a => a.group === category).length, 10);
    assert.equal(houses.filter(a => a.category === category).length, 10);
  }
}
const hashes = new Set(), originals = new Set(), rows = [];
for (const item of ready.ready) {
  const record = await read('data/vtt/biomes-20261015/completed/' + item.id + '.json');
  assert.equal(record.status, 'reviewed');
  assert(record.prompt.length > 100);
  assert(record.review.scaleChecked && record.review.subject);
  assert(!originals.has(record.outputs.main.sourceBasename), 'Reused original: ' + item.id);
  originals.add(record.outputs.main.sourceBasename);
  for (const [view, output] of Object.entries(record.outputs)) {
    const bytes = await fs.readFile(path.join(root, 'public', output.image));
    const meta = await sharp(bytes).metadata(), stats = await sharp(bytes).stats();
    assert.equal(createHash('sha256').update(bytes).digest('hex'), output.sha256);
    assert(!hashes.has(output.sha256), 'Duplicate image: ' + output.image);
    hashes.add(output.sha256);
    assert.equal(output.generator, 'built-in image_gen');
    assert.equal(meta.width, output.pixelWidth);
    assert.equal(meta.height, output.pixelHeight);
    assert.equal(meta.hasAlpha && !stats.isOpaque, item.type !== 'paint');
    assert(bytes.length < 800_000, 'Too heavy: ' + output.image);
    const thumb = await sharp(path.join(root, 'public', output.thumbnail)).metadata();
    assert(Math.max(thumb.width, thumb.height) <= 192);
    assert(Math.abs(output.width / output.height - meta.width / meta.height) < .001);
    assert(Math.abs(Math.max(output.width, output.height) * 1.5 - record.sizeMetres) < .002);
    if (item.type === 'building' || item.type === 'paint') {
      assert.equal(meta.width, 1024);
      assert.equal(meta.height, 1024);
    }
    rows.push({ id: item.id, view, bytes: bytes.length, image: output.image });
  }
  if (item.type === 'building') {
    const house = houses.find(a => a.id === item.id);
    assert(house && house.interior !== house.image);
    assert(Math.abs((house.footprint.doorEnd - house.footprint.doorStart) * record.sizeMetres - 1.05) < .001);
  }
}
await fs.mkdir(path.join(root, 'test-results/biome-assets'), { recursive: true });
const result = { passed: true, complete: ready.reviewed === 142, reviewed: ready.reviewed, images: rows.length, unique: true, originalCalls: originals.size, bytes: rows.reduce((n, r) => n + r.bytes, 0), rows };
await fs.writeFile(path.join(root, 'test-results/biome-assets/media.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, rows: undefined }));
