import { useEffect, useRef, useState } from 'react';
import { useMusicInterlude, useSoundEffects } from './SiteMusic';

export const atriumBlackoutMs = 4200;
export const atriumCrimsonMs = 5100;
type Phase = 'idle' | 'fading' | 'dark' | 'crimson';

// The clock and CSS both pause in a hidden tab. Closing the dialogue discards the cue.
export function useAtriumReaction(active: boolean): Phase {
  const [phase, setPhase] = useState<Phase>('idle');
  const { beginInterlude } = useMusicInterlude();
  useEffect(() => {
    if (!active) {
      setPhase('idle');
      return;
    }
    let elapsed = 0;
    let started = performance.now();
    let running = !document.hidden;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      clearTimeout(timer);
      const now = performance.now();
      if (running) elapsed += now - started;
      started = now;
      running = !document.hidden;
      setPhase(
        elapsed < atriumBlackoutMs ? 'fading' : elapsed < atriumCrimsonMs ? 'dark' : 'crimson',
      );
      if (running && elapsed < atriumCrimsonMs) {
        const boundary = elapsed < atriumBlackoutMs ? atriumBlackoutMs : atriumCrimsonMs;
        timer = setTimeout(advance, boundary - elapsed);
      }
    };
    advance();
    document.addEventListener('visibilitychange', advance);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', advance);
    };
  }, [active]);
  const current = active ? phase : 'idle';
  const silent = current === 'dark' || current === 'crimson';
  useEffect(() => {
    if (silent) return beginInterlude();
  }, [silent, beginInterlude]);
  return current;
}

export function AtriumWind({ active }: { active: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const { muted, volume } = useSoundEffects();
  const settings = useRef({ muted, volume });
  settings.current = { muted, volume };
  useEffect(() => {
    const sound = audio.current!;
    sound.volume = volume;
    sound.muted = muted;
    if (muted || volume === 0) sound.pause();
  }, [muted, volume]);
  useEffect(() => {
    if (!active) return;
    const sound = audio.current!;
    let live = true;
    let interrupted = document.hidden && !settings.current.muted && settings.current.volume > 0;
    const play = () => {
      if (!live || document.hidden || settings.current.muted || settings.current.volume === 0)
        return;
      void sound
        .play()
        .then(() => {
          if (!live || document.hidden || settings.current.muted || settings.current.volume === 0)
            sound.pause();
        })
        .catch(() => {});
    };
    const visibility = () => {
      if (document.hidden) {
        interrupted = !sound.paused;
        sound.pause();
      } else if (interrupted) {
        interrupted = false;
        play();
      }
    };
    sound.currentTime = 0;
    play();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      live = false;
      sound.pause();
      sound.currentTime = 0;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [active]);
  return (
    <audio
      ref={audio}
      src="/audio/atrium-corridor-wind-20261031.ogg"
      preload="auto"
      muted={muted}
      data-atrium-wind
      aria-hidden="true"
    />
  );
}
