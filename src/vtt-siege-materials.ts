import type { Point } from '../shared/vtt';

let image: HTMLImageElement | undefined;
const listeners = new Set<() => void>();
export function siegeMaterials(onLoad?: () => void) {
  if (onLoad) listeners.add(onLoad);
  if (!image) {
    image = new Image();
    image.onload = () => {
      for (const draw of listeners) draw();
    };
    image.src = '/vtt/siege-materials-20261027/projectiles-v1.png?v=native-atlas-20261029';
  }
  return image.complete && image.naturalWidth ? image : null;
}
export function forgetSiegeMaterials(callback: () => void) {
  listeners.delete(callback);
}
export const harpoonLength = (grid: number, zoom: number) =>
  Math.max(grid * 0.95, 12 / Math.max(0.03, zoom));
function drawAtlasRegion(
  ctx: CanvasRenderingContext2D,
  material: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  // Regions use the original 1536×1024 pixel space. A stale delivery copy must
  // not shift a projectile or make the rope sample an empty atlas region.
  const scaleX = material.naturalWidth / 1536,
    scaleY = material.naturalHeight / 1024;
  ctx.drawImage(material, sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY, dx, dy, dw, dh);
}
export function drawSiegeHarpoon(ctx: CanvasRenderingContext2D, grid: number, zoom: number) {
  const material = siegeMaterials();
  if (!material) return;
  const length = harpoonLength(grid, zoom),
    height = (length * 152) / 853;
  drawAtlasRegion(ctx, material, 26, 176, 853, 152, -length, -height / 2, length, height);
}
export function drawSiegeBall(
  ctx: CanvasRenderingContext2D,
  ground: boolean,
  grid: number,
  zoom: number,
) {
  const material = siegeMaterials();
  if (!material) return;
  const width = Math.max(grid * (ground ? 0.48 : 0.21), (ground ? 10 : 5) / Math.max(0.03, zoom));
  const source = ground ? [58, 436, 756, 502] : [1028, 534, 345, 347];
  const height = (width * source[3]) / source[2];
  drawAtlasRegion(
    ctx,
    material,
    source[0],
    source[1],
    source[2],
    source[3],
    -width / 2,
    -height / 2,
    width,
    height,
  );
}
export function drawSiegeRope(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  grid: number,
  zoom: number,
  visible?: (p: Point) => boolean,
  flutter = 0,
) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    distance = Math.hypot(dx, dy);
  if (distance < 0.1) return;
  const material = siegeMaterials(),
    steps = Math.min(256, Math.max(2, Math.ceil(distance / Math.max(grid * 0.3, 8 / zoom))));
  const slack = Math.min(grid * 0.18, distance * 0.025) + flutter;
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: from.x + dx * t - (dy / distance) * Math.sin(t * Math.PI) * slack,
      y: from.y + dy * t + (dx / distance) * Math.sin(t * Math.PI) * slack,
    });
  }
  const thickness = Math.max(grid * 0.022, 1.4 / zoom);
  ctx.lineCap = 'round';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (visible && (!visible(a) || !visible(mid) || !visible(b))) continue;
    ctx.strokeStyle = '#30271be0';
    ctx.lineWidth = thickness + 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (material) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      // The atlas middle repeats without the fading ends; no image file is cropped.
      drawAtlasRegion(
        ctx,
        material,
        1095,
        210,
        160,
        94,
        0,
        -thickness / 2,
        Math.hypot(b.x - a.x, b.y - a.y) + 0.35 / zoom,
        thickness,
      );
      ctx.restore();
    }
  }
}
