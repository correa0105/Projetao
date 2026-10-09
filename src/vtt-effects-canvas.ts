import type { VttToken } from '../shared/vtt';
import { effectEnds, type TokenEffect } from '../shared/vtt-effects';
import { drawEffectLayer } from './vtt-effects-front';
import { seededRandom } from './vtt-effects-primitives';
import { effectFootprint } from './vtt-effect-footprint';
import { drawOverheadEffect } from './vtt-effects-overhead';

export type EffectRenderOptions = {
  pass?: 'behind' | 'front';
  now?: number;
  reducedMotion?: boolean;
  seed?: string;
  overhead?: boolean;
  image?: HTMLImageElement;
  flipX?: boolean;
  flipY?: boolean;
};
// The ellipse follows actual token geometry. Scale remains the saved user value;
// this does not change the token or its hit box.
export function effectGeometry(width: number, height: number, scale: number) {
  if (![width, height, scale].every(Number.isFinite) || width <= 0 || height <= 0 || scale <= 0)
    return null;
  return {
    rx: width * 0.65 * scale,
    ry: height * 0.65 * scale,
    detail: Math.min(width, height) * scale < 42 ? 0.55 : 1,
  };
}
export function effectFrame(effect: TokenEffect, now: number, reducedMotion: boolean) {
  const end = effectEnds(effect);
  if (effect.kind === 'death' || now < effect.at || (end && now >= end)) return null;
  const age = (now - effect.at) / 1000;
  return {
    t: reducedMotion ? 1.25 : age,
    alpha:
      (reducedMotion ? 1 : Math.min(1, age / 0.18)) * (end ? Math.min(1, (end - now) / 600) : 1),
  };
}
export function renderEffect(
  c: CanvasRenderingContext2D,
  effect: TokenEffect,
  width: number,
  height: number,
  options: EffectRenderOptions = {},
) {
  const now = options.now ?? Date.now(),
    reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    geometry = effectGeometry(width, height, effect.scale),
    frame = effectFrame(effect, now, reduced);
  if (!geometry || !frame || frame.alpha <= 0) return false;
  c.save();
  try {
    c.scale(geometry.rx / 100, geometry.ry / 100);
    c.globalAlpha *= frame.alpha;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const random = seededRandom((options.seed || '') + effect.id);
    if (options.overhead !== false) {
      c.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
      const footprint = effectFootprint(width, height, geometry.rx, geometry.ry, options.image);
      // Surface masks fit the real art; the saved effect size expands the
      // airborne volume/floor plane instead of cancelling through normalization.
      footprint.plane.rx *= effect.scale;
      footprint.plane.ry *= effect.scale;
      drawOverheadEffect(
        c,
        effect,
        footprint,
        frame.t,
        random,
        options.pass || 'behind',
        geometry.detail,
      );
    } else
      drawEffectLayer(c, effect, 100, frame.t, random, options.pass || 'behind', geometry.detail);
  } finally {
    c.restore();
  }
  return true;
}
export function drawTokenEffects(
  c: CanvasRenderingContext2D,
  token: VttToken,
  pass: 'behind' | 'front' = 'behind',
  image?: HTMLImageElement,
) {
  if (token.layer === 'map') return;
  const now = Date.now(),
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const effect of token.effects)
    renderEffect(c, effect, token.width, token.height, {
      now,
      reducedMotion,
      pass,
      seed: token.id,
      // Every table token uses the same floor-plane renderer, including private
      // character art, imported portraits and custom images. URLs do not select
      // a different generation of effects.
      overhead: true,
      image,
      flipX: token.flipX,
      flipY: token.flipY,
    });
}
