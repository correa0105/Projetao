import { navalMotion, sailMasts, rowing, rowingPose } from '../shared/vtt-naval';
import { vehicleDefinitions } from '../shared/vtt-vehicles';
import type { VttToken } from '../shared/vtt';

export function drawSailingRig(
  c: CanvasRenderingContext2D,
  t: VttToken,
  img: HTMLImageElement,
  time = 0,
  animate = false,
) {
  const stations = t.vehicle && sailMasts[t.vehicle.itemId];
  if (!stations || !img.complete || !img.naturalWidth) return false;
  const m = navalMotion(t),
    w = t.width * (t.vehicle!.itemId === 'galley' ? 0.8 : 0.9);
  const sx = img.naturalWidth / 1024,
    sy = img.naturalHeight / 1536;
  for (const y of stations) {
    // Clews stay low and sheets lead back to fixed deck cleats. Rotating the
    // yard changes the rope angle, never the deck attachment point.
    c.save();
    c.translate(0, (y - 0.5) * t.height);
    const angle = (m.sailAngle * Math.PI) / 180;
    const beam =
      t.width *
      (t.vehicle!.itemId === 'galley'
        ? 0.22
        : t.vehicle!.itemId === 'longship'
          ? 0.24
          : vehicleDefinitions[t.vehicle!.itemId].baseWidth * 0.43);
    for (const side of [-1, 1]) {
      const x = side * w * 0.48,
        cy = -w * 0.035,
        ax = side * beam,
        ay = w * 0.16;
      c.beginPath();
      c.moveTo(
        x * Math.cos(angle) - cy * Math.sin(angle),
        x * Math.sin(angle) + cy * Math.cos(angle),
      );
      c.lineTo(ax, ay);
      c.strokeStyle = '#241b10cc';
      c.lineWidth = Math.max(0.8, w * 0.006);
      c.stroke();
      c.strokeStyle = '#c0a477dd';
      c.lineWidth = Math.max(0.45, w * 0.0028);
      c.stroke();
    }
    c.restore();
    c.save();
    c.translate(0, (y - 0.5) * t.height);
    c.rotate((m.sailAngle * Math.PI) / 180);
    if (m.sail === 'inflated') {
      // The straight foot remains attached to the spar; the cloth bellies
      // toward the bow. The vertical mast never lies along the deck.
      const strips = animate && m.sailsAnimated && w > 45 ? 16 : 1;
      for (let i = 0; i < strips; i++) {
        const u = i / strips,
          depth = w * 0.4;
        const flutter =
          strips > 1
            ? Math.sin(time * 0.001 * m.speed * 2.4 + u * 5) *
              Math.sin(Math.PI * (u + 0.5 / strips)) *
              0.018 *
              w
            : 0;
        c.drawImage(
          img,
          (16 + 992 * u) * sx,
          540 * sy,
          (992 / strips) * sx,
          480 * sy,
          -w / 2 + w * u,
          -depth + flutter,
          w / strips + 0.25,
          depth - flutter,
        );
      }
    } else
      c.drawImage(
        img,
        48 * sx,
        1170 * sy,
        928 * sx,
        210 * sy,
        -w * 0.47,
        -w * 0.04,
        w * 0.94,
        w * 0.13,
      );
    // Native aspect ratio keeps the crow's nest and mast cap circular.
    c.drawImage(img, 16 * sx, 150 * sy, 992 * sx, 220 * sy, -w / 2, -w * 0.111, w, (w * 220) / 992);
    c.restore();
  }
  return true;
}

export function drawRowingOars(
  c: CanvasRenderingContext2D,
  t: VttToken,
  img: HTMLImageElement,
  time: number,
  animate: boolean,
) {
  const id = t.vehicle!.itemId,
    p = rowing[id];
  if (!p || !img.complete || !img.naturalWidth) return;
  const m = navalMotion(t),
    bw = t.width * vehicleDefinitions[id].baseWidth;
  const scaleX = img.naturalWidth / 1280,
    scaleY = img.naturalHeight / 1280;
  const length = t.width * (id === 'rowboat' ? 0.85 : 0.37),
    thickness = length * 0.065;
  for (const side of [-1, 1])
    for (let i = 0; i < p.count; i++) {
      const y = p.first + ((p.last - p.first) * i) / Math.max(1, p.count - 1);
      const pivot = (side < 0 ? p.left : p.right) - 0.5;
      const pose =
        animate && m.oarsAnimated ? rowingPose(time * 0.001, m.speed, side) : { angle: 0, lift: 1 };
      c.save();
      c.translate(pivot * bw, (y - 0.5) * t.height);
      c.rotate((-side * Math.PI) / 2 + pose.angle);
      c.scale(1, pose.lift);
      c.drawImage(
        img,
        950 * scaleX,
        115 * scaleY,
        155 * scaleX,
        1040 * scaleY,
        -thickness / 2,
        -length * 0.25,
        thickness,
        length,
      );
      c.restore();
    }
}
