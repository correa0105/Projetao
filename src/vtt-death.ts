import type { VttToken } from '../shared/vtt';
import { plume, seededRandom, tau } from './vtt-effects-primitives';
// The intact red token and a settling pool remain; no portrait pieces are emitted.
export function drawDeath(
  c: CanvasRenderingContext2D,
  t: VttToken,
  options: { now?: number; reducedMotion?: boolean } = {},
) {
  if (!t.deathAt || t.layer === 'map') return;
  const radius = 55,
    rand = seededRandom(t.id),
    reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    age = Math.max(0, ((options.now ?? Date.now()) - t.deathAt) / 1000),
    progress = reduced ? 1 : Math.min(1, age / 1.3),
    growth = 0.4 + 0.6 * progress;
  c.save();
  c.scale(t.width / 100, t.height / 100);
  const points = Array.from({ length: 24 }, (_, i) => {
    const a = (i * tau) / 24,
      rr = radius * (0.8 + rand(i) * 0.32) * growth;
    return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
  });
  const tracePool = () => {
    const last = points.at(-1)!,
      first = points[0];
    c.beginPath();
    c.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length];
      c.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    });
    c.closePath();
  };
  // Rounded secondary pools merge unevenly into the edge, avoiding a radial
  // starburst. Their spread/material are stable for each token.
  for (let i = 0; i < 9; i++) {
    const a = rand(i + 610) * tau,
      rr = radius * (0.8 + rand(i + 620) * 0.43) * growth,
      x = Math.cos(a) * rr,
      y = Math.sin(a) * rr,
      size = radius * (0.08 + rand(i + 630) * 0.14) * growth;
    const g = c.createRadialGradient(x - size * 0.2, y - size * 0.15, 0, x, y, size);
    g.addColorStop(0, '#581017e8');
    g.addColorStop(0.78, '#470a13e8');
    g.addColorStop(1, '#230810b5');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, size, size * (0.45 + rand(i + 640) * 0.4), a, 0, tau);
    c.fill();
  }
  tracePool();
  const pool = c.createRadialGradient(-radius * 0.1, -radius * 0.15, 0, 0, 0, radius * 1.12);
  pool.addColorStop(0, '#350814ee');
  pool.addColorStop(0.5, '#520c18f2');
  pool.addColorStop(0.84, '#66151bea');
  pool.addColorStop(1, '#2d080fde');
  c.fillStyle = pool;
  c.fill();
  c.strokeStyle = '#20070cc0';
  c.lineWidth = 0.6;
  c.stroke();
  c.save();
  tracePool();
  c.clip();
  c.globalAlpha *= 0.22;
  c.globalCompositeOperation = 'screen';
  c.drawImage(plume('#9c4541', 'smoke'), -radius * 1.2, -radius * 1.2, radius * 2.4, radius * 2.4);
  c.rotate(0.7);
  c.drawImage(plume('#8b333a', 'smoke'), -radius, -radius, radius * 2, radius * 2);
  c.restore();
  c.fillStyle = '#490c15dc';
  for (let i = 0; i < 26; i++) {
    const a = rand(i + 100) * tau,
      rr = radius * (1.02 + rand(i + 200) * 0.56) * progress,
      x = Math.cos(a) * rr,
      y = Math.sin(a) * rr,
      size = radius * (0.008 + rand(i + 300) * 0.025);
    c.beginPath();
    c.ellipse(x, y, size, size * (0.48 + rand(i + 400) * 0.3), a, 0, tau);
    c.fill();
    if (i % 4 === 0) {
      c.fillStyle = '#ca725444';
      c.beginPath();
      c.ellipse(x - size * 0.25, y - size * 0.25, size * 0.28, size * 0.1, a, 0, tau);
      c.fill();
      c.fillStyle = '#490c15dc';
    }
  }
  c.strokeStyle = '#d37a6240';
  c.lineWidth = radius * 0.012;
  for (let i = 0; i < 5; i++) {
    const a = rand(i + 801) * tau;
    c.beginPath();
    c.ellipse(
      -radius * 0.12,
      -radius * 0.1,
      radius * (0.55 + i * 0.07) * growth,
      radius * (0.4 + i * 0.055) * growth,
      0,
      a,
      a + 0.18 + rand(i + 820) * 0.22,
    );
    c.stroke();
  }
  c.restore();
}
