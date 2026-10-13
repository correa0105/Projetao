type Bounds = { left: number; top: number; width: number; height: number };
const bounds = new WeakMap<HTMLImageElement, { source: string; bounds: Bounds }>();

// Only the camp presentation is cropped. The original equipment art is retained.
export function alignCampPetArt(host: HTMLElement) {
  const image = host.querySelector<HTMLImageElement>('.owned-pet-art img');
  if (!image?.complete || !image.naturalWidth) return;
  let found = bounds.get(image);
  if (!found || found.source !== image.currentSrc) {
    const sample = document.createElement('canvas');
    sample.width = sample.height = 192;
    const context = sample.getContext('2d', { willReadFrequently: true })!;
    try {
      context.drawImage(image, 0, 0, 192, 192);
      const pixels = context.getImageData(0, 0, 192, 192).data;
      let left = 192,
        top = 192,
        right = -1,
        bottom = -1;
      for (let y = 0; y < 192; y++)
        for (let x = 0; x < 192; x++) {
          if (pixels[(y * 192 + x) * 4 + 3] < 64) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      if (right < left) return;
      found = {
        source: image.currentSrc,
        bounds: {
          left: left / 192,
          top: top / 192,
          width: (right - left + 1) / 192,
          height: (bottom - top + 1) / 192,
        },
      };
      bounds.set(image, found);
    } catch {
      return;
    }
  }
  const art = image.parentElement!,
    b = found.bounds;
  art.style.position = 'relative';
  art.style.overflow = 'hidden';
  art.style.aspectRatio = String(
    (image.naturalWidth * b.width) / (image.naturalHeight * b.height),
  );
  image.style.position = 'absolute';
  image.style.maxWidth = 'none';
  image.style.width = `${100 / b.width}%`;
  image.style.left = `${(-100 * b.left) / b.width}%`;
  image.style.top = `${(-100 * b.top) / b.height}%`;
}
