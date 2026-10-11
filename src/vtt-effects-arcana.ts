import { arcanaEffects } from '../shared/vtt-effects-arcana';
import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import {
  drawRadiant,
  radiantReady,
  radiantCacheSize,
  warmRadiantEffects,
} from './vtt-effects-radiant';
const kinds = new Set<string>(arcanaEffects.map((e) => e.kind));
export async function warmArcanaEffects() {
  await warmRadiantEffects();
  return arcanaEffects.length;
}
export const arcanaEffectReady = radiantReady;
export const arcanaCacheSize = radiantCacheSize;
export function drawArcanaEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  _random: (i: number) => number,
  front: boolean,
  _detail: number,
) {
  return kinds.has(e.kind) && drawRadiant(c, e, f, t, front);
}
