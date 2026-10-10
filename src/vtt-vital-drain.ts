import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';

// Short, fading ribbons travel inward along continuously bending paths. Soft
// nested silhouettes replace the full-length spokes and rigid bright dashes.
export function vitalDrain(
  c: CanvasRenderingContext2D,
  color: string,
  t: number,
  random: (index: number) => number,
  detail: number,
) {
  const count = Math.max(3, Math.round(7 * detail));
  for (let i = 0; i < count; i++) {
    const seed = random(i + 112),
      age = fract(t * (0.19 + seed * 0.055) + random(i)),
      fade = Math.sin(age * Math.PI) ** 1.7,
      head = 12 + (1 - age) * 86,
      length = Math.min(112 - head, 30 + seed * 17),
      direction = random(i + 32) * tau + Math.sin(t * 0.36 + i) * 0.13;
    const point = (u: number) => {
      const radius = head + length * u,
        angle = direction + Math.sin(radius * 0.039 - t * 0.8 + seed * tau) * 0.24;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    };
    const tip = point(0), tail = point(1);
    for (let layer = 0; layer < 6; layer++) {
      const width = (8.5 - layer * 1.3) * (0.75 + seed * 0.4),
        gradient = c.createLinearGradient(tail.x, tail.y, tip.x, tip.y),
        opacity = fade * (layer === 5 ? 0.2 : 0.055);
      gradient.addColorStop(0, alpha(color, 0));
      gradient.addColorStop(0.48, alpha(color, opacity));
      gradient.addColorStop(0.82, alpha(tint(color, 0.38), opacity));
      gradient.addColorStop(1, alpha(color, 0));
      c.beginPath();
      for (const side of [1, -1]) {
        for (let sample = 0; sample <= 24; sample++) {
          const u = side === 1 ? sample / 24 : 1 - sample / 24,
            p = point(u),
            before = point(u - 0.002), after = point(u + 0.002),
            dx = after.x - before.x, dy = after.y - before.y,
            normal = Math.hypot(dx, dy) || 1,
            taper = Math.sin(u * Math.PI) ** 1.3 * width,
            x = p.x - dy / normal * taper * side,
            y = p.y + dx / normal * taper * side;
          if (side === 1 && sample === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
      c.closePath();
      c.fillStyle = gradient;
      c.fill();
    }
    glow(c, tip.x, tip.y, 8 + seed * 5, color, fade * 0.18);
  }
}
