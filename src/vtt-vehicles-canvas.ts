import {
  vehicleArt,
  vehicleDrawParts,
  vehicleOccupied,
  vehicleCoverImage,
} from '../shared/vtt-vehicles';
import type { VttToken } from '../shared/vtt';
import { navalAtlas, navalMotion, rowing, sailMasts } from '../shared/vtt-naval';
import { drawSailingRig, drawRowingOars } from './vtt-naval-canvas';
const masks = new WeakMap<HTMLImageElement, Map<string, Uint8ClampedArray>>();
export function drawVehiclePart(
  c: CanvasRenderingContext2D,
  t: VttToken,
  img: HTMLImageElement | undefined,
  part: 'base' | 'cover',
  motion?: { time: number; animate: boolean; oar?: HTMLImageElement },
) {
  if (!vehicleArt(t) || !img?.complete || !img.naturalWidth) return false;
  const parts = vehicleDrawParts(t.vehicle!.itemId, part);
  if (!parts.length) return false;
  const id = t.vehicle!.itemId,
    p = rowing[id],
    oar = motion?.oar;
  if (part === 'base' && p && oar?.complete && oar.naturalWidth) {
    if (id === 'rowboat') {
      const sx = oar.naturalWidth / 1280,
        sy = oar.naturalHeight / 1280;
      drawRowingOars(c, t, oar, motion!.time, motion!.animate);
      c.drawImage(
        oar,
        225 * sx,
        0,
        570 * sx,
        1240 * sy,
        -t.width / 2,
        -t.height / 2,
        t.width,
        t.height,
      );
      return true;
    }
    if (navalMotion(t).oarsAnimated) {
      drawRowingOars(c, t, oar, motion!.time, motion!.animate);
      c.save();
      c.beginPath();
      c.rect((p.left - 0.5) * t.width, -t.height / 2, (p.right - p.left) * t.width, t.height);
      c.clip();
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
      c.restore();
      return true;
    }
  }
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
export function vehicleCoverOccupied(
  t: VttToken,
  img: HTMLImageElement,
  actors: VttToken[],
  naval = false,
) {
  const a = vehicleArt(t);
  if (!a?.cover) return false;
  let map = masks.get(img);
  if (!map) {
    map = new Map();
    masks.set(img, map);
  }
  const m = navalMotion(t),
    key =
      t.vehicle!.itemId +
      (naval ? ':' + m.sail + ':' + m.sailAngle + ':' + (t.width / t.height).toFixed(4) : '');
  let pixels = map.get(key);
  if (!pixels) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    try {
      c.translate(64, 64);
      if (naval) {
        c.scale(128 / t.width, 128 / t.height);
        drawSailingRig(c, t, img);
      } else drawVehiclePart(c, { ...t, width: 128, height: 128 }, img, 'cover');
      pixels = c.getImageData(0, 0, 128, 128).data;
      map.set(key, pixels);
      if (map.size > 64) map.delete(map.keys().next().value!);
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
  motion?: { time: number; animate: boolean },
) {
  for (const t of tokens) {
    if (!t.vehicle || !vehicleArt(t)?.cover || !visible(t)) continue;
    const naval = !!sailMasts[t.vehicle.itemId];
    const img = images.get(
      naval ? navalAtlas(t.vehicle.itemId) : vehicleCoverImage(t.vehicle.itemId),
    );
    if (!img?.complete || !img.naturalWidth) continue;
    c.save();
    c.translate(t.x, t.y);
    c.rotate((t.rotation * Math.PI) / 180);
    c.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
    c.globalAlpha =
      (t.hidden || t.layer === 'gm' ? gmOpacity : 1) *
      (vehicleCoverOccupied(t, img, actors, naval) ? 0.12 : 1);
    if (naval) drawSailingRig(c, t, img, motion?.time, motion?.animate);
    else drawVehiclePart(c, t, img, 'cover');
    c.restore();
  }
}
