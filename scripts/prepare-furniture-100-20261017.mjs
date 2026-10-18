import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const root = 'data/vtt/furniture-100-20261017',
  plan = JSON.parse(await fs.readFile(root + '/prompts.json'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const reports = [];
for (const p of plan) {
  let m;
  try {
    m = JSON.parse(
      (await fs.readFile(`${root}/completed/${p.id}.json`, 'utf8')).replace(/^\uFEFF/, ''),
    );
  } catch (e) {
    if (e.code === 'ENOENT') continue;
    throw e;
  }
  let source;
  try {
    source = await fs.readFile(m.localSource ?? `${root}/${p.id}.png`);
  } catch (e) {
    if (e.code === 'ENOENT' && m.sha256 && sha(await fs.readFile(m.public)) === m.sha256) {
      reports.push(m);
      continue;
    }
    throw e;
  }
  if (m.sourceSha256 === sha(source) && m.sha256) {
    reports.push(m);
    continue;
  }
  const raw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = raw.info.width,
    y0 = raw.info.height,
    x1 = 0,
    y1 = 0,
    transparent = 0;
  for (let y = 0; y < raw.info.height; y++)
    for (let x = 0; x < raw.info.width; x++) {
      const a = raw.data[(y * raw.info.width + x) * 4 + 3];
      if (a === 0) transparent++;
      if (a > 8) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  if (!transparent || x1 <= x0 || y1 <= y0) throw Error('Missing transparent sprite ' + p.id);
  const w = Math.round((1280 * p.width) / Math.max(p.width, p.height)),
    h = Math.round((1280 * p.height) / Math.max(p.width, p.height));
  const image = await sharp(source)
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(w - 24, h - 24, { fit: 'contain', background: '#00000000' })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#00000000' })
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const full = 'public' + p.image,
    thumb = 'public' + p.thumbnail;
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.mkdir(path.dirname(thumb), { recursive: true });
  await fs.writeFile(full, image);
  await sharp(image)
    .resize({ width: 192, height: 192, fit: 'inside' })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(thumb);
  m = {
    ...m,
    public: full,
    thumbnail: thumb,
    generator: 'built-in image_gen',
    sourceSha256: sha(source),
    sha256: sha(image),
    dimensions: [w, h],
    alpha: true,
  };
  await fs.writeFile(`${root}/completed/${p.id}.json`, JSON.stringify(m, null, 2) + '\n');
  reports.push(m);
}
if (reports.length === 100 && process.argv.includes('--apply')) {
  const file = 'shared/vtt-medieval-furniture-catalog.json',
    old = JSON.parse(await fs.readFile(file));
  const ids = new Set(plan.map((p) => p.id)),
    keep = old.filter((p) => !ids.has(p.id));
  if (keep.length !== 150) throw Error('Unexpected existing catalog size ' + keep.length);
  await fs.writeFile(
    file,
    JSON.stringify([...keep, ...plan.map(({ prompt, ...p }) => p)], null, 2) + '\n',
  );
  await fs.writeFile(
    root + '/final-prompts.json',
    JSON.stringify(
      reports.map(({ id, name, prompt, source, sourceSha256, sha256 }) => ({
        id,
        name,
        prompt,
        source,
        sourceSha256,
        sha256,
      })),
      null,
      2,
    ) + '\n',
  );
}
console.log(
  JSON.stringify({
    prepared: reports.length,
    total: 100,
    applied: reports.length === 100 && process.argv.includes('--apply'),
  }),
);
