import type { EffectKind } from './vtt-effects';
export function effectSound(kind: EffectKind) {
  return '/audio/vtt-effects-20261009/' + (kind === 'arcane-barrier' ? 'prismatic-barrier' : kind) + '.ogg';
}
