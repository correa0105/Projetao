import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../public/mascot/', import.meta.url);
const source = fileURLToPath(new URL('crystal-fox-run-source.png', root));
const output = fileURLToPath(new URL('crystal-fox-run.webp', root));
const { width, height, hasAlpha } = await sharp(source).metadata();
if (!hasAlpha || !width || width !== height || width % 2) {
  throw new Error('Atlas quadrado 2 × 2 com transparência obrigatório.');
}
const cell = width / 2;
const frames = [];
for (let i = 0; i < 4; i++) {
  const buffer = await sharp(source)
    .extract({ left: (i % 2) * cell, top: Math.floor(i / 2) * cell, width: cell, height: cell })
    .png()
    .toBuffer();
  const data = await sharp(buffer).ensureAlpha().raw().toBuffer();
  let left = cell,
    top = cell,
    right = 0,
    bottom = 0;
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      if (data[(y * cell + x) * 4 + 3] < 48) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  left = Math.max(0, left - 2);
  top = Math.max(0, top - 2);
  right = Math.min(cell - 1, right + 2);
  bottom = Math.min(cell - 1, bottom + 2);
  frames.push({ buffer, left, top, width: right - left + 1, height: bottom - top + 1 });
}
// One scale and ground baseline prevent the generated grid from jumping between frames.
const scale = 464 / Math.max(...frames.flatMap((frame) => [frame.width, frame.height]));
const composites = [];
for (const [i, frame] of frames.entries()) {
  const resizedWidth = Math.round(frame.width * scale);
  const resizedHeight = Math.round(frame.height * scale);
  const input = await sharp(frame.buffer)
    .extract({ left: frame.left, top: frame.top, width: frame.width, height: frame.height })
    .resize(resizedWidth, resizedHeight)
    .png()
    .toBuffer();
  composites.push({
    input,
    left: (i % 2) * 512 + Math.round((512 - resizedWidth) / 2),
    top: Math.floor(i / 2) * 512 + 480 - resizedHeight,
  });
}
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
  .composite(composites)
  .webp({ lossless: true })
  .toFile(output);
console.log('Mascote: quatro quadros alinhados, atlas WebP transparente 1024 × 1024.');
