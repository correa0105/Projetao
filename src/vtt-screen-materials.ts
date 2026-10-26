export const screenAtlasPath = '/vtt/screen-effects-20261026/debris-embers-atlas-v1.png';
let atlas: HTMLImageElement | undefined;
export function screenAtlas() {
  if (!atlas) {
    atlas = new Image();
    atlas.decoding = 'async';
    atlas.src = screenAtlasPath;
  }
  return atlas;
}
export function drawScreenSprite(
  context: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  width: number,
  height = width,
) {
  const image = screenAtlas();
  if (!image.complete || !image.naturalWidth) return false;
  const w = image.naturalWidth / 4,
    h = image.naturalHeight / 4;
  context.drawImage(image, (index % 4) * w, Math.floor(index / 4) * h, w, h, x, y, width, height);
  return true;
}
