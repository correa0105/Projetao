import { GINNA_RUPTURE_CUES, GINNA_RUPTURE_DURATION } from './ginna-reality';
type Settings = { muted: boolean; volume: number };
type Cue = keyof typeof GINNA_RUPTURE_CUES;
type Voice = { source: AudioBufferSourceNode; gain: GainNode; offset: number; started: number };
const files: Record<Cue, string> = {
  crack: '/audio/ginna-reality-crack.wav',
  glass: '/audio/ginna-reality-glass.wav',
  mist: '/audio/ginna-reality-mist.wav',
};

/** The visual clock owns all three cues, including pause, late loading and mute. */
export function createGinnaEntryAudio(root: HTMLElement, reduced: boolean, initial: Settings) {
  let settings = initial,
    elapsed = -1,
    disposed = false;
  let context: AudioContext | null = null,
    master: GainNode | null = null;
  let decoding: Promise<void> | null = null,
    readyTimer: number | undefined;
  const buffers: Partial<Record<Cue, AudioBuffer>> = {};
  const voices = new Map<Cue, Voice>();
  const heard = new Set<Cue>();
  const abort = new AbortController();
  const state = (value: string) => {
    root.dataset.entryAudioState = value;
    root.dataset.entryAudioContext = context?.state ?? 'none';
    root.dataset.entryAudioActive = String(voices.size);
    root.dataset.entryAudioTime = String(Math.max(0, elapsed));
    root.dataset.entryAudioVolume = String(settings.volume);
  };
  const stop = (cue: Cue) => {
    const voice = voices.get(cue);
    if (!voice) return;
    voices.delete(cue);
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
  };
  const silence = (reason: string) => {
    voices.forEach((_voice, cue) => stop(cue));
    if (master) master.gain.value = 0;
    state(reason);
  };
  const loading = reduced
    ? Promise.resolve(null)
    : Promise.all(
        (Object.entries(files) as [Cue, string][]).map(async ([cue, url]) => {
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) throw new Error('Som da transição indisponível');
          return [cue, await response.arrayBuffer()] as const;
        }),
      ).catch(() => null);
  const allowed = () =>
    !disposed && !reduced && !document.hidden && !settings.muted && settings.volume > 0;
  const refresh = () => {
    if (disposed) return;
    if (reduced) return silence('reduced');
    if (document.hidden) return silence('paused');
    if (settings.muted || settings.volume <= 0) return silence('muted');
    if (!context || context.state !== 'running') return silence('blocked');
    master!.gain.value = Math.max(0, Math.min(1, settings.volume)) * 0.9;
    for (const cue of Object.keys(files) as Cue[]) {
      const offset = (elapsed - GINNA_RUPTURE_CUES[cue]) / 1000;
      const buffer = buffers[cue];
      if (offset < 0 || !buffer || offset >= buffer.duration) {
        stop(cue);
        continue;
      }
      const previous = voices.get(cue);
      if (
        previous &&
        Math.abs(previous.offset + context.currentTime - previous.started - offset) > 0.18
      )
        stop(cue);
      if (voices.has(cue)) continue;
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.008);
      source.connect(gain);
      gain.connect(master!);
      const voice = { source, gain, offset, started: context.currentTime };
      voices.set(cue, voice);
      source.onended = () => {
        if (voices.get(cue) !== voice) return;
        voices.delete(cue);
        source.disconnect();
        gain.disconnect();
        state('waiting');
      };
      source.start(0, offset);
      if (!heard.has(cue)) {
        heard.add(cue);
        root.dataset['entryAudio' + cue[0].toUpperCase() + cue.slice(1)] = elapsed.toFixed(1);
      }
    }
    state(voices.size ? 'playing' : 'waiting');
  };
  const initialize = async () => {
    if (!allowed() || !navigator.userActivation?.hasBeenActive || !window.AudioContext) return;
    if (!context) {
      context = new AudioContext({ latencyHint: 'interactive' });
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
    }
    const target = context;
    try {
      await target.resume();
      if (!decoding)
        decoding = loading
          .then(async (assets) => {
            if (!assets || disposed || target.state === 'closed') return;
            await Promise.all(
              assets.map(async ([cue, bytes]) => {
                const buffer = await target.decodeAudioData(bytes);
                if (!disposed) buffers[cue] = buffer;
              }),
            );
          })
          .catch(() => {});
      await decoding;
      if (!disposed) refresh();
    } catch {
      if (!disposed) state('blocked');
    }
  };
  const interaction = () => {
    void initialize();
  };
  const visibility = () => {
    if (document.hidden) {
      silence('paused');
      if (context?.state === 'running') void context.suspend().catch(() => {});
    } else void initialize();
  };
  const close = (reason: string) => {
    if (disposed) return;
    silence(reason);
    disposed = true;
    abort.abort();
    clearTimeout(readyTimer);
    document.removeEventListener('pointerdown', interaction, true);
    document.removeEventListener('keydown', interaction, true);
    document.removeEventListener('visibilitychange', visibility);
    master?.disconnect();
    if (context && context.state !== 'closed')
      void context
        .close()
        .then(() => {
          root.dataset.entryAudioContext = 'closed';
        })
        .catch(() => {});
  };
  document.addEventListener('pointerdown', interaction, true);
  document.addEventListener('keydown', interaction, true);
  document.addEventListener('visibilitychange', visibility);
  const ready = Promise.race([
    initialize(),
    new Promise<void>((resolve) => {
      readyTimer = window.setTimeout(resolve, 450);
    }),
  ]).finally(() => clearTimeout(readyTimer));
  state(reduced ? 'reduced' : 'loading');
  return {
    ready,
    update(time: number) {
      if (disposed) return;
      elapsed = Math.max(0, Math.min(GINNA_RUPTURE_DURATION, time));
      refresh();
    },
    setSettings(next: Settings) {
      settings = next;
      refresh();
      if (allowed() && (!context || context.state !== 'running')) void initialize();
    },
    finish: () => close('finished'),
    dispose: () => close('disposed'),
  };
}
