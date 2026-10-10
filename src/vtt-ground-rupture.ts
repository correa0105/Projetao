import { fract, glow, tau } from './vtt-effects-primitives';
import { materialSprite } from './vtt-effects-materials';
import { physicalProp } from './vtt-effects-physical';

// A shared impact launches the debris. The shadows stay on the ground while
// stones approach the overhead camera, settle and disappear into expanding dust.
export function groundRupture(
  c: CanvasRenderingContext2D,
  color: string,
  t: number,
  random: (index: number) => number,
  front: boolean,
  detail: number,
) {
  const impact = fract(t / 3.8),
    swell = Math.sin(impact * Math.PI),
    count = Math.max(8, Math.round(18 * detail));
  if (!front) {
    physicalProp(c, 'rubble', 0, 0, 158 + swell * 14, random(91) * tau, 0.34 + swell * 0.23, color);
    for (let i = 0; i < 12; i++) {
      const age = fract(impact - random(i + 122) * 0.14),
        fade = Math.sin(age * Math.PI) ** 1.5,
        angle = i / 12 * tau + random(i + 31) * 0.25,
        radius = 44 + age * 57;
      materialSprite(c, color, 'vapor', Math.cos(angle) * radius, Math.sin(angle) * radius,
        35 + age * 36, angle, t * 0.27 + i, fade * 0.34);
    }
  }
  for (let i = 0; i < count; i++) {
    const age = fract(impact - random(i + 122) * 0.14),
      angle = i / count * tau + (random(i + 33) - 0.5) * 0.3,
      radius = 38 + (1 - (1 - age) ** 2.2) * (45 + random(i + 65) * 13),
      lift = Math.sin(age * Math.PI),
      size = 12 + random(i + 71) * 15,
      opacity = Math.sin(age * Math.PI) ** 0.75,
      x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (!front) glow(c, x + 2 + lift * 4, y + 3 + lift * 5, size * 0.7, '#211d17', opacity * 0.4);
    if ((Math.sin(angle) > 0) !== front) continue;
    physicalProp(c, 'rock', x, y, size * (1 + lift * 0.38), angle + (age - 0.5) * 1.15,
      opacity * 0.95, color);
    materialSprite(c, color, 'vapor', x, y, size * 1.7 + age * 14, angle, t * 0.3 + i,
      opacity * age * 0.2);
  }
}
