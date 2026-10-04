import { useCallback, useEffect, useRef } from 'react';
import { useSoundEffects } from './SiteMusic';

const sounds = {
  cover: { src: '/audio/shop-counter-leather.wav', gain: 0.65, length: 1.25 },
  page: { src: '/audio/shop-counter-paper.wav', gain: 0.85, length: 1.1 },
};

export function useRulebookSound(active: boolean) {
  const { volume, muted } = useSoundEffects();
  const preferences = useRef({ active, volume, muted });
  preferences.current = { active, volume, muted };
  const players = useRef(new Map<keyof typeof sounds, HTMLAudioElement>());
  const stops = useRef(new Map<keyof typeof sounds, ReturnType<typeof setTimeout>>());
  const stop = useCallback(() => {
    stops.current.forEach(clearTimeout);
    stops.current.clear();
    players.current.forEach((player) => player.pause());
  }, []);

  useEffect(() => {
    players.current.forEach((player, kind) => {
      player.volume = Math.min(1, volume * sounds[kind].gain);
      player.muted = muted;
    });
    if (!active || muted || volume === 0) stop();
  }, [active, volume, muted, stop]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      stop();
      players.current.clear();
    };
  }, [stop]);

  return useCallback(
    (kind: keyof typeof sounds) => {
      const prefs = preferences.current;
      if (!prefs.active || prefs.muted || prefs.volume === 0 || document.hidden) return;
      // Restart one short recorded effect per gesture; fast navigation never stacks audio.
      stop();
      let player = players.current.get(kind);
      if (!player) {
        player = new Audio(sounds[kind].src);
        player.preload = 'auto';
        players.current.set(kind, player);
      }
      player.volume = Math.min(1, prefs.volume * sounds[kind].gain);
      player.muted = false;
      player.currentTime = 0;
      void player.play().catch(() => {});
      stops.current.set(
        kind,
        setTimeout(() => player.pause(), sounds[kind].length * 1000),
      );
    },
    [stop],
  );
}
