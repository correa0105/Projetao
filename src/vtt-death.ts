import type { VttToken } from '../shared/vtt';
// The intact red token and blood stain remain; no image pieces are emitted.
export function drawDeath(c: CanvasRenderingContext2D, t: VttToken) {
  if (!t.deathAt || t.layer === 'map') return;
  const radius = Math.max(t.width, t.height) * 0.55;
  const seed = [...t.id].reduce((s, v) => s + v.charCodeAt(0), 0);
  const rand = (n: number) => {
    const v = Math.sin(n * 71.37 + seed) * 9871;
    return v - Math.floor(v);
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const age = Math.max(0, (Date.now() - t.deathAt) / 1000);
  const progress = reduced ? 1 : Math.min(1, age / 1.3);
  c.save();
  c.fillStyle = '#66100ee0';
  c.strokeStyle = '#240609';
  c.lineWidth = 1;
  const growth = 0.4 + 0.6 * progress;
  const points = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2,
      r = radius * (0.85 + rand(i) * 0.38) * growth;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  const last = points.at(-1)!,
    first = points[0];
  c.beginPath();
  c.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    c.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  });
  c.closePath();
  const pool = c.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.3);
  pool.addColorStop(0, '#79140ee8');
  pool.addColorStop(1, '#480b0ddc');
  c.fillStyle = pool;
  c.fill();
  c.stroke();
  c.fillStyle = '#64100fdf';
  for (let i = 0; i < 12; i++) {
    const a = rand(i + 610) * Math.PI * 2,
      tip = radius * (1.3 + rand(i + 620) * 0.65) * growth,
      width = radius * (0.025 + rand(i + 630) * 0.035),
      start = radius * 0.65 * growth;
    c.save();
    c.rotate(a);
    c.beginPath();
    c.moveTo(start, -width * 2.1);
    c.bezierCurveTo(tip * 0.65, -width * 1.6, tip, -width, tip + width, 0);
    c.bezierCurveTo(tip, width * 1.1, tip * 0.65, width * 1.6, start, width * 2.1);
    c.closePath();
    c.fill();
    c.restore();
  }
  for (let i = 0; i < 50; i++) {
    const a = rand(i + 100) * Math.PI * 2,
      r = radius * (1 + rand(i + 200) * 1.05) * progress;
    c.beginPath();
    c.ellipse(
      Math.cos(a) * r,
      Math.sin(a) * r,
      1 + rand(i + 300) * radius * 0.065,
      1 + rand(i + 400) * radius * 0.035,
      a,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  c.restore();
}
