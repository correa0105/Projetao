import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const plan = JSON.parse(await fs.readFile('data/site-art-plan-20261012.json'));
const catalog = {};
const manifests = {
  statue: JSON.parse(
    await fs.readFile('public/house/items/house-refit-20261007/art-manifest.json'),
  ),
  expansion: JSON.parse(
    await fs.readFile('public/house/items/house-expansion-20261008/art-manifest.json'),
  ),
};
for (const p of plan.filter((p) => p.kind === 'house')) {
  const record = JSON.parse(await fs.readFile(`data/site-art-completed-20261012/${p.key}.json`));
  const bytes = await fs.readFile(p.output);
  if (createHash('sha256').update(bytes).digest('hex') !== record.sha256)
    throw Error('Changed art ' + p.key);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let l = info.width,
    r = -1,
    t = info.height,
    b = -1,
    clear = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a < 8) clear++;
      if (a > 1) {
        l = Math.min(l, x);
        r = Math.max(r, x);
        t = Math.min(t, y);
        b = Math.max(b, y);
      }
    }
  if (clear / (info.width * info.height) < 0.04 || r < l)
    throw Error('Invalid transparency ' + p.key);
  const reference = manifests[p.id === 'statue' ? 'statue' : 'expansion'].assets.find(
    (a) => a.id === p.id && a.facing === 1,
  );
  const foot = (a) => 1.4 * Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));
  const width =
    p.id === 'open-codex'
      ? ((info.width / (r - l + 1)) * foot((p.facing * Math.PI) / 4)) /
        ((reference.width / reference.visible_width) * foot(Math.PI / 4))
      : info.width / (b - t + 1) / (reference.width / reference.visible_height);
  (catalog[p.id] ||= {})[p.facing] = {
    image: '/' + p.output.replace(/^public\//, ''),
    width: Number(width.toFixed(5)),
  };
}
await fs.writeFile('shared/house-view-repairs.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(
  'Calibrated ' +
    plan.filter((p) => p.kind === 'house').length +
    ' repaired views; historical layouts and IDs retained.',
);
