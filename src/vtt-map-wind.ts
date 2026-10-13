import type { MapAtmosphere } from '../shared/vtt-atmosphere';
import type { VttToken } from '../shared/vtt';
import { drawAnimatedAsset } from './vtt-animated-assets';
import { seededRandom } from './vtt-effects-primitives';

export function mapWindMotion(a: MapAtmosphere, t: number) {
  const strong = a.weather === 'gale',
    angle = (a.wind * Math.PI) / 180;
  const gust = strong
    ? 1 + 0.32 * Math.sin(t * 2.1) + 0.18 * Math.sin(t * 4.3)
    : 1 + 0.18 * Math.sin(t * 0.7);
  const speed = (strong ? 440 : 82) * (a.speed / 0.65);
  // Integral of gust speed keeps the flow continuous when each gust rises/falls.
  const distance =
    speed *
    (strong
      ? t - (0.32 / 2.1) * Math.cos(t * 2.1) - (0.18 / 4.3) * Math.cos(t * 4.3)
      : t - (0.18 / 0.7) * Math.cos(t * 0.7));
  return { angle, speed: speed * gust, distance, strong };
}
export function drawMapWind(
  c: CanvasRenderingContext2D,
  sceneId: string,
  a: MapAtmosphere,
  t: number,
  w: number,
  h: number,
) {
  if (!['wind', 'gale'].includes(a.weather) || a.intensity <= 0 || w <= 0 || h <= 0) return;
  const { angle, distance, strong } = mapWindMotion(a, t),
    random = seededRandom(sceneId + ' map wind');
  const span = Math.hypot(w, h) + 240;
  const spacing = Math.max(strong ? 220 : 240, span / 9);
  const steps = Math.ceil(span / spacing);
  c.save();
  c.translate(w / 2, h / 2);
  c.rotate(angle);
  for (let row = 0; row < steps; row++)
    for (let col = 0; col < steps; col++) {
      const i = row * steps + col,
        x = (col - (steps - 1) / 2) * spacing,
        y = (row - (steps - 1) / 2) * spacing;
      const sx = x * Math.cos(angle) - y * Math.sin(angle),
        sy = x * Math.sin(angle) + y * Math.cos(angle);
      if (Math.abs(sx) > w / 2 + 230 || Math.abs(sy) > h / 2 + 180) continue;
      c.save();
      c.translate(x, y);
      // Reuse the actual Vento asset from the reference, including its native
      // mist, leaves, alpha and animation. Each stream has its own stable phase.
      drawAnimatedAsset(
        c,
        {
          id: sceneId + ' wind ' + i,
          width: strong ? 320 : 240,
          height: 240,
          animatedAsset: { id: 'wind', speed: 1, intensity: a.intensity, playing: true },
        } as VttToken,
        undefined,
        (distance / 57 + random(i + 50) * 20) * 1000,
        false,
        true,
      );
      c.restore();
    }
  c.restore();
}
