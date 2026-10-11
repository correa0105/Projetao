import { livingEffects } from '../shared/vtt-effects-living';
import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { drawArgentCrossroads } from './vtt-argent-crossroads';
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
export const livingEffectReady = (kind: string) =>
  kind === 'argent-crossroads' ? Promise.resolve() : radiantReady(kind);
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
  if (drawArgentCrossroads(c, e, f, t, front ? 'front' : 'behind')) return true;
  return kinds.has(e.kind) && drawRadiant(c, e, f, t, front);
}
