import { injury } from '../shared/vtt-blood';
import type { VttScene, VttToken } from '../shared/vtt';
import { seededRandom } from './vtt-effects-primitives';
import { effectFootprint } from './vtt-effect-footprint';
import { isTopDownTokenImage } from '../shared/vtt-token-image';

type View = { left: number; right: number; top: number; bottom: number };
const masks = new Map<
  string,
  { image?: HTMLImageElement; key: string; canvas: HTMLCanvasElement }
>();
const splashes = new Map<number, HTMLCanvasElement>();
const RESOLUTION = 384;
function blot(c: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  const random = seededRandom(String(seed));
  c.save();
  c.translate(x, y);
  c.rotate(random(0) * Math.PI * 2);
  // Disconnected round droplets, with subtle wet highlights, never a large pool.
  for (let i = 0; i < 15; i++) {
    const a = random(i + 10) * Math.PI * 2;
    const d = Math.sqrt(random(i + 30)) * r * 1.35;
    const radius = r * (i < 3 ? 0.14 + random(i + 50) * 0.08 : 0.025 + random(i + 50) * 0.055);
    const px = Math.cos(a) * d,
      py = Math.sin(a) * d;
    c.beginPath();
    c.ellipse(px, py, radius, radius * (0.72 + random(i + 70) * 0.26), a, 0, Math.PI * 2);
    c.fillStyle = i % 3 ? '#7e111b' : '#991823';
    c.fill();
    if (i < 3) {
      c.beginPath();
      c.ellipse(
        px - radius * 0.23,
        py - radius * 0.24,
        radius * 0.22,
        radius * 0.1,
        -0.5,
        0,
        Math.PI * 2,
      );
      c.fillStyle = '#d5696240';
      c.fill();
    }
  }
  c.restore();
}
function splatter(seed: number) {
  const variant = seed % 16;
  const old = splashes.get(variant);
  if (old) return old;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const c = canvas.getContext('2d')!;
  blot(c, 96, 96, 44, variant);
  splashes.set(variant, canvas);
  return canvas;
}
export function drawBloodDecals(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  view: View,
  gm = false,
  now = Date.now(),
) {
  for (const d of scene.blood) {
    if (d.kind !== 'splash') continue;
    if (d.private && !gm) continue;
    if (!gm && scene.tokens.some((t) => t.id === d.source && (t.hidden || t.layer === 'gm')))
      continue;
    const r = d.size * 2;
    if (d.x + r < view.left || d.x - r > view.right || d.y + r < view.top || d.y - r > view.bottom)
      continue;
    c.save();
    c.translate(d.x, d.y);
    c.rotate(d.angle);
    c.globalAlpha *= now - d.at > 120000 ? 0.75 : 0.94;
    const texture = splatter(d.seed),
      sx = 1;
    c.drawImage(texture, -d.size * sx, -d.size, d.size * 2 * sx, d.size * 2);
    c.restore();
  }
}
export function drawTokenBlood(
  c: CanvasRenderingContext2D,
  token: VttToken,
  image?: HTMLImageElement,
) {
  const severity = injury(token);
  if (token.layer === 'map' || severity <= 0) return;
  const wounds = token.blood?.wounds.length
    ? token.blood.wounds
    : [{ seed: 0, strength: severity }];
  const topDown =
    token.image.startsWith('/vtt/monsters/') ||
    token.image.startsWith('/api/vtt/premium-art/') ||
    isTopDownTokenImage(token.image);
  const key = JSON.stringify([wounds, token.width / token.height, topDown, image?.naturalWidth]);
  let cached = masks.get(token.id);
  if (!cached || cached.image !== image || cached.key !== key) {
    const canvas = document.createElement('canvas');
    canvas.width = RESOLUTION;
    canvas.height = Math.max(
      32,
      Math.min(1536, Math.round((RESOLUTION * token.height) / token.width)),
    );
    const ctx = canvas.getContext('2d')!,
      w = canvas.width,
      h = canvas.height;
    const footprint = effectFootprint(w, h, 100, 100, topDown ? image : undefined);
    for (const wound of wounds) {
      const random = seededRandom(token.id + wound.seed),
        point = footprint.body[Math.floor(random(1) * footprint.body.length)];
      const x = w / 2 + point.x * footprint.sx,
        y = h / 2 + point.y * footprint.sy;
      const radius = Math.min(w, h) * (0.022 + Math.sqrt(wound.strength) * 0.15);
      ctx.globalAlpha = Math.min(0.85, 0.2 + Math.sqrt(wound.strength) * 0.85);
      blot(ctx, x, y, radius, wound.seed);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    if (topDown && image?.complete && image.naturalWidth) {
      const fit = Math.min(w / image.naturalWidth, h / image.naturalHeight);
      ctx.drawImage(
        image,
        (w - image.naturalWidth * fit) / 2,
        (h - image.naturalHeight * fit) / 2,
        image.naturalWidth * fit,
        image.naturalHeight * fit,
      );
    } else {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    cached = { image, key, canvas };
    if (masks.size >= 32) masks.delete(masks.keys().next().value!);
    masks.set(token.id, cached);
  }
  c.save();
  c.shadowBlur = 0;
  // Stains retain the underlying skin, fabric and metal texture.
  c.globalCompositeOperation = 'multiply';
  c.scale(token.flipX ? -1 : 1, token.flipY ? -1 : 1);
  c.drawImage(cached.canvas, -token.width / 2, -token.height / 2, token.width, token.height);
  c.restore();
}
export function clearBloodRenderCache() {
  masks.clear();
  splashes.clear();
}
