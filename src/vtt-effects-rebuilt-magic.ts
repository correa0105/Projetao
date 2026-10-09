import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, glow, star, tau, tint } from './vtt-effects-primitives';
import { physicalProp } from './vtt-effects-physical';
import { temporalField } from './vtt-effects-temporal';
type Random = (i: number) => number;
const polar = (r: number, a: number) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
export const rebuiltMagicKinds = new Set([
  'vortex',
  'bless',
  'sonic',
  'lunar-halo',
  'starfield',
  'comets',
  'mirror-shield',
  'sleep',
  'fear',
]);
function crescent(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  a: number,
  color: string,
  opacity: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.globalAlpha *= opacity;
  // Closed crescent geometry keeps alpha in the concavity, with no opaque mask.
  c.beginPath();
  c.arc(0, 0, size, -Math.PI / 2, Math.PI / 2);
  c.bezierCurveTo(size * 0.67, size * 0.68, size * 0.67, -size * 0.68, 0, -size);
  const g = c.createLinearGradient(-size, 0, size, 0);
  g.addColorStop(0, alpha(color, 0.17));
  g.addColorStop(1, tint(color, 0.8));
  c.fillStyle = g;
  c.fill();
  c.restore();
}
function trail(c: CanvasRenderingContext2D, t: number, index: number, color: string, fire = false) {
  const angle = t * (0.46 + index * 0.08) + index * 2.19,
    rx = 93 + index * 7,
    ry = 78 + index * 5;
  for (let k = 36; k > 0; k--) {
    const a = angle - k * 0.033,
      b = angle - (k - 1) * 0.033;
    c.beginPath();
    c.moveTo(Math.cos(a) * rx, Math.sin(a) * ry);
    c.lineTo(Math.cos(b) * rx, Math.sin(b) * ry);
    c.lineWidth = (1 - k / 37) ** 1.5 * (fire ? 9 : 5.6);
    c.strokeStyle = alpha(tint(color, (1 - k / 37) * 0.8), (1 - k / 37) ** 2 * 0.8);
    c.stroke();
  }
  const x = Math.cos(angle) * rx,
    y = Math.sin(angle) * ry;
  glow(c, x, y, 10, color, 0.45);
  c.fillStyle = '#fff5f3';
  star(c, x, y, 4.7);
}
export function drawRebuiltMagic(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  const color = e.color,
    kind = e.kind;
  if (kind === 'vortex') {
    if (!front) {
      temporalField(c, 'vortex', t * 0.56, 0, 0, 307, 307, -t * 0.2, 0.86, color);
      glow(c, 0, 0, 34, '#10212b', 0.6);
    }
    // Dust converges on logarithmic paths, with accelerating inward motion.
    for (let i = 0; i < Math.round(52 * detail); i++) {
      const u = fract(t * (0.19 + random(i) * 0.09) + random(i + 17));
      const a = random(i + 36) * tau + u * u * 5.2,
        r = 115 * (1 - u) ** 0.65 + 9;
      const p = polar(r, a);
      if (p.y > 0 !== front) continue;
      const q = polar(r + 4, a - 0.08);
      c.beginPath();
      c.moveTo(q.x, q.y);
      c.lineTo(p.x, p.y);
      c.lineWidth = 0.55 + random(i + 8) * 1.1;
      c.strokeStyle = alpha(tint(color, 0.5), Math.sin(u * Math.PI) * 0.7);
      c.stroke();
    }
  } else if (kind === 'bless') {
    if (!front) {
      glow(c, 0, 0, 131, color, 0.17);
      for (let side of [-1, 1])
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + side * (0.34 + i * 0.13),
            r = 87 + i * 5;
          physicalProp(
            c,
            'feather',
            Math.cos(a) * r,
            Math.sin(a) * r,
            43 + i * 2.6,
            a + Math.PI / 2 + side * 0.17,
            0.61 + 0.14 * Math.sin(t * 0.65 + i * 0.13),
            tint(color, 0.56),
          );
        }
    }
    for (let i = 0; i < 25; i++) {
      const u = fract(t * 0.14 + random(i + 7)),
        a = random(i + 19) * tau,
        r = 43 + u * 73,
        p = polar(r, a);
      if (p.y > 0 !== front) continue;
      const fade = Math.sin(u * Math.PI);
      glow(c, p.x, p.y, 4, color, fade * 0.25);
      c.fillStyle = alpha(tint(color, 0.82), fade * 0.82);
      star(c, p.x, p.y, 1.2 + random(i) * 2.8);
    }
  } else if (kind === 'sonic') {
    if (!front) temporalField(c, 'vapour', t * 0.25, 0, 0, 226, 226, 0, 0.13, color);
    // Pressure packets expand and disperse through three broad lobes. No closed
    // static zigzag rings: the ridge advances, widens and loses its coherence.
    for (let wave = 0; wave < 3; wave++) {
      const u = fract(t * 0.38 + wave / 3),
        r = 28 + u * 103,
        fade = Math.sin(u * Math.PI) ** 1.4;
      for (let lobe = 0; lobe < 3; lobe++) {
        const center = (lobe * tau) / 3 + 0.26 * Math.sin(t * 0.2),
          start = center - 0.72;
        if (Math.sin(center) > 0 !== front) continue;
        c.beginPath();
        for (let k = 0; k <= 36; k++) {
          const a = start + k * 0.04,
            edge = r + Math.sin(a * 3 + t * 1.6) * 4;
          const p = polar(edge, a);
          k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
        }
        c.strokeStyle = alpha(color, fade * 0.08);
        c.lineWidth = 6 + u * 7;
        c.stroke();
        c.strokeStyle = alpha(tint(color, 0.7), fade * 0.65);
        c.lineWidth = 0.8 + u * 0.8;
        c.stroke();
      }
    }
  } else if (kind === 'lunar-halo') {
    if (!front) {
      temporalField(c, 'vapour', t * 0.21, 0, 0, 248, 248, t * 0.07, 0.3, color);
      const a = -Math.PI * 0.62 + t * 0.11,
        p = polar(91, a);
      glow(c, p.x, p.y, 32, color, 0.16);
      crescent(c, p.x, p.y, 23, a + 0.7, color, 0.94);
    }
    for (let i = 0; i < 23; i++) {
      const a = random(i) * tau + t * 0.04,
        p = polar(75 + random(i + 9) * 40, a);
      if (p.y > 0 !== front) continue;
      c.fillStyle = alpha(tint(color, 0.7), 0.2 + 0.5 * Math.sin(t * 0.6 + i) ** 2);
      star(c, p.x, p.y, 0.7 + random(i + 23) * 1.4);
    }
  } else if (kind === 'starfield') {
    // Four different, stable constellation graphs. Light travels along a
    // connection; whole graphs drift slowly rather than flickering randomly.
    for (let graph = 0; graph < 4; graph++) {
      const base = (graph * tau) / 4 + t * 0.06,
        points = Array.from({ length: 5 }, (_, i) =>
          polar(
            78 + random(graph * 19 + i) * 34,
            base + (i - 2) * 0.14 + (random(i + graph * 51) - 0.5) * 0.1,
          ),
        );
      if (Math.sin(base) > 0 !== front) continue;
      for (let i = 0; i < points.length - 1; i++) {
        const p = points[i],
          q = points[i + 1];
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.strokeStyle = alpha(color, 0.2);
        c.lineWidth = 0.65;
        c.stroke();
        const u = fract(t * 0.28 + graph * 0.31 - i * 0.2),
          x = p.x + (q.x - p.x) * u,
          y = p.y + (q.y - p.y) * u;
        glow(c, x, y, 3, color, Math.sin(u * Math.PI) * 0.5);
      }
      for (let i = 0; i < points.length; i++) {
        const p = points[i],
          fade = 0.55 + Math.sin(t * 0.7 + i + graph) ** 2 * 0.4;
        glow(c, p.x, p.y, 5, color, fade * 0.35);
        c.fillStyle = alpha(tint(color, 0.85), fade);
        star(c, p.x, p.y, 1.7 + (i % 2) * 1.2);
      }
    }
  } else if (kind === 'comets') {
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = t * (0.46 + i * 0.08) + i * 2.19;
      if (Math.sin(a) > 0 !== front) continue;
      trail(c, t, i, color);
    }
  } else if (kind === 'mirror-shield') {
    for (let i = 0; i < 5; i++) {
      const a = t * 0.14 + (i * tau) / 5,
        p = polar(93, a);
      if (p.y > 0 !== front) continue;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(a + Math.PI / 2);
      c.scale(0.8 + 0.2 * Math.sin(t * 0.5 + i) ** 2, 1);
      c.beginPath();
      c.moveTo(-13, -24);
      c.lineTo(10, -29);
      c.lineTo(17, 16);
      c.lineTo(-6, 27);
      c.lineTo(-17, 11);
      c.closePath();
      c.save();
      c.clip();
      const g = c.createLinearGradient(-15, -25, 16, 25);
      g.addColorStop(0, '#f2faff');
      g.addColorStop(0.22, alpha(color, 0.57));
      g.addColorStop(0.48, '#223c52');
      g.addColorStop(0.68, alpha(color, 0.8));
      g.addColorStop(1, '#f1fbff');
      c.fillStyle = g;
      c.fillRect(-20, -35, 40, 70);
      // Actual token reflections follow its art without pixel reads or caches.
      if (f.source) {
        c.globalAlpha *= 0.38;
        c.drawImage(f.source, -33, -36, 65, 73);
      }
      c.globalAlpha *= 0.9;
      c.fillStyle = '#f3fbff';
      c.translate(Math.sin(t * 0.7 + i) * 18, 0);
      c.rotate(0.35);
      c.fillRect(-3, -40, 3, 80);
      c.restore();
      c.strokeStyle = alpha(tint(color, 0.6), 0.75);
      c.lineWidth = 1.25;
      c.stroke();
      c.beginPath();
      c.moveTo(-13, -24);
      c.lineTo(-6, 27);
      c.strokeStyle = alpha('#ffffff', 0.5);
      c.lineWidth = 0.4;
      c.stroke();
      c.restore();
    }
  } else if (kind === 'sleep') {
    if (!front) temporalField(c, 'vapour', t * 0.15, 0, 0, 218, 218, 0, 0.2, color);
    for (let i = 0; i < 7; i++) {
      const u = fract(t * 0.12 + random(i + 18)),
        a = (i * tau) / 7 + 0.08 * Math.sin(t * 0.4 + i),
        p = polar(66 + u * 40, a);
      if (p.y > 0 !== front) continue;
      crescent(
        c,
        p.x,
        p.y,
        3 + u * 4,
        Math.sin(t * 0.3 + i) * 0.4,
        color,
        Math.sin(u * Math.PI) * 0.68,
      );
    }
    for (let i = 0; i < 15; i++) {
      const u = fract(t * 0.12 + random(i + 22)),
        p = polar(51 + u * 54, random(i + 64) * tau);
      if (p.y > 0 !== front) continue;
      c.fillStyle = alpha(tint(color, 0.7), Math.sin(u * Math.PI) * 0.55);
      star(c, p.x, p.y, 0.7 + u);
    }
  } else if (kind === 'fear') {
    if (!front) temporalField(c, 'vapour', t * 0.43, 0, 0, 254, 254, t * 0.045, 0.7, '#251627');
    // Faces emerge at irregular intervals in the surrounding darkness; eyes
    // focus briefly, then close as their smoky forms dissolve.
    for (let i = 0; i < 4; i++) {
      const u = fract(t * 0.17 + random(i + 28)),
        a = (i * tau) / 4 + 0.23 * Math.sin(t * 0.25 + i),
        p = polar(85 + u * 13, a);
      if (p.y > 0 !== front) continue;
      const fade = Math.sin(u * Math.PI) ** 3;
      temporalField(c, 'vapour', t * 0.48 + i * 0.5, p.x, p.y, 66, 78, a, 0.6 * fade, '#271229');
      c.save();
      c.translate(p.x, p.y);
      c.rotate(a + Math.PI / 2);
      c.scale(1, 0.6 + 0.4 * fade);
      for (let side of [-1, 1]) {
        const x = side * 9;
        glow(c, x, -4, 7, '#b58bc9', fade * 0.4);
        c.beginPath();
        c.moveTo(x - side * 4, -6);
        c.quadraticCurveTo(x, -1, x + side * 4, -4);
        c.strokeStyle = alpha('#e1badf', fade * 0.87);
        c.lineWidth = 1;
        c.stroke();
      }
      c.restore();
    }
  }
}
