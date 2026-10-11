import type { EffectKind } from '../shared/vtt-effects';

// Precipitation belongs to the scene's gravity, not the actor's facing or flips.
// Body materials and orbital effects keep following the token as before.
const precipitation = new Set<EffectKind>([
  'blizzard',
  'acid-rain',
  'hail',
  'thunderstorm',
  'rain-curtain',
  'snow-drift',
  'falling-blossoms',
  'celestial-rain',
  'aether-drops',
  'opal-cascade',
  'starlit-fall',
]);
export const sceneOrientedEffect = (kind: EffectKind) => precipitation.has(kind);
