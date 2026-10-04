import { useEffect, useRef, type RefObject } from 'react';

type HeartbeatSettings = { muted: boolean; volume: number };
type HeartbeatState = 'playing' | 'muted' | 'paused' | 'reduced' | 'blocked';

// A short, muffled chest thump; the second contraction uses the same timbre, softer.
function makeHeartbeat(context: AudioContext) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.24), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let noise = 0;
  for (let index = 0; index < samples.length; index++) {
    const time = index / context.sampleRate;
    const attack = Math.min(1, time / 0.006);
    const release = Math.min(1, (0.24 - time) / 0.025);
    const phase = 2 * Math.PI * (43 * time + 51 * 0.025 * (1 - Math.exp(-time / 0.025)));
    noise = noise * 0.88 + (Math.random() * 2 - 1) * 0.12;
    const body = (Math.sin(phase) + 0.17 * Math.sin(phase * 2)) * Math.exp(-time / 0.064);
    const chest = noise * 0.22 * Math.exp(-time / 0.032);
    samples[index] = (body * 0.78 + chest) * attack * release;
  }
  return buffer;
}

export function useGinnaHeartbeat(
  root: RefObject<HTMLElement | null>,
  { muted, volume }: HeartbeatSettings,
) {
  const settings = useRef({ muted, volume });
  settings.current = { muted, volume };
  const refresh = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dialog = root.current;
    if (!dialog) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let context: AudioContext | null = null;
    let master: GainNode | null = null;
    let muffler: BiquadFilterNode | null = null;
    let sound: AudioBuffer | null = null;
    let frame = 0;
    let disposed = false;
    let unlocked = false;
    let beats = 0;
    let previousTime: number | null = null;
    let previousAnimation: Animation | null = null;
    const voices = new Map<AudioBufferSourceNode, GainNode>();

    const state = (value: HeartbeatState) => {
      dialog.dataset.heartbeatState = value;
      dialog.dataset.heartbeatMuted = String(settings.current.muted);
      dialog.dataset.heartbeatVolume = String(settings.current.volume);
    };
    const silence = () => {
      for (const [voice, strength] of voices) {
        voice.onended = null;
        voice.stop();
        voice.disconnect();
        strength.disconnect();
      }
      voices.clear();
      previousTime = null;
    };
    const resume = () => {
      if (
        disposed ||
        document.hidden ||
        motion.matches ||
        settings.current.muted ||
        !settings.current.volume
      )
        return;
      if (!context && window.AudioContext) {
        context = new AudioContext({ latencyHint: 'interactive' });
        sound = makeHeartbeat(context);
        muffler = context.createBiquadFilter();
        muffler.type = 'lowpass';
        muffler.frequency.value = 230;
        muffler.Q.value = 0.55;
        master = context.createGain();
        muffler.connect(master);
        master.connect(context.destination);
        context.addEventListener('statechange', contextState);
      }
      if (context?.state === 'running') unlocked = true;
      // Lazy mounting may happen after the click that opened the vision.
      if (context && (unlocked || navigator.userActivation?.hasBeenActive))
        void context.resume().catch(() => {
          if (!disposed) state('blocked');
        });
    };
    const contextState = () => {
      if (context?.state === 'running') unlocked = true;
    };
    const beat = (phase: number, pulse: number, time: number) => {
      if (!context || !master || !muffler || !sound || context.state !== 'running') return;
      const voice = context.createBufferSource();
      const strength = context.createGain();
      voice.buffer = sound;
      strength.gain.value = pulse === 0 ? 0.85 : 0.65;
      voice.connect(strength);
      strength.connect(muffler);
      voices.set(voice, strength);
      voice.onended = () => {
        voices.delete(voice);
        voice.disconnect();
        strength.disconnect();
      };
      voice.start();
      dialog.dataset.heartbeatBeats = String(++beats);
      dialog.dataset.heartbeatPhase = phase.toFixed(4);
      dialog.dataset.heartbeatPulse = String(pulse + 1);
      dialog.dataset.heartbeatTime = time.toFixed(2);
    };
    const tick = () => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (document.hidden) {
        state('paused');
        silence();
        return;
      }
      if (motion.matches) {
        state('reduced');
        silence();
        return;
      }
      if (settings.current.muted || settings.current.volume <= 0) {
        state('muted');
        silence();
        return;
      }
      const text = dialog.querySelector('.ginna-balloon-copy[data-text-effect="heartbeat"]');
      const animation = text
        ?.getAnimations()
        .find((candidate) => (candidate as CSSAnimation).animationName === 'ginna-text-heartbeat');
      const duration = animation?.effect?.getComputedTiming().duration;
      const currentTime = animation?.currentTime;
      if (
        !animation ||
        animation.playState !== 'running' ||
        typeof duration !== 'number' ||
        !duration ||
        typeof currentTime !== 'number'
      ) {
        state('paused');
        silence();
        return;
      }
      if (!context || context.state !== 'running') {
        state('blocked');
        silence();
        return;
      }
      state('playing');
      master!.gain.value = Math.max(0, Math.min(1, settings.current.volume)) * 0.85;
      const delay = animation.effect!.getTiming().delay ?? 0;
      const time = currentTime - delay;
      if (
        previousAnimation !== animation ||
        previousTime === null ||
        time < previousTime ||
        time - previousTime > duration * 0.5
      ) {
        previousTime = time;
        previousAnimation = animation;
        return;
      }
      // Use the visual animation's clock. Never replay missed beats after a stalled/hidden tab.
      for (
        let cycle = Math.floor(previousTime / duration);
        cycle <= Math.floor(time / duration);
        cycle++
      ) {
        for (const [pulse, peak] of [0.1, 0.27].entries()) {
          const target = (cycle + peak) * duration;
          if (previousTime < target && time >= target && time - target <= duration * 0.035)
            beat((time % duration) / duration, pulse, time);
        }
      }
      previousTime = time;
    };
    const visibility = () => {
      silence();
      if (document.hidden) {
        state('paused');
        if (context?.state === 'running') void context.suspend().catch(() => {});
      } else resume();
    };
    const update = () => {
      if (master) master.gain.value = settings.current.muted ? 0 : settings.current.volume * 0.85;
      if (motion.matches || settings.current.muted || !settings.current.volume) silence();
      resume();
    };
    refresh.current = update;
    dialog.dataset.heartbeatBeats = '0';
    dialog.dataset.heartbeatPhase = '0';
    state('paused');
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', update);
    resume();
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      refresh.current = null;
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', update);
      silence();
      context?.removeEventListener('statechange', contextState);
      muffler?.disconnect();
      master?.disconnect();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    };
  }, [root]);

  useEffect(() => refresh.current?.(), [muted, volume]);
}
