import type { TokenEffect } from '../shared/vtt-effects';
import { extraEffectKinds } from '../shared/vtt-effects-extra';
import { paintFootprint, type EffectFootprint } from './vtt-effect-footprint';
import { materialSprite } from './vtt-effects-materials';
import { discharge } from './vtt-effects-overhead-magic';
import { alpha, fract, glow, luminousStroke, star, tau, tint } from './vtt-effects-primitives';

type Random = (index: number) => number;
const models = new Set<string>(extraEffectKinds);
const polar = (r: number, a: number) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
const fade = (u: number) => Math.sin(u * Math.PI);
function ring(c: CanvasRenderingContext2D, r: number, color: string, opacity: number, width = 0.8) {
  c.beginPath();
  c.arc(0, 0, r, 0, tau);
  luminousStroke(c, color, width, opacity);
}
function facet(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  a: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  const points = [
    [-size * 0.6, 0],
    [-size * 0.25, -size],
    [size * 0.7, -size * 0.3],
    [size * 0.8, size * 0.6],
    [-size * 0.1, size * 0.8],
  ];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length];
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(p[0], p[1]);
    c.lineTo(q[0], q[1]);
    c.closePath();
    c.fillStyle = alpha(tint(color, i * 0.12, i % 2 ? '#ffffff' : '#394357'), 0.7);
    c.fill();
  }
  c.beginPath();
  c.moveTo(-size * 0.25, -size);
  c.lineTo(0, 0);
  c.lineTo(size * 0.8, size * 0.6);
  luminousStroke(c, color, 0.6, 0.6);
  c.restore();
}
function crescent(
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
  c.beginPath();
  c.arc(0, 0, size, Math.PI * 0.3, Math.PI * 1.7);
  c.quadraticCurveTo(
    -size * 0.25,
    0,
    size * Math.cos(Math.PI * 0.3),
    size * Math.sin(Math.PI * 0.3),
  );
  const g = c.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, alpha(tint(color, 0.8), 0.8));
  g.addColorStop(1, alpha(color, 0.3));
  c.fillStyle = g;
  c.fill();
  luminousStroke(c, color, 0.5, 0.7);
  c.restore();
}
function gear(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  a: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  for (let k = 0; k < 48; k++) {
    const p = polar(r * (k % 4 === 0 || k % 4 === 3 ? 1 : 0.84), (k / 48) * tau);
    k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
  }
  c.closePath();
  c.fillStyle = alpha(tint(color, 0.55, '#292837'), 0.2);
  c.fill();
  luminousStroke(c, color, 0.8, 0.75);
  ring(c, r * 0.55, color, 0.5, 0.5);
  for (let i = 0; i < 6; i++) {
    const p = polar(r * 0.18, (i / 6) * tau),
      q = polar(r * 0.55, (i / 6) * tau);
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(q.x, q.y);
    luminousStroke(c, color, 0.8, 0.6);
  }
  c.restore();
}
function feather(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  a: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  c.moveTo(0, -r);
  c.bezierCurveTo(r * 0.55, -r * 0.6, r * 0.6, r * 0.4, 0, r);
  c.bezierCurveTo(-r * 0.7, r * 0.4, -r * 0.4, -r * 0.7, 0, -r);
  const g = c.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
  g.addColorStop(0, alpha(color, 0.25));
  g.addColorStop(0.55, alpha(tint(color, 0.5), 0.7));
  g.addColorStop(1, alpha(color, 0.2));
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  c.moveTo(0, -r);
  c.lineTo(0, r * 1.2);
  for (let i = 0; i < 7; i++) {
    const y0 = -r * 0.65 + i * r * 0.23,
      w = Math.sin(((i + 1) / 9) * Math.PI) * r * 0.42;
    c.moveTo(-w, y0 - r * 0.22);
    c.lineTo(0, y0);
    c.lineTo(w, y0 - r * 0.22);
  }
  luminousStroke(c, color, 0.4, 0.7);
  c.restore();
}
function mist(
  c: CanvasRenderingContext2D,
  t: number,
  random: Random,
  n: number,
  opacity: number,
  spread = 1,
) {
  for (let i = 0; i < n; i++) {
    const u = fract(t * 0.13 + random(i + 54)),
      p = polar((25 + u * 52) * spread, random(i + 41) * tau + t * 0.04);
    // Shared neutral atlas keeps the texture cache small across all models.
    materialSprite(
      c,
      '#b6c8d3',
      'vapor',
      p.x,
      p.y,
      40 + u * 55,
      i + t * 0.08,
      t * 0.22 + i,
      fade(u) * opacity,
    );
  }
}
// New models share the token's floor plane, with bounded deterministic geometry.
// No image-data readback, particle arrays, timers or texture baking in this loop.
export function drawAdvancedEffects(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  pass: 'behind' | 'front',
  detail: number,
) {
  if (!models.has(e.kind)) return false;
  const front = pass === 'front',
    color = e.color,
    n = (v: number) => Math.max(3, Math.round(v * detail));
  c.save();
  try {
    if (e.kind === 'petrify' && front)
      paintFootprint(c, f, tint(color, 0.3, '#6b645e'), 0.3 + Math.sin(t * 0.65) * 0.035);
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    // An understated contact glow keeps both passes visible without a solid disc.
    if (!front) glow(c, 0, 0, 86, color, 0.11 + Math.sin(t * 0.9) * 0.025);
    switch (e.kind) {
      case 'inferno':
      case 'blue-fire':
      case 'soul-flames': {
        const soul = e.kind === 'soul-flames',
          blue = e.kind === 'blue-fire',
          count = n(soul ? 8 : blue ? 10 : 14);
        if (!front) {
          ring(c, 58, color, 0.22, 2);
          mist(c, t, random, n(5), 0.18);
        }
        for (let i = 0; i < count; i++) {
          if ((i % 2 === 0) !== front) continue;
          const u = fract(t * (soul ? 0.24 : blue ? 0.38 : 0.44) + random(i)),
            a = (i / count) * tau + Math.sin(t * 0.6 + i) * 0.12,
            p = polar(22 + u * (soul ? 63 : 55), a);
          c.save();
          c.globalAlpha *= fade(u);
          materialSprite(
            c,
            color,
            'flame',
            p.x,
            p.y,
            (blue ? 42 : 55) + u * 28,
            a + Math.PI / 2 + t * 0.06,
            t * 0.5 + i,
            0.58,
          );
          glow(c, p.x, p.y, 9, color, 0.28);
          if (soul && front) {
            c.fillStyle = alpha(tint(color, 0.3, '#172735'), 0.7);
            c.beginPath();
            c.ellipse(p.x - 2, p.y - 1, 1.1, 2, 0, 0, tau);
            c.ellipse(p.x + 2, p.y - 1, 1.1, 2, 0, 0, tau);
            c.fill();
          }
          c.restore();
        }
        if (e.kind === 'inferno' && front)
          for (let i = 0; i < n(18); i++) {
            const u = fract(t * 0.7 + random(i + 98)),
              p = polar(28 + u * 72, random(i + 88) * tau);
            c.fillStyle = alpha(tint(color, 0.5), fade(u) * 0.7);
            star(c, p.x, p.y, 1.2);
          }
        break;
      }
      case 'acid-rain':
      case 'hail': {
        const ice = e.kind === 'hail';
        if (!front) mist(c, t, random, n(5), ice ? 0.14 : 0.2);
        for (let i = 0; i < n(22); i++) {
          const u = fract(t * 0.6 + random(i)),
            a = random(i + 18) * tau,
            p = polar(22 + random(i + 34) * 59, a);
          if (front) {
            const x = p.x + (1 - u) * 9,
              y = p.y - (1 - u) * 28;
            c.save();
            c.globalAlpha *= fade(u) * 0.85;
            if (ice) facet(c, x, y, 3 + random(i + 73) * 3, color, t + i);
            else {
              c.beginPath();
              c.moveTo(x - 2, y - 5);
              c.quadraticCurveTo(x + 3, y + 1, x, y + 3);
              c.quadraticCurveTo(x - 3, y, x - 2, y - 5);
              c.fillStyle = alpha(tint(color, 0.3), 0.65);
              c.fill();
            }
            c.restore();
          } else {
            c.save();
            c.translate(p.x, p.y);
            c.scale(1, 0.65);
            c.beginPath();
            c.arc(0, 0, 1 + u * 8, 0, tau);
            luminousStroke(c, color, 0.7, (1 - u) * 0.5);
            c.restore();
          }
        }
        break;
      }
      case 'ice-lattice': {
        c.save();
        c.rotate(t * 0.04);
        for (let arm = 0; arm < 6; arm++) {
          c.save();
          c.rotate((arm / 6) * tau);
          c.beginPath();
          c.moveTo(8, 0);
          c.lineTo(83 + Math.sin(t + arm) * 2, 0);
          for (let k = 0; k < 5; k++) {
            const x = 23 + k * 11,
              len = 8 + (4 - k) * 2;
            c.moveTo(x - len, -len);
            c.lineTo(x, 0);
            c.lineTo(x - len, len);
          }
          luminousStroke(c, color, front ? 0.65 : 2.8, front ? 0.6 : 0.3);
          if (front) {
            facet(c, 77, 0, 7, color, Math.PI / 2);
            for (let k = 0; k < 3; k++) {
              c.fillStyle = alpha(tint(color, 0.7), 0.5 + Math.sin(t * 2 + k) * 0.2);
              star(c, 29 + k * 18, 0, 2);
            }
          }
          c.restore();
        }
        ring(c, 54, color, front ? 0.3 : 0.15);
        c.restore();
        break;
      }
      case 'steam': {
        mist(c, t * 1.3, random, n(front ? 8 : 10), front ? 0.34 : 0.45);
        if (front)
          for (let i = 0; i < n(6); i++) {
            const a = (i / 6) * tau + t * 0.08;
            c.beginPath();
            for (let k = 0; k < 18; k++) {
              const u = k / 17,
                p = polar(15 + u * 65, a + Math.sin(u * 4 + t) * 0.2);
              k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
            }
            luminousStroke(c, color, 1.4, 0.2);
          }
        break;
      }
      case 'sandstorm': {
        if (!front) mist(c, t, random, n(8), 0.32);
        for (let i = 0; i < n(front ? 46 : 18); i++) {
          const u = fract(t * 0.42 + random(i)),
            r = 30 + random(i + 45) * 65,
            a = random(i + 71) * tau + t * (0.25 + r * 0.006),
            p = polar(r, a);
          c.beginPath();
          c.moveTo(p.x, p.y);
          const q = polar(r, a - 0.03 - u * 0.09);
          c.lineTo(q.x, q.y);
          luminousStroke(c, color, front ? 0.45 : 1.8, fade(u) * (front ? 0.65 : 0.18));
        }
        break;
      }
      case 'earthquake': {
        for (let i = 0; i < n(front ? 8 : 12); i++) {
          const a = (i / 12) * tau,
            r = 25 + Math.sin(t * 0.8 + i) * 3;
          c.beginPath();
          for (let k = 0; k < 7; k++) {
            const p = polar(r + k * 9, a + Math.sin(k * 12.3 + i) * 0.09);
            k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
            if (k === 3) {
              const q = polar(r + k * 9 + 12, a + 0.18);
              c.lineTo(q.x, q.y);
              c.moveTo(p.x, p.y);
            }
          }
          luminousStroke(
            c,
            front ? tint(color, 0.35) : tint(color, 0.6, '#211f26'),
            front ? 0.6 : 3.5,
            front ? 0.5 : 0.8,
          );
          if (front) {
            const p = polar(58 + random(i + 34) * 21, a + t * 0.01);
            facet(c, p.x + Math.sin(t * 12 + i), p.y, 3 + random(i + 67) * 3, color, i);
          }
        }
        break;
      }
      case 'thunderstorm': {
        if (!front) {
          mist(c, t, random, n(10), 0.45);
          ring(c, 72, color, 0.16);
        } else {
          const tick = Math.floor(t * 3);
          for (let i = 0; i < 3; i++) {
            const p = polar(68, (i / 3) * tau + t * 0.1),
              q = polar(35 + random(i + tick * 7) * 48, (i / 3) * tau + 0.6);
            discharge(c, p, q, random, tick * 31 + i * 67, color, 0.65);
          }
          for (let i = 0; i < n(20); i++) {
            const u = fract(t * 0.8 + random(i + 32)),
              p = polar(12 + random(i + 62) * 81, random(i + 79) * tau);
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.x - 2, p.y + 6);
            luminousStroke(c, color, 0.4, fade(u) * 0.4);
          }
        }
        break;
      }
      case 'bubbles': {
        for (let i = 0; i < n(front ? 15 : 6); i++) {
          const u = fract(t * 0.16 + random(i)),
            p = polar(23 + u * 66, random(i + 31) * tau + Math.sin(t * 0.3 + i) * 0.1),
            r = 3 + random(i + 58) * 7;
          c.save();
          c.globalAlpha *= fade(u) * (front ? 0.65 : 0.2);
          c.translate(p.x, p.y);
          const g = c.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r);
          g.addColorStop(0, alpha(tint(color, 0.8), 0.2));
          g.addColorStop(0.7, alpha(color, 0.02));
          g.addColorStop(1, alpha(tint(color, 0.5), 0.35));
          c.fillStyle = g;
          c.beginPath();
          c.arc(0, 0, r, 0, tau);
          c.fill();
          c.beginPath();
          c.arc(0, 0, r * 0.78, Math.PI * 1.05, Math.PI * 1.55);
          luminousStroke(c, tint(color, 0.7), 0.7, 0.8);
          c.restore();
        }
        break;
      }
      case 'solar-halo': {
        ring(c, 67, color, front ? 0.4 : 0.55, front ? 0.6 : 2);
        for (let i = 0; i < n(24); i++) {
          const a = (i / 24) * tau + t * 0.07,
            p = polar(65, a),
            q = polar(91 + Math.sin(t * 2 + i) * 6, a),
            mid = polar(76, a + 0.025);
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.quadraticCurveTo(mid.x, mid.y, q.x, q.y);
          luminousStroke(c, color, front ? 0.7 : 3, front ? 0.8 : 0.22);
          if (front && i % 3 === 0) {
            c.fillStyle = alpha(tint(color, 0.7), 0.6);
            star(c, q.x, q.y, 2.5);
          }
        }
        break;
      }
      case 'lunar-halo': {
        if (!front) {
          ring(c, 72, color, 0.3);
          ring(c, 79, color, 0.18);
          mist(c, t, random, n(4), 0.12);
        } else {
          const p = polar(69, t * 0.26);
          crescent(c, p.x, p.y, 16, t * 0.26, color);
          for (let i = 0; i < n(18); i++) {
            const u = fract(t * 0.13 + random(i)),
              q = polar(60 + random(i + 24) * 26, (i / 18) * tau + t * 0.05);
            c.fillStyle = alpha(tint(color, 0.5), fade(u) * 0.7);
            star(c, q.x, q.y, 1 + random(i + 72));
          }
        }
        break;
      }
      case 'starfield': {
        const count = n(12),
          points = Array.from({ length: count }, (_, i) =>
            polar(43 + random(i + 34) * 41, (i / count) * tau + Math.sin(t * 0.13 + i) * 0.07),
          );
        for (let i = 0; i < count; i++) {
          const p = points[i],
            q = points[(i + 3) % count];
          if (!front) {
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x, q.y);
            luminousStroke(c, color, 0.5, 0.3);
          } else {
            glow(c, p.x, p.y, 9, color, 0.16);
            c.fillStyle = alpha(tint(color, 0.7), 0.65 + Math.sin(t * 2 + i) * 0.25);
            star(c, p.x, p.y, 2.5 + random(i + 54) * 1.8);
            const u = fract(t * 0.22 + i / count);
            c.fillStyle = alpha(color, 0.8);
            star(c, p.x + (q.x - p.x) * u, p.y + (q.y - p.y) * u, 1.1);
          }
        }
        break;
      }
      case 'comets': {
        for (let i = 0; i < (front ? 4 : 2); i++) {
          const a = t * (0.34 + i * 0.04) + (i / 4) * tau,
            r = 62 + i * 8;
          for (let k = 0; k < 22; k++) {
            const u = k / 22,
              p = polar(r, a - u * 0.85),
              q = polar(r, a - (u + 1 / 22) * 0.85);
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x, q.y);
            luminousStroke(
              c,
              color,
              (1 - u) * (front ? 3 : 5) + 0.25,
              (1 - u) * (front ? 0.55 : 0.14),
            );
          }
          const p = polar(r, a);
          glow(c, p.x, p.y, 9, color, 0.45);
          c.fillStyle = alpha(tint(color, 0.8), 0.9);
          star(c, p.x, p.y, front ? 4 : 2);
        }
        break;
      }
      case 'mirror-shield':
      case 'prismatic-barrier': {
        const prism = e.kind === 'prismatic-barrier',
          palette = ['#f79f9a', '#efd783', '#9ddeaa', '#88d8ea', '#a3b7f5', '#d7a8e9'];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * tau + t * 0.1,
            p = polar(70, a),
            local = prism ? tint(palette[i], 0.16, color) : color;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(a + Math.PI / 2);
          c.scale(1, 0.85 + Math.sin(t + i) * 0.1);
          c.beginPath();
          c.moveTo(-14, -18);
          c.lineTo(13, -18);
          c.lineTo(17, 10);
          c.lineTo(0, 24);
          c.lineTo(-17, 10);
          c.closePath();
          const g = c.createLinearGradient(-16, -16, 18, 18);
          g.addColorStop(0, alpha(tint(local, 0.65), front ? 0.32 : 0.09));
          g.addColorStop(0.46, alpha(local, front ? 0.05 : 0.02));
          g.addColorStop(0.54, alpha(tint(local, 0.85), front ? 0.48 : 0.1));
          g.addColorStop(1, alpha(local, 0.12));
          c.fillStyle = g;
          c.fill();
          luminousStroke(c, local, front ? 0.8 : 2, front ? 0.7 : 0.18);
          if (front) {
            c.beginPath();
            c.moveTo(-10, -9);
            c.lineTo(9, -9);
            c.lineTo(11, 5);
            luminousStroke(c, tint(local, 0.6), 0.55, 0.65);
          }
          c.restore();
        }
        break;
      }
      case 'clockwork': {
        if (!front) {
          ring(c, 78, color, 0.4);
          for (let i = 0; i < 24; i++) {
            const p = polar(75, (i / 24) * tau),
              q = polar(i % 3 === 0 ? 69 : 72, (i / 24) * tau);
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x, q.y);
            luminousStroke(c, color, 0.6, 0.5);
          }
        }
        for (let i = 0; i < (front ? 4 : 2); i++) {
          const p = polar(front ? 65 : 35, (i / (front ? 4 : 2)) * tau);
          gear(c, p.x, p.y, front ? 17 : 24, t * (i % 2 ? -0.3 : 0.3), color);
        }
        break;
      }
      case 'gravity-well': {
        if (!front) {
          const g = c.createRadialGradient(0, 0, 8, 0, 0, 72);
          g.addColorStop(0, '#13121e99');
          g.addColorStop(0.6, alpha(color, 0.16));
          g.addColorStop(1, alpha(color, 0));
          c.fillStyle = g;
          c.fillRect(-74, -74, 148, 148);
        }
        for (let i = 0; i < (front ? 4 : 7); i++) {
          c.save();
          c.rotate(t * 0.13 + i * 0.17);
          c.scale(1, 0.5 + i * 0.055);
          c.beginPath();
          c.arc(0, 0, 46 + i * 5, t * 0.3 + i, t * 0.3 + i + Math.PI * 1.4);
          luminousStroke(c, color, front ? 0.8 : 1.5, front ? 0.6 : 0.18);
          c.restore();
        }
        if (front)
          for (let i = 0; i < n(12); i++) {
            const u = fract(t * 0.15 + random(i)),
              p = polar(84 * (1 - u) + 8, random(i + 44) * tau + t * 0.4 + u * 2);
            glow(c, p.x, p.y, 3, color, fade(u) * 0.45);
          }
        break;
      }
      case 'astral-threads': {
        for (let i = 0; i < (front ? 7 : 10); i++) {
          c.beginPath();
          const start = (i / 10) * tau + t * 0.06;
          for (let k = 0; k < 33; k++) {
            const u = k / 32,
              p = polar(61 + Math.sin(u * tau * 2 + t + i) * 14, start + u * tau * 0.74);
            k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
          }
          luminousStroke(c, color, front ? 0.55 : 1.8, front ? 0.65 : 0.14);
          if (front) {
            const u = fract(t * 0.22 + i / 7),
              p = polar(61 + Math.sin(u * tau * 2 + t + i) * 14, start + u * tau * 0.74);
            glow(c, p.x, p.y, 5, color, 0.5);
          }
        }
        break;
      }
      case 'spectral-chains': {
        for (let strand = 0; strand < 2; strand++)
          for (let i = 0; i < n(28); i++) {
            const a = (i / n(28)) * tau + t * (strand ? -0.07 : 0.07),
              r = 64 + strand * 12 + Math.sin(a * 3 + t) * 3,
              p = polar(r, a);
            c.save();
            c.translate(p.x, p.y);
            c.rotate(a + Math.PI / 2);
            c.beginPath();
            c.ellipse(0, 0, 6, i % 2 === 0 ? 3 : 1.5, 0, 0, tau);
            luminousStroke(c, color, front ? 1 : 2.7, front ? 0.58 : 0.13);
            if (front) {
              c.beginPath();
              c.ellipse(0, -0.4, 5, 1.3, 0, Math.PI, Math.PI * 1.7);
              luminousStroke(c, tint(color, 0.65), 0.45, 0.7);
            }
            c.restore();
          }
        break;
      }
      case 'thorn-cage': {
        for (let i = 0; i < 6; i++) {
          c.save();
          c.rotate((i / 6) * tau + 0.03 * Math.sin(t * 0.8 + i));
          c.beginPath();
          c.moveTo(22, 0);
          c.bezierCurveTo(38, -19, 67, 16, 88, -7);
          luminousStroke(c, tint(color, 0.5, '#394d2b'), front ? 1.6 : 5, front ? 0.7 : 0.38);
          for (let k = 0; k < 6; k++) {
            const x = 31 + k * 9,
              y = Math.sin(k) * 7;
            c.beginPath();
            c.moveTo(x - 2, y);
            c.lineTo(x + 1, y + (k % 2 ? 9 : -9));
            c.lineTo(x + 4, y + 1);
            c.closePath();
            c.fillStyle = alpha(color, front ? 0.75 : 0.2);
            c.fill();
          }
          c.restore();
        }
        break;
      }
      case 'spores': {
        if (!front) mist(c, t, random, n(7), 0.2);
        for (let i = 0; i < n(front ? 34 : 15); i++) {
          const u = fract(t * 0.11 + random(i)),
            p = polar(13 + u * 77, random(i + 21) * tau + Math.sin(t * 0.4 + i) * 0.16),
            r = 0.7 + random(i + 63) * 1.8;
          glow(c, p.x, p.y, r * 3, color, fade(u) * 0.18);
          c.fillStyle = alpha(tint(color, 0.6), fade(u) * 0.75);
          c.beginPath();
          c.arc(p.x, p.y, r, 0, tau);
          c.fill();
        }
        break;
      }
      case 'mushrooms': {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * tau,
            p = polar(65 + Math.sin(i * 12) * 9, a),
            r = 7 + random(i + 61) * 4;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(a - Math.PI / 2);
          c.scale(1, 1 + Math.sin(t * 0.65 + i) * 0.03);
          if (!front) {
            glow(c, 0, 0, 18, color, 0.16);
          } else {
            c.beginPath();
            c.moveTo(-2, 0);
            c.quadraticCurveTo(-2, 9, 1, 11);
            c.lineTo(3, 10);
            c.lineTo(2, -1);
            c.closePath();
            c.fillStyle = alpha(tint(color, 0.65), 0.7);
            c.fill();
            c.beginPath();
            c.ellipse(0, 0, r, r * 0.58, 0, 0, tau);
            const g = c.createLinearGradient(0, -r, 0, r);
            g.addColorStop(0, alpha(tint(color, 0.65), 0.8));
            g.addColorStop(1, alpha(tint(color, 0.4, '#53394f'), 0.8));
            c.fillStyle = g;
            c.fill();
            for (let k = 0; k < 4; k++) {
              c.beginPath();
              c.moveTo(0, 1);
              c.lineTo((k - 1.5) * r * 0.45, r * 0.45);
              luminousStroke(c, color, 0.35, 0.7);
            }
            const q = polar(r * 0.6, t + i);
            c.fillStyle = alpha(tint(color, 0.8), 0.8);
            star(c, q.x, q.y, 1.1);
          }
          c.restore();
        }
        break;
      }
      case 'butterflies': {
        for (let i = 0; i < n(front ? 9 : 4); i++) {
          const a = (i / 9) * tau + t * 0.17,
            p = polar(44 + Math.sin(t * 0.6 + i) * 27, a),
            r = 5 + random(i + 55) * 3;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(a + Math.PI / 2);
          c.scale(0.3 + Math.abs(Math.sin(t * 5 + i)) * 0.7, 1);
          for (const side of [-1, 1]) {
            const g = c.createLinearGradient(0, 0, side * r * 1.7, 0);
            g.addColorStop(0, alpha(tint(color, 0.35, '#433650'), front ? 0.8 : 0.2));
            g.addColorStop(0.7, alpha(color, front ? 0.7 : 0.15));
            g.addColorStop(1, alpha(tint(color, 0.75), front ? 0.7 : 0.1));
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(0, 0);
            c.bezierCurveTo(side * r, -r * 1.4, side * r * 2, -r * 0.6, side * r, r * 0.1);
            c.bezierCurveTo(side * r * 1.8, r, side * r * 0.5, r * 1.3, 0, 0);
            c.fill();
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(side * r, -r * 0.6);
            luminousStroke(c, tint(color, 0.6), 0.4, 0.5);
          }
          c.beginPath();
          c.moveTo(0, -r * 0.5);
          c.lineTo(0, r * 0.6);
          luminousStroke(c, tint(color, 0.6, '#302936'), 0.8, 0.8);
          c.restore();
        }
        break;
      }
      case 'feathers': {
        for (let i = 0; i < n(front ? 12 : 5); i++) {
          const u = fract(t * 0.12 + random(i)),
            a = random(i + 67) * tau + t * 0.08,
            p = polar(22 + u * 68, a);
          c.save();
          c.globalAlpha *= fade(u) * (front ? 0.85 : 0.2);
          feather(c, p.x, p.y, 7 + random(i + 32) * 6, a + Math.sin(t + i) * 0.4, color);
          c.restore();
        }
        break;
      }
      case 'rage': {
        for (let i = 0; i < n(front ? 10 : 8); i++) {
          const u = fract(t * 0.42 + random(i)),
            a = (i / 10) * tau + t * 0.06,
            p = polar(32 + u * 52, a);
          c.save();
          c.globalAlpha *= fade(u);
          c.translate(p.x, p.y);
          c.rotate(a);
          c.beginPath();
          c.moveTo(-8, -2);
          c.lineTo(14, 0);
          c.lineTo(-2, 1.5);
          c.closePath();
          c.fillStyle = alpha(color, front ? 0.7 : 0.15);
          c.fill();
          if (front) {
            c.beginPath();
            c.moveTo(-5, -1);
            c.lineTo(10, 0);
            luminousStroke(c, tint(color, 0.4), 0.6, 0.8);
          }
          c.restore();
        }
        if (!front) ring(c, 60 + Math.sin(t * 3) * 3, color, 0.35, 1.5);
        break;
      }
      case 'sleep': {
        if (!front) mist(c, t * 0.6, random, n(5), 0.17);
        else
          for (let i = 0; i < 6; i++) {
            const u = fract(t * 0.12 + i / 6),
              a = (i / 6) * tau + 0.1 * Math.sin(t * 0.4),
              p = polar(28 + u * 58, a);
            c.save();
            c.globalAlpha *= fade(u);
            if (i % 2 === 0) crescent(c, p.x, p.y, 6 + u * 3, -0.3 + t * 0.06, color);
            else {
              c.translate(p.x, p.y);
              c.rotate(-0.15);
              c.beginPath();
              c.moveTo(-3, -4);
              c.lineTo(3, -4);
              c.lineTo(-3, 4);
              c.lineTo(3, 4);
              luminousStroke(c, color, 1.1, 0.75);
            }
            c.restore();
          }
        break;
      }
      case 'fear': {
        if (!front) mist(c, t, random, n(8), 0.37);
        for (let i = 0; i < (front ? 6 : 8); i++) {
          const a = (i / 8) * tau + t * 0.04;
          c.save();
          c.rotate(a);
          c.beginPath();
          c.moveTo(91, -8);
          c.bezierCurveTo(74, 12, 64, -17, 44, 2);
          c.bezierCurveTo(61, -4, 75, 23, 91, 9);
          c.closePath();
          c.fillStyle = alpha(tint(color, 0.6, '#282333'), front ? 0.4 : 0.3);
          c.fill();
          if (front) {
            c.beginPath();
            c.moveTo(71, -2);
            c.lineTo(78, -5);
            c.lineTo(76, 1);
            c.closePath();
            c.fillStyle = alpha(tint(color, 0.6), 0.45 + Math.sin(t * 1.5 + i) * 0.2);
            c.fill();
          }
          c.restore();
        }
        break;
      }
      case 'petrify': {
        for (let i = 0; i < n(front ? 14 : 7); i++) {
          const u = fract(t * 0.13 + random(i)),
            a = random(i + 42) * tau,
            p = polar(25 + u * 60, a);
          c.save();
          c.globalAlpha *= fade(u) * (front ? 0.65 : 0.18);
          facet(c, p.x, p.y, 2 + random(i + 65) * 4, color, i + t * 0.1);
          c.restore();
        }
        if (front)
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * tau + t * 0.01,
              p = polar(28, a),
              q = polar(52, a + 0.1);
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x - 3, q.y + 2);
            c.lineTo(q.x, q.y);
            luminousStroke(c, tint(color, 0.55, '#4e4644'), 0.6, 0.4);
          }
        break;
      }
    }
  } finally {
    c.restore();
  }
  return true;
}
