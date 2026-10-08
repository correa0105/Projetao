import { useEffect, useRef } from 'react';
import { viewerSees, type VttScene, type VttToken } from '../shared/vtt';
import { effectSound } from '../shared/vtt-effect-sounds';
import { useVttEffectAudio } from './vtt-effect-audio';
export function VttEffectSounds({
  roomId,
  scene,
  gm,
  preview,
  viewer,
  enabled,
  volume,
}: {
  roomId: string;
  scene: VttScene;
  gm: boolean;
  preview: boolean;
  viewer: VttToken | null;
  enabled: boolean;
  volume: number;
}) {
  const initialized = useRef(''),
    seen = useRef(new Set<string>()),
    audio = useVttEffectAudio(enabled, volume);
  useEffect(() => {
    const keys = new Set<string>(),
      sounds = new Set<string>();
    for (const token of scene.tokens) {
      const visible =
        token.layer === 'tokens' &&
        ((gm && !preview) ||
          (!token.hidden && (!preview || (!!viewer && viewerSees(viewer, token, scene)))));
      const effects = [
        ...token.effects,
        ...(token.deathAt ? [{ id: 'death', kind: 'death' as const, at: token.deathAt }] : []),
      ];
      for (const e of effects) {
        const key = scene.id + ':' + token.id + ':' + e.id + ':' + e.at;
        keys.add(key);
        if (
          initialized.current === roomId &&
          visible &&
          !seen.current.has(key) &&
          Date.now() - e.at >= 0 &&
          Date.now() - e.at < 10000
        )
          sounds.add(effectSound(e.kind));
      }
    }
    if (initialized.current !== roomId) {
      audio.stop();
      initialized.current = roomId;
    } else for (const path of sounds) audio.play(path);
    seen.current = keys;
  }, [roomId, scene, gm, preview, viewer, audio.play, audio.stop]);
  return null;
}
