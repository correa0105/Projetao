import type { TerrainStroke, VttScene } from '../shared/vtt';
import { terrainTextures } from '../shared/vtt-terrain';
import type { RenderOptions } from './vtt-canvas';
const caches = new WeakMap<
  HTMLCanvasElement,
  {
    key: string;
    signature: string;
    draft: TerrainStroke | null | undefined;
    canvas: HTMLCanvasElement;
    layer: HTMLCanvasElement;
    mask: HTMLCanvasElement;
    piece: HTMLCanvasElement;
  }
>();
export function drawTerrain(c: CanvasRenderingContext2D, scene: VttScene, o: RenderOptions) {
  const strokes = [...(scene.terrain || []), ...(o.terrainDraft ? [o.terrainDraft] : [])];
  if (!strokes.length) return;
  const layers = scene.terrainLayers || [{ id: 'base', name: 'Chão', visible: true, opacity: 1 }];
  const w = c.canvas.width,
    h = c.canvas.height,
    zoom = o.camera.zoom * o.dpr;
  const tx = w / 2 - o.camera.x * zoom,
    ty = h / 2 - o.camera.y * zoom;
  const key = JSON.stringify([
    scene.id,
    o.camera,
    o.dpr,
    w,
    h,
    terrainTextures.map((t) => o.images.get(t.image)?.naturalWidth || 0),
  ]);
  const signature = JSON.stringify([scene.terrain || [], layers]);
  let cache = caches.get(c.canvas);
  if (
    !cache ||
    cache.key !== key ||
    cache.signature !== signature ||
    cache.draft !== o.terrainDraft
  ) {
    const output = cache?.canvas || document.createElement('canvas'),
      layer = cache?.layer || document.createElement('canvas');
    const mask = cache?.mask || document.createElement('canvas'),
      piece = cache?.piece || document.createElement('canvas');
    output.width = layer.width = w;
    output.height = layer.height = h;
    const out = output.getContext('2d')!,
      lc = layer.getContext('2d')!,
      mc = mask.getContext('2d')!,
      pc = piece.getContext('2d')!;
    function apply(stroke: TerrainStroke) {
      const margin = stroke.radius * 2;
      const left = Math.max(
        0,
        Math.floor((Math.min(...stroke.points.map((p) => p.x)) - margin) * zoom + tx),
      );
      const top = Math.max(
        0,
        Math.floor((Math.min(...stroke.points.map((p) => p.y)) - margin) * zoom + ty),
      );
      const rw =
        Math.min(w, Math.ceil((Math.max(...stroke.points.map((p) => p.x)) + margin) * zoom + tx)) -
        left;
      const rh =
        Math.min(h, Math.ceil((Math.max(...stroke.points.map((p) => p.y)) + margin) * zoom + ty)) -
        top;
      if (rw <= 0 || rh <= 0) return;
      const image = o.images.get(terrainTextures.find((t) => t.id === stroke.texture)!.image);
      if (!stroke.erase && (!image?.complete || !image.naturalWidth)) return;
      mask.width = piece.width = rw;
      mask.height = piece.height = rh;
      mc.filter = stroke.softness
        ? `blur(${stroke.radius * zoom * stroke.softness * 0.3}px)`
        : 'none';
      mc.setTransform(zoom, 0, 0, zoom, tx - left, ty - top);
      mc.fillStyle = mc.strokeStyle = '#fff';
      mc.lineCap = mc.lineJoin = 'round';
      const radius = stroke.radius * (1 - stroke.softness * 0.35);
      if ((stroke.shape || 'round') === 'round') {
        mc.lineWidth = radius * 2;
        mc.beginPath();
        if (stroke.points.every((p) => p.x === stroke.points[0].x && p.y === stroke.points[0].y)) {
          mc.arc(stroke.points[0].x, stroke.points[0].y, radius, 0, Math.PI * 2);
          mc.fill();
        } else {
          stroke.points.forEach((p, i) => (i ? mc.lineTo(p.x, p.y) : mc.moveTo(p.x, p.y)));
          mc.stroke();
        }
      } else {
        const stamp = (x: number, y: number) => {
          if (stroke.shape === 'square') {
            mc.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            return;
          }
          const seed = (Math.round(x * 13) * 73856093) ^ (Math.round(y * 13) * 19349663);
          mc.beginPath();
          for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            const r = radius * (0.65 + 0.35 * ((((seed ^ (i * 83492791)) >>> 0) % 1000) / 1000));
            const px = x + Math.cos(angle) * r,
              py = y + Math.sin(angle) * r;
            if (i) mc.lineTo(px, py);
            else mc.moveTo(px, py);
          }
          mc.closePath();
          mc.fill();
        };
        stamp(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          const a = stroke.points[i - 1],
            b = stroke.points[i],
            steps = Math.min(
              512,
              Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (radius * 0.4))),
            );
          for (let j = 1; j <= steps; j++)
            stamp(a.x + ((b.x - a.x) * j) / steps, a.y + ((b.y - a.y) * j) / steps);
        }
      }
      mc.filter = 'none';
      lc.globalAlpha = stroke.opacity;
      if (stroke.erase) {
        lc.globalCompositeOperation = 'destination-out';
        lc.drawImage(mask, left, top);
      } else {
        const pattern = pc.createPattern(image!, 'repeat')!;
        pattern.setTransform(
          new DOMMatrix([
            (stroke.textureScale / image!.naturalWidth) * zoom,
            0,
            0,
            (stroke.textureScale / image!.naturalHeight) * zoom,
            tx - left,
            ty - top,
          ]),
        );
        pc.fillStyle = pattern;
        pc.fillRect(0, 0, rw, rh);
        pc.globalCompositeOperation = 'destination-in';
        pc.drawImage(mask, 0, 0);
        lc.globalCompositeOperation = 'source-over';
        lc.drawImage(piece, left, top);
      }
    }
    for (const metadata of layers) {
      if (!metadata.visible || metadata.opacity <= 0) continue;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalAlpha = 1;
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, w, h);
      strokes.filter((s) => (s.layer || 'base') === metadata.id).forEach(apply);
      out.globalAlpha = metadata.opacity;
      out.drawImage(layer, 0, 0);
    }
    cache = { key, signature, draft: o.terrainDraft, canvas: output, layer, mask, piece };
    caches.set(c.canvas, cache);
  }
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.beginPath();
  c.rect(tx, ty, scene.width * zoom, scene.height * zoom);
  c.clip();
  c.drawImage(cache.canvas, 0, 0);
  c.restore();
}
