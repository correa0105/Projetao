export const tau = Math.PI * 2;
export const fract = (n: number) => n - Math.floor(n);
export function seededRandom(text: string) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return (i: number) => fract(Math.sin(i * 127.1 + (seed >>> 0) * 0.00017) * 43758.5453);
}
export function tint(color: string, amount: number, destination = '#ffffff') {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(color.slice(i, i + 2), 16) * (1 - amount) +
            parseInt(destination.slice(i, i + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function alpha(color: string, opacity: number) {
  return (
    color +
    Math.round(Math.max(0, Math.min(1, opacity)) * 255)
      .toString(16)
      .padStart(2, '0')
  );
}
const textures = new Map<string, HTMLCanvasElement>();
export const EFFECT_TEXTURE_LIMIT = 24;
export function effectTextureCacheSize() {
  return textures.size;
}
export function clearEffectTextureCache() {
  textures.clear();
}
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x: number, y: number) {
  const a = Math.floor(x),
    b = Math.floor(y),
    u = fract(x),
    v = fract(y),
    sx = u * u * (3 - 2 * u),
    sy = v * v * (3 - 2 * v);
  return (
    (hash(a, b) * (1 - sx) + hash(a + 1, b) * sx) * (1 - sy) +
    (hash(a, b + 1) * (1 - sx) + hash(a + 1, b + 1) * sx) * sy
  );
}
// Generated once per color/material, then reused as transparent density sprites.
// No per-frame pixel loops, external images or unbounded particle objects.
export function plume(color: string, material: 'fire' | 'smoke') {
  const key = color + material,
    existing = textures.get(key);
  if (existing) {
    textures.delete(key);
    textures.set(key, existing);
    return existing;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!,
    pixels = c.createImageData(256, 256),
    fire = material === 'fire';
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const px = (x / 255) * 2 - 1,
        py = (y / 255) * 2 - 1,
        n = noise(x / 44, y / 39) * 0.5 + noise(x / 19, y / 17) * 0.3 + noise(x / 8, y / 7) * 0.2,
        drift = fire ? Math.sin(py * 8) * 0.09 * (1 - py) : 0,
        width = fire ? 0.16 + (py + 1) * 0.32 : 1,
        radial = Math.max(0, 1 - ((px - drift) / width) ** 2 - py ** 2),
        density = Math.max(0, radial * (n * 1.45 + 0.09) - 0.13),
        core = fire ? Math.min(1, density * (py + 1) * 1.1) : density * 0.12,
        offset = (y * 256 + x) * 4;
      for (let k = 0; k < 3; k++)
        pixels.data[offset + k] = rgb[k] * (1 - core) + (fire ? [255, 244, 197][k] : 230) * core;
      pixels.data[offset + 3] = Math.min(255, density * (fire ? 360 : 215));
    }
  c.putImageData(pixels, 0, 0);
  if (textures.size >= EFFECT_TEXTURE_LIMIT) textures.delete(textures.keys().next().value!);
  textures.set(key, canvas);
  return canvas;
}
export function glow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  opacity = 0.35,
) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(tint(color, 0.35), opacity));
  g.addColorStop(0.3, alpha(color, opacity * 0.75));
  g.addColorStop(1, alpha(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
export function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.1, y - r * 0.1, x + r * 0.6, y);
  c.quadraticCurveTo(x + r * 0.1, y + r * 0.1, x, y + r);
  c.quadraticCurveTo(x - r * 0.1, y + r * 0.1, x - r * 0.6, y);
  c.quadraticCurveTo(x - r * 0.1, y - r * 0.1, x, y - r);
  c.fill();
}
export function luminousStroke(
  c: CanvasRenderingContext2D,
  color: string,
  width: number,
  opacity = 1,
) {
  c.strokeStyle = alpha(color, opacity * 0.18);
  c.lineWidth = width * 4;
  c.stroke();
  c.strokeStyle = alpha(color, opacity * 0.8);
  c.lineWidth = width * 1.7;
  c.stroke();
  c.strokeStyle = alpha(tint(color, 0.82), opacity);
  c.lineWidth = width * 0.48;
  c.stroke();
}
export function bolt(
  c: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: number,
  random: (i: number) => number,
  tick: number,
  color: string,
  width = 0.014,
) {
  const points = Array.from({ length: 17 }, (_, i) => {
    const p = i / 16,
      n = (random(i + tick * 17) - 0.5) * r * 0.25 * Math.sin(p * Math.PI);
    return { x: a.x + (b.x - a.x) * p + n, y: a.y + (b.y - a.y) * p - n * 0.55 };
  });
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  for (let k = 4; k < 14; k += 4) {
    const p = points[k],
      side = k % 8 ? 1 : -1;
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + r * 0.12 * side, p.y - r * 0.1);
    c.lineTo(p.x + r * 0.08 * side, p.y - r * 0.19);
    c.lineTo(p.x + r * 0.22 * side, p.y - r * 0.28);
  }
  luminousStroke(c, color, r * width, 0.9);
}
export function floorRing(
  c: CanvasRenderingContext2D,
  r: number,
  color: string,
  t: number,
  opacity = 0.7,
) {
  c.save();
  c.translate(0, r * 0.6);
  c.scale(1, 0.26);
  glow(c, 0, 0, r * 1.1, color, 0.19);
  c.beginPath();
  c.ellipse(0, 0, r * 0.86, r * 0.86, 0, 0, tau);
  luminousStroke(c, color, r * 0.01, opacity);
  c.beginPath();
  c.ellipse(0, 0, r * 0.7, r * 0.7, 0, t * 0.12, t * 0.12 + tau * 0.78);
  luminousStroke(c, color, r * 0.007, opacity * 0.5);
  c.restore();
}
