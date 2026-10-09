import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { materialSprite } from './vtt-effects-materials';
import { alpha, fract, glow, luminousStroke, star, tau, tint } from './vtt-effects-primitives';
import { discharge } from './vtt-effects-overhead-magic';
import { curseFlow, physicalProp } from './vtt-effects-physical';
import { drawLavaFissures } from './vtt-lava-fissures';

type Random = (index: number) => number;
const models = new Set([
  'portal',
  'teleport',
  'shockwave',
  'explosion',
  'vortex',
  'smoke',
  'blizzard',
  'embers',
  'chain-lightning',
  'lava',
  'runes',
  'curse',
  'bless',
  'necrotic',
  'web',
  'swarm',
  'leaves',
  'petals',
  'blades',
  'sonic',
]);
const polar = (r: number, a: number) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
const envelope = (age: number) => Math.sin(age * Math.PI);
function ring(
  c: CanvasRenderingContext2D,
  r: number,
  color: string,
  width: number,
  opacity: number,
  t: number,
  irregular = 0,
) {
  c.beginPath();
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * tau,
      radius = r + irregular * (Math.sin(a * 7 + t * 1.7) + Math.sin(a * 13 - t) * 0.35);
    const p = polar(radius, a);
    k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
  }
  luminousStroke(c, color, width, opacity);
}
function streak(
  c: CanvasRenderingContext2D,
  a: number,
  r: number,
  age: number,
  color: string,
  width = 1,
) {
  const p = polar(r, a),
    q = polar(r - 8 - age * 12, a + 0.04);
  c.beginPath();
  c.moveTo(q.x, q.y);
  c.lineTo(p.x, p.y);
  luminousStroke(c, color, width, envelope(age) * 0.8);
}
function glyph(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  color: string,
  variant: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  c.moveTo(-3, -5);
  c.lineTo(3, 0);
  c.lineTo(-3, 5);
  c.moveTo(0, -5);
  c.lineTo(0, 5);
  if (variant % 2) {
    c.moveTo(-4, 2);
    c.lineTo(4, 2);
  } else {
    c.moveTo(-4, -3);
    c.lineTo(3, -3);
  }
  luminousStroke(c, color, 0.7, 0.7);
  c.restore();
}
function vapor(
  c: CanvasRenderingContext2D,
  t: number,
  random: Random,
  count: number,
  opacity: number,
  expand = false,
) {
  // Neutral shared density atlas avoids a separate texture bake per new model.
  for (let i = 0; i < count; i++) {
    const age = fract(t * 0.18 + random(i + 9)),
      p = polar(expand ? 25 + age * 70 : 35 + random(i + 14) * 28, random(i + 32) * tau + t * 0.05);
    materialSprite(
      c,
      '#b6c8d3',
      'vapor',
      p.x,
      p.y,
      42 + age * 58,
      i + t * 0.08,
      t * 0.3 + i,
      envelope(age) * opacity,
    );
  }
}
function fragment(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  size: number,
  color: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  c.moveTo(-size, -size * 0.25);
  c.lineTo(size * 0.7, -size * 0.5);
  c.lineTo(size, 0);
  c.lineTo(-size * 0.3, size * 0.4);
  c.closePath();
  c.fillStyle = alpha(tint(color, 0.5), 0.8);
  c.fill();
  c.restore();
}

// Every new model has its own geometry and motion. Both layers share an
// isotropic map plane; height approaches the overhead camera without a foot offset.
export function drawEffectCollection(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: Random,
  pass: 'behind' | 'front',
  detail: number,
) {
  if (!models.has(e.kind)) return false;
  c.save();
  try {
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    const front = pass === 'front',
      n = (x: number) => Math.max(3, Math.round(x * detail)),
      color = e.color;
    if (e.kind === 'portal') {
      if (!front) {
        const g = c.createRadialGradient(0, 0, 14, 0, 0, 88);
        g.addColorStop(0, '#080c1ac9');
        g.addColorStop(0.75, alpha(tint(color, 0.8, '#0c1026'), 0.75));
        g.addColorStop(1, alpha(color, 0));
        c.fillStyle = g;
        c.fillRect(-88, -88, 176, 176);
        ring(c, 75, color, 3, 0.9, t, 3);
      } else {
        for (let i = 0; i < n(14); i++) {
          const a = (i / 14) * tau + t * 0.5;
          c.beginPath();
          c.arc(0, 0, 77 + Math.sin(i + t) * 3, a, a + 0.17);
          luminousStroke(c, color, 2.1, 0.8);
          streak(c, a, 90, fract(t * 0.3 + i / 14), color, 0.65);
        }
      }
    } else if (e.kind === 'teleport') {
      if (!front) {
        ring(c, 65 + Math.sin(t * 3) * 6, color, 1.2, 0.7, t);
        ring(c, 83, color, 0.6, 0.4, t);
      } else
        for (let i = 0; i < n(30); i++) {
          const age = fract(t * 0.6 + random(i)),
            a = random(i + 47) * tau,
            p = polar(100 * (1 - age) + 8, a + t * 0.15);
          c.save();
          c.globalAlpha *= envelope(age);
          fragment(c, p.x, p.y, a + t, 2 + age * 2, color);
          streak(c, a, 100 * (1 - age) + 8, age, color, 0.6);
          c.restore();
        }
    } else if (e.kind === 'shockwave' || e.kind === 'explosion') {
      const fire = e.kind === 'explosion';
      if (!front) {
        if (fire) materialSprite(c, '#ed7836', 'flame', 0, 0, 180, t * 0.2, t * 0.7, 0.65);
        else vapor(c, t, random, n(6), 0.25, true);
        for (let i = 0; i < 3; i++) {
          const age = fract(t * (fire ? 0.7 : 0.45) + i / 3);
          ring(c, 12 + age * 98, color, 2 + (1 - age) * 5, (1 - age) * 0.55, t, fire ? 4 : 2);
        }
      } else {
        glow(c, 0, 0, fire ? 42 : 27, color, fire ? 0.4 : 0.14);
        for (let i = 0; i < n(fire ? 25 : 14); i++) {
          const age = fract(t * 0.8 + random(i)),
            a = random(i + 42) * tau,
            p = polar(15 + age * 98, a);
          c.save();
          c.globalAlpha *= envelope(age) * (1 - age);
          if (fire) fragment(c, p.x, p.y, a + t, 2 + random(i + 7) * 3, color);
          else streak(c, a, 15 + age * 98, age, color, 0.8);
          c.restore();
        }
      }
    } else if (e.kind === 'vortex') {
      if (!front) vapor(c, t * 1.4, random, n(8), 0.27);
      for (let i = 0; i < n(front ? 5 : 7); i++) {
        c.beginPath();
        for (let k = 0; k <= 58; k++) {
          const u = k / 58,
            a = (i / 7) * tau + t * 1.2 + u * tau * 1.7,
            p = polar(10 + u * 90, a);
          k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
        }
        luminousStroke(c, color, front ? 1.25 : 3, front ? 0.55 : 0.2);
      }
    } else if (e.kind === 'smoke') {
      vapor(c, t, random, n(front ? 9 : 12), front ? 0.65 : 0.7, true);
      glow(c, 0, 0, 110, color, front ? 0.04 : 0.13);
    } else if (e.kind === 'blizzard') {
      if (!front) vapor(c, t * 1.7, random, n(7), 0.35);
      else
        for (let i = 0; i < n(36); i++) {
          const age = fract(t * 0.32 + random(i)),
            a = random(i + 6) * tau + t * 0.16,
            p = polar(12 + age * 105, a),
            size = 1.2 + random(i + 78) * 2.8;
          c.save();
          c.globalAlpha *= envelope(age) * 0.7;
          c.translate(p.x, p.y);
          c.rotate(a + t * 0.4);
          c.beginPath();
          for (let k = 0; k < 3; k++) {
            const q = polar(size, (k / 3) * Math.PI);
            c.moveTo(-q.x, -q.y);
            c.lineTo(q.x, q.y);
          }
          luminousStroke(c, color, 0.35, 0.8);
          c.restore();
        }
    } else if (e.kind === 'embers') {
      if (!front) {
        glow(c, 0, 0, 90, color, 0.16);
        materialSprite(c, '#ed7836', 'flame', 0, 0, 135, t * 0.15, t * 0.4, 0.2);
      } else
        for (let i = 0; i < n(28); i++) {
          const age = fract(t * 0.55 + random(i)),
            a = random(i + 67) * tau,
            p = polar(20 + age * 83, a + Math.sin(t + i) * 0.12);
          c.save();
          c.globalAlpha *= envelope(age);
          fragment(c, p.x, p.y, a + t, 1 + random(i + 51) * 2, color);
          streak(c, a, 20 + age * 83, age, color, 0.4);
          c.restore();
        }
    } else if (e.kind === 'chain-lightning') {
      if (!front) glow(c, 0, 0, 105, color, 0.12);
      else {
        const tick = Math.floor(t * 3),
          points = Array.from({ length: 7 }, (_, i) =>
            polar(42 + random(i + tick * 31) * 33, (i / 7) * tau + t * 0.12),
          );
        for (let i = 0; i < points.length; i++) {
          discharge(
            c,
            points[i],
            points[(i + 1) % points.length],
            random,
            tick * 67 + i * 51,
            color,
            1,
          );
          glow(c, points[i].x, points[i].y, 9, color, 0.25);
        }
      }
    } else if (e.kind === 'lava') {
      if (!front) {
        materialSprite(c, '#ed7836', 'flame', 0, 0, 215, -t * 0.03, t * 0.3, 0.5);
        drawLavaFissures(c, color, t, random);
      } else
        for (let i = 0; i < n(5); i++) {
          const p = polar(50, random(i) * tau);
          materialSprite(c, '#ed7836', 'flame', p.x, p.y, 45, i + t * 0.1, t * 0.9 + i, 0.35);
        }
    } else if (e.kind === 'runes') {
      if (!front) {
        ring(c, 85, color, 0.8, 0.65, t);
        ring(c, 57, color, 1, 0.55, t);
        ring(c, 92, color, 0.45, 0.35, t);
      }
      for (let i = 0; i < n(front ? 10 : 16); i++) {
        const a = (i / (front ? 10 : 16)) * tau + t * (front ? -0.12 : 0.08),
          p = polar(front ? 62 : 84, a);
        glyph(c, p.x, p.y, a + Math.PI / 2, color, i);
      }
    } else if (e.kind === 'curse') {
      curseFlow(c, color, t, random, front);
    } else if (e.kind === 'bless') {
      if (!front) {
        glow(c, 0, 0, 113, color, 0.22);
        ring(c, 82, color, 1.3, 0.5, t);
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const p = polar(k % 2 ? 34 : 73, (k / 10) * tau - Math.PI / 2 + t * 0.05);
          k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
        }
        c.closePath();
        luminousStroke(c, color, 0.8, 0.55);
      } else
        for (let i = 0; i < n(16); i++) {
          const a = (i / 16) * tau + t * 0.16,
            p = polar(65 + Math.sin(t * 2 + i) * 12, a);
          c.save();
          c.fillStyle = alpha(tint(color, 0.65), 0.7);
          star(c, p.x, p.y, 2 + Math.sin(t + i) * 0.8);
          c.restore();
          streak(c, a, 88, fract(t * 0.23 + i / 16), color, 0.65);
        }
    } else if (e.kind === 'necrotic') {
      if (!front) {
        vapor(c, t * 0.65, random, n(9), 0.4);
        glow(c, 0, 0, 82, color, 0.16);
      } else
        for (let i = 0; i < n(13); i++) {
          const age = fract(t * 0.3 + random(i)),
            a = random(i + 32) * tau;
          c.beginPath();
          for (let k = 0; k <= 26; k++) {
            const u = k / 26,
              p = polar(9 + (1 - u) * 85, a + Math.sin(u * 7 + t + i) * 0.08);
            k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
          }
          luminousStroke(c, color, 1, 0.16 + envelope(age) * 0.3);
          streak(c, a, 10 + (1 - age) * 82, age, color, 1.5);
        }
    } else if (e.kind === 'web') {
      const spokes = 13;
      c.globalAlpha *= front ? 0.82 : 0.95;
      const radius = front ? 50 : 97;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * tau,
          p = polar(radius, a);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(p.x, p.y);
        c.strokeStyle = alpha('#343329', 0.42);
        c.lineWidth = 1.7;
        c.stroke();
        luminousStroke(c, tint(color, 0.48), 0.85, 0.95);
      }
      for (let band = 1; band <= 5; band++) {
        c.beginPath();
        for (let i = 0; i <= spokes; i++) {
          const a = (i / spokes) * tau,
            r = ((radius * band) / 5) * (0.95 + 0.04 * Math.sin(t + i)),
            p = polar(r, a),
            q = polar(r * 0.85, a - (tau / spokes) * 0.5);
          if (i === 0) c.moveTo(p.x, p.y);
          else c.quadraticCurveTo(q.x, q.y, p.x, p.y);
        }
        c.strokeStyle = alpha('#343329', 0.38);
        c.lineWidth = 1.5;
        c.stroke();
        luminousStroke(c, tint(color, 0.42), 0.75, 0.92);
      }
    } else if (e.kind === 'petals') {
      for (let i = 0; i < n(front ? 14 : 8); i++) {
        const life = fract(t * (0.13 + random(i + 71) * 0.08) + random(i));
        const a = random(i + 25) * tau + t * 0.16 + life * 0.8;
        const p = polar(50 + life * 46, a);
        c.save();
        c.translate(p.x + Math.sin(t * 1.7 + i) * 4, p.y + Math.sin(life * Math.PI) * 5);
        c.rotate(a + Math.sin(t * 1.1 + i) * 0.8);
        c.scale(0.38 + Math.abs(Math.cos(t * 1.3 + i)) * 0.62, 1);
        physicalProp(
          c,
          i % 3 ? 'petal-rose' : 'petal-ivory',
          0,
          0,
          16 + random(i + 18) * 11,
          0,
          envelope(life) * (front ? 0.94 : 0.68),
          color,
        );
        c.restore();
      }
    } else if (e.kind === 'swarm' || e.kind === 'leaves') {
      if (!front) vapor(c, t * 0.6, random, n(4), 0.12);
      const total = n(front ? 12 : 8);
      for (let i = 0; i < total; i++) {
        const a = (i / total) * tau + t * (0.3 + random(i) * 0.25),
          p = polar(53 + random(i + 31) * 36 + Math.sin(t + i) * 10, a),
          size = 3 + random(i + 15) * 4;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(a + Math.PI / 2);
        c.globalAlpha *= front ? 0.8 : 0.45;
        c.fillStyle = alpha(tint(color, 0.15), 0.8);
        if (e.kind === 'swarm') {
          const flap = 0.3 + Math.abs(Math.sin(t * 9 + i)) * 0.7;
          c.beginPath();
          c.moveTo(0, -size * 0.6);
          c.lineTo(-size * 1.4 * flap, -size);
          c.quadraticCurveTo(-size * 0.5, 0, -size * 0.7 * flap, size * 0.4);
          c.lineTo(0, size * 0.7);
          c.lineTo(size * 0.7 * flap, size * 0.4);
          c.quadraticCurveTo(size * 0.5, 0, size * 1.4 * flap, -size);
          c.closePath();
          c.fill();
        } else {
          c.scale(0.45 + Math.abs(Math.cos(t + i)) * 0.55, 1);
          c.beginPath();
          c.moveTo(0, -size);
          c.bezierCurveTo(size * 1.1, -size * 0.6, size, 0.6 * size, 0, size);
          c.bezierCurveTo(-size, 0.6 * size, -size * 1.1, -size * 0.6, 0, -size);
          c.fill();
          c.beginPath();
          c.moveTo(0, -size * 0.7);
          c.lineTo(0, size * 0.8);
          c.strokeStyle = alpha(tint(color, 0.6), 0.5);
          c.lineWidth = 0.5;
          c.stroke();
        }
        c.restore();
      }
    } else if (e.kind === 'blades') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * tau + t * 0.9,
          p = polar(75, a);
        c.save();
        c.globalAlpha *= front ? 0.8 : 0.25;
        c.beginPath();
        c.arc(0, 0, 75, a - 0.45, a - 0.05);
        luminousStroke(c, color, 1, 0.3);
        c.translate(p.x, p.y);
        c.rotate(a + Math.PI / 2);
        c.beginPath();
        c.moveTo(0, -17);
        c.lineTo(4, 7);
        c.lineTo(0, 5);
        c.lineTo(-4, 7);
        c.closePath();
        const g = c.createLinearGradient(-4, 0, 4, 0);
        g.addColorStop(0, alpha(color, 0.25));
        g.addColorStop(0.5, alpha(tint(color, 0.85), 0.9));
        g.addColorStop(1, alpha(color, 0.5));
        c.fillStyle = g;
        c.fill();
        c.beginPath();
        c.moveTo(-6, 9);
        c.lineTo(6, 9);
        c.moveTo(0, 9);
        c.lineTo(0, 15);
        luminousStroke(c, color, 0.85, 0.7);
        c.restore();
      }
    } else if (e.kind === 'sonic') {
      if (!front) glow(c, 0, 0, 105, color, 0.12);
      for (let i = 0; i < (front ? 2 : 4); i++) {
        const age = fract(t * 0.5 + i / 4),
          r = 18 + age * 87;
        c.beginPath();
        for (let k = 0; k <= 120; k++) {
          const a = (k / 120) * tau,
            p = polar(r + Math.sin(a * 18 + t * 6) * (2 + age * 3), a);
          k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
        }
        luminousStroke(c, color, front ? 0.75 : 1.8, (1 - age) * 0.45);
      }
    }
    return true;
  } finally {
    c.restore();
  }
}
