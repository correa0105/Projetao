import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { fract } from './vtt-effects-primitives';

const pages = typeof Image === 'undefined' ? [] : [new Image(), new Image()];
let loaded = false;
export const arcaneBarrierReady = Promise.all(
  pages.map(async (image, page) => {
    image.src = `/vtt/arcane-barrier-20261010/membrane-${page}.webp`;
    await image.decode();
  }),
)
  .then(() => {
    loaded = pages.length === 2;
  })
  .catch(() => {});
const tile = 196,
  size = 192;
let back: HTMLCanvasElement | undefined, front: HTMLCanvasElement | undefined;
let previousPhase = -1,
  previousColor = '';

export function drawArcaneBarrier(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  pass: 'behind' | 'front',
) {
  if (e.kind !== 'arcane-barrier') return false;
  if (!loaded) return true;
  const phase = fract(t / 4) * 32,
    frame = Math.floor(phase);
  if (!back) {
    back = document.createElement('canvas');
    front = document.createElement('canvas');
    back.width = back.height = front.width = front.height = size;
  }
  if (phase !== previousPhase || e.color !== previousColor) {
    const ctx = back.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'lighter';
    for (const [index, weight] of [
      [frame, 1 - (phase - frame)],
      [(frame + 1) % 32, phase - frame],
    ]) {
      const cell = index % 16;
      ctx.globalAlpha = weight;
      ctx.drawImage(
        pages[Math.floor(index / 16)],
        (cell % 4) * tile + 2,
        Math.floor(cell / 4) * tile + 2,
        size,
        size,
        0,
        0,
        size,
        size,
      );
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (e.color.toLowerCase() !== '#8870ff') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = e.color;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const fc = front!.getContext('2d')!;
    fc.clearRect(0, 0, size, size);
    fc.drawImage(back, 0, 0);
    fc.globalCompositeOperation = 'destination-in';
    const mask = fc.createRadialGradient(96, 96, 0, 96, 96, 96);
    mask.addColorStop(0, '#ffffff10');
    mask.addColorStop(0.48, '#ffffff18');
    mask.addColorStop(0.68, '#ffffffcc');
    mask.addColorStop(1, '#ffffff');
    fc.fillStyle = mask;
    fc.fillRect(0, 0, size, size);
    fc.globalCompositeOperation = 'source-over';
    previousPhase = phase;
    previousColor = e.color;
  }
  c.save();
  c.globalCompositeOperation = 'screen';
  c.globalAlpha *= pass === 'front' ? 0.92 : 0.56;
  // The atlas circle includes a soft 12% margin. The physical radius encloses
  // all token corners, including rectangular tokens, without tilting the dome.
  const rx = f.plane.rx * 2.25,
    ry = f.plane.ry * 2.25;
  c.drawImage(pass === 'front' ? front! : back, -rx, -ry, rx * 2, ry * 2);
  c.restore();
  return true;
}
