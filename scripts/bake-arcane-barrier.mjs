import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const sat = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => {
  const x = sat(n);
  return x * x * (3 - 2 * x);
};
const grid = Float32Array.from({ length: 64 ** 3 }, (_, i) => {
  let n = Math.imul(i + 1, 374761393);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967295;
});
function noise(x, y, z) {
  const X = Math.floor(x),
    Y = Math.floor(y),
    Z = Math.floor(z);
  const u = smooth(x - X),
    v = smooth(y - Y),
    w = smooth(z - Z);
  const at = (a, b, c) => grid[(a & 63) + (b & 63) * 64 + (c & 63) * 4096];
  let result = 0;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++)
        result += at(X + i, Y + j, Z + k) * (i ? u : 1 - u) * (j ? v : 1 - v) * (k ? w : 1 - w);
  return result;
}
export function barrierField(x, y, t) {
  const r = Math.hypot(x, y) / 0.84;
  if (r >= 1.035) return [0, 0, 0];
  const z = Math.sqrt(Math.max(0, 1 - Math.min(1, r) ** 2));
  const co = Math.cos(t),
    si = Math.sin(t),
    u = x * co - y * si,
    v = x * si + y * co;
  const n =
    noise(u * 3.1 + 12 + si * 0.45, v * 3.1 + 18, z * 2.7 + 4 + co * 0.38) * 0.68 +
    noise(u * 7.6 + 27, v * 7.6 + 8 + co * 0.22, z * 6.2 + 21) * 0.32;
  const sheet = smooth((n - 0.4) * 6);
  const border = Math.exp(-(((n - 0.415) / 0.032) ** 2));
  const fresnel = (1 - z) ** 1.3;
  const rim = Math.exp(-(((r - 0.985) / 0.025) ** 2));
  const fade = smooth((1.035 - r) * 30);
  const center = 0.07 + 0.93 * smooth((r - 0.25) / 0.6);
  const density = sat(
    (sheet * (0.2 + fresnel * 0.36) + border * 0.18 + rim * 0.21) * fade * center,
  );
  const light = sat(border * 0.66 + rim * 0.52 + fresnel * 0.12);
  const shade = 0.66 + 0.26 * Math.max(0, -x * 0.5 - y * 0.35 + z * 0.8);
  return [density, light, shade];
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/bake-arcane-barrier.mjs')) {
  const dir = 'public/vtt/arcane-barrier-20261010',
    size = 192,
    tile = 196,
    width = tile * 4,
    assets = [];
  await fs.mkdir(dir, { recursive: true });
  for (let page = 0; page < 2; page++) {
    const bytes = Buffer.alloc(width * width * 4);
    for (let cell = 0; cell < 16; cell++)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const [density, light, shade] = barrierField(
            ((x + 0.5) / size) * 2 - 1,
            ((y + 0.5) / size) * 2 - 1,
            ((page * 16 + cell) / 32) * Math.PI * 2,
          );
          const at = (((cell >> 2) * tile + y + 2) * width + (cell % 4) * tile + x + 2) * 4;
          for (let k = 0; k < 3; k++)
            bytes[at + k] = [136, 112, 255][k] * shade * (1 - light) + [132, 235, 255][k] * light;
          bytes[at + 3] = Math.round(density * 255);
        }
    const path = dir + '/membrane-' + page + '.webp';
    await sharp(bytes, { raw: { width, height: width, channels: 4 } })
      .webp({ quality: 94, alphaQuality: 100, effort: 3 })
      .toFile(path);
    assets.push({
      path: path.slice(6),
      sha256: createHash('sha256')
        .update(await fs.readFile(path))
        .digest('hex'),
    });
  }
  await fs.writeFile(
    'data/vtt/arcane-barrier-20261010.json',
    JSON.stringify(
      {
        name: 'Barreira arcana',
        kind: 'arcane-barrier',
        method:
          'Original spherical periodic density field; nadir perspective, clear token center, cyan membrane edges; reference only, no copied video frames',
        source: 'scripts/bake-arcane-barrier.mjs',
        source_sha256: createHash('sha256')
          .update(await fs.readFile('scripts/bake-arcane-barrier.mjs'))
          .digest('hex'),
        reference: '20261010-1624-27.6664745.mp4',
        size,
        tile,
        frames: 32,
        period: 4,
        assets,
        review: 'pending',
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Baked original arcane dome: 32 transparent frames in two WebP pages.');
}
