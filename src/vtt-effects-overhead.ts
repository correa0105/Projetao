import type { TokenEffect } from '../shared/vtt-effects';
import { footprintPoint, paintFootprint, type EffectFootprint } from './vtt-effect-footprint';
import {
  alpha,
  bolt,
  fract,
  glow,
  luminousStroke,
  plume,
  star,
  tau,
  tint,
} from './vtt-effects-primitives';
type Random = (index: number) => number;
import { projectOverheadEffect } from './vtt-effect-projection';

function groundCircle(c: CanvasRenderingContext2D, f: EffectFootprint, color: string, t: number) {
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  glow(c, 0, 0, 105, color, 0.16);
  c.beginPath();
  c.ellipse(0, 0, 80, 80, 0, 0, tau);
  luminousStroke(c, color, 0.8, 0.6);
  c.beginPath();
  c.ellipse(0, 0, 67, 67, 0, t * 0.15, t * 0.15 + tau * 0.75);
  luminousStroke(c, color, 0.6, 0.3);
  c.restore();
}

function mist(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  t: number,
  random: Random,
  count: number,
  opacity: number,
  fire = false,
) {
  const sprite = plume(color, fire ? 'fire' : 'smoke');
  for (let i = 0; i < count; i++) {
    const age = fract(t * (fire ? 0.6 : 0.16) + random(i + 19));
    const angle = random(i + 61) * tau + Math.sin(t * 0.3 + i) * 0.3;
    const p = projectOverheadEffect(f.plane, 0.04 + age * (fire ? 0.42 : 0.66), angle, age);
    const size = (fire ? 18 + age * 24 : 23 + age * 37) * p.perspective;
    c.save();
    c.globalAlpha *= Math.sin(age * Math.PI) * opacity;
    c.translate(p.x, p.y);
    c.rotate(fire ? angle + Math.PI / 2 : i + t * 0.12);
    c.drawImage(sprite, -size / 2, -size / 2, size, size);
    c.restore();
  }
}
function particles(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  t: number,
  random: Random,
  count: number,
  stars = false,
) {
  c.fillStyle = tint(color, 0.8);
  for (let i = 0; i < count; i++) {
    const age = fract(t * (0.24 + random(i) * 0.2) + random(i + 20));
    const p = projectOverheadEffect(f.plane, 0.05 + age * 0.8, random(i + 50) * tau, age);
    const x = p.x,
      y = p.y;
    const size = (1 + random(i + 30) * 1.7) * p.perspective;
    c.save();
    c.globalAlpha *= Math.sin(age * Math.PI) * 0.85;
    if (stars) star(c, x, y, size * 1.8);
    else {
      c.beginPath();
      c.arc(x, y, size, 0, tau);
      c.fill();
    }
    c.restore();
  }
}
function ice(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const g = c.createLinearGradient(-size * 0.35, size * 0.2, size * 0.35, -size);
  g.addColorStop(0, alpha(color, 0.12));
  g.addColorStop(0.45, alpha(tint(color, 0.78), 0.78));
  g.addColorStop(1, alpha(color, 0.3));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-size * 0.3, size * 0.1);
  c.lineTo(-size * 0.22, -size * 0.5);
  c.lineTo(0, -size);
  c.lineTo(size * 0.27, -size * 0.48);
  c.lineTo(size * 0.3, size * 0.1);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(0, -size);
  c.lineTo(size * 0.1, -size * 0.35);
  c.lineTo(0, size * 0.1);
  luminousStroke(c, color, 0.7, 0.7);
  c.restore();
}
function shard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const g = c.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, tint(color, 0.4));
  g.addColorStop(1, tint(color, 0.65, '#252329'));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-size, -size * 0.5);
  c.lineTo(size * 0.15, -size);
  c.lineTo(size, -size * 0.1);
  c.lineTo(size * 0.7, size * 0.8);
  c.lineTo(-size * 0.6, size * 0.7);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(-size, -size * 0.5);
  c.lineTo(0, 0);
  c.lineTo(size, -size * 0.1);
  c.strokeStyle = alpha(tint(color, 0.6), 0.6);
  c.lineWidth = 0.7;
  c.stroke();
  c.restore();
}
function ribbons(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  t: number,
  random: Random,
  count: number,
  opacity: number,
) {
  for (let i = 0; i < Math.min(2, count); i++)
    for (let segment = 0; segment < 4; segment++) {
      c.save();
      c.globalAlpha *= opacity * (0.35 + segment * 0.17);
      c.beginPath();
      for (let k = 0; k <= 16; k++) {
        const progress = (segment + k / 16) / 4;
        const angle = progress * tau * 1.65 + t * 0.55 + i * Math.PI;
        const p = projectOverheadEffect(
          f.plane,
          0.8 + random(i + 41) * 0.08,
          angle,
          0.06 + progress * 0.84,
        );
        k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
      }
      luminousStroke(c, color, 0.7 + segment * 0.13, 0.8);
      c.restore();
    }
}
// Transparent top-down sprites have an irregular body, not a coin-shaped base.
// Surface materials follow alpha. Airborne effects rise from the token center
// along the vertical world axis, projected toward a camera directly above it.
export function drawOverheadEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  pass: 'behind' | 'front',
  detail: number,
) {
  const front = pass === 'front',
    n = (count: number) => Math.max(3, Math.round(count * detail));
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (e.kind === 'poison' || e.kind === 'shadow' || e.kind === 'fire' || e.kind === 'acid') {
    const poison = e.kind === 'poison',
      fire = e.kind === 'fire',
      acid = e.kind === 'acid';
    const color = e.kind === 'shadow' ? tint(e.color, 0.65, '#191327') : e.color;
    mist(
      c,
      f,
      front ? color : tint(color, 0.3, '#25262b'),
      t,
      random,
      n(poison ? 14 : 10),
      front ? (poison ? 0.68 : 0.6) : 0.55,
      fire,
    );
    if (front) {
      if (fire || e.kind === 'shadow') particles(c, f, color, t * (fire ? 2 : 0.7), random, n(20));
      else
        for (let i = 0; i < n(poison ? 10 : 16); i++) {
          const age = fract(t * 0.3 + random(i));
          const p = projectOverheadEffect(f.plane, 0.06 + age * 0.75, random(i + 87) * tau, age);
          const size = (1.7 + random(i + 18) * 2.5) * p.perspective;
          const x = p.x,
            y = p.y;
          c.save();
          c.globalAlpha *= Math.sin(age * Math.PI) * 0.8;
          glow(c, x, y, size * 2, color, 0.25);
          c.beginPath();
          c.arc(x, y, size, 0, tau);
          c.fillStyle = alpha(tint(color, 0.6), acid ? 0.4 : 0.08);
          c.fill();
          c.strokeStyle = alpha(tint(color, 0.5), 0.8);
          c.lineWidth = 0.7;
          c.stroke();
          c.restore();
        }
    }
  } else if (e.kind === 'frost') {
    if (!front) mist(c, f, tint(e.color, 0.25), t * 0.5, random, n(12), 0.5);
    else {
      paintFootprint(c, f, tint(e.color, 0.65), 0.17 + Math.sin(t * 0.7) * 0.025);
      for (let i = 0; i < n(14); i++) {
        const p = footprintPoint(f, Math.floor(random(i + 46) * f.edge.length), true);
        ice(c, p.x, p.y, Math.atan2(p.ny, p.nx) + Math.PI / 2, 7 + random(i + 18) * 10, e.color);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.nx * 8, p.y - p.ny * 8);
        c.lineTo(p.x - p.nx * 12 + p.ny * 4, p.y - p.ny * 12 - p.nx * 4);
        luminousStroke(c, e.color, 0.6, 0.65);
      }
      particles(c, f, e.color, t * 0.5, random, n(16), true);
    }
  } else if (e.kind === 'heal' || e.kind === 'radiant') {
    const color = e.kind === 'heal' ? e.color : tint(e.color, 0.1);
    if (!front) {
      groundCircle(c, f, color, t);
      mist(c, f, color, t * 0.65, random, n(8), 0.25);
    } else {
      c.globalCompositeOperation = 'screen';
      paintFootprint(c, f, color, 0.08 + Math.sin(t * 2) * 0.025);
      ribbons(c, f, color, t * 0.6, random, n(6), 0.6);
      particles(c, f, tint(color, 0.35, '#ffe3a2'), t * 0.8, random, n(22), true);
      for (let i = 0; i < n(5); i++) {
        const p = footprintPoint(f, i * 23);
        glow(c, p.x, p.y, 16, color, 0.12 + Math.sin(t * 2 + i) * 0.05);
      }
    }
  } else if (e.kind === 'lightning' || e.kind === 'sparks') {
    c.globalCompositeOperation = 'screen';
    const tick = Math.floor(t * (e.kind === 'lightning' ? 9 : 13));
    if (!front)
      for (let i = 0; i < n(7); i++) {
        const p = footprintPoint(f, i * 17, true);
        glow(c, p.x, p.y, 19, e.color, 0.1 + random(tick + i) * 0.2);
      }
    else {
      for (let i = 0; i < n(e.kind === 'lightning' ? 5 : 4); i++) {
        const p = projectOverheadEffect(f.plane, 0.02, 0, 0);
        const q = projectOverheadEffect(
          f.plane,
          0.35 + random(i + tick * 13) * 0.6,
          random(i + tick * 31 + 107) * tau,
          random(i + tick * 7),
        );
        c.save();
        c.globalAlpha *= 0.35 + random(tick + i * 7) * 0.65;
        bolt(c, p, q, 45, random, tick + i * 51, e.color, e.kind === 'lightning' ? 0.033 : 0.018);
        glow(c, p.x, p.y, 8, e.color, 0.45);
        c.restore();
      }
      particles(c, f, e.color, t * 2.7, random, n(16));
    }
  } else if (e.kind === 'shield') {
    if (!front) mist(c, f, e.color, t * 0.3, random, n(7), 0.2);
    else {
      paintFootprint(c, f, e.color, 0.075);
      for (let i = 0; i < n(18); i++) {
        const p = footprintPoint(f, Math.floor(random(i + 14) * f.edge.length), true);
        c.save();
        c.globalAlpha *= 0.3 + 0.2 * Math.sin(t * 1.8 + i);
        c.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * tau,
            x = p.x + Math.cos(a) * 5,
            y = p.y + Math.sin(a) * 5;
          k ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        luminousStroke(c, e.color, 0.8, 0.65);
        c.restore();
      }
    }
  } else if (e.kind === 'arcane') {
    if (!front) {
      groundCircle(c, f, e.color, t);
      mist(c, f, e.color, t * 0.5, random, n(7), 0.32);
    } else {
      ribbons(c, f, e.color, t, random, n(5), 0.55);
      for (let i = 0; i < n(10); i++) {
        const p = footprintPoint(f, Math.floor(random(i + 90) * f.edge.length), true);
        c.save();
        c.translate(p.x + p.nx * 11, p.y + p.ny * 11);
        c.rotate(t * 0.13 + i);
        c.beginPath();
        c.moveTo(-3, -5);
        c.lineTo(3, 0);
        c.lineTo(-3, 5);
        c.moveTo(0, -3);
        c.lineTo(0, 4);
        luminousStroke(c, e.color, 0.8, 0.6 + Math.sin(t + i) * 0.15);
        c.restore();
      }
    }
  } else if (e.kind === 'wind' || e.kind === 'water') {
    const water = e.kind === 'water';
    if (!front) {
      if (water) groundCircle(c, f, e.color, t);
      mist(c, f, e.color, t, random, n(7), water ? 0.3 : 0.25);
    } else {
      ribbons(c, f, e.color, t * (water ? 0.8 : 1.5), random, n(9), 0.75);
      particles(c, f, e.color, t, random, n(20));
    }
  } else if (e.kind === 'earth') {
    if (!front) mist(c, f, tint(e.color, 0.35, '#554937'), t * 0.6, random, n(10), 0.55);
    for (let i = 0; i < n(front ? 6 : 12); i++) {
      const p = footprintPoint(f, Math.floor(random(i + 52) * f.edge.length), true);
      shard(
        c,
        p.x + p.nx * 8,
        p.y + p.ny * 8,
        i + Math.sin(t + i) * 0.07,
        3 + random(i + 13) * 5,
        e.color,
      );
    }
    if (front) particles(c, f, e.color, t * 0.7, random, n(15));
  } else if (e.kind === 'vines') {
    if (!front) mist(c, f, e.color, t * 0.4, random, n(6), 0.24);
    for (let i = 0; i < n(front ? 5 : 9); i++) {
      const p = footprintPoint(f, Math.floor(random(i + 45) * f.edge.length), true);
      const length = 20 + random(i + 8) * 15,
        a = Math.atan2(p.ny, p.nx);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(a);
      c.beginPath();
      c.moveTo(-7, 0);
      c.bezierCurveTo(0, -9, length * 0.5, 9, length, Math.sin(t + i) * 3);
      c.strokeStyle = tint(e.color, 0.5, '#27321f');
      c.lineWidth = 2.3;
      c.stroke();
      c.strokeStyle = tint(e.color, 0.2);
      c.lineWidth = 0.8;
      c.stroke();
      for (let k = 0; k < 3; k++) {
        const x = (k * length) / 3,
          side = k % 2 ? -1 : 1;
        c.beginPath();
        c.moveTo(x, 0);
        c.quadraticCurveTo(x + 2, side * 9, x + 8, side * 6);
        c.quadraticCurveTo(x + 9, side * 1, x, 0);
        c.fillStyle = tint(e.color, 0.2 + k * 0.1);
        c.fill();
      }
      c.restore();
    }
  }
}
