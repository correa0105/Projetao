import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useMusicInterlude, useSoundEffects } from './SiteMusic';
import { VttSoundEngine } from './vtt-sound-engine';
import type { SoundSnapshot, SoundSettings } from '../shared/vtt-sounds';
export function useVttSounds(roomId: string | undefined) {
  const [snapshot, setSnapshot] = useState<SoundSnapshot | null>(null),
    [error, setError] = useState(''),
    [, redraw] = useState(0);
  const music = useMusicInterlude(),
    effects = useSoundEffects(),
    engine = useRef<VttSoundEngine | null>(null),
    latest = useRef<SoundSnapshot | null>(null);
  const volumes = useRef({ music, effects });
  volumes.current = { music, effects };
  function accept(next: SoundSnapshot) {
    if (latest.current && next.revision < latest.current.revision) return;
    latest.current = next;
    setSnapshot(next);
    engine.current?.sync(next, volumes.current.music, volumes.current.effects);
  }
  useEffect(() => {
    latest.current = null;
    setSnapshot(null);
    setError('');
    if (!roomId) return;
    let live = true,
      pending = false;
    const player = new VttSoundEngine(
      () => {
        if (live) redraw((n) => n + 1);
      },
      (message) => {
        if (live) setError(message);
      },
    );
    engine.current = player;
    const read = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const next = await api<SoundSnapshot>(`/vtt/rooms/${roomId}/sounds`);
        if (live) {
          accept(next);
          setError((old) => (old.startsWith('A conexão') ? '' : old));
        }
      } catch {
        if (live && latest.current) {
          player.sync(
            {
              ...latest.current,
              soundboard: { ...latest.current.soundboard, voices: [] },
              music: { ...latest.current.music, playing: false },
            },
            volumes.current.music,
            volumes.current.effects,
          );
          setError('A conexão com os sons da mesa foi interrompida. Tentando reconectar.');
        }
      } finally {
        pending = false;
      }
    };
    void read();
    const timer = setInterval(() => void read(), 1000);
    document.addEventListener('visibilitychange', read);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', read);
      player.dispose();
      engine.current = null;
    };
  }, [roomId]);
  useEffect(() => {
    if (latest.current) engine.current?.sync(latest.current, music, effects);
  }, [music.volume, music.muted, effects.volume, effects.muted]);
  return {
    snapshot,
    error,
    accept,
    active: (id: string) => engine.current?.active(id) || false,
    unlock: () => engine.current?.unlock(),
    preview: (s: SoundSettings) => engine.current?.previewSound(s),
    stopPreview: () => engine.current?.stopPreview(),
    previewing: engine.current?.previewing() || false,
  };
}
