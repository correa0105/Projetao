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
import { drawExpandedEffect } from './vtt-effects-expanded';
import { drawEffectCollection } from './vtt-effects-collection';
import { drawAdvancedEffects } from './vtt-effects-advanced';
import { effectFootprint } from './vtt-effect-footprint';
import { drawArcanaEffect } from './vtt-effects-arcana';

type Random = (i: number) => number;
function smoke(
  c: CanvasRenderingContext2D,
  color: string,
  r: number,
  t: number,
  random: Random,
  count: number,
  opacity: number,
) {
  const sprite = plume(color, 'smoke');
  for (let i = 0; i < count; i++) {
    const p = fract(t * (0.11 + random(i) * 0.09) + random(i + 20)),
      x = Math.sin(p * 4 + i) * r * (0.4 + random(i + 10) * 0.4),
      y = r * 0.65 - p * r * 1.65,
      size = r * (0.6 + p * 0.6 + random(i + 40) * 0.18);
    c.save();
    c.globalAlpha *= Math.sin(p * Math.PI) * opacity;
    c.translate(x, y);
    c.rotate(p * 1.3 + i);
    c.drawImage(sprite, -size / 2, -size / 2, size, size);
    c.restore();
  }
}
function crystals(
  c: CanvasRenderingContext2D,
  r: number,
  t: number,
  color: string,
  random: Random,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * tau,
      x = Math.cos(a) * r * 0.84,
      y = Math.sin(a) * r * 0.76,
      h = r * (0.12 + random(i + 61) * 0.16),
      w = h * 0.36;
    c.save();
    c.translate(x, y);
    c.rotate(a + Math.PI / 2);
    const g = c.createLinearGradient(-w, 0, w, -h);
    g.addColorStop(0, alpha(color, 0.15));
    g.addColorStop(0.45, alpha(tint(color, 0.65), 0.72));
    g.addColorStop(1, alpha(color, 0.3));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-w, 0);
    c.lineTo(-w * 0.6, -h * 0.55);
    c.lineTo(0, -h);
    c.lineTo(w * 0.7, -h * 0.5);
    c.lineTo(w, 0);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(0, -h);
    c.lineTo(w * 0.2, -h * 0.48);
    c.lineTo(0, 0);
    luminousStroke(c, color, r * 0.006, 0.5);
    c.restore();
  }
}
function motes(
  c: CanvasRenderingContext2D,
  r: number,
  t: number,
  random: Random,
  color: string,
  count: number,
  stars = false,
) {
  c.fillStyle = tint(color, 0.78);
  for (let i = 0; i < count; i++) {
    const p = fract(t * (0.24 + random(i) * 0.17) + random(i + 40)),
      x = (random(i + 20) - 0.5) * r * 1.5 + Math.sin(t + i) * r * 0.025,
      y = r * 0.65 - p * r * 1.85,
      size = r * (0.008 + random(i + 30) * 0.018);
    c.save();
    c.globalAlpha *= Math.sin(p * Math.PI) * 0.85;
    if (stars) star(c, x, y, size * 1.5);
    else {
      c.beginPath();
      c.ellipse(x, y, size * 0.55, size * 1.2, 0.2, 0, tau);
      c.fill();
    }
    c.restore();
  }
}
export function drawEffectLayer(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  r: number,
  t: number,
  random: Random,
  pass: 'behind' | 'front',
  detail = 1,
) {
  const front = pass === 'front',
    n = (count: number) => Math.max(3, Math.round(count * detail));
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (drawArcanaEffect(c, e, effectFootprint(160, 160, r, r), t, random, front, detail)) return;
  if (drawAdvancedEffects(c, e, effectFootprint(160, 160, 100, 100), t, random, pass, detail))
    return;
  if (drawEffectCollection(c, e, effectFootprint(160, 160, 100, 100), t, random, pass, detail))
    return;
  if (e.kind === 'fire') {
    if (!front) {
      glow(c, 0, r * 0.42, r * 1.2, e.color, 0.24);
      smoke(c, tint(e.color, 0.72, '#181724'), r, t, random, n(6), 0.35);
      c.save();
      c.scale(1, 0.28);
      glow(c, 0, r * 1.7, r * 0.92, e.color, 0.55);
      c.restore();
    } else {
      const sprite = plume(e.color, 'fire');
      for (let i = 0; i < n(20); i++) {
        const p = fract(t * (0.4 + random(i) * 0.25) + random(i + 30)),
          x = (random(i + 18) - 0.5) * r * 1.3 + Math.sin(t * 2 + i) * r * 0.075,
          y = r * 0.73 - p * r * 0.8,
          w = r * (0.25 + random(i + 75) * 0.22),
          h = r * (0.65 + random(i + 40) * 0.68);
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI) * 0.83;
        c.translate(x, y);
        c.rotate(Math.sin(t * 1.3 + i) * 0.16);
        c.drawImage(sprite, -w / 2, -h, w, h);
        c.restore();
      }
      c.globalCompositeOperation = 'screen';
      glow(c, 0, r * 0.51, r * 0.65, e.color, 0.23);
      motes(c, r, t * 1.8, random, e.color, n(24));
    }
  } else if (e.kind === 'frost') {
    if (!front) {
      glow(c, 0, r * 0.4, r * 1.2, e.color, 0.19);
      smoke(c, tint(e.color, 0.42), r, t * 0.45, random, n(7), 0.26);
      crystals(c, r, t, e.color, random, n(12));
    } else {
      c.save();
      c.beginPath();
      c.ellipse(0, 0, r * 0.75, r * 0.75, 0, 0, tau);
      c.clip();
      const g = c.createLinearGradient(-r, r, r, -r);
      g.addColorStop(0, alpha(e.color, 0.3));
      g.addColorStop(0.45, alpha(tint(e.color, 0.8), 0.035));
      g.addColorStop(1, alpha(e.color, 0.18));
      c.fillStyle = g;
      c.fillRect(-r, -r, r * 2, r * 2);
      for (let i = 0; i < n(12); i++) {
        const a = random(i) * tau;
        let x = Math.cos(a) * r * 0.77,
          y = Math.sin(a) * r * 0.77;
        c.beginPath();
        c.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x = x * 0.68 + (random(i + k * 31) - 0.5) * r * 0.12;
          y = y * 0.68 + (random(i + k * 23) - 0.5) * r * 0.12;
          c.lineTo(x, y);
          c.lineTo(x + Math.cos(a + 0.9) * r * 0.12, y + Math.sin(a + 0.9) * r * 0.12);
          c.moveTo(x, y);
        }
        luminousStroke(c, e.color, r * 0.005, 0.55);
      }
      c.restore();
      c.fillStyle = '#eefaff';
      for (let i = 0; i < n(16); i++) {
        const p = fract(t * 0.13 + random(i)),
          a = random(i + 15) * tau,
          x = Math.cos(a) * r * (0.55 + random(i + 42) * 0.45),
          y = -r * 0.95 + p * r * 1.8;
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI) * 0.7;
        star(c, x, y, r * (0.012 + random(i + 28) * 0.022));
        c.restore();
      }
    }
  } else if (e.kind === 'poison') {
    if (!front) {
      glow(c, 0, r * 0.52, r * 1.2, e.color, 0.22);
      smoke(c, tint(e.color, 0.4, '#25301d'), r, t, random, n(10), 0.6);
    } else {
      smoke(c, e.color, r, t, random, n(10), 0.62);
      for (let i = 0; i < n(9); i++) {
        const p = fract(t * (0.19 + random(i) * 0.1) + random(i + 13)),
          x = (random(i + 43) - 0.5) * r * 1.55,
          y = r * 0.68 - p * r * 1.65,
          size = r * (0.025 + random(i + 32) * 0.03);
        c.save();
        c.globalAlpha *= Math.sin(p * Math.PI);
        const g = c.createRadialGradient(x - size * 0.3, y - size * 0.4, 0, x, y, size);
        g.addColorStop(0, alpha(tint(e.color, 0.8), 0.55));
        g.addColorStop(0.55, alpha(e.color, 0.12));
        g.addColorStop(1, alpha(e.color, 0.02));
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, size, 0, tau);
        c.fill();
        c.strokeStyle = alpha(tint(e.color, 0.4), 0.65);
        c.lineWidth = r * 0.008;
        c.stroke();
        c.beginPath();
        c.arc(x - size * 0.15, y - size * 0.15, size * 0.6, Math.PI, Math.PI * 1.55);
        c.stroke();
        c.restore();
      }
    }
  } else if (e.kind === 'heal') {
    if (!front) {
      floorRing(c, r, e.color, t);
      c.save();
      c.translate(0, r * 0.6);
      c.scale(1, 0.26);
      c.rotate(t * 0.14);
      for (let i = 0; i < 12; i++) {
        c.save();
        c.rotate((i * tau) / 12);
        c.beginPath();
        c.moveTo(r * 0.8, -r * 0.035);
        c.lineTo(r * 0.9, 0);
        c.lineTo(r * 0.8, r * 0.035);
        luminousStroke(c, e.color, r * 0.008, 0.5);
        c.restore();
      }
      c.restore();
      glow(c, 0, r * 0.3, r, e.color, 0.13);
    } else {
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        let joined = false;
        for (let k = 0; k <= 64; k++) {
          const p = k / 64,
            a = p * tau * 1.15 + t * 0.85 + (i * tau) / 3,
            x = Math.cos(a) * r * 0.65,
            y = r * 0.67 - p * r * 1.48;
          if (Math.sin(a) < -0.1) {
            joined = false;
            continue;
          }
          if (joined) c.lineTo(x, y);
          else c.moveTo(x, y);
          joined = true;
        }
        luminousStroke(c, e.color, r * 0.011, 0.8);
      }
      motes(c, r, t, random, tint(e.color, 0.55, '#ffe6a8'), n(20), true);
    }
  } else if (e.kind === 'sparks') {
    c.globalCompositeOperation = 'screen';
    const tick = Math.floor(t * 9);
    if (!front) {
      glow(c, 0, 0, r, e.color, 0.11);
      for (let arc = 0; arc < 3; arc++) {
        c.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * tau * 0.56 + (arc * tau) / 3 + t * 0.35,
            rr = r * (0.9 + (random(i + tick * 41 + arc) - 0.5) * 0.22),
            x = Math.cos(a) * rr,
            y = Math.sin(a) * rr;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        luminousStroke(c, e.color, r * 0.009, 0.7);
      }
    } else {
      for (let i = 0; i < n(4); i++) {
        const a = random(i + (tick % 19)) * tau,
          spread = r * (0.48 + random(i + 60) * 0.24);
        c.save();
        c.globalAlpha *= 0.45 + random(tick + i) * 0.5;
        bolt(
          c,
          { x: Math.cos(a) * spread, y: Math.sin(a) * spread },
          { x: -Math.cos(a + 0.4) * spread, y: -Math.sin(a + 0.4) * spread },
          r,
          random,
          tick + i * 51,
          e.color,
          0.011,
        );
        c.restore();
      }
      for (let i = 0; i < n(18); i++) {
        const p = fract(t * 0.8 + random(i + 8)),
          a = random(i + 24) * tau,
          rr = r * (0.5 + p * 0.65),
          x = Math.cos(a) * rr,
          y = Math.sin(a) * rr;
        c.save();
        c.globalAlpha *= 1 - p;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * r * 0.065, y + Math.sin(a) * r * 0.065);
        luminousStroke(c, e.color, r * 0.007, 0.8);
        c.restore();
      }
    }
  } else drawExpandedEffect(c, e, r, t, random, pass, detail);
}
