let wraith: HTMLImageElement | undefined;
export const spectralScreamerReady = (async () => {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.src = '/vtt/spectral-procession-20261010/screaming-wraith.webp';
  try {
    await image.decode();
    wraith = image;
  } catch {
    // A failed download must not stop the other gallery effects.
  }
})();
export const spectralScreamerLoaded = () => Boolean(wraith);

// Native face and hood remain together. A travelling cloth wave stretches the
// lower cloak, with a zero displacement at the hood rather than rigid rotation.
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
  const cloth = (u: number) => Math.max(0, (u - 0.29) / 0.71);
  const yAt = (u: number) => height * (u - 0.46 + stretch * cloth(u) ** 2);
  for (let i = 0; i < rows; i++) {
    const u = i / rows,
      next = (i + 1) / rows,
      amount = cloth(u),
      sway = size * 0.085 * Math.sin(t * 1.47 - amount * 5.2) * amount ** 1.5,
      breadth = 1 + Math.sin(t * 0.73 - amount * 2.9) * amount * 0.07;
    c.drawImage(
      wraith,
      0,
      u * wraith.naturalHeight,
      wraith.naturalWidth,
      wraith.naturalHeight / rows,
      -width * 0.73 + sway,
      yAt(u),
      width * breadth,
      yAt(next) - yAt(u) + 0.2,
    );
  }
  c.restore();
}
