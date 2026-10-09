import type { TokenEffect } from '../shared/vtt-effects';
import { footprintPoint, paintFootprint, type EffectFootprint } from './vtt-effect-footprint';
import { projectOverheadEffect } from './vtt-effect-projection';
import { materialSprite } from './vtt-effects-materials';
import { alpha, fract, glow, luminousStroke, star, tau, tint } from './vtt-effects-primitives';
type Random = (i: number) => number;
type Point = { x: number; y: number };
const envelope = (age: number) => Math.sin(Math.PI * age) ** 1.2;

// Broad prism walls retain width until the short pointed cap.
export function crystalOutline(size: number, length?: number) {
  if (length !== undefined)
    return [
      [0, -0.38 * size],
      [length - Math.min(length * 0.24, size * 0.43), -0.38 * size],
      [length, 0],
      [length - Math.min(length * 0.24, size * 0.43), 0.38 * size],
      [0, 0.38 * size],
    ];
  return [
    [-0.65 * size, -0.38 * size],
    [0.72 * size, -0.38 * size],
    [1.15 * size, 0],
    [0.72 * size, 0.38 * size],
    [-0.65 * size, 0.38 * size],
  ];
}
function crystal(
  c: CanvasRenderingContext2D,
  p: Point,
  size: number,
  angle: number,
  color: string,
  opacity: number,
  length?: number,
) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(angle);
  c.globalAlpha *= opacity;
  const vertices = crystalOutline(size, length),
    tip = { x: vertices[2][0], y: vertices[2][1] },
    ridge = { x: length === undefined ? -size * 0.08 : length * 0.38, y: -size * 0.04 };
  // A filled body under every facet keeps the base/cap visible at any size.
  c.beginPath();
  vertices.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = alpha(tint(color, 0.2, '#477c97'), 0.85);
  c.fill();
  const colors = [
    tint(color, 0.3, '#334e71'),
    tint(color, 0.55),
    tint(color, 0.8),
    tint(color, 0.15),
    tint(color, 0.25, '#334e71'),
  ];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    c.beginPath();
    c.moveTo(ridge.x, ridge.y);
    c.lineTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.closePath();
    c.fillStyle = alpha(colors[i], 0.85);
    c.fill();
    c.strokeStyle = alpha(tint(color, 0.5, '#304463'), 0.6);
    c.lineWidth = size * 0.035;
    c.stroke();
  }
  c.beginPath();
  c.moveTo(vertices[0][0], vertices[0][1]);
  c.lineTo(ridge.x, ridge.y);
  c.lineTo(tip.x, tip.y);
  luminousStroke(c, color, size * 0.055, 0.75);
  c.restore();
}

// Frost rises from the ground beneath the body's center. Weapon silhouettes
// never determine its origin. Cancel scale at the base, grow only the prism.
function frostBase(_f: EffectFootprint, angle: number, scale: number) {
  const radius = 18 / scale;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function frost(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  front: boolean,
  count: (n: number) => number,
) {
  if (!front) {
    c.save();
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    materialSprite(c, e.color, 'vapor', 0, 0, 230, t * 0.035, t * 0.25, 0.75);
    glow(c, 0, 0, 96, e.color, 0.13);
    for (let i = 0; i < count(19); i++) {
      const angle = (i / count(19)) * tau + random(i) * 0.16;
      const p = frostBase(f, angle, e.scale),
        size = 10 + random(i + 47) * 14,
        length = size * 1.8 + Math.max(0, 1 - 1 / e.scale) * 45;
      crystal(c, p, size, angle, e.color, 0.78 + Math.sin(t * 0.65 + i) * 0.04, length);
      if (i % 3 === 0)
        crystal(c, p, 8 + random(i + 211) * 8, angle - 0.12, e.color, 0.7, length * 0.65);
    }
    c.restore();
  } else {
    paintFootprint(c, f, tint(e.color, 0.6), 0.06);
    c.save();
    // Cancel token aspect stretching: aerial crystals use uniform map units.
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    for (let i = 0; i < count(12); i++) {
      const p = footprintPoint(f, Math.floor(random(i + 188) * f.edge.length), true);
      const angle = Math.atan2(p.ny, p.nx);
      crystal(
        c,
        {
          x: (p.x * 80) / f.plane.rx + (p.nx * 7) / e.scale,
          y: (p.y * 80) / f.plane.ry + (p.ny * 7) / e.scale,
        },
        (2 + random(i + 21) * 2.5) / e.scale,
        angle,
        e.color,
        0.68,
        (6 + random(i + 12) * 4) / e.scale,
      );
    }
    for (let i = 0; i < count(22); i++) {
      const age = fract(t * 0.24 + random(i + 70)),
        angle = random(i + 90) * tau + t * 0.08;
      const p = projectOverheadEffect({ rx: 80, ry: 80 }, 1.08 + age * 0.32, angle, age * 0.15);
      c.save();
      c.globalAlpha *= envelope(age) * 0.75;
      if (i % 3 === 0)
        crystal(c, p, (1 + random(i + 52) * 2) * p.perspective, angle + t * 0.4, e.color, 0.8);
      else {
        c.fillStyle = alpha(tint(e.color, 0.75), 0.8);
        star(c, p.x, p.y, (0.7 + random(i) * 1.4) * p.perspective);
      }
      c.restore();
    }
    materialSprite(c, tint(e.color, 0.35), 'vapor', 0, 0, 70, t * 0.07, t * 0.4, 0.16);
    c.restore();
  }
}

// Quad strips carry width, color and height, rather than uniform wire circles.
// Each strand shares the floor's center; z increases apparent radius toward camera.
export function energySpiral(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  t: number,
  golden: string,
  strands = 3,
  steps = 40,
) {
  for (let strand = 0; strand < strands; strand++) {
    const points = [];
    for (let k = 0; k <= steps; k++) {
      const u = k / steps,
        angle = u * tau * 1.18 + t * 0.52 + (strand * tau) / strands;
      points.push(
        projectOverheadEffect(
          f.plane,
          0.69 + Math.sin(angle * 2 + strand) * 0.105 + Math.sin(u * Math.PI) * 0.06,
          angle,
          0.08 + u * 0.85,
        ),
      );
    }
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) / steps,
        a = points[k],
        b = points[k + 1],
        angle = Math.atan2(b.y - a.y, b.x - a.x);
      const width = (1.3 + Math.sin(u * Math.PI) * 4.8) * (strand === 2 ? 0.55 : 1);
      const nx = Math.sin(angle) * width,
        ny = -Math.cos(angle) * width;
      const opacity = envelope(u) * (0.4 + 0.12 * Math.sin(t * 1.2 + k * 0.23));
      c.beginPath();
      c.moveTo(a.x - nx, a.y - ny);
      c.lineTo(b.x - nx, b.y - ny);
      c.lineTo(b.x + nx, b.y + ny);
      c.lineTo(a.x + nx, a.y + ny);
      c.closePath();
      const gradient = c.createLinearGradient(a.x - nx, a.y - ny, a.x + nx, a.y + ny);
      const local = strand === 1 ? golden : color;
      gradient.addColorStop(0, alpha(local, 0));
      gradient.addColorStop(0.5, alpha(tint(local, 0.45), opacity));
      gradient.addColorStop(1, alpha(local, 0));
      c.fillStyle = gradient;
      c.fill();
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      luminousStroke(c, local, 0.45, opacity * 0.8);
    }
  }
}

function healing(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  front: boolean,
  count: (n: number) => number,
) {
  const golden = tint(e.color, e.kind === 'heal' ? 0.62 : 0.16, '#ffd37b');
  if (!front) {
    c.save();
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    // Keep the flowing light inside the centered ground ring. The wisps above
    // it are free to drift, while the footprint stays round at every token size.
    c.save();
    c.beginPath();
    c.arc(0, 0, 80, 0, tau);
    c.clip();
    materialSprite(c, e.color, 'energy', 0, 0, 218, t * 0.16, t * 0.22, 0.65);
    materialSprite(c, golden, 'energy', 0, 0, 188, -t * 0.12, t * 0.22 + 0.6, 0.22);
    c.restore();
    glow(c, 0, 0, 106, e.color, 0.18);
    c.beginPath();
    c.arc(0, 0, 80, 0, tau);
    luminousStroke(c, e.color, 0.7, 0.42);
    for (let i = 0; i < 3; i++) {
      const age = fract(t * 0.28 + i / 3),
        r = 25 + age * 57;
      c.beginPath();
      c.arc(0, 0, r, 0, tau);
      luminousStroke(c, golden, 0.55, envelope(age) * 0.3);
    }
    c.restore();
  } else {
    c.globalCompositeOperation = 'screen';
    paintFootprint(c, f, e.color, 0.065 + Math.sin(t * 1.4) * 0.025);
    energySpiral(c, f, e.color, t, golden);
    materialSprite(c, e.color, 'energy', 0, 0, 102, t * 0.12, t * 0.22, 0.25);
    for (let i = 0; i < count(28); i++) {
      const age = fract(t * (0.16 + random(i) * 0.1) + random(i + 20)),
        angle = random(i + 50) * tau + t * 0.17;
      const p = projectOverheadEffect(f.plane, 0.07 + age * 0.78, angle, age);
      const q = projectOverheadEffect(
        f.plane,
        0.07 + Math.max(0, age - 0.055) * 0.78,
        angle - 0.1,
        Math.max(0, age - 0.055),
      );
      c.save();
      c.globalAlpha *= envelope(age) * (0.4 + random(i + 30) * 0.4);
      c.beginPath();
      c.moveTo(q.x, q.y);
      c.lineTo(p.x, p.y);
      luminousStroke(c, i % 3 ? e.color : golden, 0.7, 0.5);
      c.fillStyle = tint(i % 3 ? e.color : golden, 0.65);
      const size = (0.5 + random(i + 13) * 1.3) * p.perspective;
      star(c, p.x, p.y, size * 2);
      if (i % 4 === 0) glow(c, p.x, p.y, size * 6, golden, 0.2);
      c.restore();
    }
    glow(c, 0, 0, 13, e.color, 0.18 + 0.07 * Math.sin(t * 1.8));
  }
}

// One reproducible bolt per discharge, with a quick strike and decaying afterglow.
// Its geometry stays stable during that discharge instead of jittering every frame.
export function discharge(
  c: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  random: Random,
  seed: number,
  color: string,
  width: number,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1,
    nx = -dy / length,
    ny = dx / length;
  const points = [];
  for (let k = 0; k <= 13; k++) {
    const u = k / 13,
      offset = (random(seed + k) - 0.5) * length * 0.34 * Math.sin(u * Math.PI);
    points.push({ x: a.x + dx * u + nx * offset, y: a.y + dy * u + ny * offset });
  }
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  luminousStroke(c, color, width, 0.95);
  for (let k = 3; k < 11; k += 3) {
    const p = points[k],
      side = random(seed + k + 70) > 0.5 ? 1 : -1;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(
      p.x + dx * 0.08 + nx * length * 0.14 * side,
      p.y + dy * 0.08 + ny * length * 0.14 * side,
    );
    c.lineTo(
      p.x + dx * 0.2 + nx * length * 0.23 * side,
      p.y + dy * 0.2 + ny * length * 0.23 * side,
    );
    luminousStroke(c, color, width * 0.45, 0.6);
  }
}
function electricity(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  front: boolean,
  count: (n: number) => number,
) {
  const sparks = e.kind === 'sparks',
    speed = sparks ? 2.3 : 1.4,
    outer = tint(e.color, 0.2, '#5641eb');
  c.globalCompositeOperation = 'screen';
  if (!front) {
    c.save();
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    materialSprite(c, outer, 'energy', 0, 0, 204, -t * 0.12, t * 0.3, sparks ? 0.2 : 0.35);
    glow(c, 0, 0, 95, outer, 0.13);
    c.restore();
  } else {
    let flash = 0;
    for (const { p, q, seed, strength } of electricBursts(
      f,
      t * speed,
      random,
      sparks,
      count(9) / 9,
    )) {
      flash = Math.max(flash, strength);
      c.save();
      c.globalAlpha *= strength;
      discharge(c, p, q, random, seed, e.color, sparks ? 0.85 : 1.4);
      glow(c, p.x, p.y, sparks ? 8 : 13, e.color, 0.4);
      glow(c, q.x, q.y, 6, e.color, 0.45);
      c.restore();
    }
    paintFootprint(c, f, e.color, flash * 0.08);
  }
}
// Three distributed sources, each with simultaneous stable branches.
export function electricBursts(
  f: EffectFootprint,
  phase: number,
  random: Random,
  sparks: boolean,
  detail = 1,
) {
  const result = [];
  for (let emitter = 0; emitter < 3; emitter++) {
    const cycle = Math.floor(phase + emitter / 3),
      age = fract(phase + emitter / 3);
    const seed = cycle * 197 + emitter * 911;
    const angle = (emitter / 3) * tau + (random(seed + 105) - 0.5) * 0.8;
    const p = projectOverheadEffect(f.plane, 0.3 + random(seed + 18) * 0.3, angle, 0.1);
    const strength = 0.2 + Math.exp(-age * 5) * 0.8;
    for (let branch = 0; branch < (detail < 0.8 ? 2 : 3); branch++) {
      const a = angle + (branch - 1) * 0.75 + (random(seed + branch + 41) - 0.5) * 0.45;
      const end = projectOverheadEffect(
        f.plane,
        sparks ? 0.28 : 0.52,
        a,
        0.5 + random(seed + branch + 88) * 0.4,
      );
      result.push({ p, q: { x: p.x + end.x, y: p.y + end.y }, seed: seed + branch * 61, strength });
    }
  }
  return result;
}
export function drawOverheadMagic(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  pass: 'front' | 'behind',
  detail: number,
) {
  const count = (n: number) => Math.max(3, Math.round(n * detail)),
    front = pass === 'front';
  if (e.kind === 'frost') frost(c, e, f, t, random, front, count);
  else if (e.kind === 'heal' || e.kind === 'radiant') healing(c, e, f, t, random, front, count);
  else if (e.kind === 'lightning' || e.kind === 'sparks')
    electricity(c, e, f, t, random, front, count);
  else return false;
  return true;
}
