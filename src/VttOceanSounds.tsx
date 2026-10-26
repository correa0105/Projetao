import { useEffect, useRef } from 'react';
import type { VttScene } from '../shared/vtt';
import { emptySoundboard, type SoundSnapshot } from '../shared/vtt-sounds';
import { useSoundEffects } from './SiteMusic';
import { VttSoundEngine } from './vtt-sound-engine';

// Shared scene settings feed the existing bounded audio engine. At most two
// loops; no audio downloads while muted, no connection or polling of its own.
export function VttOceanSounds({
  roomId,
  scene,
  enabled,
  volume,
}: {
  roomId: string;
  scene: VttScene;
  enabled: boolean;
  volume: number;
}) {
  const engine = useRef<VttSoundEngine | null>(null),
    channel = useSoundEffects();
  const sea = scene.ocean?.enabled ? scene.ocean.seaVolume : 0,
    wind = scene.ocean?.enabled ? scene.ocean.windVolume : 0;
  const active =
    enabled && !channel.muted && volume > 0 && channel.volume > 0 && (sea > 0 || wind > 0);
  useEffect(() => {
    if (!active) return;
    const player = new VttSoundEngine(
      () => {},
      () => {},
    );
    engine.current = player;
    const unlock = () => {
      player.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      player.dispose();
      engine.current = null;
    };
  }, [roomId, scene.id, active]);
  useEffect(() => {
    const board = emptySoundboard();
    board.volume = volume;
    for (const [sourceId, gain] of [
      ['amb-ocean-waves', sea],
      ['amb-scene-park-wind', wind],
    ] as const)
      if (gain > 0)
        board.voices.push({
          id: scene.id + ':' + sourceId,
          sourceId,
          channel: 'ambience',
          volume: gain,
          loop: true,
          startedAt: 0,
        });
    const snapshot: SoundSnapshot = {
      revision: 1,
      serverTime: Date.now(),
      soundboard: board,
      music: { assetId: null, playing: false, loop: true, volume: 0 },
    };
    engine.current?.sync(snapshot, { muted: true, volume: 0 }, channel);
  }, [roomId, scene.id, active, sea, wind, volume, channel.volume, channel.muted]);
  return null;
}
