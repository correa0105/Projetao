// Native alpha is preserved. Gauzy cloak rows flutter independently while
// advected density dissolves its tail; the illustrated head remains stable.
let pilgrim: HTMLImageElement | undefined;
export const spectralPilgrimReady = (async () => {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.src = '/vtt/temporal-20261009/spectral-pilgrim.webp';
  try {
    await image.decode();
    pilgrim = image;
  } catch {
    /* surrounding density fallback */
  }
})();
export const spectralPilgrimLoaded = () => Boolean(pilgrim);
export function spectralPilgrim(
  c: CanvasRenderingContext2D,
  size: number,
  t: number,
  opacity: number,
) {
  if (!pilgrim) return;
  c.save();
  c.globalAlpha *= opacity;
  const width = size * 0.86,
    height = size * 1.32,
    rows = 12;
  for (let i = 0; i < rows; i++) {
    const u = i / rows,
      sway = Math.sin(t * 1.1 - u * 4.8) * size * 0.027 * u * u;
    c.drawImage(
      pilgrim,
      0,
      (i * pilgrim.naturalHeight) / rows,
      pilgrim.naturalWidth,
      pilgrim.naturalHeight / rows,
      -width / 2 + sway,
      -height * 0.37 + (i * height) / rows,
      width,
      height / rows + 0.28,
    );
  }
  c.restore();
}
