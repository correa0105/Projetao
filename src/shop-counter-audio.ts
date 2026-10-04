import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { shopWeight } from '../shared/armor-bundles';
import type { Item } from './types';
import { useMusicInterlude } from './SiteMusic';

type Settings = { muted: boolean; volume: number };
type Kind =
  | 'wood'
  | 'liquid'
  | 'waterskin'
  | 'metal'
  | 'chain'
  | 'spheres'
  | 'glass'
  | 'paper'
  | 'leather'
  | 'cloth';
type SoundItem = Pick<Item, 'id' | 'name' | 'original_name' | 'category' | 'weight_lb'>;
const assets: Record<Kind, string> = {
  wood: '/audio/shop-counter-wood.wav',
  liquid: '/audio/shop-counter-liquid.wav',
  waterskin: '/audio/shop-counter-waterskin.wav',
  metal: '/audio/shop-counter-metal.wav',
  chain: '/audio/shop-counter-chain.wav',
  spheres: '/audio/shop-counter-spheres.wav',
  glass: '/audio/shop-counter-glass.wav',
  paper: '/audio/shop-counter-paper.wav',
  leather: '/audio/shop-counter-leather.wav',
  cloth: '/audio/shop-counter-cloth.wav',
};
// Match the physical object, rather than assuming everything in a magical category is alike.
const materials: Record<string, Kind> = {
  dagger: 'metal',
  manacles: 'chain',
  'ring-of-invisibility': 'metal',
  'ring-of-protection': 'metal',
  'ring-of-regeneration': 'metal',
  antitoxin: 'liquid',
  shortbow: 'wood',
  longbow: 'wood',
  'hunting-trap': 'metal',
  'leather-armor': 'leather',
  'plate-armor': 'metal',
  bucket: 'wood',
  tent: 'cloth',
  'immovable-rod': 'metal',
  chest: 'wood',
  'crystal-ball': 'glass',
  'component-pouch': 'leather',
  'bag-of-holding': 'leather',
  quarterstaff: 'wood',
  'boots-of-elvenkind': 'leather',
  lock: 'metal',
  tinderbox: 'metal',
  'staff-of-the-magi': 'wood',
  waterskin: 'waterskin',
  basket: 'wood',
  blanket: 'cloth',
  'hempen-rope-50-feet': 'cloth',
  chain: 'chain',
  'chain-mail': 'chain',
  'studded-leather': 'leather',
  shield: 'metal',
  'ball-bearings': 'spheres',
  greatsword: 'metal',
  longsword: 'metal',
  caltrops: 'metal',
  'alchemists-fire': 'liquid',
  acid: 'liquid',
  'grappling-hook': 'metal',
  'glass-bottle': 'glass',
  'healers-kit': 'leather',
  'climbers-kit': 'leather',
  'hooded-lantern': 'metal',
  book: 'paper',
  'cloak-of-displacement': 'cloth',
  'cloak-of-protection': 'cloth',
  backpack: 'leather',
  'goggles-of-night': 'glass',
  oil: 'liquid',
  'dragon-orb': 'glass',
  shovel: 'metal',
  crowbar: 'metal',
  breastplate: 'metal',
  'spell-scroll-cantrip': 'paper',
  'potion-of-growth': 'liquid',
  'potion-of-healing': 'liquid',
  'potion-of-climbing': 'liquid',
  'potion-of-heroism': 'liquid',
  'potion-of-flying': 'liquid',
  rations: 'cloth',
  rapier: 'metal',
  bedroll: 'cloth',
  'slippers-of-spider-climbing': 'leather',
  bell: 'metal',
  torch: 'wood',
  candle: 'cloth',
  'cosmetic-cape': 'cloth',
  'cosmetic-necklace': 'metal',
  'cosmetic-tiara': 'metal',
  'cosmetic-gloves': 'leather',
  'cosmetic-boots': 'leather',
  cigar: 'paper',
};
const materialLevels: Record<
  Kind,
  { gain: number; range: number; cutoff: number; damping: number }
> = {
  wood: { gain: 0.32, range: 0.5, cutoff: 7800, damping: 3900 },
  liquid: { gain: 0.32, range: 0.5, cutoff: 7800, damping: 3900 },
  waterskin: { gain: 0.32, range: 0.38, cutoff: 7200, damping: 2500 },
  metal: { gain: 0.32, range: 0.5, cutoff: 11000, damping: 4300 },
  chain: { gain: 0.32, range: 0.4, cutoff: 11000, damping: 3200 },
  spheres: { gain: 0.32, range: 0.24, cutoff: 12000, damping: 2200 },
  glass: { gain: 0.24, range: 0.3, cutoff: 11000, damping: 3200 },
  paper: { gain: 0.15, range: 0.18, cutoff: 8200, damping: 2500 },
  leather: { gain: 0.24, range: 0.28, cutoff: 7200, damping: 2800 },
  cloth: { gain: 0.16, range: 0.22, cutoff: 6800, damping: 2400 },
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function materialOf(item: SoundItem): Kind {
  if (materials[item.id]) return materials[item.id];
  const normalized = `${item.id} ${item.name} ${item.original_name} ${item.category}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
  // These fallbacks also cover later catalog entries without giving an empty glass water sounds.
  if (/waterskin|cantil/.test(normalized)) return 'waterskin';
  if (
    /potion|pocao|pocoes|antitoxin|antitoxina|alchemist|alquimico|acid|\boil\b|oleo|liquid/.test(
      normalized,
    )
  )
    return 'liquid';
  if (/ball.bearing|esferas|bola de gude/.test(normalized)) return 'spheres';
  if (/chain|corrente|malha|manacles|algemas/.test(normalized)) return 'chain';
  if (/glass|vidro|crystal|cristal|goggle|oculos|orbe|orb\b/.test(normalized)) return 'glass';
  if (/scroll|pergaminho|book|livro|cigar|charuto/.test(normalized)) return 'paper';
  if (
    /leather|couro|boot|bota|glove|luva|slipper|sapato|pouch|bolsa|backpack|mochila/.test(
      normalized,
    )
  )
    return 'leather';
  if (
    /cloak|manto|capa|cloth|tecido|tent|barraca|blanket|cobertor|bedroll|dormir|rope|corda/.test(
      normalized,
    )
  )
    return 'cloth';
  if (
    /metal|sword|espada|dagger|adaga|rapier|rapieira|plate|placas|peitoral|shield|escudo|ring|anel|necklace|colar|tiara|lock|cadeado|lantern|lanterna|crowbar|pe de cabra|shovel|\bpa\b|bell|sino|hook|gancho|caltrop|estrepes/.test(
      normalized,
    )
  )
    return 'metal';
  return 'wood';
}

/** Physical weight, plus the object's illustrated size, determines the impact. */
export function shopCounterSoundProfile(item: SoundItem, size = 1) {
  const inputWeight = shopWeight(item);
  const weight = Number.isFinite(inputWeight) ? Math.max(0, inputWeight) : 1;
  const kind = materialOf(item);
  const mass = clamp(Math.log1p(weight) / Math.log(66), 0, 1);
  const extent = clamp((size - 1) / 0.22, 0, 1);
  const strength = clamp(mass * 0.85 + extent * 0.15, 0, 1);
  const material = materialLevels[kind];
  return {
    kind,
    weight,
    gain: clamp(material.gain + strength * material.range, material.gain, 0.82),
    pitch: clamp(1.07 - strength * 0.24, 0.83, 1.07),
    cutoff: material.cutoff - material.damping * strength,
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
  const decoding: Partial<Record<Kind, Promise<void>>> = {};
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
  const kinds = Object.keys(assets) as Kind[];
  const loading = Object.fromEntries(
    (Object.entries(assets) as [Kind, string][]).map(([kind, url]) => [
      kind,
      (async () => {
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) throw new Error('Efeito do balcão indisponível.');
        return await response.arrayBuffer();
      })().catch(() => null),
    ]),
  ) as Record<Kind, Promise<ArrayBuffer | null>>;

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
  const decode = (target: AudioContext, kind: Kind): Promise<void> => {
    if (buffers[kind]) return Promise.resolve();
    if (!decoding[kind])
      decoding[kind] = loading[kind]
        .then(async (bytes) => {
          if (!bytes || disposed) return;
          const buffer = await target.decodeAudioData(bytes.slice(0));
          if (!disposed) buffers[kind] = buffer;
        })
        .catch(() => {})
        .finally(() => {
          delete decoding[kind];
        });
    return decoding[kind]!;
  };
  const prepare = () => {
    const target = initialize();
    if (!target) return;
    void target
      .resume()
      .then(() => Promise.all(kinds.map((kind) => decode(target, kind))))
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
        .then(() => decode(target, profile.kind))
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
      for (const kind of kinds) delete buffers[kind];
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
