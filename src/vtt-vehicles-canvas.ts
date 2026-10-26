import {
  vehicleArt,
  vehicleDrawParts,
  vehicleOccupied,
  vehicleCoverImage,
  type VehicleId,
} from '../shared/vtt-vehicles';
import type { VttToken } from '../shared/vtt';
const masks = new WeakMap<HTMLImageElement, Map<VehicleId, Uint8ClampedArray>>();
export function drawVehiclePart(
  c: CanvasRenderingContext2D,
  t: VttToken,
  img: HTMLImageElement | undefined,
  part: 'base' | 'cover',
) {
  if (!vehicleArt(t) || !img?.complete || !img.naturalWidth) return false;
  const parts = vehicleDrawParts(t.vehicle!.itemId, part);
  if (!parts.length) return false;
  for (const { source: r, target: q } of parts)
    c.drawImage(
      img,
      r[0] * img.naturalWidth,
      r[1] * img.naturalHeight,
      r[2] * img.naturalWidth,
      r[3] * img.naturalHeight,
      (q[0] - 0.5) * t.width,
      (q[1] - 0.5) * t.height,
      q[2] * t.width,
      q[3] * t.height,
    );
  return true;
}
export function vehicleCoverOccupied(t: VttToken, img: HTMLImageElement, actors: VttToken[]) {
  const a = vehicleArt(t);
  if (!a?.cover) return false;
  let map = masks.get(img);
  if (!map) {
    map = new Map();
    masks.set(img, map);
  }
  let pixels = map.get(t.vehicle!.itemId);
  if (!pixels) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    try {
      c.translate(64, 64);
      drawVehiclePart(c, { ...t, width: 128, height: 128 }, img, 'cover');
      pixels = c.getImageData(0, 0, 128, 128).data;
      map.set(t.vehicle!.itemId, pixels);
    } catch {
      return false;
    }
  }
  return vehicleOccupied(
    t,
    actors,
    (x, y) => pixels![(Math.floor(y * 128) * 128 + Math.floor(x * 128)) * 4 + 3] > 64,
  );
}
export function drawVehicleCovers(
  c: CanvasRenderingContext2D,
  tokens: VttToken[],
  actors: VttToken[],
  images: Map<string, HTMLImageElement>,
  visible: (t: VttToken) => boolean,
  gmOpacity: number,
) {
  for (const t of tokens) {
    if (!t.vehicle || !vehicleArt(t)?.cover || !visible(t)) continue;
    const img = images.get(vehicleCoverImage(t.vehicle.itemId));
    if (!img?.complete || !img.naturalWidth) continue;
    c.save();
    c.translate(t.x, t.y);
    c.rotate((t.rotation * Math.PI) / 180);
    c.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
    c.globalAlpha =
      (t.hidden || t.layer === 'gm' ? gmOpacity : 1) *
      (vehicleCoverOccupied(t, img, actors) ? 0.12 : 1);
    drawVehiclePart(c, t, img, 'cover');
    c.restore();
  }
}
