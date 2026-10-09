import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { drawRebuiltFire, rebuiltFireKinds } from './vtt-effects-rebuilt-fire';
import { drawRebuiltLightning, rebuiltLightningKinds } from './vtt-effects-rebuilt-lightning';
import { drawRebuiltMagic, rebuiltMagicKinds } from './vtt-effects-rebuilt-magic';
import { drawRebuiltAtmosphere, rebuiltAtmosphereKinds } from './vtt-effects-rebuilt-atmosphere';
export const rebuiltEffectKinds = new Set([
  ...rebuiltFireKinds,
  ...rebuiltLightningKinds,
  ...rebuiltMagicKinds,
  ...rebuiltAtmosphereKinds,
]);
export function drawRebuiltEffect(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  random: (i: number) => number,
  front: boolean,
  detail: number,
) {
  if (!rebuiltEffectKinds.has(e.kind)) return false;
  c.save();
  try {
    c.scale(f.plane.rx / 80, f.plane.ry / 80);
    if (rebuiltFireKinds.has(e.kind)) drawRebuiltFire(c, e, t, random, front, detail);
    else if (rebuiltLightningKinds.has(e.kind)) drawRebuiltLightning(c, e, t, random, front);
    else if (rebuiltMagicKinds.has(e.kind)) drawRebuiltMagic(c, e, f, t, random, front, detail);
    else drawRebuiltAtmosphere(c, e, f, t, random, front, detail);
  } finally {
    c.restore();
  }
  return true;
}
