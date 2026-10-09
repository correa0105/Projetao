import type { TokenEffect } from '../shared/vtt-effects';
import { extraEffectKinds } from '../shared/vtt-effects-extra';
import type { EffectFootprint } from './vtt-effect-footprint';
import { continuousPhenomenon } from './vtt-effects-continuous';
import type { Phenomenon } from '../shared/vtt-effects-cinematic';
import { materialSprite } from './vtt-effects-materials';
import {
  petrificationSurface,
  physicalProp,
  naturalEarth,
  type PhysicalProp,
} from './vtt-effects-physical';
import { energyShell, livingVine, volumeMotes } from './vtt-effects-volume';
import { alpha, fract, glow, tau, tint } from './vtt-effects-primitives';
const models = new Set<string>(extraEffectKinds);
const rows: Record<string, [Phenomenon['family'], Phenomenon['layout'], number, number]> = {
  inferno: ['fire', 'ring', 0.7, 28],
  'blue-fire': ['fire', 'jet', 0.9, 23],
  'soul-flames': ['soul', 'surge', 0.42, 25],
  'acid-rain': ['acid', 'rain', 0.9, 38],
  hail: ['ice', 'rain', 0.9, 33],
  'ice-lattice': ['ice', 'bloom', 0.2, 25],
  steam: ['air', 'jet', 0.6, 28],
  sandstorm: ['air', 'spiral', 0.8, 38],
  earthquake: ['earth', 'burst', 0.35, 25],
  thunderstorm: ['electric', 'cage', 3.5, 26],
  bubbles: ['water', 'bloom', 0.18, 20],
  'solar-halo': ['light', 'ring', 0.3, 30],
  'lunar-halo': ['light', 'orbit', 0.15, 23],
  starfield: ['light', 'cage', 0.17, 22],
  comets: ['light', 'comet', 0.66, 19],
  'mirror-shield': ['light', 'ring', 0.16, 24],
  'prismatic-barrier': ['light', 'ring', 0.3, 33],
  clockwork: ['earth', 'orbit', 0.15, 15],
  'gravity-well': ['soul', 'spiral', 0.32, 26],
  'astral-threads': ['soul', 'rift', 0.3, 29],
  'spectral-chains': ['soul', 'cage', 0.2, 25],
  'thorn-cage': ['nature', 'cage', 0.16, 26],
  spores: ['nature', 'bloom', 0.14, 32],
  mushrooms: ['nature', 'orbit', 0.12, 17],
  butterflies: ['nature', 'orbit', 0.4, 17],
  feathers: ['nature', 'surge', 0.26, 24],
  rage: ['fire', 'burst', 0.9, 28],
  sleep: ['soul', 'bloom', 0.12, 25],
  fear: ['soul', 'surge', 0.28, 28],
  petrify: ['earth', 'orbit', 0.14, 13],
};
export function drawAdvancedEffects(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: (i: number) => number,
  pass: 'behind' | 'front',
  detail: number,
) {
  if (!models.has(e.kind)) return false;
  const front = pass === 'front',
    color = e.color;
  if (e.kind === 'earthquake') {
    naturalEarth(c, e, f, t, random, front);
    return true;
  }
  c.save();
  if (e.kind === 'petrify' && front)
    petrificationSurface(c, f, color, (e.intensity ?? 0.8) * Math.min(1, 0.3 + t / 3.5));
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  const [family, layout, speed, count] = rows[e.kind],
    model: Phenomenon = { family, layout, speed, count, spread: 1, name: e.kind };
  const special: Partial<Record<string, PhysicalProp>> = {
    clockwork: 'gear',
    'spectral-chains': 'chain',
    mushrooms: 'mushrooms',
    butterflies: 'butterfly',
    feathers: 'feather',
    fear: 'skull',
    bubbles: 'droplet',
  };
  const prop = special[e.kind];
  if (prop) {
    const total = Math.max(
      5,
      Math.round(
        (prop === 'chain' ? 42 : prop === 'gear' ? 8 : prop === 'droplet' ? 20 : 14) * detail,
      ),
    );
    for (let i = 0; i < total; i++) {
      if ((i % 2 === 0) !== front) continue;
      const u = fract(t * speed + random(i)),
        a = (i / total) * tau + t * (prop === 'chain' ? 0.12 : prop === 'gear' ? 0.06 : 0.2),
        r = prop === 'chain' ? 82 : prop === 'gear' ? 76 : 51 + u * 46;
      c.save();
      c.translate(Math.cos(a) * r, Math.sin(a) * r);
      c.rotate(a + Math.PI / 2);
      if (prop === 'butterfly') c.scale(0.18 + Math.abs(Math.sin(t * 7 + i)) * 0.82, 1);
      if (prop === 'feather') c.scale(0.45 + Math.abs(Math.cos(t * 1.8 + i)) * 0.55, 1);
      physicalProp(
        c,
        prop,
        0,
        0,
        prop === 'gear'
          ? 43
          : prop === 'chain'
            ? 25
            : prop === 'droplet'
              ? 18 + random(i) * 11
              : prop === 'mushrooms'
                ? 39
                : 27,
        prop === 'gear' ? t * (i % 2 ? -0.6 : 0.6) : Math.sin(t + i) * 0.15,
        Math.sin(u * Math.PI) * (front ? 0.93 : 0.7),
        color,
      );
      c.restore();
    }
    if (prop === 'droplet' && front)
      for (let i = 0; i < 3; i++) {
        const u = fract(t * 0.22 + i / 3);
        c.beginPath();
        c.arc(0, 0, 25 + u * 73, 0, tau);
        c.strokeStyle = alpha(color, (1 - u) * 0.24);
        c.lineWidth = 0.8;
        c.stroke();
      }
    if (!front)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * tau;
        materialSprite(
          c,
          color,
          'vapor',
          Math.cos(a) * 72,
          Math.sin(a) * 72,
          54,
          a,
          t * 0.5 + i,
          0.2,
        );
      }
  } else if (e.kind === 'ice-lattice') {
    if (!front)
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * tau,
          r = 77 + random(i + 19) * 12;
        physicalProp(
          c,
          'ice',
          Math.cos(a) * r,
          Math.sin(a) * r,
          34 + random(i + 31) * 16,
          a + Math.PI / 2,
          0.93,
          color,
        );
        materialSprite(
          c,
          '#e7f5fb',
          'vapor',
          Math.cos(a) * r,
          Math.sin(a) * r,
          42,
          a,
          t * 0.65 + i,
          0.23,
        );
      }
    else volumeMotes(c, '#ecf9ff', 102, t * 0.9, random, Math.round(28 * detail), 0.7);
  } else if (e.kind === 'thorn-cage') {
    for (let i = 0; i < 7; i++) {
      c.save();
      c.rotate((i / 7) * tau);
      c.globalAlpha *= front ? 0.53 : 0.73;
      livingVine(c, color, 95, t, i);
      c.restore();
    }
    continuousPhenomenon(c, model, color, t, random, front, detail * 0.6);
  } else if (e.kind === 'spores') {
    if (!front)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * tau;
        materialSprite(
          c,
          color,
          'vapor',
          Math.cos(a) * 68,
          Math.sin(a) * 68,
          65,
          a,
          t * 0.3 + i,
          0.31,
        );
      }
    else volumeMotes(c, tint(color, 0.5), 97, t * 0.65, random, Math.round(44 * detail), 0.82);
  } else if (e.kind === 'petrify') {
    if (front)
      for (let i = 0; i < 9; i++) {
        const u = fract(t * 0.2 + random(i)),
          a = random(i + 29) * tau,
          r = 76 + u * 26;
        physicalProp(
          c,
          'rubble',
          Math.cos(a) * r,
          Math.sin(a) * r,
          18,
          t * 0.1 + i,
          Math.sin(u * Math.PI) * 0.6,
          color,
        );
      }
  } else {
    if (['mirror-shield', 'prismatic-barrier', 'solar-halo'].includes(e.kind))
      energyShell(c, color, 88, t, front ? 0.56 : 0.35, e.kind === 'prismatic-barrier');
    continuousPhenomenon(c, model, color, t, random, front, detail);
    if (e.kind === 'thunderstorm' && !front)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * tau;
        materialSprite(
          c,
          '#8293ab',
          'vapor',
          Math.cos(a) * 75,
          Math.sin(a) * 75,
          68,
          a,
          t * 0.55 + i,
          0.52,
        );
      }
    if (e.kind === 'starfield' && front) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * tau + t * 0.045,
          r = 70 + Math.sin(i) * 13;
        glow(
          c,
          Math.cos(a) * r,
          Math.sin(a) * r,
          2.1,
          tint(color, 0.7),
          0.65 + Math.sin(t * 2 + i) * 0.25,
        );
      }
    }
  }
  c.restore();
  return true;
}
