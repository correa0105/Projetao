import sharp from 'sharp';

/** Preserve native pixels; only pad the shorter side of a transparent token. */
export async function squareTokenCanvas(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  const meta = await image.metadata();
  if (!meta.hasAlpha || !meta.width || !meta.height || meta.width === meta.height) return bytes;
  const side = Math.max(meta.width, meta.height);
  if (side * side > 40_000_000) return bytes;
  // Padding must not make an opaque candidate satisfy the transparency gate.
  if ((await image.stats()).isOpaque) return bytes;
  const left = Math.floor((side - meta.width) / 2),
    top = Math.floor((side - meta.height) / 2);
  return image
    .extend({
      left,
      top,
      right: side - meta.width - left,
      bottom: side - meta.height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}
