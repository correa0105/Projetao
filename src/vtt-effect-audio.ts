import { useCallback, useEffect, useRef } from 'react';
import { useSoundEffects } from './SiteMusic';
export function useVttEffectAudio(enabled: boolean, volume: number) {
  const channel = useSoundEffects(),
    settings = useRef({ enabled, volume, channel });
  settings.current = { enabled, volume, channel };
  const audio = useRef(new Set<HTMLAudioElement>());
  const stop = useCallback(() => {
    for (const a of audio.current) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    audio.current.clear();
  }, []);
  useEffect(() => {
    if (!enabled || channel.muted || !volume || !channel.volume) stop();
    else for (const a of audio.current) a.volume = volume * channel.volume;
  }, [enabled, volume, channel.muted, channel.volume, stop]);
  useEffect(() => stop, [stop]);
  const play = useCallback((path: string) => {
    const o = settings.current;
    if (!o.enabled || !o.volume || o.channel.muted || !o.channel.volume || document.hidden) return;
    // Bound simultaneous short cues; no ongoing loops for permanent token effects.
    if (audio.current.size >= 8) return;
    const a = new Audio(path);
    a.volume = o.volume * o.channel.volume;
    audio.current.add(a);
    const done = () => {
      a.onended = null;
      a.onerror = null;
      audio.current.delete(a);
      a.pause();
      a.removeAttribute('src');
      a.load();
    };
    a.onended = done;
    a.onerror = done;
    void a.play().catch(done);
  }, []);
  return { play, stop };
}
