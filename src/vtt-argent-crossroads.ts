import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, tau, tint } from './vtt-effects-primitives';

export const ARGENT_CROSSROADS_PERIOD = 8;
type Point = { x: number; y: number; z: number; width: number };
type Facet = { a: Point; b: Point; u: number; ribbon: number; z: number };
type Silver = {
  color: string;
  shade: string;
  white: string;
  edge: string;
  face: string;
  groove: string;
  polish: string;
};
const palettes = new Map<string, Silver>();
function silver(color: string): Silver {
  let p = palettes.get(color);
  if (!p) {
    p = {
      color,
      shade: tint(color, 0.81, '#090909'),
      white: tint(color, 0.93),
      edge: tint(color, 0.55),
      face: tint(color, 0.45),
      groove: tint(color, 0.55, '#353535'),
      polish: tint(color, 0.78),
    };
    if (palettes.size >= 8) palettes.delete(palettes.keys().next().value!);
    palettes.set(color, p);
  }
  return p;
}

// Four open silver streams form a woven crossroads. Their depth and curvature
// are continuous, including at the loop seam; the two passes share this shape.
export function argentRibbonPoint(ribbon: number, u: number, t: number): Point {
  const phase = (t / ARGENT_CROSSROADS_PERIOD) * tau;
  const s = u * 2 - 1,
    side = ribbon % 2 ? 1 : -1;
  const angle = (ribbon < 2 ? Math.PI / 4 : -Math.PI / 4) + Math.sin(phase + ribbon * 0.6) * 0.1;
  const bow = 1 - s * s;
  const x = s * (116 + Math.sin(phase + ribbon) * 5) + Math.sin(s * Math.PI + phase) * 9 * bow;
  const y = side * (11 + 27 * bow) + Math.sin(s * tau + phase + ribbon * 0.7) * 17 * bow;
  const z = Math.sin(s * Math.PI + phase + (ribbon * Math.PI) / 2) * 0.75;
  const perspective = 1 + z * 0.055;
  return {
    x: (x * Math.cos(angle) - y * Math.sin(angle)) * perspective,
    y: (x * Math.sin(angle) + y * Math.cos(angle)) * perspective,
    z,
    width:
      (6.2 + 1.5 * Math.sin(s * Math.PI * 2 - phase + ribbon)) *
      (0.52 + 0.48 * Math.abs(Math.sin(s * Math.PI + phase + ribbon))) *
      (0.12 + 0.88 * Math.pow(Math.max(0, Math.sin(u * Math.PI)), 0.55)) *
      perspective,
  };
}

function normal(a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}
function polygon(
  c: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  n: { x: number; y: number },
  offset = 0,
) {
  c.beginPath();
  c.moveTo(a.x + n.x * a.width + offset, a.y + n.y * a.width + offset);
  c.lineTo(b.x + n.x * b.width + offset, b.y + n.y * b.width + offset);
  c.lineTo(b.x - n.x * b.width + offset, b.y - n.y * b.width + offset);
  c.lineTo(a.x - n.x * a.width + offset, a.y - n.y * a.width + offset);
  c.closePath();
}
function paintFacet(c: CanvasRenderingContext2D, f: Facet, palette: Silver, phase: number) {
  const { color, shade, white, edge, face, groove, polish } = palette;
  const { a, b, u, ribbon } = f,
    n = normal(a, b);
  const x = (a.x + b.x) / 2,
    y = (a.y + b.y) / 2,
    w = (a.width + b.width) / 2;
  const pulse = Math.pow(0.5 + 0.5 * Math.cos(u * tau * 2 - phase * 2 + ribbon), 12);
  const light = 0.68 + 0.2 * (n.x * -0.5 + n.y * -0.8) + pulse * 0.12;
  const mid = tint(color, 1 - light, '#303030');
  // The dark bevel remains opaque enough to separate overlapping currents.
  c.fillStyle = alpha(shade, 0.48);
  polygon(c, a, b, n, 1.2);
  c.fill();
  const metal = c.createLinearGradient(x - n.x * w, y - n.y * w, x + n.x * w, y + n.y * w);
  metal.addColorStop(0, shade);
  metal.addColorStop(0.14, mid);
  metal.addColorStop(0.28, white);
  metal.addColorStop(0.39, face);
  metal.addColorStop(0.58, groove);
  metal.addColorStop(0.75, polish);
  metal.addColorStop(0.9, edge);
  metal.addColorStop(1, shade);
  c.fillStyle = metal;
  polygon(c, a, b, n);
  c.fill();
  c.strokeStyle = alpha(white, 0.68 + 0.3 * pulse);
  c.lineWidth = 0.55;
  c.beginPath();
  c.moveTo(a.x - n.x * a.width * 0.43, a.y - n.y * a.width * 0.43);
  c.lineTo(b.x - n.x * b.width * 0.43, b.y - n.y * b.width * 0.43);
  c.stroke();
}

function paintKnot(c: CanvasRenderingContext2D, p: Point, color: string, opacity: number) {
  c.save();
  c.globalAlpha *= opacity;
  c.globalCompositeOperation = 'screen';
  const radius = 12,
    halo = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  halo.addColorStop(0, alpha(tint(color, 0.9), 0.9));
  halo.addColorStop(0.2, alpha(color, 0.58));
  halo.addColorStop(1, alpha(color, 0));
  c.fillStyle = halo;
  c.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  c.translate(p.x, p.y);
  c.rotate(Math.PI / 4);
  c.fillStyle = tint(color, 0.96);
  c.beginPath();
  c.moveTo(0, -5.2);
  c.lineTo(0.6, -0.6);
  c.lineTo(5.2, 0);
  c.lineTo(0.6, 0.6);
  c.lineTo(0, 5.2);
  c.lineTo(-0.6, 0.6);
  c.lineTo(-5.2, 0);
  c.lineTo(-0.6, -0.6);
  c.closePath();
  c.fill();
  c.restore();
}

export function drawArgentCrossroads(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  pass: 'behind' | 'front',
) {
  if (e.kind !== 'argent-crossroads') return false;
  const intensity = Math.max(0, Math.min(1, e.intensity ?? 1));
  if (!intensity) return true;
  const phase = ((t / ARGENT_CROSSROADS_PERIOD) % 1) * tau;
  const facets: Facet[] = [],
    knots: { p: Point; opacity: number }[] = [];
  for (let ribbon = 0; ribbon < 4; ribbon++) {
    for (let j = 0; j < 88; j++) {
      const u = (j + 0.5) / 88,
        a = argentRibbonPoint(ribbon, Math.max(0, (j - 0.07) / 88), t);
      const b = argentRibbonPoint(ribbon, Math.min(1, (j + 1.07) / 88), t),
        z = (a.z + b.z) / 2;
      if (z >= 0 === (pass === 'front')) facets.push({ a, b, u, ribbon, z });
    }
    for (let k = 0; k < 2; k++) {
      const u = fract(
        (t / ARGENT_CROSSROADS_PERIOD) * (ribbon % 2 ? -1 : 1) + ribbon * 0.21 + k * 0.5,
      );
      const p = argentRibbonPoint(ribbon, u, t);
      if (p.z >= 0 === (pass === 'front')) knots.push({ p, opacity: Math.sin(u * Math.PI) });
    }
  }
  facets.sort((a, b) => a.z - b.z);
  c.save();
  c.scale(f.plane.rx / 66, f.plane.ry / 66);
  c.globalAlpha *= intensity;
  c.globalCompositeOperation = 'source-over';
  const palette = silver(e.color);
  c.strokeStyle = alpha(e.color, 0.08);
  c.lineWidth = 18;
  for (let ribbon = 0; ribbon < 4; ribbon++) {
    c.beginPath();
    let connected = false;
    for (let j = 0; j <= 88; j++) {
      const p = argentRibbonPoint(ribbon, j / 88, t);
      if (p.z >= 0 !== (pass === 'front')) {
        connected = false;
        continue;
      }
      if (connected) c.lineTo(p.x, p.y);
      else c.moveTo(p.x, p.y);
      connected = true;
    }
    c.stroke();
  }
  for (const facet of facets) paintFacet(c, facet, palette, phase);
  for (const knot of knots) paintKnot(c, knot.p, e.color, knot.opacity);
  c.restore();
  return true;
}
