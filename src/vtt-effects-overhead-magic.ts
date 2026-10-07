import type { TokenEffect } from '../shared/vtt-effects';
import { footprintPoint, paintFootprint, type EffectFootprint } from './vtt-effect-footprint';
import { projectOverheadEffect } from './vtt-effect-projection';
import { materialSprite } from './vtt-effects-materials';
import { alpha, fract, glow, luminousStroke, star, tau, tint } from './vtt-effects-primitives';
type Random = (i: number) => number;
type Point = { x: number; y: number };
const envelope = (age: number) => Math.sin(Math.PI * age) ** 1.2;

function crystal(
  c: CanvasRenderingContext2D,
  p: Point,
  size: number,
  angle: number,
  color: string,
  opacity: number,
) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(angle);
  c.globalAlpha *= opacity;
  const tip = { x: size * 1.25, y: -size * 0.12 };
  const vertices = [
    [-size * 0.6, -size * 0.4],
    [size * 0.25, -size * 0.5],
    [tip.x, tip.y],
    [size * 0.35, size * 0.35],
    [-size * 0.5, size * 0.45],
  ];
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
    c.moveTo(-size * 0.08, -size * 0.04);
    c.lineTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.closePath();
    c.fillStyle = alpha(colors[i], 0.85);
    c.fill();
    c.strokeStyle = alpha(tint(color, 0.5, '#304463'), 0.6);
    c.lineWidth = 0.35;
    c.stroke();
  }
  c.beginPath();
  c.moveTo(-size * 0.6, -size * 0.4);
  c.lineTo(-size * 0.08, -size * 0.04);
  c.lineTo(tip.x, tip.y);
  luminousStroke(c, color, 0.65, 0.75);
  c.restore();
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
      const radius = 51 + random(i + 31) * 27;
      const p = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      crystal(c, p, 10 + random(i + 47) * 14, angle, e.color, 0.55 + Math.sin(t * 0.65 + i) * 0.08);
      c.beginPath();
      c.moveTo(p.x * 0.35, p.y * 0.35);
      c.lineTo(p.x * 0.7 - p.y * 0.04, p.y * 0.7 + p.x * 0.04);
      c.lineTo(p.x, p.y);
      luminousStroke(c, e.color, 0.6, 0.3);
    }
    c.restore();
  } else {
    paintFootprint(c, f, tint(e.color, 0.6), 0.14);
    for (let i = 0; i < count(12); i++) {
      const p = footprintPoint(f, Math.floor(random(i + 17) * f.edge.length), true);
      crystal(c, p, 3 + random(i + 21) * 7, Math.atan2(p.ny, p.nx), e.color, 0.65);
    }
    for (let i = 0; i < count(22); i++) {
      const age = fract(t * 0.24 + random(i + 70)),
        angle = random(i + 90) * tau + t * 0.08;
      const p = projectOverheadEffect(f.plane, 0.06 + age * 0.9, angle, age);
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
    materialSprite(c, e.color, 'energy', 0, 0, 218, t * 0.16, t * 0.22, 0.65);
    materialSprite(c, golden, 'energy', 0, 0, 188, -t * 0.12, t * 0.22 + 0.6, 0.22);
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
function discharge(
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
    const total = count(sparks ? 7 : 6);
    for (let i = 0; i < total; i++) {
      const phase = t * speed + i / total,
        cycle = Math.floor(phase),
        age = fract(phase);
      const strength = Math.min(1, age / 0.035) * Math.exp(-age * 10);
      flash = Math.max(flash, strength);
      if (strength < 0.015) continue;
      const seed = cycle * 197 + i * 61;
      const angle = random(seed + 105) * tau;
      const p = projectOverheadEffect(f.plane, 0.035, angle, 0);
      const q = projectOverheadEffect(
        f.plane,
        (sparks ? 0.3 : 0.55) + random(seed + 18) * 0.4,
        angle,
        0.35 + random(seed + 88) * 0.6,
      );
      c.save();
      c.globalAlpha *= strength;
      discharge(c, p, q, random, seed, e.color, sparks ? 0.85 : 1.4);
      glow(c, q.x, q.y, 6, e.color, 0.45);
      c.restore();
    }
    paintFootprint(c, f, e.color, flash * 0.08);
    glow(c, 0, 0, sparks ? 14 : 23, outer, 0.32 + flash * 0.2);
    glow(c, 0, 0, 7, e.color, 0.28 + flash * 0.32);
    for (let i = 0; i < count(15); i++) {
      const age = fract(t * 1.1 + random(i + 47)),
        angle = random(i + 51) * tau;
      const p = projectOverheadEffect(f.plane, 0.08 + age * 0.85, angle, age);
      const q = projectOverheadEffect(
        f.plane,
        0.08 + Math.max(0, age - 0.07) * 0.85,
        angle,
        Math.max(0, age - 0.07),
      );
      c.save();
      c.globalAlpha *= envelope(age) * 0.65;
      c.beginPath();
      c.moveTo(q.x, q.y);
      c.lineTo(p.x, p.y);
      luminousStroke(c, e.color, 0.7, 0.7);
      c.restore();
    }
  }
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
