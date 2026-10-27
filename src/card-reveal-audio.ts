let context: AudioContext | undefined;

// Original synthesized paper sweep and glass harmonics; no sampled music or voices.
export function playCardReveal(volume: number) {
  if (!Number.isFinite(volume) || volume <= 0 || !window.AudioContext) return () => {};
  context ??= new AudioContext();
  const audio = context;
  void audio.resume().catch(() => {});
  const now = audio.currentTime + .035, output = audio.createGain();
  output.gain.value = Math.min(1, volume) * .26;
  output.connect(audio.destination);
  const sources: AudioScheduledSourceNode[] = [];
  const noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .65), audio.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
  const paper = audio.createBufferSource(), filter = audio.createBiquadFilter(), breath = audio.createGain();
  paper.buffer = noise;filter.type = 'bandpass';filter.frequency.setValueAtTime(550, now);filter.frequency.exponentialRampToValueAtTime(3200, now + .43);filter.Q.value = .65;
  breath.gain.setValueAtTime(0, now);breath.gain.linearRampToValueAtTime(.24, now + .16);breath.gain.exponentialRampToValueAtTime(.001, now + .6);
  paper.connect(filter).connect(breath).connect(output);paper.start(now);paper.stop(now + .65);sources.push(paper);
  for (const [i, frequency] of [523.25, 783.99, 1046.5, 1567.98].entries()) {
    const tone = audio.createOscillator(), envelope = audio.createGain(), at = now + .2 + i * .085;
    tone.type = 'sine';tone.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);envelope.gain.linearRampToValueAtTime(.13 / (1 + i * .4), at + .018);envelope.gain.exponentialRampToValueAtTime(.0001, at + 1.45);
    tone.connect(envelope).connect(output);tone.start(at);tone.stop(at + 1.5);sources.push(tone);
  }
  let disposed = false;
  const dispose = () => {
    if (disposed) return;disposed = true;
    output.gain.cancelScheduledValues(audio.currentTime);output.gain.setTargetAtTime(0, audio.currentTime, .015);
    for (const source of sources) { try { source.stop(audio.currentTime + .06); } catch { /* Already finished. */ } }
    setTimeout(() => output.disconnect(), 100);
  };
  const timer = setTimeout(dispose, 2200);
  return () => { clearTimeout(timer);dispose(); };
}
