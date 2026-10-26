import type { VttScene } from '../shared/vtt';
import { oceanImage } from '../shared/vtt-naval';
import type { RenderOptions } from './vtt-canvas';

// Native image quads keep the entire pass on the same Canvas backend as tokens
// and terrain. No map-sized buffers, pixel reads or changing texture patterns.
export function drawOcean(
  c: CanvasRenderingContext2D,
  s: VttScene,
  o: RenderOptions,
  now: number,
  reduced: boolean,
) {
  if (!s.ocean?.enabled) return;
  const image = o.images.get(oceanImage);
  const v = {
    x: Math.max(0, o.camera.x - o.width / 2 / o.camera.zoom),
    y: Math.max(0, o.camera.y - o.height / 2 / o.camera.zoom),
    right: Math.min(s.width, o.camera.x + o.width / 2 / o.camera.zoom),
    bottom: Math.min(s.height, o.camera.y + o.height / 2 / o.camera.zoom),
  };
  if (v.right <= v.x || v.bottom <= v.y) return;
  c.save();
  c.fillStyle = '#124c59';
  c.fillRect(v.x, v.y, v.right - v.x, v.bottom - v.y);
  if (image?.complete && image.naturalWidth) {
    const size =
      700 * 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(v.right - v.x, v.bottom - v.y) / 5600)));
    const tiles = (dx: number, dy: number) => {
      for (let y = Math.floor((v.y - dy) / size); y < Math.ceil((v.bottom - dy) / size); y++)
        for (let x = Math.floor((v.x - dx) / size); x < Math.ceil((v.right - dx) / size); x++)
          c.drawImage(image, x * size + dx, y * size + dy, size, size);
    };
    tiles(0, 0);
    const animated = s.ocean.animated && !reduced && o.mapEffects !== false;
    const t = animated ? (now / 1000) * s.ocean.speed : 0;
    c.globalAlpha = 0.25;
    tiles((Math.sin(t * 0.11) * 9 + t * 1.4) % size, (Math.cos(t * 0.09) * 7 - t * 2.2) % size);
  }
  c.restore();
}
