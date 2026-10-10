import { alpha, tint } from './vtt-effects-primitives';

type Point = { x: number; y: number };
type Random = (i: number) => number;

// A stable channel for each strike: fine side channels, a tapered plasma sheath
// and an uneven white core. Geometry changes only on the next discharge.
export function texturedDischarge(
  c: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  random: Random,
  seed: number,
  color: string,
  width: number,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.1) return;
  const nx = -dy / length,
    ny = dx / length;
  const coarse = Array.from({ length: 14 }, (_, k) => {
    const u = k / 13;
    const offset = (random(seed + k) - 0.5) * length * 0.34 * Math.sin(u * Math.PI);
    return { x: a.x + dx * u + nx * offset, y: a.y + dy * u + ny * offset };
  });
  const points: Point[] = [];
  for (let k = 0; k < 13; k++) {
    const p = coarse[k],
      q = coarse[k + 1];
    for (let j = 0; j < 3; j++) {
      const u = j / 3;
      const noise = (random(seed + 301 + k * 3 + j) - 0.5) * length * 0.024 * Math.sin(u * Math.PI);
      points.push({ x: p.x + (q.x - p.x) * u + nx * noise, y: p.y + (q.y - p.y) * u + ny * noise });
    }
  }
  points.push(b);
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const gradient = c.createLinearGradient(a.x, a.y, b.x, b.y);
  gradient.addColorStop(0, alpha(color, 0.3));
  gradient.addColorStop(0.22, alpha(color, 0.85));
  gradient.addColorStop(0.72, alpha(color, 0.55));
  gradient.addColorStop(1, alpha(color, 0));
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.strokeStyle = gradient;
  c.lineWidth = width * 3.4;
  c.shadowColor = color;
  c.shadowBlur = width * 5;
  c.globalAlpha *= 0.5;
  c.stroke();
  c.shadowBlur = 0;
  c.globalAlpha *= 2;
  function channel(
    path: Point[],
    thickness: number,
    pigment: string,
    opacity: number,
    key: number,
  ) {
    const left: Point[] = [],
      right: Point[] = [];
    for (let k = 0; k < path.length; k++) {
      const p = path[k],
        prev = path[Math.max(0, k - 1)],
        next = path[Math.min(path.length - 1, k + 1)];
      const vx = next.x - prev.x,
        vy = next.y - prev.y,
        distance = Math.hypot(vx, vy) || 1;
      const u = k / (path.length - 1);
      const radius = thickness * (0.35 + random(seed + key + k) * 0.65) * Math.pow(1 - u, 0.6);
      left.push({ x: p.x - (vy / distance) * radius, y: p.y + (vx / distance) * radius });
      right.push({ x: p.x + (vy / distance) * radius, y: p.y - (vx / distance) * radius });
    }
    c.beginPath();
    [...left, ...right.reverse()].forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fillStyle = alpha(pigment, opacity);
    c.fill();
  }
  channel(points, width * 1.2, color, 0.42, 401);
  channel(points, width * 0.62, tint(color, 0.72), 0.85, 451);
  channel(points, width * 0.25, '#f4fbff', 0.92, 501);
  const forks = 1 + Math.floor(random(seed + 701) * 4);
  for (let fork = 0; fork < forks; fork++) {
    const k = 5 + Math.floor(random(seed + fork * 71 + 702) * 29);
    const p = points[k],
      side = random(seed + k + 70) > 0.5 ? 1 : -1;
    const reach = 0.08 + random(seed + k + 703) * 0.24;
    const spread = 0.07 + random(seed + k + 704) * 0.25;
    const branch = Array.from({ length: 9 }, (_, j) => {
      const u = j / 8;
      const jitter =
        (random(seed + k * 19 + j + 601) - 0.5) * length * 0.045 * Math.sin(u * Math.PI);
      return {
        x: p.x + dx * reach * u + nx * (length * spread * side * u + jitter),
        y: p.y + dy * reach * u + ny * (length * spread * side * u + jitter),
      };
    });
    channel(branch, width * 0.45, color, 0.5, 651 + k);
    channel(branch, width * 0.17, tint(color, 0.8), 0.78, 751 + k);
  }
  c.restore();
}
