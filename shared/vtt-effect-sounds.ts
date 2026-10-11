import type { EffectKind } from './vtt-effects';
import { livingEffectKinds } from './vtt-effects-living';
export function effectSound(kind: EffectKind) {
  if ((livingEffectKinds as readonly string[]).includes(kind))
    return '/audio/vtt-living-20261010/' + kind + '.wav';
  return (
    '/audio/vtt-effects-20261009/' +
    (kind === 'arcane-barrier' ? 'prismatic-barrier' : kind) +
    '.ogg'
  );
}
