import type { VttScene, VttToken } from '../shared/vtt';
import {
  canopyActor,
  canopyAreaOccupied,
  canopyTokenSamples,
  isTreeCanopy,
  resolveCanopy,
  bindCanopy,
  canopySource,
} from '../shared/vtt-canopies';
const masks = new WeakMap<HTMLImageElement, Uint8ClampedArray>();
function mask(image: HTMLImageElement) {
  let pixels = masks.get(image);
  if (!pixels) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    try {
      context.drawImage(image, 0, 0, 128, 128);
      pixels = context.getImageData(0, 0, 128, 128).data;
      masks.set(image, pixels);
    } catch {
      return null;
    }
  }
  return pixels;
}
export function treeCanopyOccupied(tree: VttToken, image: HTMLImageElement, actors: VttToken[]) {
  const pixels = mask(image);
  if (!pixels) return false;
  const a = (-tree.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return actors.some(
    (t) =>
      canopyActor(t) &&
      canopyTokenSamples(t).some((p) => {
        const x = p.x - tree.x,
          y = p.y - tree.y;
        const u = ((x * c - y * s) * (tree.flipX ? -1 : 1)) / tree.width + 0.5;
        const v = ((x * s + y * c) * (tree.flipY ? -1 : 1)) / tree.height + 0.5;
        return (
          u >= 0 &&
          u < 1 &&
          v >= 0 &&
          v < 1 &&
          pixels![(Math.floor(v * 128) * 128 + Math.floor(u * 128)) * 4 + 3] > 64
        );
      }),
  );
}
const areaBindings = new WeakMap<
  VttScene,
  {
    tokens: VttToken[];
    areas: VttScene['canopyAreas'];
    value: NonNullable<VttScene['canopyAreas']>;
  }
>();
function effectiveAreas(scene: VttScene) {
  let cached = areaBindings.get(scene);
  if (!cached || cached.tokens !== scene.tokens || cached.areas !== scene.canopyAreas) {
    cached = {
      tokens: scene.tokens,
      areas: scene.canopyAreas,
      value: (scene.canopyAreas || []).map((a) => {
        const t = !a.source && canopySource(a, scene.tokens);
        return t ? bindCanopy(a, t) : a;
      }),
    };
    areaBindings.set(scene, cached);
  }
  return cached.value;
}
const covers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function captureCanopyAreas(c: CanvasRenderingContext2D, scene: VttScene) {
  const areas = effectiveAreas(scene).filter((a) => a.enabled && !a.source);
  if (!areas.length) return null;
  let cover = covers.get(c.canvas);
  if (!cover) {
    cover = document.createElement('canvas');
    covers.set(c.canvas, cover);
  }
  if (cover.width !== c.canvas.width || cover.height !== c.canvas.height) {
    cover.width = c.canvas.width;
    cover.height = c.canvas.height;
  }
  const copy = cover.getContext('2d')!;
  copy.clearRect(0, 0, cover.width, cover.height);
  copy.drawImage(c.canvas, 0, 0);
  return cover;
}
function areaPath(area: import('../shared/vtt-canopies').CanopyArea) {
  const path = new Path2D();
  area.points.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
  return path;
}
export function clipCanopyBase(c: CanvasRenderingContext2D, scene: VttScene, t: VttToken) {
  for (const raw of effectiveAreas(scene)) {
    if (!raw.enabled || raw.source?.tokenId !== t.id) continue;
    const area = resolveCanopy(raw, scene.tokens);
    if (!area) continue;
    const outside = new Path2D();
    outside.rect(-32000, -32000, 64000, 64000);
    outside.addPath(areaPath(area));
    c.clip(outside, 'evenodd');
  }
}
export function drawCanopyForeground(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  images: Map<string, HTMLImageElement>,
  actors: VttToken[],
  cover: HTMLCanvasElement | null,
  visible: (t: VttToken) => boolean,
  selected: string[],
  zoom: number,
) {
  if (cover) {
    // Disjoint compositing keeps overlapping selections from doubling opacity.
    const used: Path2D[] = [];
    const areas = effectiveAreas(scene)
      .filter((a) => a.enabled && !a.source)
      .sort(
        (a, b) =>
          (canopyAreaOccupied(a, actors) ? a.opacity : 1) -
          (canopyAreaOccupied(b, actors) ? b.opacity : 1),
      );
    for (const area of areas) {
      c.save();
      for (const previous of used) {
        const outside = new Path2D();
        outside.rect(0, 0, scene.width, scene.height);
        outside.addPath(previous);
        c.clip(outside, 'evenodd');
      }
      const path = new Path2D();
      area.points.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
      path.closePath();
      c.clip(path);
      c.globalAlpha = canopyAreaOccupied(area, actors) ? area.opacity : 1;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(cover, 0, 0);
      c.restore();
      used.push(path);
    }
  }
  for (const item of scene.tokens
    .filter((t) => t.layer === 'map')
    .sort((a, b) => a.level - b.level)) {
    const img = images.get(item.image);
    if (!visible(item) || !img?.complete || !img.naturalWidth) continue;
    const areas = effectiveAreas(scene)
      .filter((a) => a.enabled && a.source?.tokenId === item.id)
      .map((a) => resolveCanopy(a, scene.tokens))
      .filter((a) => a !== null)
      .sort(
        (a, b) =>
          (canopyAreaOccupied(a, actors) ? a.opacity : 1) -
          (canopyAreaOccupied(b, actors) ? b.opacity : 1),
      );
    const used: Path2D[] = [];
    if (isTreeCanopy(item) && areas.length) {
      c.save();
      clipCanopyBase(c, scene, item);
      c.translate(item.x, item.y);
      c.rotate((item.rotation * Math.PI) / 180);
      c.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
      c.globalAlpha = item.hidden ? scene.gmOpacity : 1;
      c.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
      c.restore();
    }
    for (const area of areas) {
      c.save();
      for (const previous of used) {
        const outside = new Path2D();
        outside.rect(-32000, -32000, 64000, 64000);
        outside.addPath(previous);
        c.clip(outside, 'evenodd');
      }
      const path = areaPath(area);
      c.clip(path);
      c.translate(item.x, item.y);
      c.rotate((item.rotation * Math.PI) / 180);
      c.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
      c.globalAlpha =
        (canopyAreaOccupied(area, actors) ? area.opacity : 1) * (item.hidden ? scene.gmOpacity : 1);
      c.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
      c.restore();
      used.push(path);
    }
  }
  for (const tree of scene.tokens.filter(isTreeCanopy).sort((a, b) => a.level - b.level)) {
    if (effectiveAreas(scene).some((a) => a.enabled && a.source?.tokenId === tree.id)) continue;
    const image = images.get(tree.image);
    if (!visible(tree) || !image?.complete || !image.naturalWidth) continue;
    c.save();
    c.translate(tree.x, tree.y);
    c.rotate((tree.rotation * Math.PI) / 180);
    c.scale(tree.flipX ? -1 : 1, tree.flipY ? -1 : 1);
    c.globalAlpha = treeCanopyOccupied(tree, image, actors) ? (scene.canopyOpacity ?? 0.35) : 1;
    if (tree.hidden) c.globalAlpha *= scene.gmOpacity;
    c.drawImage(image, -tree.width / 2, -tree.height / 2, tree.width, tree.height);
    if (selected.includes(tree.id)) {
      c.globalAlpha = 1;
      c.strokeStyle = '#efd293';
      c.lineWidth = 2 / zoom;
      c.setLineDash([6 / zoom, 3 / zoom]);
      c.strokeRect(
        -tree.width / 2 - 4 / zoom,
        -tree.height / 2 - 4 / zoom,
        tree.width + 8 / zoom,
        tree.height + 8 / zoom,
      );
    }
    c.restore();
  }
}
