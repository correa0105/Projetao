import { useEffect, useRef } from 'react';
import type { SpellEffect } from '../shared/vtt-spells';
import { spellProfile } from '../shared/vtt-spells';
import { useVttEffectAudio } from './vtt-effect-audio';
const sounds: Record<string, string> = {
  fire: 'fire',
  frost: 'ice',
  lightning: 'electric',
  acid: 'poison',
  poison: 'poison',
  heal: 'healing',
  radiant: 'healing',
  nature: 'leaves',
  necrotic: 'necrotic',
  psychic: 'sonic',
  illusion: 'arcane',
  portal: 'portal',
  water: 'water',
  wind: 'wind',
  earth: 'earth',
  time: 'arcane',
  ward: 'shield',
  divination: 'arcane',
  force: 'arcane',
};
export function VttSpellSounds({
  roomId,
  loaded,
  effects,
  enabled,
  volume,
}: {
  roomId: string;
  loaded: boolean;
  effects: SpellEffect[];
  enabled: boolean;
  volume: number;
}) {
  const audio = useVttEffectAudio(enabled, volume),
    initialized = useRef(''),
    seen = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded) {
      initialized.current = '';
      audio.stop();
      return;
    }
    if (initialized.current !== roomId) {
      audio.stop();
      initialized.current = roomId;
      seen.current = new Set(effects.map((e) => e.id));
      return;
    }
    for (const e of effects) {
      if (!seen.current.has(e.id) && Date.now() - e.started >= 0 && Date.now() - e.started < 3500)
        audio.play(
          spellProfile(e.spellId)
            ? '/audio/vtt-spells-20261009/' + spellProfile(e.spellId)!.id + '.ogg'
            : '/audio/vtt-effects/' + (sounds[e.profile.visual.family] || 'arcane') + '.wav',
          Math.max(0, (Date.now() - e.started) / 1000),
        );
      seen.current.add(e.id);
    }
    if (seen.current.size > 1500) seen.current = new Set(effects.map((e) => e.id));
  }, [roomId, loaded, effects, audio.play, audio.stop]);
  return null;
}
