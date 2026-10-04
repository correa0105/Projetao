import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { shopWeight } from '../shared/armor-bundles';
import type { Item } from './types';
import { useMusicInterlude } from './SiteMusic';

type Settings = { muted: boolean; volume: number };
type Kind = 'wood' | 'liquid';
type SoundItem = Pick<Item, 'id' | 'name' | 'original_name' | 'category' | 'weight_lb'>;
const assets: Record<Kind, string> = {
  wood: '/audio/shop-counter-wood.wav',
  liquid: '/audio/shop-counter-liquid.wav',
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Physical weight, plus the object's illustrated size, determines the impact. */
export function shopCounterSoundProfile(item: SoundItem, size = 1) {
  const inputWeight = shopWeight(item);
  const weight = Number.isFinite(inputWeight) ? Math.max(0, inputWeight) : 1;
  const normalized = `${item.id} ${item.name} ${item.original_name} ${item.category}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const kind: Kind =
    /potion|pocao|pocoes|waterskin|cantil|\boil\b|oleo|liquid|frasco|flask|vial/.test(normalized)
      ? 'liquid'
      : 'wood';
  const mass = clamp(Math.log1p(weight) / Math.log(66), 0, 1);
  const extent = clamp((size - 1) / 0.22, 0, 1);
  const strength = clamp(mass * 0.85 + extent * 0.15, 0, 1);
  return {
    kind,
    weight,
    gain: clamp(0.32 + strength * 0.5, 0.32, 0.82),
    pitch: clamp(1.07 - strength * 0.24, 0.83, 1.07),
    cutoff: 7800 - strength * 3900,
  };
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode };

export function createShopCounterAudio(root: HTMLElement, initial: Settings) {
  let settings = initial;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let limiter: DynamicsCompressorNode | null = null;
  let disposed = false;
  let epoch = 0;
  let count = 0;
  let variation = 0;
  let decoding: Promise<void> | null = null;
  const buffers: Partial<Record<Kind, AudioBuffer>> = {};
  const voices = new Set<Voice>();
  const abort = new AbortController();
  const state = (value: string) => {
    root.dataset.counterAudioState = value;
    root.dataset.counterAudioContext = context?.state ?? 'none';
    root.dataset.counterAudioActive = String(voices.size);
    root.dataset.counterAudioCount = String(count);
    root.dataset.counterAudioMuted = String(settings.muted);
    root.dataset.counterAudioVolume = String(settings.volume);
  };
  const loading = Promise.all(
    (Object.entries(assets) as [Kind, string][]).map(async ([kind, url]) => {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error('Efeito do balcão indisponível.');
      return [kind, await response.arrayBuffer()] as const;
    }),
  ).catch(() => null);

  const stop = (voice: Voice) => {
    voices.delete(voice);
    voice.source.onended = null;
    try {
      voice.source.stop();
    } catch {}
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.filter.disconnect();
  };
  const close = (reason: string) => {
    epoch++;
    for (const voice of voices) stop(voice);
    const previous = context;
    context = null;
    master?.disconnect();
    limiter?.disconnect();
    master = null;
    limiter = null;
    state(reason);
    if (previous && previous.state !== 'closed')
      void previous
        .close()
        .catch(() => {})
        .then(() => {
          if (!context) root.dataset.counterAudioContext = 'closed';
        });
  };
  const allowed = () => !disposed && !document.hidden && !settings.muted && settings.volume > 0;
  const initialize = () => {
    if (
      !allowed() ||
      (navigator.userActivation && !navigator.userActivation.hasBeenActive) ||
      !window.AudioContext
    )
      return null;
    if (!context) {
      try {
        context = new AudioContext({ latencyHint: 'interactive' });
        root.dataset.counterAudioGesture = String(navigator.userActivation?.hasBeenActive ?? true);
        master = context.createGain();
        master.gain.value = clamp(settings.volume, 0, 1);
        limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -8;
        limiter.knee.value = 4;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.12;
        master.connect(limiter);
        limiter.connect(context.destination);
      } catch {
        close('unavailable');
        return null;
      }
    }
    return context;
  };
  const decode = (target: AudioContext) => {
    if (buffers.wood && buffers.liquid) return Promise.resolve();
    if (!decoding)
      decoding = loading
        .then(async (files) => {
          if (!files || disposed) throw new Error('Efeito do balcão indisponível.');
          await Promise.all(
            files.map(async ([kind, bytes]) => {
              const buffer = await target.decodeAudioData(bytes.slice(0));
              if (!disposed) buffers[kind] = buffer;
            }),
          );
        })
        .catch(() => {
          decoding = null;
        });
    return decoding;
  };
  const prepare = () => {
    const target = initialize();
    if (!target) return;
    void target
      .resume()
      .then(() => decode(target))
      .catch(() => {});
  };
  const visibility = () => {
    if (document.hidden) close('hidden');
    else state(settings.muted || settings.volume <= 0 ? 'muted' : 'ready');
  };
  document.addEventListener('pointerdown', prepare, true);
  document.addEventListener('keydown', prepare, true);
  document.addEventListener('visibilitychange', visibility);
  state(settings.muted || settings.volume <= 0 ? 'muted' : 'ready');

  return {
    place(item: SoundItem, size = 1) {
      if (!allowed()) return;
      const target = initialize();
      if (!target) return;
      const requestedEpoch = epoch;
      const requestedAt = performance.now();
      const profile = shopCounterSoundProfile(item, size);
      void target
        .resume()
        .then(() => decode(target))
        .then(() => {
          // A sound belongs to this accepted placement, never to a later visit.
          if (
            !allowed() ||
            epoch !== requestedEpoch ||
            target !== context ||
            target.state !== 'running' ||
            performance.now() - requestedAt > 450
          )
            return;
          const buffer = buffers[profile.kind];
          if (!buffer) {
            state('unavailable');
            return;
          }
          while (voices.size >= 6) stop(voices.values().next().value!);
          const source = target.createBufferSource();
          const gain = target.createGain();
          const filter = target.createBiquadFilter();
          const pitch = clamp(
            profile.pitch + [-0.014, 0.009, -0.004, 0.014, 0][variation++ % 5],
            0.8,
            1.1,
          );
          source.buffer = buffer;
          source.playbackRate.value = pitch;
          gain.gain.value = profile.gain;
          filter.type = 'lowpass';
          filter.frequency.value = profile.cutoff;
          filter.Q.value = 0.45;
          source.connect(filter);
          filter.connect(gain);
          gain.connect(master!);
          const voice = { source, gain, filter };
          voices.add(voice);
          source.onended = () => {
            voices.delete(voice);
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
            if (!disposed) state(voices.size ? 'playing' : 'ready');
          };
          source.start();
          count++;
          root.dataset.counterAudioItem = item.id;
          root.dataset.counterAudioKind = profile.kind;
          root.dataset.counterAudioWeight = profile.weight.toFixed(3);
          root.dataset.counterAudioGain = profile.gain.toFixed(4);
          root.dataset.counterAudioPitch = pitch.toFixed(4);
          state('playing');
        })
        .catch(() => {
          if (allowed() && epoch === requestedEpoch && target === context) state('unavailable');
        });
    },
    setSettings(next: Settings) {
      settings = next;
      if (settings.muted || settings.volume <= 0) close('muted');
      else {
        if (master && context)
          master.gain.setTargetAtTime(clamp(settings.volume, 0, 1), context.currentTime, 0.008);
        state(document.hidden ? 'hidden' : voices.size ? 'playing' : 'ready');
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      document.removeEventListener('pointerdown', prepare, true);
      document.removeEventListener('keydown', prepare, true);
      document.removeEventListener('visibilitychange', visibility);
      close('disposed');
      delete buffers.wood;
      delete buffers.liquid;
    },
  };
}

export function useShopCounterSound(root: RefObject<HTMLElement | null>) {
  const { muted, volume } = useMusicInterlude();
  const preferences = useRef({ muted, volume });
  preferences.current = { muted, volume };
  const player = useRef<ReturnType<typeof createShopCounterAudio> | null>(null);
  useEffect(() => {
    if (!root.current) return;
    const current = createShopCounterAudio(root.current, preferences.current);
    player.current = current;
    return () => {
      current.dispose();
      player.current = null;
    };
  }, [root]);
  useEffect(() => {
    player.current?.setSettings({ muted, volume });
  }, [muted, volume]);
  return useCallback((item: Item, size = 1) => player.current?.place(item, size), []);
}
