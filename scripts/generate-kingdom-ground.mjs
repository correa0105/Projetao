import sharp from 'sharp';

// Original, directionless turf. This is a single ground plane, not a map of
// roads, trees, buildings, water or other objects that would conflict on turn.
const size = 3072;
const pixels = Buffer.allocUnsafe(size * size * 3);

function hash(x, y, seed) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy, seed) * (1 - sx) + hash(ix + 1, iy, seed) * sx;
  const bottom = hash(ix, iy + 1, seed) * (1 - sx) + hash(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

function mix(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const warpX = (noise(x / 730, y / 730, 123) - 0.5) * 170;
    const warpY = (noise(x / 690, y / 690, 457) - 0.5) * 170;
    const u = x + warpX;
    const v = y + warpY;
    const broad = noise(u / 570, v / 570, 11) * 0.55 + noise(u / 260, v / 260, 53) * 0.3 + noise(u / 95, v / 95, 97) * 0.15;
    const dry = Math.max(0, Math.min(1, (broad - 0.45) * 3.1));
    const moss = Math.max(0, Math.min(1, (0.43 - broad) * 3.5));
    const grain = (noise(x / 14, y / 14, 211) - 0.5) * 15 + (hash(x, y, 809) - 0.5) * 12;
    const earth = [111, 115, 72];
    const tawny = [157, 139, 87];
    const deep = [78, 96, 68];
    const offset = (y * size + x) * 3;
    for (let channel = 0; channel < 3; channel++) {
      const base = mix(mix(earth[channel], tawny[channel], dry), deep[channel], moss);
      pixels[offset + channel] = Math.max(0, Math.min(255, Math.round(base + grain)));
    }
  }
}

// Fine broken ink strokes give the turf a drawn surface at close zoom. They
// are pigment variation only: no tufts, paths or props are baked into it.
let randomState = 204089;
const random = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
};
for (let mark = 0; mark < 105000; mark++) {
  const x = Math.floor(random() * size);
  const y = Math.floor(random() * size);
  const length = 2 + Math.floor(random() * 8);
  const angle = random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const dark = random() < 0.67;
  const pigment = dark ? [43, 54, 42] : [186, 174, 119];
  const strength = dark ? 0.11 + random() * 0.11 : 0.09 + random() * 0.08;
  for (let step = 0; step < length; step++) {
    const px = Math.round(x + dx * step);
    const py = Math.round(y + dy * step);
    if (px < 0 || py < 0 || px >= size || py >= size) continue;
    const offset = (py * size + px) * 3;
    for (let channel = 0; channel < 3; channel++)
      pixels[offset + channel] = Math.round(mix(pixels[offset + channel], pigment[channel], strength));
  }
}

await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile('public/kingdom/ground-turf.png');
console.log('Solo original gerado: public/kingdom/ground-turf.png');
