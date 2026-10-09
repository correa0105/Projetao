import type { Phenomenon } from '../shared/vtt-effects-cinematic';
import { flowSprite, flowArc } from './vtt-effects-native-flow';
import { physicalProp } from './vtt-effects-physical';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';

type Random = (i: number) => number;
const polar = (r: number, a: number) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
const visiblePass = (a: number, front: boolean) => Math.sin(a) > 0 === front;

function spark(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  opacity: number,
  length = 3,
) {
  c.save();
  c.globalAlpha *= opacity;
  glow(c, x, y, 3.4, color, 0.36);
  c.beginPath();
  c.moveTo(x - length * 0.24, y + length * 0.6);
  c.lineTo(x + length * 0.24, y - length * 0.6);
  c.strokeStyle = tint(color, 0.85);
  c.lineWidth = 0.85;
  c.lineCap = 'round';
  c.stroke();
  c.restore();
}

function fire(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
) {
  if (m.layout === 'comet') {
    for (let i = 0; i < 3; i++) {
      const a = t * m.speed * 1.15 + (i * tau) / 3,
        r = 87 * m.spread;
      if (!visiblePass(a, front)) continue;
      for (let k = 4; k >= 0; k--) {
        const q = a - k * 0.17,
          p = polar(r - k * 1.5, q);
        flowSprite(
          c,
          'flame-tongue',
          p.x,
          p.y,
          70 - k * 8,
          84 - k * 10,
          q + 0.7,
          t * 2 + i + k * 0.12,
          (1 - k / 5) * 0.9,
          color,
        );
      }
      const p = polar(r, a);
      physicalProp(c, 'fireball', p.x, p.y, 35, a, 1);
      glow(c, p.x, p.y, 14, '#ffd58c', 0.4);
    }
  } else {
    const count = m.layout === 'surge' ? 10 : 12;
    for (let i = 0; i < count; i++) {
      const u = fract(t * m.speed + i / count),
        a = (i * tau) / count + (m.layout === 'spiral' ? t * 0.7 : 0);
      const r = (m.layout === 'ring' ? 82 : 40 + u * 58) * m.spread;
      let p = polar(r, a),
        angle = a + 0.8;
      if (m.layout === 'surge') {
        p = { x: ((i % 3) - 1) * 41 + (u - 0.5) * 62, y: 90 - u * 180 };
        angle = -0.35;
      }
      if (p.y > 0 !== front) continue;
      const fade = Math.sin(u * Math.PI) ** 0.8;
      flowSprite(
        c,
        'flame-tongue',
        p.x,
        p.y,
        73 + u * 26,
        88 + u * 21,
        angle,
        t * 2 + i,
        fade * 0.93,
        color,
      );
      glow(c, p.x, p.y, 17, '#ffb643', fade * 0.26);
    }
  }
  if (front)
    for (let i = 0; i < 18; i++) {
      const u = fract(t * 0.65 + random(i)),
        a = random(i + 37) * tau,
        p = polar(64 + u * 54, a);
      spark(c, p.x, p.y, '#ffd47e', Math.sin(u * Math.PI) * 0.9, 2 + random(i + 48) * 3);
    }
}

function frost(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  const snow = /neve|hail|granizo/i.test(m.name);
  if (snow) {
    for (let i = 0; i < Math.round(38 * detail); i++) {
      const u = fract(t * 0.25 + random(i)),
        x = (random(i + 19) - 0.5) * 210 + Math.sin(t + i) * 12,
        y = (u - 0.5) * 210;
      if ((i % 2 === 0) !== front) continue;
      physicalProp(c, 'ice', x, y, 4 + random(i + 48) * 5, t + i, Math.sin(u * Math.PI) * 0.9);
    }
    return;
  }
  if (!front)
    for (let i = 0; i < 20; i++) {
      const a = (i * tau) / 20,
        p = polar(
          (m.layout === 'comet' ? 91 : 79) * m.spread,
          a + (m.layout === 'comet' ? t * 0.6 : 0),
        );
      const grow = 0.88 + Math.sin(t * 1.8 + i * 0.38) * 0.12;
      physicalProp(
        c,
        'ice',
        p.x,
        p.y,
        (35 + random(i + 25) * 19) * grow,
        a + Math.PI / 2,
        0.98,
        color,
      );
      if (i % 3 === 0)
        flowSprite(c, 'cloud-wisp', p.x, p.y, 76, 51, a + t * 0.2, t + i, 0.33, '#d7eff9');
    }
  if (front)
    for (let i = 0; i < Math.round(23 * detail); i++) {
      const u = fract(t * 0.34 + random(i)),
        a = random(i + 66) * tau + t * 0.12,
        p = polar(77 + u * 26, a);
      spark(c, p.x, p.y, '#e2f8ff', Math.sin(u * Math.PI) * 0.85, 2.4);
    }
}

function lightning(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
) {
  if (m.layout === 'orbit') {
    for (let i = 0; i < 4; i++) {
      const a = (i * tau) / 4 + t * 0.8,
        p = polar(86, a);
      if (!visiblePass(a, front)) continue;
      physicalProp(c, 'plasma', p.x, p.y, 51, t + i, 0.97);
      glow(c, p.x, p.y, 22, color, 0.3);
    }
    return;
  }
  const count = 7,
    r = 91 * m.spread;
  for (let i = 0; i < count; i++) {
    const turn = t * (m.layout === 'spiral' ? 0.72 : 0.12);
    const start = (i * tau) / count + turn,
      end = ((i + 1) * tau) / count + turn;
    if (!visiblePass((start + end) / 2, front)) continue;
    c.save();
    const pulse = 0.55 + 0.45 * Math.sin(t * 17 + i * 4) ** 2;
    c.globalAlpha *= pulse;
    const path = () => {
      c.beginPath();
      for (let k = 0; k <= 22; k++) {
        const u = k / 22,
          a = start + (end - start) * u,
          jitter = Math.sin(t * 37 + k * 4.7 + i * 13) * 3.7 * Math.sin(u * Math.PI);
        const radius =
          m.layout === 'spiral'
            ? 42 + ((i + u) / count) * 65
            : m.layout === 'ring'
              ? r + Math.sin(u * Math.PI) * 19
              : r + Math.sin(t * 4 + a * 3) * 5;
        const p = polar(radius + jitter, a + (m.layout === 'spiral' ? (i + u) * 0.42 : 0));
        k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
      }
    };
    path();
    c.strokeStyle = alpha(color, 0.18);
    c.lineWidth = 5;
    c.stroke();
    path();
    c.strokeStyle = alpha(color, 0.72);
    c.lineWidth = 1.65;
    c.stroke();
    path();
    c.strokeStyle = '#f0fcff';
    c.lineWidth = 0.65;
    c.stroke();
    const p = polar(r, start);
    glow(c, p.x, p.y, 9, '#b4eaff', 0.46);
    c.beginPath();
    c.moveTo(p.x, p.y);
    const tip = polar(r + 17, start - 0.07);
    c.quadraticCurveTo(
      p.x + Math.sin(t * 19 + i) * 4,
      p.y + Math.cos(t * 17 + i) * 4,
      tip.x,
      tip.y,
    );
    c.strokeStyle = alpha('#d5f2ff', 0.65);
    c.lineWidth = 0.55;
    c.stroke();
    c.restore();
  }
}

function liquid(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  const acid = m.family === 'acid',
    pool = acid && m.layout === 'bloom';
  if (m.layout === 'spiral') {
    if (front) {
      for (let i = 0; i < 12; i++) {
        const u = fract(t * 0.6 + random(i)),
          p = polar(87 + u * 23, random(i + 34) * tau + t * 0.8);
        spark(c, p.x, p.y, acid ? color : '#d7f8ff', Math.sin(u * Math.PI) * 0.85, 3);
      }
      return;
    }
    for (let i = 0; i < 3; i++)
      flowArc(
        c,
        'water-curl',
        57 + i * 18,
        t * 0.93 + i * 2.1,
        Math.PI * 1.86,
        t + i,
        0.94,
        acid ? color : undefined,
        undefined,
        36,
        0.58,
      );
    return;
  }
  if (m.layout === 'rain') {
    for (let i = 0; i < Math.round(35 * detail); i++) {
      if ((i % 2 === 0) !== front) continue;
      const u = fract(t * 0.75 + random(i)),
        x = (random(i + 38) - 0.5) * 190,
        y = (u - 0.5) * 190;
      spark(c, x, y, tint(color, 0.42), Math.sin(u * Math.PI) * 0.86, 8 + random(i + 53) * 7);
      if (u > 0.77) {
        c.beginPath();
        c.ellipse(x, y, (u - 0.77) * 25, (u - 0.77) * 12, 0, 0, tau);
        c.strokeStyle = alpha('#d5eff6', (1 - u) * 1.7);
        c.lineWidth = 0.6;
        c.stroke();
      }
    }
  } else if (pool) {
    if (!front) {
      const gradient = c.createRadialGradient(-11, -9, 5, 0, 0, 105);
      gradient.addColorStop(0, alpha(tint(color, 0.32, '#244419'), 0.75));
      gradient.addColorStop(0.7, alpha(color, 0.47));
      gradient.addColorStop(1, alpha(color, 0));
      c.fillStyle = gradient;
      c.fillRect(-105, -105, 210, 210);
      for (let i = 0; i < 4; i++)
        flowSprite(
          c,
          'water-curl',
          Math.sin(t + i) * 8,
          Math.cos(t + i) * 8,
          179,
          146,
          (i * tau) / 4 + t * 0.09,
          t + i,
          0.74,
          color,
        );
    } else
      for (let i = 0; i < 7; i++) {
        const u = fract(t * 0.24 + random(i)),
          a = random(i + 45) * tau,
          p = polar(75 + u * 17, a);
        flowSprite(c, 'cloud-wisp', p.x, p.y, 73, 53, a, t + i, Math.sin(u * Math.PI) * 0.4, color);
        glow(c, p.x, p.y, 2.4, '#d3f492', Math.sin(u * Math.PI) * 0.75);
      }
  } else if (acid && m.layout === 'surge') {
    for (let i = 0; i < 8; i++) {
      const u = fract(t * 0.43 + i / 8),
        p = { x: (u - 0.5) * 173, y: Math.sin(i * 9) * 39 };
      if (p.y > 0 !== front) continue;
      flowSprite(
        c,
        'cloud-wisp',
        p.x,
        p.y,
        110 + u * 31,
        83 + u * 21,
        -0.3,
        t * 1.7 + i,
        Math.sin(u * Math.PI) * 0.68,
        color,
      );
    }
  } else if (m.layout === 'burst' || m.layout === 'jet') {
    for (let i = 0; i < 9; i++) {
      const u = fract(t * m.speed + i / 9),
        a = (i * tau) / 9,
        p = polar(38 + u * 66, a);
      if (!visiblePass(a, front)) continue;
      flowSprite(
        c,
        'water-curl',
        p.x,
        p.y,
        92 - u * 27,
        65 - u * 13,
        a,
        t + i,
        Math.sin(u * Math.PI) * 0.88,
        acid ? color : undefined,
      );
      physicalProp(
        c,
        'droplet',
        p.x,
        p.y,
        7 + random(i) * 8,
        a,
        Math.sin(u * Math.PI) * 0.95,
        acid ? color : undefined,
      );
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const u = fract(t * 0.34 + i / 5),
        a = (i * tau) / 5 + t * (m.layout === 'wave' ? 0.1 : 0.85),
        r = m.layout === 'wave' ? 40 + u * 69 : 71;
      if (!visiblePass(a, front)) continue;
      const p = polar(r, a);
      flowSprite(
        c,
        'water-curl',
        p.x,
        p.y,
        162,
        105,
        a + 0.6,
        t * 1.6 + i,
        m.layout === 'wave' ? Math.sin(u * Math.PI) * 0.85 : 0.82,
        acid ? color : undefined,
      );
    }
  }
}

function air(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  const sand = /areia|sandstorm/i.test(m.name),
    swirl = m.layout === 'spiral';
  const count = m.layout === 'burst' ? 8 : swirl ? 5 : 6;
  if (swirl && !front)
    for (let i = 0; i < 3; i++)
      flowArc(
        c,
        'cloud-wisp',
        55 + i * 19,
        t * 1.1 + i * 2.1,
        Math.PI * 1.8,
        t + i,
        0.65,
        sand ? '#d2b289' : color,
        undefined,
        36,
        0.55,
      );
  for (let i = 0; i < (swirl ? 0 : count); i++) {
    const u = fract(t * m.speed + i / count),
      a = (i * tau) / count + (swirl ? t * 1.1 : 0);
    let p = polar(m.layout === 'burst' ? 32 + u * 76 : 75, a),
      angle = a + 0.5;
    if (m.layout === 'surge' || m.layout === 'rain') {
      p = { x: (u - 0.5) * 188, y: ((i % 3) - 1) * 54 };
      angle = i % 2 ? -0.28 : 0.25;
    }
    if (p.y > 0 !== front) continue;
    flowSprite(
      c,
      'cloud-wisp',
      p.x,
      p.y,
      swirl ? 171 : 159,
      swirl ? 103 : 96,
      angle,
      t * 1.9 + i,
      Math.sin(u * Math.PI) * (sand ? 0.43 : 0.57),
      sand ? '#d2b289' : color,
    );
  }
  if (front)
    for (let i = 0; i < Math.round((sand ? 65 : 24) * detail); i++) {
      const u = fract(t * 0.6 + random(i)),
        a = random(i + 42) * tau + (swirl ? t * 0.8 : 0),
        p = polar(46 + u * 64, a);
      spark(c, p.x, p.y, sand ? '#e5c698' : '#e6eff1', Math.sin(u * Math.PI) * 0.6, sand ? 1 : 3);
    }
}

function spirit(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  front: boolean,
) {
  const ghost = /espectral|almas/i.test(m.name),
    count = ghost ? 5 : 6;
  for (let i = 0; i < count; i++) {
    const u = fract(t * 0.23 + i / count),
      a = (i * tau) / count + t * 0.3 + (m.layout === 'spiral' ? u * 2.1 : 0);
    let p = polar(m.layout === 'bloom' ? 52 + u * 42 : m.layout === 'spiral' ? 38 + u * 64 : 82, a),
      angle = a + 0.5;
    if (m.layout === 'surge') {
      p = { x: (u - 0.5) * 166, y: ((i % 3) - 1) * 54 };
      angle = -0.4;
    }
    if (p.y > 0 !== front) continue;
    flowSprite(
      c,
      ghost ? 'ghost-wisp' : 'cloud-wisp',
      p.x,
      p.y,
      ghost ? 95 : 127,
      ghost ? 91 : 97,
      angle,
      t * 1.3 + i,
      0.62 + Math.sin(u * Math.PI) * 0.25,
      color,
    );
  }
}

function light(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  if (m.layout === 'spiral') {
    if (!front)
      for (let i = 0; i < 3; i++)
        flowArc(
          c,
          'light-stream',
          62 + i * 16,
          t * 0.72 + i * 2.1,
          Math.PI * 1.8,
          t + i,
          0.9,
          color,
          undefined,
          25,
          0.4,
        );
    if (front)
      for (let i = 0; i < 18; i++) {
        const u = fract(t * 0.4 + random(i)),
          p = polar(68 + u * 40, random(i + 42) * tau + t * 0.3);
        spark(c, p.x, p.y, color, Math.sin(u * Math.PI) * 0.82, 2.4);
      }
    return;
  }
  if (m.layout === 'rift') {
    if (!front) {
      c.save();
      c.rotate(Math.sin(t * 0.7) * 0.045);
      c.beginPath();
      c.moveTo(0, -108);
      c.bezierCurveTo(26, -53, 26, 53, 0, 108);
      c.bezierCurveTo(-26, 53, -26, -53, 0, -108);
      const g = c.createLinearGradient(-25, 0, 25, 0);
      g.addColorStop(0, alpha(color, 0.6));
      g.addColorStop(0.25, '#142238');
      g.addColorStop(0.5, '#030919');
      g.addColorStop(0.75, '#142238');
      g.addColorStop(1, alpha(color, 0.6));
      c.fillStyle = g;
      c.fill();
      c.restore();
    }
    for (const side of [-1, 1])
      flowSprite(
        c,
        'light-stream',
        side * 23,
        0,
        62,
        224,
        side * 0.13,
        t * 1.5 + side,
        front ? 0.48 : 0.88,
        color,
      );
  } else if (m.layout === 'rain') {
    for (let i = 0; i < Math.round(30 * detail); i++) {
      if ((i % 2 === 0) !== front) continue;
      const u = fract(t * 0.45 + random(i));
      spark(
        c,
        (random(i + 40) - 0.5) * 199,
        (u - 0.5) * 204,
        color,
        Math.sin(u * Math.PI) * 0.92,
        9 + random(i + 53) * 7,
      );
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const u = fract(t * m.speed + i / 5),
        a = (i * tau) / 5 + t * 0.4,
        p = polar(m.layout === 'wave' ? 38 + u * 65 : 79, a);
      if (!visiblePass(a, front)) continue;
      const tone = /prism/i.test(m.name) ? ['#91ddff', '#bca4ff', '#f6d48c'][i % 3] : color;
      flowSprite(c, 'light-stream', p.x, p.y, 153, 109, a + 0.8, t * 1.4 + i, 0.82, tone);
    }
    if (front)
      for (let i = 0; i < 22; i++) {
        const u = fract(t * 0.4 + random(i)),
          a = random(i + 42) * tau + t * 0.3,
          p = polar(62 + u * 43, a);
        spark(c, p.x, p.y, color, Math.sin(u * Math.PI) * 0.82, 2.4);
      }
  }
}

export function drawFluidPhenomenon(
  c: CanvasRenderingContext2D,
  m: Phenomenon,
  color: string,
  t: number,
  random: Random,
  front: boolean,
  detail: number,
) {
  c.save();
  if (m.family === 'fire') fire(c, m, color, t, random, front);
  else if (m.family === 'ice') frost(c, m, color, t, random, front, detail);
  else if (m.family === 'electric') lightning(c, m, color, t, random, front);
  else if (m.family === 'water' || m.family === 'acid')
    liquid(c, m, color, t, random, front, detail);
  else if (m.family === 'air') air(c, m, color, t, random, front, detail);
  else if (m.family === 'soul') spirit(c, m, color, t, front);
  else if (m.family === 'light') light(c, m, color, t, random, front, detail);
  else {
    c.restore();
    return false;
  }
  c.restore();
  return true;
}
