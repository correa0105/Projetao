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
  c.beginPath();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2,
      r = radius * (0.65 + rand(i) * 1.1) * (0.4 + 0.6 * progress);
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (!i) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
  c.fill();
  c.stroke();
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
