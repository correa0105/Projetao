import type { TokenEffect } from '../shared/vtt-effects';
const tau = Math.PI * 2;
const cache = new Map<string, HTMLCanvasElement>();
const frac = (n: number) => n - Math.floor(n);
const hash = (x: number, y: number) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x: number, y: number) {
  const a = Math.floor(x),
    b = Math.floor(y),
    u = frac(x),
    v = frac(y),
    sx = u * u * (3 - 2 * u),
    sy = v * v * (3 - 2 * v);
  return (
    (hash(a, b) * (1 - sx) + hash(a + 1, b) * sx) * (1 - sy) +
    (hash(a, b + 1) * (1 - sx) + hash(a + 1, b + 1) * sx) * sy
  );
}
// Cached density textures: soft, turbulent edges instead of flat discs/solid shapes.
function plume(color: string, fire: boolean) {
  const key = color + fire;
  const existing = cache.get(key);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!,
    pixels = c.createImageData(256, 256);
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const px = (x / 255) * 2 - 1,
        py = (y / 255) * 2 - 1;
      const n =
        noise(x / 38, y / 38) * 0.53 + noise(x / 17, y / 17) * 0.28 + noise(x / 7, y / 7) * 0.19;
      const drift = fire ? Math.sin(py * 7) * 0.12 * (1 - py) : 0;
      const width = fire ? 0.2 + (py + 1) * 0.31 : 1;
      const radial = Math.max(0, 1 - ((px - drift) / width) ** 2 - py ** 2);
      const density = Math.max(0, radial * (n * 1.35 + 0.12) - 0.12);
      const core = fire ? Math.min(1, density * 0.9 * (py + 1)) : density * 0.18;
      const index = (y * 256 + x) * 4;
      for (let k = 0; k < 3; k++)
        pixels.data[index + k] = rgb[k] * (1 - core) + (fire ? [255, 237, 179][k] : 219) * core;
      pixels.data[index + 3] = Math.min(255, density * (fire ? 335 : 205));
    }
  c.putImageData(pixels, 0, 0);
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(key, canvas);
  return canvas;
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r * 0.65, y);
  c.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  c.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r * 0.65, y);
  c.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  c.fill();
}
function bolt(
  c: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: number,
  seed: number,
  color: string,
) {
  const points = Array.from({ length: 17 }, (_, i) => {
    const p = i / 16,
      n = (hash(i, seed) - 0.5) * r * 0.24 * Math.sin(p * Math.PI);
    return { x: a.x + (b.x - a.x) * p + n, y: a.y + (b.y - a.y) * p - n * 0.65 };
  });
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  for (let k = 4; k < 14; k += 4) {
    const p = points[k],
      side = k % 8 ? 1 : -1;
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + r * 0.15 * side, p.y - r * 0.12);
    c.lineTo(p.x + r * 0.08 * side, p.y - r * 0.2);
    c.lineTo(p.x + r * 0.28 * side, p.y - r * 0.38);
  }
  c.shadowColor = color;
  c.shadowBlur = r * 0.13;
  c.lineWidth = Math.max(0.9, r * 0.035);
  c.strokeStyle = color + '60';
  c.stroke();
  c.lineWidth = Math.max(0.6, r * 0.014);
  c.strokeStyle = color;
  c.stroke();
  c.shadowBlur = 0;
  c.lineWidth = Math.max(0.35, r * 0.006);
  c.strokeStyle = '#f5fbff';
  c.stroke();
}
export function drawEffectFront(
  c: CanvasRenderingContext2D,
  effect: TokenEffect,
  r: number,
  t: number,
  random: (i: number) => number,
) {
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (effect.kind === 'fire') {
    const sprite = plume(effect.color, true);
    for (let i = 0; i < 17; i++) {
      const p = frac(t * (0.48 + random(i) * 0.25) + random(i + 30));
      const x = (random(i + 18) - 0.5) * r * 1.25 + Math.sin(t * 2 + i) * r * 0.08,
        y = r * 0.69 - p * r * 1.18,
        w = r * (0.23 + random(i + 75) * 0.17),
        h = r * (0.78 + random(i + 40) * 0.45);
      c.save();
      c.globalAlpha *= Math.sin(p * Math.PI) * 0.84;
      c.translate(x, y);
      c.rotate(Math.sin(t * 1.2 + i) * 0.18);
      c.drawImage(sprite, -w / 2, -h, w, h);
      c.restore();
    }
    c.globalCompositeOperation = 'screen';
    const glow = c.createRadialGradient(0, r * 0.5, 0, 0, r * 0.5, r * 0.72);
    glow.addColorStop(0, '#ffa65348');
    glow.addColorStop(1, '#ef601000');
    c.fillStyle = glow;
    c.fillRect(-r, -r * 0.22, r * 2, r * 1.44);
    c.fillStyle = '#ffe9b5';
    for (let i = 0; i < 14; i++) {
      const p = frac(t * 0.7 + random(i)),
        x = (random(i + 20) - 0.5) * r * 1.25,
        y = r * 0.55 - p * r * 1.5;
      c.save();
      c.globalAlpha *= Math.sin(p * Math.PI) * 0.9;
      c.beginPath();
      c.ellipse(x, y, r * 0.007, r * 0.022, 0.2, 0, tau);
      c.fill();
      c.restore();
    }
  } else if (effect.kind === 'frost') {
    c.save();
    c.beginPath();
    c.ellipse(0, 0, r * 0.75, r * 0.75, 0, 0, tau);
    c.clip();
    const ice = c.createLinearGradient(-r, r, r, -r);
    ice.addColorStop(0, effect.color + '85');
    ice.addColorStop(0.46, '#e9faff12');
    ice.addColorStop(1, effect.color + '42');
    c.fillStyle = ice;
    c.fillRect(-r, -r, r * 2, r * 2);
    for (let i = 0; i < 11; i++) {
      const a = random(i) * tau,
        x = Math.cos(a) * r * 0.72,
        y = Math.sin(a) * r * 0.72;
      c.strokeStyle = '#dff6ff' + (i % 2 ? 'ab' : '65');
      c.lineWidth = r * 0.008;
      c.beginPath();
      c.moveTo(x, y);
      let px = x,
        py = y;
      for (let k = 0; k < 4; k++) {
        px = px * 0.7 + (random(i + k * 30) - 0.5) * r * 0.15;
        py = py * 0.7 + (random(i + k * 20) - 0.5) * r * 0.15;
        c.lineTo(px, py);
        c.lineTo(px + Math.cos(a + 0.9) * r * 0.14, py + Math.sin(a + 0.9) * r * 0.14);
        c.moveTo(px, py);
      }
      c.stroke();
    }
    c.restore();
    c.shadowColor = '#b4ddff';
    c.shadowBlur = r * 0.08;
    c.fillStyle = '#f0fbff';
    for (let i = 0; i < 9; i++) {
      const p = frac(t * 0.16 + random(i)),
        a = random(i + 12) * tau;
      c.save();
      c.globalAlpha *= 0.3 + 0.7 * Math.sin(p * Math.PI);
      star(c, Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65, r * 0.034);
      c.restore();
    }
  } else if (effect.kind === 'poison') {
    const smoke = plume(effect.color, false);
    for (let i = 0; i < 13; i++) {
      const p = frac(t * (0.15 + random(i) * 0.12) + random(i + 20)),
        x = Math.sin(p * 4 + i) * r * (0.2 + random(i + 10) * 0.45),
        y = r * 0.75 - p * r * 1.55,
        size = r * (0.6 + p * 0.42 + random(i + 40) * 0.15);
      c.save();
      c.globalAlpha *= Math.sin(p * Math.PI) * 0.72;
      c.translate(x, y);
      c.rotate(p * 1.5 + i);
      c.drawImage(smoke, -size / 2, -size / 2, size, size);
      c.restore();
    }
    c.strokeStyle = '#b7ca8180';
    c.lineWidth = r * 0.012;
    for (let i = 0; i < 5; i++) {
      const p = frac(t * 0.4 + random(i));
      c.save();
      c.globalAlpha *= Math.sin(p * Math.PI);
      c.beginPath();
      c.arc((random(i + 3) - 0.5) * r, r * 0.5 - p * r * 0.95, r * 0.026, 0, tau);
      c.stroke();
      c.restore();
    }
  } else if (effect.kind === 'heal') {
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      for (let k = 0; k <= 32; k++) {
        const p = k / 32,
          a = p * tau + t * 1.2 + i * 2.1,
          x = Math.cos(a) * r * 0.65,
          y = r * 0.62 - p * r * 1.35;
        if (Math.sin(a) < 0) {
          c.moveTo(x, y);
          continue;
        }
        c.lineTo(x, y);
      }
      c.shadowColor = effect.color;
      c.shadowBlur = r * 0.08;
      c.lineWidth = r * 0.016;
      c.strokeStyle = effect.color + 'a0';
      c.stroke();
      c.lineWidth = r * 0.005;
      c.strokeStyle = '#fff6dba8';
      c.stroke();
    }
    c.fillStyle = '#fff4cf';
    c.shadowColor = '#f4d68e';
    for (let i = 0; i < 13; i++) {
      const p = frac(t * 0.27 + random(i)),
        x = (random(i + 21) - 0.5) * r * 1.35,
        y = r * 0.6 - p * r * 1.3;
      c.save();
      c.globalAlpha *= Math.sin(p * Math.PI);
      star(c, x, y, r * (0.016 + random(i + 32) * 0.045));
      c.restore();
    }
  } else if (effect.kind === 'sparks') {
    c.globalCompositeOperation = 'screen';
    const tick = Math.floor(t * 11);
    for (let i = 0; i < 3; i++) {
      const a = random(i + (tick % 17)) * tau,
        spread = r * (0.62 + random(i + 60) * 0.2);
      c.save();
      c.globalAlpha *= 0.55 + 0.4 * hash(tick, i);
      bolt(
        c,
        { x: Math.cos(a) * spread, y: Math.sin(a) * spread },
        { x: -Math.cos(a + 0.4) * spread, y: -Math.sin(a + 0.4) * spread },
        r,
        tick + i * 53,
        effect.color,
      );
      c.restore();
    }
  }
  c.restore();
}
