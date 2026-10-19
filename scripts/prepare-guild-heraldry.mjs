import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const file = 'data/guild-heraldry-20261019.json',
  manifest = JSON.parse(await fs.readFile(file, 'utf8'));
for (const batch of manifest.batches) {
  const { data, info } = await sharp(
    process.argv[2]
      ? path.join(process.argv[2], path.basename(batch.source.replaceAll('\\', '/')))
      : batch.source,
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info,
    n = w * h,
    labels = new Int32Array(n),
    queue = new Int32Array(n),
    components = [];
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (labels[start] || data[start * 4 + 3] <= 8) continue;
    const id = ++next;
    let read = 0,
      end = 1,
      count = 0,
      minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      sx = 0,
      sy = 0;
    queue[0] = start;
    labels[start] = id;
    while (read < end) {
      const p = queue[read++],
        x = p % w,
        y = Math.floor(p / w);
      count++;
      sx += x;
      sy += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) {
        const q = p + d;
        if (q < 0 || q >= n || Math.abs((q % w) - x) > 1 || labels[q] || data[q * 4 + 3] <= 8)
          continue;
        labels[q] = id;
        queue[end++] = q;
      }
    }
    components.push({ id, count, minX, minY, maxX, maxY, x: sx / count, y: sy / count });
  }
  const mains = Array.from({ length: 10 }, (_, i) => {
    const cx = (((i % 5) + 0.5) * w) / 5,
      cy = ((Math.floor(i / 5) + 0.5) * h) / 2;
    const choices = components.filter(
      (c) =>
        c.count > 1000 &&
        Math.floor(c.x / (w / 5)) === i % 5 &&
        Math.floor(c.y / (h / 2)) === Math.floor(i / 5),
    );
    if (!choices.length) throw Error('Missing object ' + batch.kind + ' ' + i);
    return choices.sort((a, b) => b.count - a.count)[0];
  });
  if (new Set(mains.map((c) => c.id)).size !== 10) throw Error('Duplicate');
  const sheets = [];
  for (let i = 0; i < 10; i++) {
    const main = mains[i],
      own = components.filter((c) => {
        if (c.count < 8) return false;
        const nearest = mains
          .map((m, j) => ({ j, d: ((c.x - m.x) / (w / 5)) ** 2 + ((c.y - m.y) / (h / 2)) ** 2 }))
          .sort((a, b) => a.d - b.d)[0];
        return nearest.j === i && (c === main || c.count < main.count * 0.3);
      });
    const ids = new Set(own.map((c) => c.id));
    const minX = Math.min(...own.map((c) => c.minX)),
      minY = Math.min(...own.map((c) => c.minY)),
      maxX = Math.max(...own.map((c) => c.maxX)),
      maxY = Math.max(...own.map((c) => c.maxY));
    const cw = maxX - minX + 1,
      ch = maxY - minY + 1,
      raw = Buffer.alloc(cw * ch * 4);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const p = y * w + x;
        if (ids.has(labels[p])) data.copy(raw, ((y - minY) * cw + x - minX) * 4, p * 4, p * 4 + 4);
      }
    const image = await sharp(raw, { raw: { width: cw, height: ch, channels: 4 } })
      .resize({ width: 448, height: 448, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    const cell = await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: image.data,
          left: Math.round((512 - image.info.width) / 2),
          top: Math.round((512 - image.info.height) / 2),
        },
      ])
      .png()
      .toBuffer();
    const sprite = batch.sprites[i];
    await sharp(cell).webp({ quality: 96, alphaQuality: 100 }).toFile(sprite.file);
    sprite.sha256 = createHash('sha256')
      .update(await fs.readFile(sprite.file))
      .digest('hex');
    sheets.push({ input: cell, left: (i % 5) * 512, top: Math.floor(i / 5) * 512 });
  }
  await sharp({
    create: { width: 2560, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(sheets)
    .webp({ quality: 96, alphaQuality: 100 })
    .toFile(batch.output);
  batch.sha256 = createHash('sha256')
    .update(await fs.readFile(batch.output))
    .digest('hex');
  console.log(
    batch.kind,
    '10 isolated objects',
    mains.map((m) => m.count),
  );
}
manifest.packing =
  'Connected alpha components isolate each of ten subjects per source without cutting at nominal grid boundaries. Small detached details assigned to nearest main subject; extraneous neighbor fragments excluded. Each subject is fitted within 448px and centered in an individual transparent 512px sprite. Six 5×2 sheets are kept as source previews; runtime uses 60 individual sprites to prevent SVG color-filter bleed.';
await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
