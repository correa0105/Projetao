import type { TokenEffect } from '../shared/vtt-effects';
import {
  alpha,
  bolt,
  floorRing,
  fract,
  glow,
  luminousStroke,
  plume,
  star,
  tau,
  tint,
} from './vtt-effects-primitives';
type Random = (i: number) => number;

function orbit(
  c: CanvasRenderingContext2D,
  r: number,
  t: number,
  color: string,
  front: boolean,
  offset: number,
  tilt = 0.4,
) {
  c.beginPath();
  let joined = false;
  for (let k = 0; k <= 64; k++) {
    const p = k / 64,
      a = p * tau + t * 0.5 + offset,
      x = Math.cos(a) * r * 0.85,
      y = Math.sin(a) * r * tilt + (p - 0.5) * r * 0.45;
    if (Math.sin(a) > 0 !== front) {
      joined = false;
      continue;
    }
    joined ? c.lineTo(x, y) : c.moveTo(x, y);
    joined = true;
  }
  luminousStroke(c, color, r * 0.008, 0.75);
}
function glyphs(c: CanvasRenderingContext2D, r: number, t: number, color: string, count: number) {
  c.save();
  c.rotate(t * 0.12);
  for (let i = 0; i < count; i++) {
    c.save();
    c.rotate((i * tau) / count);
    c.translate(r * 0.9, 0);
    c.beginPath();
    c.moveTo(-r * 0.025, -r * 0.045);
    c.lineTo(r * 0.02, 0);
    c.lineTo(-r * 0.025, r * 0.045);
    if (i % 3 === 0) {
      c.moveTo(-r * 0.012, -r * 0.016);
      c.lineTo(r * 0.025, -r * 0.036);
    } else if (i % 3 === 1) {
      c.moveTo(-r * 0.025, -r * 0.045);
      c.lineTo(-r * 0.025, r * 0.045);
    } else {
      c.moveTo(r * 0.025, -r * 0.045);
      c.lineTo(-r * 0.035, r * 0.01);
    }
    luminousStroke(c, color, r * 0.006, 0.7);
    c.restore();
  }
  c.restore();
}
function haze(
  c: CanvasRenderingContext2D,
  r: number,
  t: number,
  random: Random,
  color: string,
  count: number,
  opacity: number,
  low = false,
) {
  const texture = plume(color, 'smoke');
  for (let i = 0; i < count; i++) {
    const p = fract(t * 0.12 + random(i + 40)),
      a = (i / count) * tau + t * 0.1,
      x = Math.cos(a) * r * 0.65,
      y = low ? r * 0.6 + Math.sin(a) * r * 0.18 : r * 0.7 - p * r * 1.6,
      size = r * (0.65 + p * 0.4);
    c.save();
    c.globalAlpha *= Math.sin(p * Math.PI) * opacity;
    c.translate(x, y);
    c.rotate(i + t * 0.08);
    c.drawImage(texture, -size / 2, -size / 2, size, size);
    c.restore();
  }
}
function stone(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  a: number,
  color: string,
  random: Random,
  index: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  const vertices = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * tau) / 6,
      rr = size * (0.8 + random(index + i) * 0.35);
    return { x: Math.cos(angle) * rr, y: Math.sin(angle) * rr * 0.72 };
  });
  const g = c.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, tint(color, 0.25));
  g.addColorStop(0.6, color);
  g.addColorStop(1, tint(color, 0.6, '#181b20'));
  c.fillStyle = g;
  c.beginPath();
  vertices.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(vertices[4].x, vertices[4].y);
  c.lineTo(-size * 0.15, -size * 0.2);
  c.lineTo(vertices[0].x, vertices[0].y);
  c.lineTo(-size * 0.15, -size * 0.2);
  c.lineTo(vertices[2].x, vertices[2].y);
  c.strokeStyle = alpha(tint(color, 0.5), 0.55);
  c.lineWidth = size * 0.08;
  c.stroke();
  c.beginPath();
  c.moveTo(-size * 0.1, size * 0.08);
  c.lineTo(size * 0.2, size * 0.26);
  c.lineTo(size * 0.07, size * 0.45);
  c.strokeStyle = alpha(tint(color, 0.75, '#151921'), 0.7);
  c.lineWidth = size * 0.055;
  c.stroke();
  c.restore();
}
function leaf(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  a: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  const g = c.createLinearGradient(-size, 0, size, 0);
  g.addColorStop(0, tint(color, 0.45, '#243422'));
  g.addColorStop(0.55, color);
  g.addColorStop(1, tint(color, 0.4));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-size, 0);
  c.quadraticCurveTo(0, -size * 0.85, size, 0);
  c.quadraticCurveTo(0, size * 0.55, -size, 0);
  c.fill();
  c.strokeStyle = alpha(tint(color, 0.55), 0.7);
  c.lineWidth = size * 0.075;
  c.beginPath();
  c.moveTo(-size, 0);
  c.lineTo(size * 0.8, 0);
  c.moveTo(-size * 0.2, 0);
  c.lineTo(size * 0.08, -size * 0.35);
  c.moveTo(size * 0.2, 0);
  c.lineTo(size * 0.4, size * 0.2);
  c.stroke();
  c.restore();
}
export function drawExpandedEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  r: number,
  t: number,
  random: Random,
  pass: 'behind' | 'front',
  detail: number,
) {
  const front = pass === 'front',
    n = (count: number) => Math.max(3, Math.round(count * detail));
  if (e.kind === 'lightning') {
    c.globalCompositeOperation = 'screen';
    const tick = Math.floor(t * 6);
    if (!front) {
      floorRing(c, r, e.color, t, 0.4);
      glow(c, 0, -r * 0.1, r * 1.18, e.color, 0.16);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * tau + random(tick + i) * 0.22;
        bolt(
          c,
          { x: 0, y: r * 0.6 },
          { x: Math.cos(a) * r * 1.07, y: r * 0.6 + Math.sin(a) * r * 0.24 },
          r,
          random,
          tick + i,
          e.color,
          0.007,
        );
      }
    } else {
      for (let i = 0; i < n(3); i++) {
        const x = (i - 1) * r * 0.45 + (random(tick + i + 9) - 0.5) * r * 0.18;
        c.save();
        c.globalAlpha *= 0.45 + random(tick + 25 + i) * 0.4;
        bolt(
          c,
          { x: x + r * 0.3, y: -r * 1.12 },
          { x: x - r * 0.13, y: r * 0.56 },
          r,
          random,
          tick + i * 77,
          e.color,
          0.015,
        );
        c.restore();
        glow(c, x - r * 0.13, r * 0.56, r * 0.15, e.color, 0.75);
      }
    }
  } else if (e.kind === 'arcane') {
    c.globalCompositeOperation = 'screen';
    if (!front) {
      floorRing(c, r, e.color, t);
      c.save();
      c.translate(0, r * 0.59);
      c.scale(1, 0.27);
      glyphs(c, r, t, e.color, 18);
      c.restore();
      glow(c, 0, 0, r, e.color, 0.14);
    }
    for (let i = 0; i < 3; i++)
      orbit(c, r, t * (i % 2 ? -0.7 : 1), e.color, front, (i * tau) / 3, 0.28 + i * 0.15);
    if (front) {
      for (let i = 0; i < n(12); i++) {
        const a = (i / 12) * tau + t * 0.27,
          rr = r * (0.82 + random(i) * 0.15),
          x = Math.cos(a) * rr,
          y = Math.sin(a) * rr * 0.8;
        c.save();
        c.translate(x, y);
        c.rotate(-a + t * 0.2);
        c.globalAlpha *= 0.35 + random(i + 20) * 0.5;
        c.beginPath();
        c.moveTo(0, -r * 0.04);
        c.lineTo(r * 0.025, 0);
        c.lineTo(0, r * 0.04);
        c.lineTo(-r * 0.025, 0);
        c.closePath();
        luminousStroke(c, e.color, r * 0.006, 0.9);
        c.restore();
      }
    }
  } else if (e.kind === 'shield') {
    c.save();
    c.beginPath();
    c.ellipse(0, 0, r * 0.98, r * 0.99, 0, 0, tau);
    c.clip();
    if (!front) {
      const g = c.createRadialGradient(-r * 0.28, -r * 0.3, r * 0.02, 0, 0, r);
      g.addColorStop(0, alpha(tint(e.color, 0.6), 0.1));
      g.addColorStop(0.6, alpha(e.color, 0.015));
      g.addColorStop(0.85, alpha(e.color, 0.15));
      g.addColorStop(1, alpha(tint(e.color, 0.4), 0.4));
      c.fillStyle = g;
      c.fillRect(-r, -r, r * 2, r * 2);
    } else {
      const size = r * 0.13;
      c.strokeStyle = alpha(e.color, 0.16);
      c.lineWidth = r * 0.006;
      for (let row = -5; row <= 5; row++)
        for (let col = -5; col <= 5; col++) {
          const x = col * size * 1.72 + (row % 2) * size * 0.86,
            y = row * size * 1.5;
          if (Math.hypot(x, y) > r * 0.97) continue;
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * tau) / 6 + Math.PI / 6,
              px = x + Math.cos(a) * size,
              py = y + Math.sin(a) * size;
            k ? c.lineTo(px, py) : c.moveTo(px, py);
          }
          c.closePath();
          c.stroke();
        }
      const sweep = t * 0.32;
      c.beginPath();
      c.ellipse(0, 0, r * 0.96, r * 0.96, 0, sweep, sweep + tau * 0.23);
      luminousStroke(c, e.color, r * 0.014, 0.85);
      const wave = fract(t * 0.18),
        rr = r * (0.2 + wave * 0.9);
      c.globalAlpha *= Math.sin(wave * Math.PI) * 0.3;
      c.beginPath();
      c.ellipse(-r * 0.17, -r * 0.24, rr, rr, 0, 0, tau);
      luminousStroke(c, e.color, r * 0.009, 0.5);
    }
    c.restore();
    c.beginPath();
    c.ellipse(0, 0, r * 0.98, r * 0.99, 0, 0, tau);
    luminousStroke(c, e.color, r * 0.009, front ? 0.45 : 0.25);
  } else if (e.kind === 'radiant') {
    c.globalCompositeOperation = 'screen';
    if (!front) {
      glow(c, 0, 0, r * 1.4, e.color, 0.21);
      floorRing(c, r, e.color, t);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * tau + t * 0.045,
          w = r * (0.04 + random(i) * 0.03);
        c.save();
        c.rotate(a);
        const g = c.createLinearGradient(0, -r * 0.4, 0, -r * 1.6);
        g.addColorStop(0, alpha(e.color, 0));
        g.addColorStop(0.4, alpha(tint(e.color, 0.5), 0.16));
        g.addColorStop(1, alpha(e.color, 0));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-w, -r * 0.38);
        c.lineTo(-w * 3, -r * 1.6);
        c.lineTo(w * 3, -r * 1.6);
        c.lineTo(w, -r * 0.38);
        c.fill();
        c.restore();
      }
    } else {
      c.fillStyle = tint(e.color, 0.8);
      for (let i = 0; i < n(15); i++) {
        const p = fract(t * 0.21 + random(i)),
          x = (random(i + 30) - 0.5) * r * 1.7,
          y = r * 0.68 - p * r * 1.9;
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI) * 0.8;
        glow(c, x, y, r * 0.08, e.color, 0.3);
        star(c, x, y, r * (0.017 + random(i + 22) * 0.028));
        c.restore();
      }
      for (let i = 0; i < 2; i++) {
        const a = t * 0.15 + i * 0.7;
        c.beginPath();
        c.ellipse(0, -r * 0.62, r * (0.43 + i * 0.08), r * 0.1, 0, a, a + tau * 0.85);
        luminousStroke(c, e.color, r * 0.009, 0.7);
      }
    }
  } else if (e.kind === 'shadow') {
    if (!front) {
      haze(c, r, t, random, tint(e.color, 0.85, '#11121d'), n(12), 0.9);
      glow(c, 0, r * 0.3, r * 1.13, e.color, 0.14);
    } else {
      haze(c, r, t, random, tint(e.color, 0.65, '#151322'), n(7), 0.45);
      for (let i = 0; i < n(7); i++) {
        const side = i % 2 ? 1 : -1,
          x = side * r * (0.45 + random(i) * 0.3),
          y = r * 0.7,
          endX = side * r * (0.72 + Math.sin(t * 0.7 + i) * 0.16),
          endY = -r * (0.65 + random(i + 7) * 0.4);
        const g = c.createLinearGradient(x, y, endX, endY);
        g.addColorStop(0, alpha('#161021', 0.65));
        g.addColorStop(0.6, alpha(e.color, 0.4));
        g.addColorStop(1, alpha(e.color, 0));
        c.beginPath();
        c.moveTo(x - r * 0.03, y);
        c.bezierCurveTo(x * 1.5, -r * 0.04, endX * 0.25, -r * 0.4, endX, endY);
        c.bezierCurveTo(endX * 0.3, -r * 0.45, x * 1.45, 0, x + r * 0.03, y);
        c.closePath();
        c.fillStyle = g;
        c.fill();
      }
      c.globalCompositeOperation = 'screen';
      c.fillStyle = alpha(tint(e.color, 0.45), 0.65);
      for (let i = 0; i < n(14); i++) {
        const p = fract(t * 0.16 + random(i)),
          a = random(i + 25) * tau;
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI);
        star(c, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 - p * r * 0.12, r * 0.014);
        c.restore();
      }
    }
  } else if (e.kind === 'acid') {
    if (!front) {
      c.save();
      c.translate(0, r * 0.63);
      c.scale(1, 0.28);
      const g = c.createRadialGradient(-r * 0.2, -r * 0.15, 0, 0, 0, r);
      g.addColorStop(0, alpha(tint(e.color, 0.3), 0.35));
      g.addColorStop(0.72, alpha(e.color, 0.55));
      g.addColorStop(1, alpha(tint(e.color, 0.5, '#34461d'), 0.05));
      c.fillStyle = g;
      c.beginPath();
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * tau,
          rr = r * (0.88 + 0.06 * Math.sin(a * 5 + t * 0.3) + 0.05 * Math.sin(a * 9));
        k ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(rr, 0);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = alpha(tint(e.color, 0.6), 0.5);
      c.lineWidth = r * 0.012;
      c.stroke();
      c.restore();
      haze(c, r, t * 0.7, random, e.color, n(4), 0.25, true);
    } else {
      for (let i = 0; i < n(13); i++) {
        const p = fract(t * (0.3 + random(i) * 0.13) + random(i + 20)),
          x = (random(i + 30) - 0.5) * r * 1.5,
          y = r * 0.61 - Math.sin(p * Math.PI) * r * (0.65 + random(i + 70) * 0.65),
          size = r * (0.018 + random(i + 61) * 0.024);
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI) * 0.85;
        const g = c.createRadialGradient(x - size * 0.3, y - size * 0.4, 0, x, y, size * 1.1);
        g.addColorStop(0, tint(e.color, 0.8));
        g.addColorStop(0.35, e.color);
        g.addColorStop(1, alpha(e.color, 0.2));
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x, y, size, size * (1.1 + Math.abs(Math.cos(p * Math.PI)) * 0.6), 0, 0, tau);
        c.fill();
        c.restore();
      }
      for (let i = 0; i < n(7); i++) {
        const p = fract(t * 0.3 + random(i + 80)),
          x = (random(i + 16) - 0.5) * r * 1.6,
          y = r * 0.6 + random(i) * r * 0.12,
          size = r * (0.025 + p * 0.065);
        c.save();
        c.globalAlpha *= (1 - p) * 0.65;
        c.beginPath();
        c.ellipse(x, y, size, size * 0.7, 0, 0, tau);
        c.strokeStyle = tint(e.color, 0.65);
        c.lineWidth = r * 0.007;
        c.stroke();
        c.restore();
      }
    }
  } else if (e.kind === 'wind') {
    if (!front) haze(c, r, t, random, tint(e.color, 0.2), n(5), 0.26, true);
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      let joined = false;
      for (let k = 0; k <= 48; k++) {
        const p = k / 48,
          a = p * tau * 1.12 + t * (0.75 + i * 0.08) + i * 0.8,
          rr = r * (0.85 - p * 0.21),
          x = Math.cos(a) * rr,
          y = r * 0.7 - p * r * 1.6 + Math.sin(a) * r * 0.17;
        if (Math.sin(a) > 0 !== front) {
          joined = false;
          continue;
        }
        joined ? c.lineTo(x, y) : c.moveTo(x, y);
        joined = true;
      }
      const g = c.createLinearGradient(-r, r, r, -r);
      g.addColorStop(0, alpha(e.color, 0));
      g.addColorStop(0.45, alpha(tint(e.color, 0.6), 0.6));
      g.addColorStop(1, alpha(e.color, 0));
      c.strokeStyle = g;
      c.lineWidth = r * (i % 2 ? 0.011 : 0.025);
      c.stroke();
    }
    if (front)
      for (let i = 0; i < n(15); i++) {
        const p = fract(t * 0.27 + random(i)),
          a = t * 1.4 + i * 2.4,
          x = Math.cos(a) * r * 0.86,
          y = r * 0.72 - p * r * 1.8;
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.globalAlpha *= Math.sin(p * Math.PI) * 0.65;
        c.fillStyle = i % 4 ? tint(e.color, 0.4) : '#998f76';
        c.fillRect(-r * 0.025, 0, r * 0.05, r * 0.013);
        c.restore();
      }
  } else if (e.kind === 'water') {
    c.globalCompositeOperation = 'screen';
    if (!front) {
      c.save();
      c.translate(0, r * 0.6);
      c.scale(1, 0.28);
      glow(c, 0, 0, r * 1.08, e.color, 0.25);
      for (let i = 0; i < 3; i++) {
        const p = fract(t * 0.22 + i / 3);
        c.save();
        c.globalAlpha *= (1 - p) * 0.7;
        c.beginPath();
        c.ellipse(0, 0, r * (0.25 + p * 0.88), r * (0.25 + p * 0.88), 0, 0, tau);
        luminousStroke(c, e.color, r * 0.012, 0.7);
        c.restore();
      }
      c.restore();
    }
    for (let i = 0; i < 2; i++) orbit(c, r, t * (i ? -0.8 : 1), e.color, front, i * Math.PI, 0.43);
    if (front)
      for (let i = 0; i < n(18); i++) {
        const p = fract(t * 0.38 + random(i)),
          x = (random(i + 32) - 0.5) * r * 1.6,
          y = r * 0.62 - Math.sin(p * Math.PI) * r * (0.7 + random(i + 53) * 0.6),
          size = r * (0.012 + random(i + 76) * 0.019);
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI);
        glow(c, x, y, size * 2, e.color, 0.3);
        c.fillStyle = tint(e.color, 0.73);
        c.beginPath();
        c.ellipse(x, y, size * 0.6, size * 1.25, Math.sin(p * 5) * 0.3, 0, tau);
        c.fill();
        c.restore();
      }
  } else if (e.kind === 'earth') {
    if (!front) {
      haze(c, r, t, random, tint(e.color, 0.32, '#554c3d'), n(9), 0.4, true);
      for (let i = 0; i < n(11); i++) {
        const a = (i / 11) * tau,
          rr = r * 0.88;
        stone(
          c,
          Math.cos(a) * rr,
          r * 0.58 + Math.sin(a) * r * 0.2,
          r * (0.085 + random(i + 40) * 0.07),
          a,
          e.color,
          random,
          i * 7,
        );
      }
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * tau) / 6;
        c.moveTo(0, r * 0.62);
        c.lineTo(Math.cos(a) * r * 0.3, r * 0.62 + Math.sin(a) * r * 0.08);
        c.lineTo(Math.cos(a + 0.2) * r * 0.62, r * 0.62 + Math.sin(a + 0.2) * r * 0.17);
      }
      luminousStroke(c, tint(e.color, 0.28, '#efbc6b'), r * 0.007, 0.6);
    } else {
      for (let i = 0; i < n(7); i++) {
        const a = (i / 7) * tau + t * 0.19,
          x = Math.cos(a) * r * 0.82,
          y = Math.sin(a) * r * 0.58;
        stone(c, x, y, r * (0.045 + random(i + 40) * 0.06), a + t * 0.12, e.color, random, i * 11);
      }
      c.fillStyle = alpha(tint(e.color, 0.55), 0.55);
      for (let i = 0; i < n(22); i++) {
        const p = fract(t * 0.2 + random(i)),
          a = random(i + 60) * tau;
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI);
        c.beginPath();
        c.arc(Math.cos(a) * r * (0.7 + p * 0.3), r * 0.65 - p * r * 0.85, r * 0.008, 0, tau);
        c.fill();
        c.restore();
      }
    }
  } else if (e.kind === 'vines') {
    if (!front) haze(c, r, t * 0.4, random, tint(e.color, 0.2), n(5), 0.2, true);
    for (let i = 0; i < 6; i++) {
      const a = (i * tau) / 6,
        x = Math.cos(a) * r * 0.83,
        y = Math.sin(a) * r * 0.73;
      if (Math.sin(a) > 0 !== front) continue;
      c.beginPath();
      c.moveTo(x, r * 0.7);
      c.bezierCurveTo(x * 1.35, r * 0.2, x * 0.3, -r * 0.15, x, y - r * 0.16);
      c.bezierCurveTo(
        x + r * 0.18,
        y - r * 0.38,
        x + r * 0.28,
        y - r * 0.12,
        x + r * 0.13,
        y - r * 0.1,
      );
      c.strokeStyle = tint(e.color, 0.65, '#263920');
      c.lineWidth = r * 0.035;
      c.stroke();
      c.strokeStyle = e.color;
      c.lineWidth = r * 0.016;
      c.stroke();
      c.strokeStyle = alpha(tint(e.color, 0.45), 0.65);
      c.lineWidth = r * 0.005;
      c.stroke();
      for (let k = 0; k < 4; k++) {
        const p = k / 4,
          ly = r * 0.62 - p * r * 0.85,
          lx = x * (1.05 - p * 0.15) + Math.sin(p * 4) * r * 0.035;
        leaf(
          c,
          lx,
          ly,
          r * (0.075 + random(i + k) * 0.035),
          a + (k % 2 ? 1 : -1) * 0.55 + Math.sin(t * 0.6 + i) * 0.05,
          e.color,
        );
      }
    }
    if (front) {
      c.fillStyle = tint(e.color, 0.6, '#f2deb3');
      for (let i = 0; i < n(12); i++) {
        const p = fract(t * 0.12 + random(i)),
          a = random(i + 43) * tau;
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI);
        star(c, Math.cos(a) * r * 0.85, r * 0.6 - p * r * 1.5, r * 0.014);
        c.restore();
      }
    }
  }
}
