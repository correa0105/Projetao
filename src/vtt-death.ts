import type { VttToken } from '../shared/vtt';
// A stable stain remains with the token; only the recent burst moves.
export function drawDeath(c: CanvasRenderingContext2D, t: VttToken, image?: HTMLImageElement) {
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
  // Scatter angular fragments with a dark outline, then let them settle into the stain.
  if (!reduced && age < 4.8)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(i + 500) * 0.4,
        travel = radius * (1 + rand(i + 600)) * progress;
      c.save();
      c.translate(
        Math.cos(a) * travel,
        Math.sin(a) * travel - Math.sin(progress * Math.PI) * radius * 0.4,
      );
      c.rotate(a + progress * (rand(i + 700) - 0.5) * 6);
      c.globalAlpha = age > 3.7 ? Math.max(0, (4.8 - age) / 1.1) : 1;
      c.beginPath();
      c.moveTo(-radius * 0.12, -radius * 0.2);
      c.lineTo(radius * 0.18, -radius * 0.13);
      c.lineTo(radius * 0.08, radius * 0.15);
      c.lineTo(-radius * 0.16, radius * 0.08);
      c.closePath();
      c.fillStyle = '#21090a';
      c.fill();
      if (image?.complete && image.naturalWidth) {
        c.clip();
        c.filter = 'brightness(.45) sepia(.8) saturate(2)';
        c.drawImage(
          image,
          rand(i + 800) * image.naturalWidth * 0.65,
          rand(i + 900) * image.naturalHeight * 0.65,
          image.naturalWidth * 0.3,
          image.naturalHeight * 0.3,
          -radius * 0.2,
          -radius * 0.2,
          radius * 0.4,
          radius * 0.4,
        );
        c.filter = 'none';
      }
      c.restore();
    }
  c.restore();
}
