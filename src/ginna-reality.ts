export const GINNA_RUPTURE_DURATION = 3600;
export const GINNA_RUPTURE_CUES = { crack: 40, glass: 1180, mist: 1530 } as const;
type Point = { x: number; y: number };
type Vein = { points: Point[]; birth: number; growth: number; weight: number };
const random = (value: number) => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
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

/** Opaque fog behind a billowing front, so smoke itself conceals the old scene. */
function fogCover() {
  const width = 320,
    height = 240;
  const texture = document.createElement('canvas');
  const layer = document.createElement('canvas');
  const mask = document.createElement('canvas');
  for (const surface of [texture, layer, mask]) {
    surface.width = width;
    surface.height = height;
  }
  const ink = texture.getContext('2d')!;
  const pixels = ink.createImageData(width, height);
  const arrival = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const broad = noise(x / 85, y / 65),
        curl = noise(x / 34 + broad * 2, y / 29),
        fine = noise(x / 11, y / 9);
      const shade = 8 + broad * 15 + curl * 10 + fine * 3;
      const at = (y * width + x) * 4;
      pixels.data[at] = shade * 0.86;
      pixels.data[at + 1] = shade * 0.88;
      pixels.data[at + 2] = shade;
      pixels.data[at + 3] = 255;
      const seam = 0.5 + (noise(0, y / 37) - 0.5) * 0.035;
      arrival[y * width + x] = Math.max(
        0,
        Math.min(
          1,
          Math.abs(x / (width - 1) - seam) * 2 + (curl - 0.5) * 0.18 + (broad - 0.5) * 0.09,
        ),
      );
    }
  ink.putImageData(pixels, 0, 0);
  const surface = layer.getContext('2d')!;
  const masking = mask.getContext('2d')!;
  const opacity = masking.createImageData(width, height);
  return {
    draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, opening: boolean) {
      // Include rounded backing pixels on displays with fractional device scaling.
      const transform = ctx.getTransform();
      w = ctx.canvas.width / transform.a;
      h = ctx.canvas.height / transform.d;
      if (!opening && p <= 0.47) return;
      if (opening || p >= 0.93) {
        ctx.globalAlpha = opening ? 1 - smooth(p) : 1;
        ctx.drawImage(texture, 0, 0, w, h);
        ctx.globalAlpha = 1;
        return;
      }
      const front = -0.14 + smooth((p - 0.47) / 0.46) * 1.3;
      for (let i = 0; i < arrival.length; i++)
        opacity.data[i * 4 + 3] = smooth((front - arrival[i]) / 0.14) * 255;
      masking.putImageData(opacity, 0, 0);
      surface.globalCompositeOperation = 'copy';
      surface.drawImage(texture, 0, 0);
      surface.globalCompositeOperation = 'destination-in';
      surface.drawImage(mask, 0, 0);
      surface.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(layer, 0, 0, w, h);
      ctx.globalAlpha = 1;
    },
    destroy() {
      for (const surface of [texture, layer, mask]) surface.width = surface.height = 0;
    },
  };
}

function crackGeometry() {
  const spine = Array.from({ length: 25 }, (_, i): Point => ({
    x: i === 12 ? 0.5 : 0.5 + (random(i + 19) - 0.5) * 0.033 + Math.sin(i * 1.7) * 0.007,
    y: i / 24,
  }));
  const veins: Vein[] = [
    { points: spine.slice(0, 13).reverse(), birth: 0.015, growth: 0.25, weight: 1.5 },
    { points: spine.slice(12), birth: 0.015, growth: 0.27, weight: 1.5 },
  ];
  for (let i = 0; i < 15; i++) {
    const anchor = 4 + Math.floor(random(i + 80) * 17);
    const root = spine[anchor],
      side = i % 2 ? 1 : -1;
    const dx = side * (0.11 + random(i + 100) * 0.27);
    const dy = (random(i + 130) - 0.5) * 0.4;
    const points = Array.from({ length: 8 }, (_, step) => {
      const t = step / 7;
      return {
        x: root.x + dx * t + Math.sin(t * Math.PI) * (random(i * 9 + step) - 0.5) * 0.026,
        y: root.y + dy * t + Math.sin(t * Math.PI) * (random(i * 11 + step + 20) - 0.5) * 0.024,
      };
    });
    const birth = 0.11 + Math.abs(anchor - 12) * 0.012 + random(i + 6) * 0.05;
    veins.push({ points, birth, growth: 0.18, weight: 0.85 });
    for (let j = 0; j < 2; j++) {
      const start = 3 + j * 2,
        origin = points[start];
      const sx = side * (0.025 + random(i * 3 + j) * 0.06);
      const sy = (j % 2 ? 1 : -1) * (0.03 + random(i + j + 27) * 0.075);
      veins.push({
        points: [
          origin,
          { x: origin.x + sx * 0.35, y: origin.y + sy * 0.42 },
          { x: origin.x + sx * 0.72, y: origin.y + sy * 0.58 },
          { x: origin.x + sx, y: origin.y + sy },
        ],
        birth: birth + 0.1 + j * 0.035,
        growth: 0.12,
        weight: 0.42,
      });
    }
  }
  return { spine, veins };
}

/** One central fault, progressive hairline cracks, small glass flakes, then mist. */
export function createRealityFog(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const texture = reduced ? null : smokeTexture();
  const cover = reduced ? null : fogCover();
  const { spine, veins } = crackGeometry();
  let width = 0,
    height = 0;
  const resize = () => {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (canvas.dataset.stage === 'covered') cover?.draw(ctx, width, height, 1, false);
  };
  resize();
  window.addEventListener('resize', resize);
  function trace(points: Point[], progress: number, shift = 0) {
    const distance = Math.max(0, Math.min(1, progress)) * (points.length - 1);
    ctx.beginPath();
    ctx.moveTo(points[0].x * width + shift, points[0].y * height - shift);
    for (let i = 1; i < points.length && i - 1 < distance; i++) {
      const t = Math.min(1, distance - (i - 1)),
        a = points[i - 1],
        b = points[i];
      ctx.lineTo((a.x + (b.x - a.x) * t) * width + shift, (a.y + (b.y - a.y) * t) * height - shift);
    }
  }
  function seamWidth(y: number, p: number) {
    const growth = smooth((p - 0.31) / 0.32);
    const taper = Math.pow(Math.max(0, Math.sin(Math.PI * y)), 0.8);
    return growth * width * 0.115 * taper;
  }
  function drawFracture(p: number) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    // Beveled hairlines: dark depth with a restrained silver edge, no glowing grid.
    for (const vein of veins) {
      const growth = (p - vein.birth) / vein.growth;
      if (growth <= 0) continue;
      trace(vein.points, growth);
      ctx.strokeStyle = '#030506dc';
      ctx.lineWidth = vein.weight + 1.3;
      ctx.stroke();
      trace(vein.points, growth, 0.65);
      ctx.strokeStyle = vein.weight > 1 ? '#d8dddfaa' : '#ced5d669';
      ctx.lineWidth = vein.weight;
      ctx.stroke();
    }
    const opening = smooth((p - 0.31) / 0.32);
    if (opening > 0) {
      const edge = (point: Point, i: number, side: number) => ({
        x:
          point.x * width +
          side * seamWidth(point.y, p) * (0.78 + random(i + (side > 0 ? 60 : 90)) * 0.42),
        y: point.y * height,
      });
      const left = spine.map((point, i) => edge(point, i, -1));
      const right = spine.map((point, i) => edge(point, i, 1));
      const polygon = [...left, ...right.reverse()];
      ctx.beginPath();
      polygon.forEach((point, i) =>
        i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
      );
      ctx.closePath();
      ctx.shadowBlur = 14 * opening;
      ctx.shadowColor = '#000';
      ctx.fillStyle = '#010204';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#b0bbc470';
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.strokeStyle = '#262d37';
      ctx.lineWidth = 3;
      for (const rim of [left, right.reverse()]) {
        ctx.beginPath();
        rim.forEach((point, i) =>
          i ? ctx.lineTo(point.x + 2, point.y) : ctx.moveTo(point.x + 2, point.y),
        );
        ctx.stroke();
      }
    }
    let flakes = 0;
    for (let i = 0; i < 52; i++) {
      const birth = 0.335 + random(i + 180) * 0.29;
      const age = ((p - birth) * GINNA_RUPTURE_DURATION) / 1000;
      if (age < 0 || age > 1.35) continue;
      flakes++;
      const y = 0.12 + random(i + 213) * 0.74,
        side = i % 2 ? 1 : -1;
      const size = (12 + random(i + 61) * 23) * Math.min(1, width / 720 + 0.3);
      const x =
        width * (0.5 + (random(i + 44) - 0.5) * 0.025) +
        side * seamWidth(y, birth) +
        side * (15 + random(i + 12) * 55) * age;
      const cy = y * height + height * (0.025 * age + 0.3 * age * age);
      const spin = age * (1.5 + random(i + 87) * 4) * side;
      ctx.save();
      ctx.translate(x, cy);
      ctx.rotate(spin);
      ctx.scale(Math.cos(spin * 0.8) * 0.65 + 0.35, 1);
      ctx.globalAlpha = Math.min(1, age * 13) * (1 - smooth((age - 0.75) / 0.6));
      ctx.beginPath();
      ctx.moveTo(-size * 0.45, -size * 0.65);
      ctx.lineTo(size * 0.6, -size * 0.22);
      ctx.lineTo(size * 0.12, size * 1.2);
      ctx.lineTo(-size * 0.3, size * 0.23);
      ctx.closePath();
      const sheen = ctx.createLinearGradient(-size, -size, size, size);
      sheen.addColorStop(0, '#c7d1ce99');
      sheen.addColorStop(0.4, '#4b5c604c');
      sheen.addColorStop(0.6, '#10191dd9');
      sheen.addColorStop(1, '#8f9d9f88');
      ctx.fillStyle = sheen;
      ctx.fill();
      ctx.strokeStyle = '#d6dbd393';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.55);
      ctx.lineTo(size * 0.1, size * 1.05);
      ctx.strokeStyle = '#e4e8e580';
      ctx.lineWidth = 0.55;
      ctx.stroke();
      ctx.restore();
    }
    canvas.dataset.flakes = String(flakes);
  }
  return {
    draw(progress: number, opening = false) {
      const p = Math.max(0, Math.min(1, progress));
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      if (reduced) {
        ctx.globalAlpha = opening ? 1 - p : p;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        canvas.dataset.stage = opening ? 'revealing' : 'fade';
        return;
      }
      canvas.dataset.stage = opening
        ? 'revealing'
        : p < 0.12
          ? 'fissure'
          : p < 0.31
            ? 'branches'
            : p < 0.49
              ? 'flakes'
              : p < 1
                ? 'mist'
                : 'covered';
      if (!opening && p >= 0.93) {
        canvas.dataset.flakes = '0';
        cover!.draw(ctx, width, height, p, false);
        return;
      }
      if (!opening) drawFracture(p);
      const time = opening ? 1 + p * 0.55 : p;
      for (let i = 0; i < 84; i++) {
        const birth = 0.4 + random(i + 10) * 0.18,
          age = time - birth;
        if (age <= 0) continue;
        const side = i % 2 ? 1 : -1;
        const originY = 0.18 + random(i + 38) * 0.65;
        const spread = Math.pow(age * 1.65, 1.6) * width * (0.6 + random(i + 40));
        const radius = (20 + age * Math.max(width, height) * 1.25) * (0.55 + random(i + 90) * 0.65);
        const cx = width * 0.5 + side * (seamWidth(originY, 0.47) * 0.2 + spread);
        const cy =
          height * originY -
          age * height * 0.3 +
          Math.sin(i * 2.39996 + time) * age * height * 0.28;
        ctx.globalAlpha = Math.min(0.85, age * 6) * (opening ? (1 - smooth(p)) * 0.95 : 1);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * 0.51 + time * 0.2);
        ctx.drawImage(texture!, -radius, -radius * 0.8, radius * 2, radius * 1.6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      cover!.draw(ctx, width, height, p, opening);
    },
    destroy() {
      window.removeEventListener('resize', resize);
      canvas.width = canvas.height = 0;
      cover?.destroy();
      if (texture) texture.width = texture.height = 0;
    },
  };
}
