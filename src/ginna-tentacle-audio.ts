export type GinnaTentacleAudioSettings = { muted: boolean; volume: number };
type Stage = 'emergence' | 'wrapping';
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  stage: Stage;
  offset: number;
  started: number;
};
const duration = 5600;
const wrappingAt = 2700;
const files: Record<Stage, string> = {
  emergence: '/audio/ginna-tentacle-emergence.wav',
  wrapping: '/audio/ginna-tentacle-wrapping.wav',
};

/** A single playback clock owned by the visual animation, including its pauses. */
export function createGinnaTentacleAudio(
  root: HTMLElement,
  reduced: boolean,
  initial: GinnaTentacleAudioSettings,
) {
  let settings = initial;
  let elapsed = 0;
  let started = false;
  let disposed = false;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let voice: Voice | null = null;
  let decoding: Promise<void> | null = null;
  const buffers: Partial<Record<Stage, AudioBuffer>> = {};
  const heard = new Set<Stage>();
  const abort = new AbortController();
  let readyTimer: number | undefined;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = (value: string) => {
    root.dataset.tentacleAudioState = value;
    root.dataset.tentacleAudioContext = context?.state ?? 'none';
    root.dataset.tentacleAudioMuted = String(settings.muted);
    root.dataset.tentacleAudioVolume = String(settings.volume);
    root.dataset.tentacleAudioTime = elapsed.toFixed(2);
    root.dataset.tentacleAudioActive = voice ? '1' : '0';
  };
  const stopVoice = () => {
    if (!voice) return;
    const previous = voice;
    voice = null;
    previous.source.onended = null;
    previous.source.stop();
    previous.source.disconnect();
    previous.gain.disconnect();
  };
  const silence = (reason: string) => {
    if (master) master.gain.value = 0;
    stopVoice();
    state(reason);
  };
  const loading = reduced
    ? Promise.resolve(null)
    : Promise.all(
        (Object.entries(files) as [Stage, string][]).map(async ([stage, url]) => {
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) throw new Error('Efeito sonoro indisponível');
          return [stage, await response.arrayBuffer()] as const;
        }),
      ).catch(() => null);

  const decode = () => {
    if (!context || decoding) return decoding ?? Promise.resolve();
    const target = context;
    decoding = loading
      .then(async (assets) => {
        if (!assets || disposed || target.state === 'closed') return;
        await Promise.all(
          assets.map(async ([stage, bytes]) => {
            const buffer = await target.decodeAudioData(bytes);
            if (!disposed) buffers[stage] = buffer;
          }),
        );
      })
      .catch(() => {});
    return decoding;
  };

  const allowed = () =>
    !disposed &&
    !document.hidden &&
    !reduced &&
    !motion.matches &&
    !settings.muted &&
    settings.volume > 0;
  const refresh = () => {
    if (disposed) return;
    if (reduced || motion.matches) return silence('reduced');
    if (document.hidden) return silence('paused');
    if (settings.muted || settings.volume <= 0) return silence('muted');
    if (!context || context.state !== 'running') return silence('blocked');
    if (!started) return silence('ready');
    const stage: Stage = elapsed < wrappingAt ? 'emergence' : 'wrapping';
    const offset = (elapsed - (stage === 'wrapping' ? wrappingAt : 0)) / 1000;
    const buffer = buffers[stage];
    if (!buffer) return silence('loading');
    if (offset >= buffer.duration) return silence('waiting');
    if (voice) {
      const actual = voice.offset + context.currentTime - voice.started;
      // A busy foreground tab may cap visual frame advancement. Keep the sound
      // at that same pose instead of letting it reach the next scene early.
      if (voice.stage !== stage || Math.abs(actual - offset) > 0.1) stopVoice();
    }
    master!.gain.value = Math.max(0, Math.min(1, settings.volume));
    if (!voice) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.008);
      source.connect(gain);
      gain.connect(master!);
      const active: Voice = { source, gain, stage, offset, started: context.currentTime };
      voice = active;
      source.onended = () => {
        if (voice !== active) return;
        voice = null;
        source.disconnect();
        gain.disconnect();
        state('waiting');
      };
      source.start(0, offset);
      if (!heard.has(stage)) {
        heard.add(stage);
        root.dataset[stage === 'emergence' ? 'tentacleAudioEmergence' : 'tentacleAudioWrapping'] =
          '1';
        root.dataset[
          stage === 'emergence' ? 'tentacleAudioEmergenceTime' : 'tentacleAudioWrappingTime'
        ] = elapsed.toFixed(2);
      }
    }
    root.dataset.tentacleAudioOffset = offset.toFixed(4);
    state('playing');
  };
  const initialize = async () => {
    if (!allowed() || !navigator.userActivation?.hasBeenActive || !window.AudioContext) return;
    if (!context) {
      context = new AudioContext({ latencyHint: 'interactive' });
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
    }
    const current = context;
    try {
      await current.resume();
      await decode();
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
  const motionChange = () => {
    refresh();
    if (!motion.matches) void initialize();
  };
  const close = (reason: 'finished' | 'disposed') => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    window.clearTimeout(readyTimer);
    silence(reason);
    document.removeEventListener('pointerdown', interaction, true);
    document.removeEventListener('keydown', interaction, true);
    document.removeEventListener('visibilitychange', visibility);
    motion.removeEventListener('change', motionChange);
    master?.disconnect();
    if (context && context.state !== 'closed')
      void context
        .close()
        .then(() => {
          root.dataset.tentacleAudioContext = 'closed';
        })
        .catch(() => {});
  };

  root.dataset.tentacleAudioEmergence = '0';
  root.dataset.tentacleAudioWrapping = '0';
  state(reduced ? 'reduced' : 'loading');
  document.addEventListener('pointerdown', interaction, true);
  document.addEventListener('keydown', interaction, true);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', motionChange);
  // Preparing buffers before the first visual frame keeps the emergence impact
  // at time zero. The existing click is sufficient; no context starts on load.
  const prepare =
    allowed() && navigator.userActivation?.hasBeenActive ? initialize() : Promise.resolve();
  const ready = Promise.race([
    prepare,
    new Promise<void>((resolve) => {
      readyTimer = window.setTimeout(resolve, 1200);
    }),
  ]).finally(() => window.clearTimeout(readyTimer));
  refresh();
  return {
    ready,
    update(time: number) {
      if (disposed) return;
      started = true;
      elapsed = Math.max(0, Math.min(duration, time));
      if (elapsed >= duration) close('finished');
      else refresh();
    },
    setSettings(next: GinnaTentacleAudioSettings) {
      settings = next;
      refresh();
      if (allowed() && (!context || context.state !== 'running')) void initialize();
    },
    finish: () => close('finished'),
    dispose: () => close('disposed'),
  };
}
