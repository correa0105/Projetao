import fs from 'node:fs/promises';
import sharp from 'sharp';
const manifest = JSON.parse(
  await fs.readFile('public/house/items/views/art-manifest.json', 'utf8'),
);
const result = {};
async function measure(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width,
    y0 = info.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return {
    width: info.width,
    height: info.height,
    visibleWidth: x1 - x0 + 1,
    visibleHeight: y1 - y0 + 1,
    data,
  };
}
for (const id of [...new Set(manifest.map((v) => v.id))]) {
  const original = await measure('public/house/items/' + id + '.webp'),
    values = [];
  for (let view = 0; view < 8; view++) {
    const m = await measure('public/house/items/views/' + id + '/' + view + '.webp');
    const yaw = (view * Math.PI) / 4;
    const factor =
      id === 'rug'
        ? ((m.width / m.visibleWidth) *
            (2 * Math.abs(Math.cos(yaw)) + 3 * Math.abs(Math.sin(yaw)))) /
          ((original.width / original.visibleWidth) * 5 * Math.SQRT1_2)
        : m.width / m.visibleHeight / (original.width / original.visibleHeight);
    values.push(Number(factor.toFixed(5)));
  }
  result[id] = values;
}
await fs.writeFile('shared/house-view-sizes.json', JSON.stringify(result, null, 2) + '\n');
const quads = {};
for (const view of [0, 1, 7]) {
  const m = await measure('public/house/items/views/frame/' + view + '.webp'),
    w = m.width,
    h = m.height;
  // The opening is a connected transparent component enclosed by the frame.
  const seen = new Uint8Array(w * h),
    q = [Math.floor(h / 2) * w + Math.floor(w / 2)];
  seen[q[0]] = 1;
  let minX = w,
    maxX = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i],
      x = p % w,
      y = Math.floor(p / w);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    for (const n of [
      x > 0 ? p - 1 : -1,
      x < w - 1 ? p + 1 : -1,
      y > 0 ? p - w : -1,
      y < h - 1 ? p + w : -1,
    ])
      if (n >= 0 && !seen[n] && m.data[n * 4 + 3] < 100) {
        seen[n] = 1;
        q.push(n);
      }
  }
  if (q.length > w * h * 0.8) throw Error('Frame opening was not enclosed: ' + view);
  function edge(x) {
    let top = h,
      bottom = 0;
    for (let y = 0; y < h; y++)
      if (seen[y * w + x]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    return [top, bottom];
  }
  const l = minX + 8,
    r = maxX - 8,
    ly = edge(l),
    ry = edge(r),
    pad = 9;
  quads[view] = [
    [l - pad, ly[0] - pad],
    [r + pad, ry[0] - pad],
    [r + pad, ry[1] + pad],
    [l - pad, ly[1] + pad],
  ].map(([x, y]) => [Number((x / w).toFixed(6)), Number((y / h).toFixed(6))]);
}
await fs.writeFile('shared/house-frame-quads.json', JSON.stringify(quads, null, 2) + '\n');
console.log('Calibrated 96 view sizes and three image planes.');
