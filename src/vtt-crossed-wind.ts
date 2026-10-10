import { alpha, fract, tint } from './vtt-effects-primitives';
type Random = (i: number) => number;

// Both currents carry tapered ribbons through a continuous curved velocity
// field. Their edges fade across several translucent layers, without stamping
// repeated smoke silhouettes or rotating an entire picture.
export function crossedWind(
  c: CanvasRenderingContext2D,
  t: number,
  random: Random,
  front: boolean,
  color: string,
) {
  const stream = front ? 0 : 1,
    direction = stream ? -0.64 : 0.65,
    light = tint(color, 0.52);
  c.save();
  c.rotate(direction);
  const curve = (x: number, lane: number) =>
    lane +
    18 * Math.sin(x * 0.023 - t * 1.12 + stream * 2.4) +
    9 * Math.sin(x * 0.039 + t * 0.61 + lane * 0.04) +
    Math.exp(-((x / 65) ** 2)) * Math.sin(t * 0.81 + stream) * 17;
  for (let i = 0; i < 4; i++) {
    const u = fract(t * (0.19 + i * 0.012) + i * 0.25 + stream * 0.17),
      start = -226 + u * 348,
      length = 97 + random(i + stream * 17) * 28,
      lane = (i - 1.5) * 13 + (stream ? 8 : -8),
      fade = Math.sin(u * Math.PI) ** 1.7;
    for (let layer = 0; layer < 5; layer++) {
      const thickness = (14 - layer * 2.65) * (0.8 + i * 0.08);
      c.beginPath();
      for (const side of [1, -1]) {
        for (let n = 0; n <= 28; n++) {
          const progress = side === 1 ? n / 28 : 1 - n / 28,
            x = start + length * progress,
            width = Math.sin(progress * Math.PI) ** 1.6 * thickness,
            y = curve(x, lane) + side * width;
          if (side === 1 && n === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
      c.closePath();
      c.fillStyle = alpha(light, fade * (layer === 4 ? 0.14 : 0.044));
      c.fill();
    }
  }
  c.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const u = fract(t * (0.34 + random(i + 12) * 0.12) + random(i + stream * 71)),
      x = -140 + u * 280,
      lane = (random(i + 91) - 0.5) * 83,
      length = 3 + random(i + 31) * 8,
      fade = Math.sin(u * Math.PI) ** 2;
    c.beginPath();
    c.moveTo(x - length, curve(x - length, lane));
    c.quadraticCurveTo(x - length / 2, curve(x - length / 2, lane), x, curve(x, lane));
    c.lineWidth = 0.55 + random(i + 67) * 0.7;
    c.strokeStyle = alpha(light, fade * 0.36);
    c.stroke();
  }
  c.restore();
}
