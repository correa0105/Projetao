import { livingEffects } from '../shared/vtt-effects-living';
import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import {
  drawRadiant,
  radiantReady,
  radiantCacheSize,
  warmRadiantEffects,
} from './vtt-effects-radiant';
const kinds = new Set<string>(livingEffects.map((e) => e.kind));
export async function warmLivingEffects() {
  await warmRadiantEffects();
  return livingEffects.length;
}
export const livingEffectReady = radiantReady;
export const livingCacheSize = radiantCacheSize;
export function drawLivingEffect(
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
