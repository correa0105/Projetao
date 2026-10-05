import { useEffect, useRef } from 'react';
import { useSoundEffects } from './SiteMusic';
import { petArtwork } from './pet-art';

// Freely licensed, short animal recordings; source credits ship with the local files.
const recorded = new Set(['dog', 'cat', 'owl', 'raven', 'fox', 'frog', 'rat', 'guinea-pig']);
export function usePetAppearanceSound(petId: string, appearance: string, trigger = 0) {
  const preferences = useSoundEffects(),
    settings = useRef(preferences);
  settings.current = preferences;
  const voice = useRef<HTMLAudioElement | null>(null),
    context = useRef<AudioContext | null>(null),
    gain = useRef<GainNode | null>(null);
  useEffect(() => {
    let cancelled = false,
      sounded = false,
      pending = false;
    const stop = () => {
      if (voice.current) {
        voice.current.onended = null;
        voice.current.pause();
        voice.current = null;
      }
      if (context.current) {
        void context.current.close().catch(() => {});
        context.current = null;
      }
      gain.current = null;
    };
    const play = async () => {
      if (
        cancelled ||
        sounded ||
        pending ||
        settings.current.muted ||
        !settings.current.volume ||
        document.hidden
      )
        return;
      pending = true;
      stop();
      try {
        if (recorded.has(petId)) {
          // Versioned file avoids cached raven recordings with speech or wind.
          const file = petId === 'raven' ? 'raven-caw-v3' : petId;
          const audio = new Audio(`/audio/pets/${file}.wav`);
          voice.current = audio;
          audio.volume = settings.current.volume * (petId === 'rat' ? 0.55 : 0.8);
          await audio.play();
          if (cancelled || settings.current.muted || !settings.current.volume || document.hidden) {
            audio.pause();
            return;
          }
          sounded = true;
          audio.onended = stop;
        } else {
          // Quiet pets: a gentle hiss or sniff. No electronic tone or impact.
          const audio = new AudioContext();
          context.current = audio;
          await audio.resume();
          if (
            cancelled ||
            context.current !== audio ||
            settings.current.muted ||
            document.hidden ||
            audio.state !== 'running'
          )
            return;
          const duration = petId === 'snake' ? 0.75 : 0.3;
          const buffer = audio.createBuffer(
              1,
              Math.ceil(audio.sampleRate * duration),
              audio.sampleRate,
            ),
            samples = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++)
            samples[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / samples.length) ** 1.5;
          const source = audio.createBufferSource(),
            filter = audio.createBiquadFilter(),
            output = audio.createGain();
          source.buffer = buffer;
          filter.type = 'bandpass';
          filter.frequency.value = petId === 'snake' ? 3400 : 950;
          filter.Q.value = 0.6;
          output.gain.value = settings.current.volume * (petId === 'snake' ? 0.24 : 0.035);
          gain.current = output;
          source.connect(filter).connect(output).connect(audio.destination);
          source.start();
          source.onended = stop;
          sounded = true;
        }
      } catch {
        stop();
      } finally {
        pending = false;
      }
    };
    const image = new Image();
    image.onload = () => {
      if (!cancelled) void play();
    };
    image.src = petArtwork(petId, appearance).source;
    const unlock = () => {
      if (image.complete && image.naturalWidth) void play();
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      image.onload = null;
      stop();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [petId, appearance, trigger]);
  useEffect(() => {
    if (voice.current) {
      voice.current.volume = preferences.volume * (petId === 'rat' ? 0.55 : 0.8);
      if (preferences.muted || !preferences.volume) voice.current.pause();
    }
    if (gain.current)
      gain.current.gain.value = preferences.muted
        ? 0
        : preferences.volume * (petId === 'snake' ? 0.24 : 0.035);
    if ((preferences.muted || !preferences.volume) && context.current) {
      void context.current.close().catch(() => {});
      context.current = null;
      gain.current = null;
    }
  }, [preferences.muted, preferences.volume, petId]);
}
