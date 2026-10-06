import sharp, { type OverlayOptions } from 'sharp';

/** Pack every selected item into numbered panels, within the native reference limit. */
export async function equipmentReferenceSheet(items: { slot: string; image: Buffer }[]) {
  const columns = Math.min(items.length, items.length > 9 ? 4 : 3),
    width = 384,
    height = 528,
    rows = Math.ceil(items.length / columns);
  const panels: OverlayOptions[] = [];
  for (const [index, item] of items.entries()) {
    const left = (index % columns) * width,
      top = Math.floor(index / columns) * height;
    panels.push({
      input: await sharp(item.image, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(width - 24, height - 72, { fit: 'contain', background: '#202328' })
        .png()
        .toBuffer(),
      left: left + 12,
      top: top + 60,
    });
    // Labels use validated slot identifiers, never player-provided markup.
    panels.push({
      input: Buffer.from(
        `<svg width="${width}" height="52" xmlns="http://www.w3.org/2000/svg"><text x="14" y="34" fill="#e7d7b6" font-family="sans-serif" font-size="24">${index + 1} · ${item.slot}</text></svg>`,
      ),
      left,
      top,
    });
  }
  return sharp({
    create: { width: columns * width, height: rows * height, channels: 4, background: '#17191c' },
  })
    .composite(panels)
    .png()
    .toBuffer();
}
