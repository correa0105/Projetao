import { useEffect, useRef } from 'react';
import { useSoundEffects } from './SiteMusic';

export function useLoreMechanism() {
  const effects = useSoundEffects(),
    current = useRef(effects),
    cleanup = useRef<(() => void) | null>(null);
  current.current = effects;
  useEffect(() => () => cleanup.current?.(), []);
  return (moving: boolean) => {
    cleanup.current?.();
    let context: AudioContext;
    try {
      context = new AudioContext();
      void context.resume().catch(() => {});
    } catch {
      return (_locked = false) => {};
    }
    const gain = context.createGain();
    gain.connect(context.destination);
    const update = () => {
      const fx = current.current;
      gain.gain.value = fx.muted || document.hidden ? 0 : fx.volume;
    };
    update();
    const timer = setInterval(update, 80);
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate),
      data = buffer.getChannelData(0);
    // Alternating ratchet teeth and short resonant bearing knocks. No voices or ambience.
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate,
        phase = t % 0.0833;
      data[i] =
        phase < 0.017
          ? (Math.random() * 2 - 1) * Math.exp(-phase * 340) * 0.17 +
            Math.sin(phase * 2 * Math.PI * 430) * Math.exp(-phase * 220) * 0.055
          : 0;
    }
    const loop = context.createBufferSource();
    loop.buffer = buffer;
    loop.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    loop.connect(filter).connect(gain);
    if (moving) loop.start();
    let stopped = false,
      closeTimer: ReturnType<typeof setTimeout> | undefined;
    const dispose = () => {
      clearInterval(timer);
      clearTimeout(closeTimer);
      try {
        loop.stop();
      } catch {}
      void context.close().catch(() => {});
    };
    cleanup.current = dispose;
    return (locked = false) => {
      if (stopped) return;
      stopped = true;
      if (moving) loop.stop();
      if (locked) {
        const now = context.currentTime;
        for (const [delay, frequency, strength] of [
          [0, 170, 0.75],
          [0.105, 92, 1],
          [0.16, 610, 0.22],
        ]) {
          const tone = context.createOscillator(),
            envelope = context.createGain();
          tone.type = 'triangle';
          tone.frequency.setValueAtTime(frequency, now + delay);
          tone.frequency.exponentialRampToValueAtTime(frequency * 0.48, now + delay + 0.14);
          envelope.gain.setValueAtTime(strength * 0.55, now + delay);
          envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.2);
          tone.connect(envelope).connect(gain);
          tone.start(now + delay);
          tone.stop(now + delay + 0.23);
        }
        const snap = context.createBufferSource();
        snap.buffer = buffer;
        const snapGain = context.createGain();
        snapGain.gain.setValueAtTime(1.7, now + 0.1);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        snap.connect(snapGain).connect(gain);
        snap.start(now + 0.1, 0, 0.12);
      }
      closeTimer = setTimeout(dispose, locked ? 480 : 30);
    };
  };
}
