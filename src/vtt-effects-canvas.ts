import type { VttToken } from '../shared/vtt';
import { effectEnds } from '../shared/vtt-effects';
import { drawEffectFront } from './vtt-effects-front';
const tau = Math.PI * 2,
  fract = (n: number) => n - Math.floor(n);
function seed(text: string) {
  let n = 0;
  for (const c of text) n = (n * 31 + c.charCodeAt(0)) | 0;
  return (n >>> 0) / 4294967296;
}
function light(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: string,
) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + alpha);
  g.addColorStop(1, color + '00');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
export function drawTokenEffects(
  c: CanvasRenderingContext2D,
  token: VttToken,
  pass: 'behind' | 'front' = 'behind',
) {
  if (token.layer === 'map') return;
  const now = Date.now(),
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const e of token.effects) {
    const end = effectEnds(e);
    if ((end && now >= end) || e.kind === 'death') continue;
    const r = Math.max(token.width, token.height) * 0.65 * e.scale,
      t = reduced ? 1.1 : (now - e.at) / 1000,
      s = seed(token.id + e.id),
      random = (i: number) => fract(Math.sin(i * 127.1 + s * 491.7) * 43758.5453);
    c.save();
    c.globalAlpha *= end ? Math.min(1, (end - now) / 600) : 1;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (pass === 'front') {
      drawEffectFront(c, e, r, t, random);
      c.restore();
      continue;
    }
    if (e.kind === 'fire') {
      light(c, 0, r * 0.38, r * 1.35, e.color, '38');
      drawEffectFront(c, e, r * 1.12, t, random);
      for (let i = 0; i < 22; i++) {
        const p = fract(t * (0.26 + random(i) * 0.3) + random(i + 40)),
          x = (random(i + 70) - 0.5) * r * 1.7 + Math.sin(t * 2 + i) * r * 0.1,
          y = r * 0.6 - p * r * 2;
        c.save();
        c.globalAlpha *= (1 - p) * 0.85;
        c.fillStyle = i % 3 ? '#ffc078' : e.color;
        c.beginPath();
        c.ellipse(x, y, r * 0.013, r * 0.027, -0.3, 0, tau);
        c.fill();
        c.restore();
      }
    } else if (e.kind === 'frost') {
      light(c, 0, r * 0.45, r * 1.18, e.color, '26');
      c.strokeStyle = '#d3efffcc';
      c.lineWidth = r * 0.01;
      for (let i = 0; i < 8; i++) {
        const p = fract(t * 0.13 + random(i + 80)),
          x = (random(i + 10) - 0.5) * r * 2.2,
          y = -r * 1.05 + p * r * 1.8;
        c.save();
        c.translate(x, y);
        c.rotate(t * 0.3 + i);
        const z = r * (0.045 + random(i + 25) * 0.03);
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * tau) / 6;
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * z, Math.sin(a) * z);
          const bx = Math.cos(a) * z * 0.57,
            by = Math.sin(a) * z * 0.57;
          c.moveTo(bx + Math.cos(a + 0.9) * z * 0.3, by + Math.sin(a + 0.9) * z * 0.3);
          c.lineTo(bx, by);
          c.lineTo(bx + Math.cos(a - 0.9) * z * 0.3, by + Math.sin(a - 0.9) * z * 0.3);
        }
        c.stroke();
        c.restore();
      }
    } else if (e.kind === 'poison') {
      for (let i = 0; i < 13; i++) {
        const p = fract(t * (0.11 + random(i) * 0.08) + random(i + 10)),
          side = i % 2 ? 1 : -1,
          x = side * r * (0.56 + random(i + 20) * 0.32) + Math.sin(t * 1.2 + i) * r * 0.14,
          y = r * 0.65 - p * r * 1.9;
        light(
          c,
          x,
          y,
          r * (0.26 + random(i + 30) * 0.25),
          e.color,
          Math.round(Math.sin(p * Math.PI) * 105)
            .toString(16)
            .padStart(2, '0'),
        );
      }
      c.strokeStyle = e.color + '85';
      c.lineWidth = r * 0.025;
      for (let side = -1; side <= 1; side += 2) {
        c.beginPath();
        c.moveTo(side * r * 0.7, r * 0.65);
        c.bezierCurveTo(
          side * r * 1.23,
          r * 0.1,
          side * r * 0.4,
          -r * 0.15,
          side * r * (0.76 + Math.sin(t) * 0.1),
          -r * 0.9,
        );
        c.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const p = fract(t * 0.22 + random(i));
        c.save();
        c.globalAlpha *= (1 - p) * 0.65;
        c.beginPath();
        c.arc(
          (i % 2 ? 1 : -1) * r * (0.65 + random(i + 8) * 0.25),
          r * 0.7 - p * r * 1.7,
          r * (0.025 + random(i + 18) * 0.035),
          0,
          tau,
        );
        c.stroke();
        c.restore();
      }
    } else if (e.kind === 'heal') {
      light(c, 0, r * 0.43, r * 1.25, e.color, '2f');
      c.strokeStyle = e.color + 'bb';
      c.lineWidth = r * 0.019;
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.ellipse(0, r * 0.56, r * (0.91 - k * 0.18), r * (0.25 - k * 0.06), 0, 0, tau);
        c.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i * tau) / 12 + t * 0.14,
          x = Math.cos(a) * r * 0.81,
          y = r * 0.56 + Math.sin(a) * r * 0.21;
        c.beginPath();
        c.moveTo(x - r * 0.02, y - r * 0.035);
        c.lineTo(x + r * 0.025, y);
        c.lineTo(x - r * 0.02, y + r * 0.035);
        c.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * r * 0.28,
          p = fract(t * 0.28 + random(i)),
          g = c.createLinearGradient(x, r * 0.5, x, -r * 1.1);
        g.addColorStop(0, e.color + '00');
        g.addColorStop(0.5, e.color + '55');
        g.addColorStop(1, '#fff0cd00');
        c.fillStyle = g;
        c.fillRect(x - r * 0.025, -r * 1.1, r * 0.05, r * 1.65);
        const y = r * 0.55 - p * r * 1.6;
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI);
        light(c, x, y, r * 0.08, '#ffebba', 'de');
        c.fillStyle = '#fff1cd';
        c.beginPath();
        c.moveTo(x, y - r * 0.045);
        c.quadraticCurveTo(x + r * 0.008, y - r * 0.008, x + r * 0.035, y);
        c.quadraticCurveTo(x + r * 0.008, y + r * 0.008, x, y + r * 0.045);
        c.quadraticCurveTo(x - r * 0.008, y + r * 0.008, x - r * 0.035, y);
        c.quadraticCurveTo(x - r * 0.008, y - r * 0.008, x, y - r * 0.045);
        c.fill();
        c.restore();
      }
    } else if (e.kind === 'sparks') {
      c.shadowColor = e.color;
      c.shadowBlur = r * 0.07;
      for (let arc = 0; arc < 3; arc++) {
        c.beginPath();
        for (let i = 0; i <= 18; i++) {
          const a = (i / 18) * tau * 0.73 + (arc * tau) / 3 + t * 0.5,
            noise = Math.sin(i * 12.7 + Math.floor(t * 12) * 4.9 + arc) * r * 0.17,
            rr = r * (0.82 + 0.045 * Math.sin(t * 3 + arc)) + noise,
            x = Math.cos(a) * rr,
            y = Math.sin(a) * rr;
          if (!i) c.moveTo(x, y);
          else c.lineTo(x, y);
          if (i % 5 === 2) {
            c.lineTo(x * 1.18, y * 1.18);
            c.moveTo(x, y);
          }
        }
        c.lineWidth = r * 0.04;
        c.strokeStyle = e.color + '65';
        c.stroke();
        c.lineWidth = r * 0.012;
        c.strokeStyle = '#dfedff';
        c.stroke();
      }
      c.shadowBlur = 0;
      for (let i = 0; i < 10; i++) {
        const a = random(i) * tau + t * 0.12,
          rr = r * (0.9 + fract(t * 0.7 + random(i + 10)) * 0.32),
          x = Math.cos(a) * rr,
          y = Math.sin(a) * rr;
        c.strokeStyle = e.color + 'd9';
        c.lineWidth = r * 0.014;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * r * 0.065, y + Math.sin(a) * r * 0.065);
        c.stroke();
      }
    }
    c.restore();
  }
}
