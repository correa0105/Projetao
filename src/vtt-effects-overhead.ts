import type { TokenEffect } from '../shared/vtt-effects';
import { footprintPoint, paintFootprint, type EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, glow, luminousStroke, star, tau, tint } from './vtt-effects-primitives';
type Random = (index: number) => number;
import { projectOverheadEffect } from './vtt-effect-projection';
import { materialSprite } from './vtt-effects-materials';
import { drawOverheadMagic, energySpiral } from './vtt-effects-overhead-magic';
import { drawEffectCollection } from './vtt-effects-collection';
import { drawAdvancedEffects } from './vtt-effects-advanced';
import { naturalEarth } from './vtt-effects-physical';
import { drawCinematicTokenEffect } from './vtt-effects-continuous';
import { drawOrganicEffect } from './vtt-effects-organic';
import { drawRebuiltEffect } from './vtt-effects-rebuilt';
import { drawElementalEffect } from './vtt-effects-elemental';
import { drawArcanaEffect } from './vtt-effects-arcana';
import { drawLivingEffect } from './vtt-effects-living';
import { drawArcaneBarrier } from './vtt-arcane-barrier';
import { drawFireHeat } from './vtt-fire-heat';
import { drawFlySwarm } from './vtt-fly-swarm';
import { drawRefinedArcana } from './vtt-arcana-refined';

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
  for (let i = 0; i < count; i++) {
    const age = fract(t * (fire ? 0.6 : 0.16) + random(i + 19));
    const angle = random(i + 61) * tau + Math.sin(t * 0.3 + i) * 0.3;
    const p = projectOverheadEffect(f.plane, 0.04 + age * (fire ? 0.42 : 0.66), angle, age);
    const size = (fire ? 18 + age * 24 : 23 + age * 37) * p.perspective;
    c.save();
    c.globalAlpha *= Math.sin(age * Math.PI) * opacity;
    c.translate(p.x, p.y);
    c.rotate(fire ? angle + Math.PI / 2 : i + t * 0.12);
    if (fire) c.globalCompositeOperation = 'screen';
    materialSprite(c, color, fire ? 'flame' : 'vapor', 0, 0, size * 1.3, 0, t * 0.35 + i * 0.7, 1);
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
      // Small, irregular embers/debris, without floating solid discs.
      c.beginPath();
      c.moveTo(x - size, y);
      c.lineTo(x + size * 0.3, y - size * 0.5);
      c.lineTo(x + size, y + size * 0.4);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
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
function flowField(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  t: number,
  opacity: number,
) {
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  materialSprite(c, color, 'energy', 0, 0, 230, t * 0.1, t * 0.22, opacity);
  c.restore();
}
function ribbons(
  c: CanvasRenderingContext2D,
  f: EffectFootprint,
  color: string,
  t: number,
  count: number,
  opacity: number,
) {
  c.save();
  c.globalAlpha *= opacity;
  energySpiral(c, f, color, t, tint(color, 0.2), 2, count < 5 ? 24 : 32);
  c.restore();
}
// Transparent top-down sprites have an irregular body, not a coin-shaped base.
// Surface materials follow alpha. Airborne effects rise from the token center
// along the vertical world axis, projected toward a camera directly above it.
function drawOverheadBase(
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
  if (drawArcaneBarrier(c, e, f, t, pass)) return;
  if (e.kind === 'swarm') {
    drawFlySwarm(c, f, t, random, front, detail, e.color);
    return;
  }
  if (drawRefinedArcana(c, e, f, t, random, front)) return;
  if (drawArcanaEffect(c, e, f, t, random, front, detail)) return;
  if (drawLivingEffect(c, e, f, t, random, front, detail)) return;
  if (drawElementalEffect(c, e, f, t, random, front, detail)) return;
  if (drawRebuiltEffect(c, e, f, t, random, front, detail)) return;
  if (drawOrganicEffect(c, e, f, t, random, front, detail)) return;
  if (drawCinematicTokenEffect(c, e, f, t, random, front, detail)) return;
  if (drawAdvancedEffects(c, e, f, t, random, pass, detail)) return;
  if (drawEffectCollection(c, e, f, t, random, pass, detail)) return;
  if (drawOverheadMagic(c, e, f, t, random, pass, detail)) return;
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
      // Poison and acid keep their textured volume, without rising bubbles.
    }
  } else if (e.kind === 'shield') {
    if (!front) flowField(c, f, e.color, t * 0.3, 0.38);
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
      flowField(c, f, e.color, t * 0.5, 0.42);
    } else {
      ribbons(c, f, e.color, t, n(5), 0.55);
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
      flowField(c, f, e.color, t, water ? 0.5 : 0.32);
    } else {
      ribbons(c, f, e.color, t * (water ? 0.8 : 1.5), n(9), 0.75);
      particles(c, f, e.color, t, random, n(20));
    }
  } else if (e.kind === 'earth') {
    naturalEarth(c, e, f, t, random, front);
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

export function drawOverheadEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  pass: 'behind' | 'front',
  detail: number,
) {
  drawOverheadBase(c, e, f, t, random, pass, detail);
  drawFireHeat(c, e, f, t, random, pass, detail);
}
