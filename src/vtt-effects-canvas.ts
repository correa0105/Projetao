import type { VttToken } from '../shared/vtt';
import { effectEnds } from '../shared/vtt-effects';
export function drawTokenEffects(c: CanvasRenderingContext2D, token: VttToken) {
  if (token.layer === 'map') return;
  const now = Date.now(),
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const e of token.effects) {
    const end = effectEnds(e);
    if ((end && now >= end) || e.kind === 'death') continue;
    const r = Math.max(token.width, token.height) * 0.65 * e.scale;
    const time = reduced || !e.duration ? 0 : (now - e.at) / 1000;
    c.save();
    c.globalAlpha *= end ? Math.min(1, (end - now) / 600) : 1;
    const glow = c.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 1.4);
    glow.addColorStop(0, e.color + '00');
    glow.addColorStop(0.65, e.color + '75');
    glow.addColorStop(1, e.color + '00');
    c.fillStyle = glow;
    c.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
    c.strokeStyle = e.color;
    c.fillStyle = e.color;
    c.lineWidth = Math.max(1, r * 0.025);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + time * 0.5;
      const radius = r * (1 + Math.sin(time * 3 + i) * 0.09);
      c.save();
      c.translate(Math.cos(a) * radius, Math.sin(a) * radius);
      c.rotate(a);
      const size = r * 0.13;
      c.beginPath();
      if (e.kind === 'heal') {
        c.moveTo(-size, 0);
        c.lineTo(size, 0);
        c.moveTo(0, -size);
        c.lineTo(0, size);
        c.stroke();
      } else if (e.kind === 'frost' || e.kind === 'sparks') {
        c.moveTo(-size, 0);
        c.lineTo(0, -size * 1.5);
        c.lineTo(size, 0);
        c.lineTo(0, size * 1.5);
        c.closePath();
        c.stroke();
      } else if (e.kind === 'fire') {
        c.moveTo(-size, size);
        c.quadraticCurveTo(-size * 1.5, -size, 0, -size * 2);
        c.quadraticCurveTo(size * 1.6, -size * 0.5, size, size);
        c.closePath();
        c.fill();
      } else {
        c.arc(0, 0, size * (0.6 + (i % 3) * 0.3), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    c.restore();
  }
}
