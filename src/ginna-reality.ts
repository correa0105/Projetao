type Point = { x: number; y: number };
export type RealityShard = { points: Point[]; x: number; y: number; turn: number; delay: number };
const random = (value: number) => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// Shared irregular edges keep the scene intact until its pieces actually separate.
function brokenEdge(a: Point, b: Point): Point[] {
  if ((a.x === b.x && (a.x === 0 || a.x === 100)) || (a.y === b.y && (a.y === 0 || a.y === 100)))
    return [a];
  const reverse = a.x > b.x || (a.x === b.x && a.y > b.y);
  const first = reverse ? b : a,
    last = reverse ? a : b;
  const dx = last.x - first.x,
    dy = last.y - first.y;
  const length = Math.hypot(dx, dy) || 1;
  const seed = Math.round(first.x * 100) + Math.round(last.y * 100);
  const inner = [0.28, 0.59, 0.82].map((t, i) => {
    const bend = (random(seed + i) - 0.5) * Math.min(2.2, length * 0.13);
    return {
      x: first.x + dx * t - (dy / length) * bend,
      y: first.y + dy * t + (dx / length) * bend,
    };
  });
  return [a, ...(reverse ? inner.reverse() : inner)];
}

export function realityShards(): RealityShard[] {
  const seeds: Point[] = Array.from({ length: 12 }, (_, i) => ({
    x: 12 + (i % 4) * 25 + random(i + 3) * 9,
    y: 12 + Math.floor(i / 4) * 32 + random(i + 20) * 12,
  }));
  seeds.push({ x: 68, y: 46 }, { x: 77, y: 54 });
  return seeds.map((seed, index) => {
    let polygon: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    for (const other of seeds) {
      if (other === seed) continue;
      const nx = other.x - seed.x,
        ny = other.y - seed.y;
      const boundary = (other.x ** 2 + other.y ** 2 - seed.x ** 2 - seed.y ** 2) / 2;
      const result: Point[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length];
        const da = a.x * nx + a.y * ny - boundary,
          db = b.x * nx + b.y * ny - boundary;
        if (da <= 0) result.push(a);
        if (da <= 0 !== db <= 0) {
          const t = da / (da - db);
          result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      polygon = result;
    }
    const points = polygon.flatMap((p, i) => brokenEdge(p, polygon[(i + 1) % polygon.length]));
    return {
      points,
      x: seed.x,
      y: seed.y,
      turn: (random(index + 73) - 0.5) * 48,
      delay: 480 + Math.hypot(seed.x - 70, seed.y - 48) * 6,
    };
  });
}

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    tx = smooth(x - ix),
    ty = smooth(y - iy);
  const a = random(ix + iy * 157),
    b = random(ix + 1 + iy * 157);
  const c = random(ix + (iy + 1) * 157),
    d = random(ix + 1 + (iy + 1) * 157);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
function smokeTexture() {
  const texture = document.createElement('canvas');
  texture.width = texture.height = 192;
  const ctx = texture.getContext('2d')!;
  const pixels = ctx.createImageData(192, 192);
  for (let y = 0; y < 192; y++)
    for (let x = 0; x < 192; x++) {
      const nx = (x - 96) / 96,
        ny = (y - 96) / 96;
      const cloud =
        noise(x / 32, y / 32) * 0.52 + noise(x / 13, y / 13) * 0.3 + noise(x / 5, y / 5) * 0.18;
      const density = smooth((1 - Math.hypot(nx, ny)) * 2) * smooth((cloud - 0.19) * 2);
      const offset = (y * 192 + x) * 4,
        shade = 10 + cloud * 32;
      pixels.data[offset] = shade * 0.86;
      pixels.data[offset + 1] = shade * 0.88;
      pixels.data[offset + 2] = shade;
      pixels.data[offset + 3] = density * 220;
    }
  ctx.putImageData(pixels, 0, 0);
  return texture;
}

export function createRealityFog(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const texture = reduced ? null : smokeTexture();
  let width = 0,
    height = 0;
  const resize = () => {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  return {
    draw(progress: number, opening = false) {
      ctx.clearRect(0, 0, width, height);
      if (reduced) {
        ctx.globalAlpha = opening ? 1 - progress : progress;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      const veil = opening ? 1 - smooth(progress * 1.65) : smooth((progress - 0.55) / 0.45);
      ctx.globalAlpha = veil;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      const time = opening ? 1 + progress * 1.2 : progress;
      for (let i = 0; i < 90; i++) {
        const birth = random(i + 10) * 0.48;
        const age = time - birth;
        if (age <= 0) continue;
        const angle = i * 2.39996;
        const spread = Math.pow(age, 1.55) * Math.max(width, height) * 0.85;
        const radius = (70 + age * 410) * (0.65 + random(i + 90) * 0.75);
        const cx = width * 0.7 + Math.cos(angle) * spread * (random(i + 40) * 0.7 + 0.3);
        const cy = height * 0.48 + Math.sin(angle) * spread * 0.85 - age * height * 0.22;
        ctx.globalAlpha =
          Math.min(0.9, age * 3) * (opening ? (1 - smooth(progress)) * 0.9 : 1 - veil);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle * 0.2 + time * (0.15 + random(i)));
        ctx.drawImage(texture!, -radius, -radius * 0.75, radius * 2, radius * 1.5);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // Mount the destination only under a completely opaque black frame.
      if (!opening && progress >= 1) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
      }
    },
    destroy() {
      window.removeEventListener('resize', resize);
      canvas.width = canvas.height = 0;
    },
  };
}
