let wraith: HTMLImageElement | undefined;
export const spectralScreamerReady = (async () => {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.src = '/vtt/spectral-reaper-20261010/reaper.webp';
  try {
    await image.decode();
    wraith = image;
  } catch {
    // A failed download must not stop the other gallery effects.
  }
})();
export const spectralScreamerLoaded = () => Boolean(wraith);

// The mask, hood, hand and long scythe remain rigid. An affine cloth grid blends
// the trailing cloak's wave/stretch into the unchanged right-hand weapon strip.
export function spectralScreamer(
  c: CanvasRenderingContext2D,
  size: number,
  t: number,
  opacity: number,
) {
  if (!wraith) return;
  c.save();
  c.globalAlpha *= opacity;
  const height = size * 1.22,
    width = height * (wraith.naturalWidth / wraith.naturalHeight),
    rows = 32,
    stretch = 0.12 + 0.12 * Math.sin(t * 0.93);
  const columns = 8;
  const point = (x: number, y: number) => {
    const cloth = Math.max(0, (y - 0.38) / 0.62),
      blend = Math.max(0, Math.min(1, (0.75 - x) / 0.23)),
      weight = blend * blend * (3 - 2 * blend),
      sway = size * 0.06 * Math.sin(t * 1.47 - cloth * 5.2) * cloth ** 1.5,
      breadth = (x - 0.5) * width * 0.04 * Math.sin(t * 0.73 - cloth * 2.9) * cloth;
    return {
      x: -width * 0.73 + width * x + (sway + breadth) * weight,
      y: height * (y - 0.46 + stretch * cloth ** 2 * weight),
    };
  };
  for (let column = 0; column < columns; column++) {
    const x = column / columns, nextX = (column + 1) / columns,
      sourceX = x * wraith.naturalWidth, sourceWidth = wraith.naturalWidth / columns;
    if (x >= 0.75) {
      c.drawImage(wraith, sourceX, 0, sourceWidth, wraith.naturalHeight,
        -width * 0.73 + width * x, -height * 0.46, width / columns + 0.15, height);
      continue;
    }
    for (let row = 0; row < rows; row++) {
      const y = row / rows, nextY = (row + 1) / rows,
        sourceHeight = wraith.naturalHeight / rows,
        a = point(x, y), b = point(nextX, y), d = point(x, nextY);
      c.save();
      c.transform((b.x - a.x) / sourceWidth, (b.y - a.y) / sourceWidth,
        (d.x - a.x) / sourceHeight, (d.y - a.y) / sourceHeight, a.x, a.y);
      c.drawImage(wraith, sourceX, y * wraith.naturalHeight, sourceWidth, sourceHeight,
        0, 0, sourceWidth + 0.15, sourceHeight + 0.15);
      c.restore();
    }
  }
  c.restore();
}
