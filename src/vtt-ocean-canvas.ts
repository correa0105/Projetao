import type { VttScene } from '../shared/vtt';
import { oceanImage, oceanAnimationEnabled } from '../shared/vtt-naval';
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
    const tiles = (dx: number, dy: number, period = size) => {
      for (let y = Math.floor((v.y - dy) / period); y < Math.ceil((v.bottom - dy) / period); y++)
        for (let x = Math.floor((v.x - dx) / period); x < Math.ceil((v.right - dx) / period); x++)
          c.drawImage(image, x * period + dx, y * period + dy, period, period);
    };
    const animated = oceanAnimationEnabled(s.ocean, o.mapEffects !== false, o.oceanMotion, reduced);
    const t = animated ? (now / 1000) * s.ocean.speed : 0;
    // Two opposing swells change the crests rather than leaving an almost
    // static base underneath. A small screen-space floor keeps motion visible
    // when a whole ocean map is fitted into the viewport.
    const amplitude = animated ? Math.max(38, 8 / Math.max(0.05, o.camera.zoom)) : 0;
    tiles(Math.sin(t * 0.35) * amplitude, Math.sin(t * 0.22) * amplitude * 0.7);
    c.globalAlpha = animated ? 0.32 + 0.1 * Math.sin(t * 0.52) : 0.25;
    tiles(-Math.sin(t * 0.29) * amplitude * 0.8, Math.sin(t * 0.43) * amplitude, size * 1.07);
  }
  c.restore();
}
