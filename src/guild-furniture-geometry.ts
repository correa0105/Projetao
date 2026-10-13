import { houseDistortionMatrix } from '../shared/house-distortion';
import { guildPerspectiveCorners, type GuildPerspective } from '../shared/guild-perspective';
type VisiblePixels = {
  source: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  perspective?: GuildPerspective;
};
const visiblePixels = new WeakMap<HTMLImageElement, VisiblePixels>();

export function alignGuildFurnitureImage(
  image: HTMLImageElement,
  perspective?: GuildPerspective,
) {
  let pixels = visiblePixels.get(image);
  if (pixels?.source !== image.src) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = Math.max(1, Math.round((192 * image.naturalHeight) / image.naturalWidth));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      top = canvas.height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++)
        if (data[(y * canvas.width + x) * 4 + 3] > 64) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
    if (right < left || bottom < top) return;
    pixels = {
      source: image.src,
      left: left / canvas.width,
      top: top / canvas.height,
      right: (right + 1) / canvas.width,
      bottom: (bottom + 1) / canvas.height,
    };
    visiblePixels.set(image, pixels);
  }
  pixels.perspective = perspective;
  const width = image.offsetWidth,
    height = image.offsetHeight;
  const x = pixels.left * width,
    y = pixels.top * height;
  const matrix = houseDistortionMatrix(
    perspective,
    (pixels.right - pixels.left) * width,
    (pixels.bottom - pixels.top) * height,
  );
  image.style.transformOrigin = '0 0';
  image.style.transform = `translateY(${(1 - pixels.bottom) * 100}%) translate(${x}px,${y}px) ${matrix === 'none' ? '' : matrix} translate(${-x}px,${-y}px)`;
}
export function guildFurnitureGeometry(image: HTMLImageElement) {
  const p = visiblePixels.get(image);
  if (!image.complete || p?.source !== image.src) return null;
  const parent = image.parentElement!.getBoundingClientRect();
  const width = image.offsetWidth,
    height = image.offsetHeight;
  const base = {
    left: parent.left + image.offsetLeft + p.left * width,
    top: parent.top + image.offsetTop + (p.top + 1 - p.bottom) * height,
    width: (p.right - p.left) * width,
    height: (p.bottom - p.top) * height,
  };
  const points = guildPerspectiveCorners(p.perspective).map((c) => ({
    x: base.left + c.x * base.width,
    y: base.top + c.y * base.height,
  }));
  return { base, points };
}
export function guildFurnitureVisibleRect(image: HTMLImageElement) {
  const geometry = guildFurnitureGeometry(image);
  return geometry
    ? {
        left: Math.min(...geometry.points.map((p) => p.x)),
        right: Math.max(...geometry.points.map((p) => p.x)),
        top: Math.min(...geometry.points.map((p) => p.y)),
        bottom: Math.max(...geometry.points.map((p) => p.y)),
      }
    : null;
}
