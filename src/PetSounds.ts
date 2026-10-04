import { useEffect, useRef } from 'react';
import { useSoundEffects } from './SiteMusic';
import { petAppearance } from '../shared/pets';

// Short, locally synthesized animal voices; no tracking or third-party audio requests.
export function usePetAppearanceSound(petId: string, appearance: string) {
  const preferences = useSoundEffects();
  const settings = useRef(preferences);
  settings.current = preferences;
  const audio = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  useEffect(() => {
    let cancelled = false,
      sounded = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (timer) clearTimeout(timer);
      const context = audio.current;
      audio.current = null;
      master.current = null;
      if (context) void context.close().catch(() => {});
    };
    const play = async () => {
      if (
        cancelled ||
        sounded ||
        settings.current.muted ||
        !settings.current.volume ||
        document.hidden
      )
        return;
      stop();
      try {
        const context = new AudioContext();
        audio.current = context;
        await context.resume();
        if (cancelled || audio.current !== context || context.state !== 'running') return;
        sounded = true;
        const output = context.createGain();
        output.gain.value = settings.current.volume * 0.32;
        output.connect(context.destination);
        master.current = output;
        const t = context.currentTime + 0.025;
        const tone = (
          at: number,
          duration: number,
          start: number,
          end: number,
          amplitude: number,
          rough = false,
        ) => {
          const voice = context.createOscillator(),
            gain = context.createGain(),
            filter = context.createBiquadFilter();
          voice.type = rough ? 'sawtooth' : 'sine';
          voice.frequency.setValueAtTime(start, t + at);
          voice.frequency.exponentialRampToValueAtTime(end, t + at + duration);
          filter.type = 'lowpass';
          filter.frequency.value = rough ? 1100 : 5000;
          gain.gain.setValueAtTime(0.0001, t + at);
          gain.gain.exponentialRampToValueAtTime(amplitude, t + at + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + at + duration);
          voice.connect(filter).connect(gain).connect(output);
          voice.start(t + at);
          voice.stop(t + at + duration + 0.02);
        };
        const rustle = (duration: number, frequency: number, amplitude: number) => {
          const buffer = context.createBuffer(
              1,
              Math.ceil(context.sampleRate * duration),
              context.sampleRate,
            ),
            samples = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++)
            samples[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / samples.length);
          const source = context.createBufferSource(),
            filter = context.createBiquadFilter(),
            gain = context.createGain();
          source.buffer = buffer;
          filter.type = 'bandpass';
          filter.frequency.value = frequency;
          filter.Q.value = 0.6;
          gain.gain.value = amplitude;
          source.connect(filter).connect(gain).connect(output);
          source.start(t);
        };
        switch (petId) {
          case 'dog':
            tone(0, 0.18, 190, 80, 0.7, true);
            tone(0.28, 0.22, 210, 75, 0.55, true);
            rustle(0.5, 700, 0.18);
            break;
          case 'cat':
            tone(0, 0.5, 410, 260, 0.65, true);
            tone(0.06, 0.36, 790, 480, 0.16);
            break;
          case 'owl':
            tone(0, 0.23, 520, 390, 0.7);
            tone(0.32, 0.38, 470, 390, 0.65);
            break;
          case 'raven':
            tone(0, 0.25, 570, 210, 0.6, true);
            tone(0.34, 0.28, 580, 230, 0.45, true);
            rustle(0.6, 1500, 0.22);
            break;
          case 'fox':
            tone(0, 0.14, 700, 260, 0.65, true);
            tone(0.25, 0.12, 760, 330, 0.45, true);
            break;
          case 'frog':
            tone(0, 0.22, 165, 100, 0.8, true);
            tone(0.3, 0.23, 145, 90, 0.7, true);
            break;
          case 'snake':
            rustle(0.8, 3800, 0.8);
            break;
          case 'rat':
            tone(0, 0.11, 2250, 1650, 0.35);
            tone(0.22, 0.14, 2500, 1800, 0.3);
            break;
          case 'guinea-pig':
            tone(0, 0.22, 1150, 1700, 0.4);
            tone(0.28, 0.25, 1350, 1900, 0.4);
            break;
          default:
            rustle(0.5, 1800, 0.35);
            tone(0.05, 0.06, 130, 80, 0.25);
            tone(0.25, 0.06, 140, 80, 0.2);
        }
        timer = setTimeout(stop, 1500);
      } catch {
        stop();
      }
    };
    const variant = petAppearance(petId, appearance),
      image = new Image();
    image.onload = () => {
      if (!cancelled) void play();
    };
    image.src = variant ? `/pets/variants-${variant.atlas}-v1.png` : '/pets/animals-v1.png';
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
  }, [petId, appearance]);
  useEffect(() => {
    if (master.current)
      master.current.gain.value = preferences.muted ? 0 : preferences.volume * 0.32;
    if ((preferences.muted || !preferences.volume) && audio.current) {
      const context = audio.current;
      audio.current = null;
      master.current = null;
      void context.close().catch(() => {});
    }
  }, [preferences.muted, preferences.volume]);
}
