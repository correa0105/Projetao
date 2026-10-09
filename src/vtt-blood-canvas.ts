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
  // Uneven, connected pools, fine satellite droplets and a wet reflected edge.
  const shape = () => {
    c.beginPath();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2,
        radius = r * (0.55 + random(i + 1) * 0.45);
      const px = Math.cos(a) * radius,
        py = Math.sin(a) * radius;
      if (!i) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  };
  shape();
  const wet = c.createRadialGradient(-r * 0.28, -r * 0.28, r * 0.03, 0, 0, r);
  wet.addColorStop(0, '#aa1824');
  wet.addColorStop(0.3, '#8b0f19');
  wet.addColorStop(0.75, '#520811');
  wet.addColorStop(1, '#280608');
  c.fillStyle = wet;
  c.fill();
  c.save();
  c.clip();
  for (let i = 0; i < 12; i++) {
    c.beginPath();
    c.ellipse(
      (random(i + 70) - 0.5) * r * 1.5,
      (random(i + 90) - 0.5) * r * 1.5,
      r * (0.08 + random(i + 110) * 0.22),
      r * 0.025,
      random(i + 130) * 6,
      0,
      Math.PI * 2,
    );
    c.fillStyle = i % 3 ? '#d13d3927' : '#ffd1a254';
    c.fill();
  }
  c.restore();
  for (let i = 0; i < 20; i++) {
    const a = random(i + 150) * Math.PI * 2,
      d = r * (0.8 + random(i + 180) * 1.05);
    c.beginPath();
    c.ellipse(
      Math.cos(a) * d,
      Math.sin(a) * d,
      r * (0.018 + random(i + 200) * 0.065),
      r * (0.012 + random(i + 230) * 0.04),
      a,
      0,
      Math.PI * 2,
    );
    c.fillStyle = i % 3 ? '#620811' : '#96131b';
    c.fill();
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
      sx = d.kind === 'trail' ? 1.7 : d.kind === 'splash' ? 2.5 : 1;
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
