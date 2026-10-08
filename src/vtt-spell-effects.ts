import { type VttScene, type VttToken } from '../shared/vtt';
import {
  pixelsPerFoot,
  spellCells,
  spellOrigin,
  type SpellEffect,
  type SpellProfile,
  type SpellPlacement,
} from '../shared/vtt-spells';
import { alpha, glow, seededRandom, tau } from './vtt-effects-primitives';
import { materialSprite } from './vtt-effects-materials';
import { drawWeaponArt } from './vtt-weapon-art';
export type SpellPreview = {
  profile: SpellProfile;
  actorId: string;
  targets: string[];
  points: SpellPlacement[];
};
type View = { left: number; top: number; right: number; bottom: number };
function line(c: CanvasRenderingContext2D, points: number[], close = false) {
  c.beginPath();
  for (let i = 0; i < points.length; i += 2)
    i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]);
  if (close) c.closePath();
}
export function spellPath(
  c: CanvasRenderingContext2D,
  p: SpellProfile,
  at: SpellPlacement,
  f: number,
) {
  const s = p.size * f,
    w = Math.max(1, p.width * f);
  c.beginPath();
  if (p.shape === 'sphere' || p.shape === 'ring') {
    c.arc(at.x, at.y, s, 0, tau);
    if (p.shape === 'ring') c.arc(at.x, at.y, Math.max(0, s - w), 0, tau, true);
    return;
  }
  const coords =
    p.shape === 'cone'
      ? [0, 0, s, -s / 2, s, s / 2]
      : p.shape === 'line'
        ? [0, -w / 2, s, -w / 2, s, w / 2, 0, w / 2]
        : p.shape === 'wall'
          ? [-s / 2, -w / 2, s / 2, -w / 2, s / 2, w / 2, -s / 2, w / 2]
          : p.origin === 'caster-face'
            ? [0, -s / 2, s, -s / 2, s, s / 2, 0, s / 2]
            : [-s / 2, -s / 2, s / 2, -s / 2, s / 2, s / 2, -s / 2, s / 2];
  const a = Math.cos(at.angle),
    b = Math.sin(at.angle);
  for (let i = 0; i < coords.length; i += 2) {
    const x = at.x + coords[i] * a - coords[i + 1] * b,
      y = at.y + coords[i] * b + coords[i + 1] * a;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
function rune(c: CanvasRenderingContext2D, signature: number, r: number, t: number, color: string) {
  c.save();
  c.rotate(t * 0.08);
  c.strokeStyle = alpha(color, 0.65);
  c.lineWidth = 1.1;
  c.beginPath();
  c.arc(0, 0, r, 0, tau);
  c.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      b = (signature >>> ((i * 2) % 28)) & 3;
    c.save();
    c.rotate(a);
    line(c, [r * 0.84, -3, r * 0.93, 3, r * 1.02, -3]);
    c.stroke();
    if (b & 1) {
      line(c, [r * 0.94, -3, r * 0.94, 7]);
      c.stroke();
    }
    if (b & 2) {
      line(c, [r * 0.81, 2, r * 0.87, 7]);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}
function motif(
  c: CanvasRenderingContext2D,
  name: string,
  r: number,
  t: number,
  p: SpellProfile,
  seed: number,
) {
  const color = p.visual.color,
    light = p.visual.light,
    random = seededRandom(p.id + seed),
    count = p.visual.arms;
  c.save();
  c.strokeStyle = alpha(light, 0.82);
  c.fillStyle = alpha(color, 0.3);
  c.lineWidth = Math.max(0.8, r * 0.018);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const arc = (x: number, y: number, s: number, start = 0, end = tau) => {
    c.beginPath();
    c.arc(x, y, s, start, end);
    c.stroke();
  };
  if (['flame', 'ember', 'smoke', 'mist', 'storm'].includes(name)) {
    for (let i = 0; i < Math.min(10, count + 2); i++) {
      const a = (i * tau) / count + t * (name === 'storm' ? -0.22 : 0.15),
        s = r * (0.35 + random(i) * 0.35),
        x = Math.cos(a) * r * 0.43,
        y = Math.sin(a) * r * 0.43;
      materialSprite(
        c,
        color,
        name === 'flame' || name === 'ember' ? 'flame' : 'vapor',
        x,
        y,
        s * 2,
        a + t * 0.12,
        t * 0.3 + random(i + 10),
        name === 'mist' ? 0.3 : 0.7,
      );
    }
    if (name === 'storm') motif(c, 'bolt', r * 0.9, t, p, seed + 3);
  } else if (['bolt', 'branch'].includes(name)) {
    const n = name === 'branch' ? 4 : 2;
    for (let k = 0; k < n; k++) {
      const angle = (k * tau) / n + t * 0.11;
      c.save();
      c.rotate(angle);
      const pts = [-r * 0.9, 0];
      for (let i = 1; i < 13; i++)
        pts.push(
          -r * 0.9 + (r * 1.8 * i) / 12,
          (random(i + k * 15 + Math.floor(t * 9)) * 2 - 1) * r * 0.13,
        );
      for (const [width, opacity] of [
        [r * 0.1, 0.09],
        [r * 0.035, 0.6],
        [r * 0.012, 0.95],
      ]) {
        c.strokeStyle = alpha(width < r * 0.02 ? light : color, opacity);
        c.lineWidth = Math.max(0.7, width);
        line(c, pts);
        c.stroke();
      }
      for (let i = 3; i < 10; i += 3) {
        c.strokeStyle = alpha(light, 0.55);
        c.lineWidth = 1;
        line(c, [pts[i * 2], pts[i * 2 + 1], pts[i * 2] + r * 0.13, pts[i * 2 + 1] - r * 0.22]);
        c.stroke();
      }
      c.restore();
    }
  } else if (['crystal', 'hail', 'stone', 'thorn'].includes(name)) {
    const n = name === 'hail' ? 14 : count + 3;
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n + random(i) * 0.12,
        at = name === 'hail' ? random(i + 20) * r : r * (0.28 + random(i + 30) * 0.38),
        length = r * (0.2 + random(i + 40) * 0.42),
        wide = length * (name === 'thorn' ? 0.14 : 0.3);
      c.save();
      c.translate(Math.cos(a) * at, Math.sin(a) * at);
      c.rotate(a + Math.PI / 2);
      const g = c.createLinearGradient(-wide, 0, wide, 0);
      g.addColorStop(0, alpha(color, 0.55));
      g.addColorStop(0.5, alpha(light, 0.92));
      g.addColorStop(1, alpha(color, 0.25));
      c.fillStyle = g;
      line(c, [0, -length / 2, wide, length * 0.2, 0, length / 2, -wide, length * 0.15], true);
      c.fill();
      c.strokeStyle = alpha(light, 0.6);
      c.stroke();
      line(c, [0, -length / 2, 0, length / 2, wide, length * 0.2]);
      c.stroke();
      c.restore();
    }
  } else if (['vine', 'leaf', 'feather', 'petal', 'phoenix'].includes(name)) {
    for (let i = 0; i < count + 2; i++) {
      c.save();
      c.rotate((i * tau) / (count + 2) + t * 0.06);
      const x = r * 0.32,
        y = Math.sin(t + i) * r * 0.04;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(r * 0.5, -r * 0.32, r * 0.86, -r * 0.32, r * 0.88, 0);
      c.bezierCurveTo(r * 0.6, r * 0.24, r * 0.5, r * 0.12, x, y);
      c.fillStyle = alpha(name === 'phoenix' ? light : color, 0.35);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(r * 0.6, -r * 0.03, r * 0.88, 0);
      c.stroke();
      if (name === 'vine') {
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(r * 0.2, r * 0.5, r * 0.6, -r * 0.4, r * 0.95, r * 0.1);
        c.stroke();
      }
      if (name === 'feather' || name === 'phoenix') {
        for (let j = 2; j < 7; j++) {
          line(c, [(r * j) / 8, 0, (r * j) / 8 - r * 0.12, -r * 0.09]);
          c.stroke();
        }
      }
      c.restore();
    }
  } else if (['halo', 'ripple', 'wave', 'shockwave', 'orbit'].includes(name)) {
    const n = name === 'halo' ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const phase = (((t * 0.24 + i / n) % 1) + 1) % 1,
        s = r * (0.22 + phase * 0.8);
      c.strokeStyle = alpha(i % 2 ? light : color, (1 - phase) * 0.62);
      c.lineWidth = r * (name === 'shockwave' ? 0.04 : 0.015);
      c.beginPath();
      if (name === 'wave') {
        for (let j = 0; j < 50; j++) {
          const a = (j * tau) / 49,
            rad = s + Math.sin(a * 8 + t * 3) * r * 0.028;
          j
            ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
            : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
      } else c.arc(0, 0, s, 0, tau);
      c.stroke();
    }
  } else if (['portal', 'door', 'vortex', 'spiral', 'bead'].includes(name)) {
    if (name === 'door') {
      c.strokeStyle = alpha(light, 0.65);
      line(c, [-r * 0.4, r * 0.6, -r * 0.4, -r * 0.6, r * 0.4, -r * 0.6, r * 0.4, r * 0.6]);
      c.stroke();
    }
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let j = 0; j < 75; j++) {
        const a = j * 0.13 + (k * tau) / 3 + t * 0.3,
          s = r * (0.05 + j / 85);
        j ? c.lineTo(Math.cos(a) * s, Math.sin(a) * s) : c.moveTo(Math.cos(a) * s, Math.sin(a) * s);
      }
      c.strokeStyle = alpha(k === 1 ? light : color, 0.38);
      c.stroke();
    }
    if (name === 'bead') {
      glow(c, 0, 0, r * 0.2, color, 0.9);
      arc(0, 0, r * 0.09);
    } else {
      materialSprite(c, color, 'energy', 0, 0, r * 1.7, t * 0.1, t * 0.3, 0.45);
    }
  } else if (
    ['rune', 'sigil', 'script', 'constellation', 'star', 'crescent', 'prism'].includes(name)
  ) {
    if (name === 'rune' || name === 'sigil') rune(c, p.visual.signature, r * 0.82, t, light);
    if (name === 'script') {
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 6; i++) {
          const x = (i - 2.5) * r * 0.23,
            y = (j - 1.5) * r * 0.23;
          line(c, [
            x,
            y,
            x + r * 0.08,
            y - r * 0.07,
            x + r * 0.14,
            y + r * 0.03,
            x + r * 0.06,
            y + r * 0.08,
          ]);
          c.stroke();
        }
      }
    } else if (name === 'crescent') {
      c.beginPath();
      c.arc(0, 0, r * 0.65, -1.4, 1.4);
      c.bezierCurveTo(
        r * 0.1,
        r * 0.18,
        r * 0.1,
        -r * 0.18,
        Math.cos(-1.4) * r * 0.65,
        Math.sin(-1.4) * r * 0.65,
      );
      c.fill();
      c.stroke();
    } else
      for (let i = 0; i < count; i++) {
        const a = (i * tau) / count + t * 0.1,
          x = Math.cos(a) * r * 0.67,
          y = Math.sin(a) * r * 0.67,
          s = r * (0.04 + random(i) * 0.06);
        c.save();
        c.translate(x, y);
        c.rotate(a + t * 0.2);
        line(
          c,
          [
            0,
            -s,
            s * 0.3,
            -s * 0.25,
            s,
            0,
            s * 0.3,
            s * 0.25,
            0,
            s,
            -s * 0.3,
            s * 0.25,
            -s,
            0,
            -s * 0.3,
            -s * 0.25,
          ],
          true,
        );
        c.fillStyle = alpha(light, 0.7);
        c.fill();
        c.restore();
        if (name === 'constellation') {
          line(c, [
            x,
            y,
            Math.cos(a + tau / count) * r * 0.67,
            Math.sin(a + tau / count) * r * 0.67,
          ]);
          c.strokeStyle = alpha(color, 0.3);
          c.stroke();
        }
      }
    if (name === 'prism') {
      for (let i = 0; i < 7; i++) {
        c.strokeStyle = [
          '#ed9b8f',
          '#ecc38a',
          '#efdf83',
          '#9ee0a0',
          '#89c9ec',
          '#9eabed',
          '#d8a5e9',
        ][i];
        arc(0, 0, r * (0.27 + i * 0.08), t * 0.2, t * 0.2 + Math.PI * 1.4);
      }
    }
  } else if (
    ['shield', 'armor', 'shell', 'barrier', 'chain', 'web', 'filament', 'maze', 'crack'].includes(
      name,
    )
  ) {
    if (name === 'shield' || name === 'armor') {
      line(
        c,
        [
          0,
          -r * 0.8,
          r * 0.6,
          -r * 0.48,
          r * 0.47,
          r * 0.4,
          0,
          r * 0.82,
          -r * 0.47,
          r * 0.4,
          -r * 0.6,
          -r * 0.48,
        ],
        true,
      );
      c.fill();
      c.stroke();
      line(c, [0, -r * 0.55, 0, r * 0.52, -r * 0.28, -r * 0.17, r * 0.28, -r * 0.17]);
      c.stroke();
    } else if (name === 'shell') {
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.ellipse(0, 0, r * 0.85, r * (0.22 + i * 0.17), t * 0.15 + i * 0.3, 0, tau);
        c.strokeStyle = alpha(light, 0.25 + i * 0.1);
        c.stroke();
      }
    } else if (name === 'chain') {
      for (let i = 0; i < 15; i++) {
        c.save();
        c.rotate((i * tau) / 15 + t * 0.04);
        c.translate(r * 0.7, 0);
        c.beginPath();
        c.ellipse(0, 0, r * 0.1, r * 0.05, 0.4, 0, tau);
        c.stroke();
        c.restore();
      }
    } else if (name === 'web') {
      for (let k = 0; k < 6; k++) {
        line(c, [0, 0, Math.cos((k * tau) / 6) * r, Math.sin((k * tau) / 6) * r]);
        c.stroke();
      }
      for (let j = 1; j < 5; j++) {
        c.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = (k * tau) / 6,
            s = (r * j) / 4;
          k ? c.lineTo(Math.cos(a) * s, Math.sin(a) * s) : c.moveTo(s, 0);
        }
        c.stroke();
      }
    } else if (name === 'barrier' || name === 'maze') {
      for (let i = -3; i <= 3; i++) {
        const x = i * r * 0.23;
        line(c, [x, -r * 0.75, x + (name === 'maze' ? r * 0.1 : 0), r * 0.75]);
        c.stroke();
        line(c, [-r * 0.75, x, r * 0.75, x]);
        c.stroke();
      }
    } else
      for (let i = 0; i < count; i++) {
        const a = (i * tau) / count;
        c.save();
        c.rotate(a);
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(r * 0.3, Math.sin(t + i) * r * 0.2, r * 0.65, -r * 0.22, r * 0.95, 0);
        c.strokeStyle = alpha(light, 0.6);
        c.stroke();
        c.restore();
      }
  } else if (
    [
      'eye',
      'skull',
      'spirit',
      'echo',
      'beast',
      'dragon',
      'insect',
      'hand',
      'bone',
      'tentacle',
      'fruit',
      'clock',
      'arrow',
      'blade',
      'lance',
      'comet',
      'meteor',
      'impact',
      'scar',
      'column',
    ].includes(name)
  ) {
    if (name === 'eye') {
      c.beginPath();
      c.moveTo(-r * 0.75, 0);
      c.quadraticCurveTo(0, -r * 0.6, r * 0.75, 0);
      c.quadraticCurveTo(0, r * 0.6, -r * 0.75, 0);
      c.stroke();
      arc(0, 0, r * 0.22);
      arc(0, 0, r * 0.055);
    } else if (name === 'clock') {
      arc(0, 0, r * 0.7);
      for (let i = 0; i < 12; i++) {
        c.save();
        c.rotate((i * tau) / 12);
        line(c, [0, -r * 0.56, 0, -r * 0.66]);
        c.stroke();
        c.restore();
      }
      line(c, [0, -r * 0.45, 0, 0, Math.cos(t * 0.3) * r * 0.32, Math.sin(t * 0.3) * r * 0.32]);
      c.stroke();
    } else if (name === 'blade' || name === 'arrow') {
      c.save();
      c.rotate(-Math.PI / 4 + t * 0.03);
      drawWeaponArt(c, name === 'blade' ? 'sword' : 'bow', r * 1.2);
      c.restore();
    } else if (name === 'lance' || name === 'comet' || name === 'meteor' || name === 'column') {
      c.save();
      c.rotate(t * 0.2);
      const g = c.createLinearGradient(-r, 0, r, 0);
      g.addColorStop(0, alpha(color, 0));
      g.addColorStop(0.7, alpha(color, 0.8));
      g.addColorStop(1, alpha(light, 0.95));
      c.fillStyle = g;
      line(c, [-r, -r * 0.04, r * 0.5, -r * 0.13, r, 0, r * 0.5, r * 0.13, -r, r * 0.04], true);
      c.fill();
      glow(c, r * 0.7, 0, r * 0.25, light, 0.65);
      c.restore();
    } else if (name === 'hand') {
      c.beginPath();
      c.moveTo(-r * 0.4, r * 0.6);
      c.lineTo(-r * 0.42, 0);
      for (let i = 0; i < 4; i++) {
        const x = -r * 0.3 + i * r * 0.18;
        c.quadraticCurveTo(x - r * 0.07, -r * 0.8, x, -r * (0.5 + (i === 1 ? 0.2 : 0)));
        c.lineTo(x + r * 0.07, -r * 0.05);
      }
      c.quadraticCurveTo(r * 0.7, -r * 0.2, r * 0.45, r * 0.25);
      c.lineTo(r * 0.24, r * 0.6);
      c.closePath();
      c.fill();
      c.stroke();
    } else if (name === 'skull') {
      c.beginPath();
      c.ellipse(0, -r * 0.12, r * 0.48, r * 0.58, 0, 0, tau);
      c.fill();
      c.stroke();
      c.fillStyle = alpha(light, 0.75);
      c.beginPath();
      c.ellipse(-r * 0.19, -r * 0.12, r * 0.1, r * 0.13, 0, 0, tau);
      c.ellipse(r * 0.19, -r * 0.12, r * 0.1, r * 0.13, 0, 0, tau);
      c.fill();
      line(c, [-r * 0.28, r * 0.32, -r * 0.22, r * 0.6, r * 0.22, r * 0.6, r * 0.28, r * 0.32]);
      c.stroke();
      for (let i = -1; i <= 1; i++) {
        line(c, [i * r * 0.13, r * 0.38, i * r * 0.13, r * 0.6]);
        c.stroke();
      }
    } else if (name === 'bone') {
      for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate((i * Math.PI) / 3 + t * 0.04);
        line(c, [-r * 0.65, 0, r * 0.65, 0]);
        c.lineWidth = r * 0.08;
        c.stroke();
        arc(-r * 0.68, -r * 0.05, r * 0.08);
        arc(r * 0.68, r * 0.05, r * 0.08);
        c.restore();
      }
    } else if (name === 'spirit' || name === 'echo') {
      for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate((i * tau) / 3);
        c.translate(r * 0.45, 0);
        c.beginPath();
        c.moveTo(0, -r * 0.3);
        c.bezierCurveTo(r * 0.35, -r * 0.3, r * 0.25, r * 0.4, 0, r * 0.55);
        c.bezierCurveTo(-r * 0.2, r * 0.2, -r * 0.3, -r * 0.3, 0, -r * 0.3);
        c.strokeStyle = alpha(light, 0.5);
        c.stroke();
        c.restore();
      }
    } else if (name === 'beast' || name === 'dragon' || name === 'insect') {
      for (let i = 0; i < 4; i++) {
        const a = (i - 1.5) * 0.6;
        arc(Math.sin(a) * r * 0.52, -Math.cos(a) * r * 0.52, r * 0.12);
      }
      c.beginPath();
      c.ellipse(0, r * 0.12, r * 0.36, r * 0.3, 0, 0, tau);
      c.fill();
      c.stroke();
      if (name === 'dragon') {
        line(c, [
          -r * 0.25,
          0,
          -r * 0.8,
          -r * 0.4,
          -r * 0.68,
          r * 0.5,
          -r * 0.25,
          r * 0.2,
          r * 0.25,
          r * 0.2,
          r * 0.68,
          r * 0.5,
          r * 0.8,
          -r * 0.4,
          r * 0.25,
          0,
        ]);
        c.stroke();
      }
      if (name === 'insect') {
        for (let i = -1; i <= 1; i++) {
          line(c, [
            -r * 0.25,
            i * r * 0.2,
            -r * 0.7,
            i * r * 0.4,
            r * 0.7,
            i * r * 0.4,
            r * 0.25,
            i * r * 0.2,
          ]);
          c.stroke();
        }
      }
    } else if (name === 'tentacle') {
      for (let i = 0; i < 6; i++) {
        c.save();
        c.rotate((i * tau) / 6);
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(r * 0.3, -r * 0.4, r * 0.9, r * 0.45, r * 0.75, -r * 0.3);
        c.lineWidth = r * 0.06;
        c.strokeStyle = alpha(color, 0.8);
        c.stroke();
        c.lineWidth = 1;
        c.strokeStyle = alpha(light, 0.7);
        c.stroke();
        c.restore();
      }
    } else if (name === 'fruit') {
      for (let i = 0; i < 5; i++) {
        const a = (i * tau) / 5;
        c.beginPath();
        c.ellipse(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.2, r * 0.24, a, 0, tau);
        c.fill();
        c.stroke();
      }
    } else {
      for (let i = 0; i < count + 4; i++) {
        c.save();
        c.rotate((i * tau) / (count + 4) + t * 0.08);
        line(c, [r * 0.35, 0, r * 0.65, -r * 0.08, r * 0.85, 0]);
        c.stroke();
        c.restore();
      }
    }
  } else if (name === 'droplet' || name === 'splash') {
    for (let i = 0; i < count + 2; i++) {
      const a = (i * tau) / (count + 2);
      c.save();
      c.rotate(a + t * 0.04);
      c.translate(r * 0.45, 0);
      line(c, [0, -r * 0.2, r * 0.1, r * 0.08, 0, r * 0.16, -r * 0.1, r * 0.08], true);
      c.fill();
      c.stroke();
      c.restore();
    }
  }
  c.restore();
}
function localEffect(
  c: CanvasRenderingContext2D,
  p: SpellProfile,
  x: number,
  y: number,
  r: number,
  t: number,
  opacity: number,
  seed = 0,
) {
  c.save();
  c.translate(x, y);
  c.globalAlpha *= opacity;
  glow(c, 0, 0, r * 1.15, p.visual.color, 0.2);
  // Each spell has a distinct motif pair, runic signature and rhythm. Different
  // families also use different density materials, rather than a recolored ring.
  p.visual.motifs.forEach((m, i) => {
    c.save();
    c.globalAlpha *= i ? 0.65 : 1;
    motif(c, m, r * (i ? 0.85 : 1), t * (i ? -0.7 : 1) * p.visual.pulse, p, seed + i);
    c.restore();
  });
  const random = seededRandom(p.id + seed);
  for (let i = 0; i < 12; i++) {
    const a = random(i) * tau + t * p.visual.twist,
      rad = r * (0.35 + random(i + 20) * 0.7),
      s = r * (0.006 + random(i + 40) * 0.012),
      fade = (Math.sin(t * 1.8 + random(i + 60) * tau) + 1) / 2;
    c.strokeStyle = alpha(p.visual.light, fade * 0.7);
    c.lineWidth = Math.max(0.65, s);
    line(c, [
      Math.cos(a) * rad,
      Math.sin(a) * rad,
      Math.cos(a) * rad - s * 3,
      Math.sin(a) * rad + s,
    ]);
    c.stroke();
  }
  c.restore();
}
function field(
  c: CanvasRenderingContext2D,
  p: SpellProfile,
  at: SpellPlacement,
  s: VttScene,
  t: number,
  opacity: number,
  view: View,
) {
  const f = pixelsPerFoot(s.grid),
    size = p.size * f;
  if (!p.shape) return;
  const extent = Math.max(size, p.width * f);
  if (
    at.x + extent < view.left ||
    at.x - extent > view.right ||
    at.y + extent < view.top ||
    at.y - extent > view.bottom
  )
    return;
  c.save();
  spellPath(c, p, at, f);
  c.clip();
  const material = ['fire', 'frost', 'poison', 'water', 'wind', 'lightning'].includes(
    p.visual.family,
  );
  if (material) {
    const span = Math.min(Math.max(s.grid.size * 1.8, size * 0.5), 300),
      left = Math.max(view.left, at.x - extent),
      top = Math.max(view.top, at.y - extent),
      right = Math.min(view.right, at.x + extent),
      bottom = Math.min(view.bottom, at.y + extent);
    let n = 0;
    for (let y = top; y < bottom && n < 120; y += span * 0.8)
      for (let x = left; x < right && n < 120; x += span * 0.8, n++)
        materialSprite(
          c,
          p.visual.color,
          p.visual.family === 'fire'
            ? 'flame'
            : ['frost', 'poison', 'water', 'wind'].includes(p.visual.family)
              ? 'vapor'
              : 'energy',
          x + span * 0.4,
          y + span * 0.4,
          span * 1.4,
          t * 0.04 + n * 0.7,
          t * 0.3 + n * 0.2,
          opacity * 0.5,
        );
  }
  const radius = Math.max(18, Math.min(size * 0.6, s.grid.size * 2.4));
  if (['line', 'wall', 'cone'].includes(p.shape)) {
    const steps = Math.min(20, Math.max(2, Math.ceil(size / (radius * 1.4))));
    for (let i = 0; i < steps; i++) {
      const x = p.shape === 'wall' ? ((i + 0.5) / steps - 0.5) * size : ((i + 0.5) / steps) * size,
        y = Math.sin(i + t * 0.5) * radius * 0.15;
      localEffect(
        c,
        p,
        at.x + x * Math.cos(at.angle) - y * Math.sin(at.angle),
        at.y + x * Math.sin(at.angle) + y * Math.cos(at.angle),
        p.shape === 'cone' ? radius * (0.4 + (i + 1) / steps) : radius,
        t + i * 0.23,
        opacity * 0.75,
        i,
      );
    }
  } else {
    localEffect(c, p, at.x, at.y, radius, t, opacity);
    if (size > radius * 1.7)
      for (let i = 0; i < 8; i++) {
        const a = (i * tau) / 8 + t * 0.03,
          rad = size * 0.68;
        localEffect(
          c,
          p,
          at.x + Math.cos(a) * rad,
          at.y + Math.sin(a) * rad,
          radius * 0.6,
          t + i * 0.18,
          opacity * 0.55,
          i + 1,
        );
      }
  }
  c.restore();
  c.save();
  spellPath(c, p, at, f);
  c.strokeStyle = alpha(p.visual.color, opacity * 0.38);
  c.lineWidth = Math.max(1, f * 0.05);
  c.stroke();
  c.restore();
}
function beam(
  c: CanvasRenderingContext2D,
  p: SpellProfile,
  a: VttToken,
  b: { x: number; y: number },
  t: number,
  index: number,
) {
  const stagger = (index % 8) * 0.08;
  const progress = Math.max(0, Math.min(1, (t - 0.16 - stagger) / 0.72)),
    fade = 1 - Math.max(0, (t - 1.05 - stagger) / 0.35);
  if (progress <= 0 || fade <= 0) return;
  const x = a.x + (b.x - a.x) * progress,
    y = a.y + (b.y - a.y) * progress,
    angle = Math.atan2(b.y - a.y, b.x - a.x),
    r = Math.min(a.width, a.height) * 0.28;
  if (p.visual.family === 'lightning') {
    c.save();
    c.translate((a.x + x) / 2, (a.y + y) / 2);
    c.rotate(angle);
    const len = Math.hypot(x - a.x, y - a.y) / 2;
    const random = seededRandom(p.id + index + Math.floor(t * 12));
    const pts = [-len, 0];
    for (let i = 1; i <= 18; i++)
      pts.push(-len + (2 * len * i) / 18, (random(i) * 2 - 1) * r * 0.35);
    for (const [w, op] of [
      [8, 0.15],
      [3, 0.7],
      [1, 0.95],
    ]) {
      c.strokeStyle = alpha(w === 1 ? p.visual.light : p.visual.color, op * fade);
      c.lineWidth = w;
      line(c, pts);
      c.stroke();
    }
    c.restore();
  } else {
    c.save();
    c.globalAlpha *= fade;
    const grad = c.createLinearGradient(a.x, a.y, x, y);
    grad.addColorStop(0, alpha(p.visual.color, 0));
    grad.addColorStop(1, alpha(p.visual.light, 0.9));
    c.strokeStyle = grad;
    c.lineWidth = Math.max(1, r * 0.09);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo(
      (a.x + x) / 2 + Math.sin(index) * r,
      (a.y + y) / 2 - Math.cos(index) * r,
      x,
      y,
    );
    c.stroke();
    localEffect(c, p, x, y, r * 0.65, t, fade, index);
    c.restore();
  }
}
export function drawSpellEffects(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  effects: SpellEffect[],
  pass: 'behind' | 'front',
  view: View,
  now = Date.now(),
  reduced = false,
) {
  const visible = effects
    .filter((e) => e.sceneId === scene.id && e.started <= now && (!e.expires || e.expires > now))
    .slice(0, 200);
  for (const e of visible) {
    const actor = scene.tokens.find((t) => t.id === e.actorId);
    if (!actor) continue;
    const p = e.profile,
      t = reduced ? 1.5 : (now - e.started) / 1000,
      opacity = Math.min(1, t / 0.25) * (e.expires ? Math.min(1, (e.expires - now) / 600) : 1);
    const points = e.points.map((at) => spellOrigin(p, actor, at));
    if (pass === 'behind') {
      if (p.shape && (p.mode !== 'targets' || p.areaFromTargets))
        for (const at of points) field(c, p, at, scene, t, opacity * 0.72, view);
      else
        for (const id of new Set(e.targets.length ? e.targets : [actor.id])) {
          const target = scene.tokens.find((t) => t.id === id);
          if (!target) continue;
          localEffect(
            c,
            p,
            target.x,
            target.y,
            Math.max(18, Math.max(target.width, target.height) * 0.66),
            t,
            opacity * (e.persistent ? 0.68 : Math.max(0, 1 - (t - 1.2) / 3)),
            p.visual.signature,
          );
        }
    } else {
      if (t < 2 && !reduced) {
        const targetPoints =
          p.mode === 'targets'
            ? e.targets
                .map((id) => scene.tokens.find((t) => t.id === id))
                .filter((t): t is VttToken => !!t)
            : p.origin.startsWith('caster')
              ? []
              : points;
        targetPoints.forEach((at, i) =>
          beam(
            c,
            p,
            p.chain && i > 0
              ? scene.tokens.find((t) => t.id === e.targets[p.chainFromLast ? i - 1 : 0]) || actor
              : actor,
            at,
            t,
            i,
          ),
        );
      }
      if (!p.shape && p.mode === 'point')
        for (const at of points)
          localEffect(c, p, at.x, at.y, scene.grid.size * 0.7, t, opacity * 0.8);
      if (p.destinationRange)
        for (const at of points)
          localEffect(c, p, at.x, at.y, scene.grid.size * 0.7, t, opacity * 0.8);
    }
  }
}
export function drawSpellPreview(
  c: CanvasRenderingContext2D,
  scene: VttScene,
  preview: SpellPreview,
  view: View,
  zoom: number,
) {
  const actor = scene.tokens.find((t) => t.id === preview.actorId);
  if (!actor) return;
  const p = preview.profile,
    f = pixelsPerFoot(scene.grid);
  c.save();
  c.lineWidth = 1.5 / zoom;
  c.strokeStyle = '#d9cba0';
  c.setLineDash([5 / zoom, 5 / zoom]);
  c.beginPath();
  c.arc(actor.x, actor.y, p.range * f, 0, tau);
  c.stroke();
  c.setLineDash([]);
  const points = p.mode === 'self' ? [{ x: actor.x, y: actor.y, angle: 0 }] : preview.points;
  for (const at of points) {
    for (const cell of spellCells(p, at, scene, view)) {
      c.fillStyle = alpha(p.visual.color, 0.17);
      c.fillRect(cell.x + 1, cell.y + 1, scene.grid.size - 2, scene.grid.size - 2);
      c.strokeStyle = alpha(p.visual.light, 0.4);
      c.lineWidth = 0.8 / zoom;
      c.strokeRect(cell.x + 1, cell.y + 1, scene.grid.size - 2, scene.grid.size - 2);
    }
    spellPath(c, p, at, f);
    c.strokeStyle = p.visual.light;
    c.lineWidth = 2 / zoom;
    c.stroke();
  }
  for (const id of new Set(preview.targets)) {
    const t = scene.tokens.find((t) => t.id === id);
    if (!t) continue;
    c.strokeStyle = '#b5dfb8';
    c.lineWidth = 2.5 / zoom;
    c.strokeRect(
      t.x - t.width / 2 - 5 / zoom,
      t.y - t.height / 2 - 5 / zoom,
      t.width + 10 / zoom,
      t.height + 10 / zoom,
    );
    const n = preview.targets.filter((a) => a === id).length;
    c.fillStyle = '#d9efc5';
    c.font = 'bold ' + 14 / zoom + 'px Inter,sans-serif';
    c.textAlign = 'center';
    c.fillText(n > 1 ? '×' + n : '✓', t.x, t.y - t.height / 2 - 12 / zoom);
  }
  c.restore();
}
