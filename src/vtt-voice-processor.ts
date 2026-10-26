import { monsterVoice, type MonsterVoiceId } from '../shared/vtt-voice';

export class VttVoiceProcessor {
  readonly context: AudioContext;
  readonly destination: MediaStreamAudioDestinationNode;
  readonly analyser: AnalyserNode;
  private node: AudioWorkletNode;
  private high: BiquadFilterNode;
  private low: BiquadFilterNode;
  private bass: BiquadFilterNode;
  private wet: GainNode;
  private echo: GainNode;
  private monitorGain: GainNode;
  private output: GainNode;
  private muted = false;
  private volume = 0.8;
  private closed = false;
  private constructor(
    private input: MediaStream,
    context: AudioContext,
    node: AudioWorkletNode,
  ) {
    this.context = context;
    this.node = node;
    this.destination = context.createMediaStreamDestination();
    this.high = context.createBiquadFilter();
    this.high.type = 'highpass';
    this.high.frequency.value = 70;
    this.low = context.createBiquadFilter();
    this.low.type = 'lowpass';
    this.low.frequency.value = 6500;
    this.bass = context.createBiquadFilter();
    this.bass.type = 'lowshelf';
    this.bass.frequency.value = 210;
    const inputNode = context.createMediaStreamSource(input);
    inputNode.connect(this.high);
    this.high.connect(node);
    node.connect(this.low);
    this.low.connect(this.bass);
    const sum = context.createGain();
    this.bass.connect(sum);
    const reverb = context.createConvolver(),
      impulse = context.createBuffer(2, Math.round(context.sampleRate * 1.25), context.sampleRate);
    let seed = 31;
    for (let c = 0; c < 2; c++) {
      const a = impulse.getChannelData(c);
      for (let i = 0; i < a.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        a[i] =
          (((seed >>> 0) / 4294967296) * 2 - 1) * Math.exp((-i / context.sampleRate) * 5) * 0.15;
      }
    }
    reverb.buffer = impulse;
    this.wet = context.createGain();
    this.wet.gain.value = 0;
    this.bass.connect(reverb);
    reverb.connect(this.wet);
    this.wet.connect(sum);
    const delay = context.createDelay(0.5),
      feedback = context.createGain();
    delay.delayTime.value = 0.17;
    feedback.gain.value = 0.18;
    this.echo = context.createGain();
    this.echo.gain.value = 0;
    this.bass.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.echo);
    this.echo.connect(sum);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    this.output = context.createGain();
    this.output.gain.value = this.volume;
    sum.connect(limiter);
    limiter.connect(this.output);
    this.output.connect(this.destination);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 512;
    this.output.connect(this.analyser);
    this.monitorGain = context.createGain();
    this.monitorGain.gain.value = 0;
    this.output.connect(this.monitorGain);
    this.monitorGain.connect(context.destination);
  }
  static async open(deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error('O microfone precisa de HTTPS e de um navegador compatível.');
    const context = new AudioContext({ latencyHint: 'interactive' });
    let input: MediaStream | undefined;
    try {
      await context.resume();
      await context.audioWorklet.addModule('/audio/vtt-monster-voice-worklet.js');
      input = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      });
      return new VttVoiceProcessor(
        input,
        context,
        new AudioWorkletNode(context, 'alvorada-monster-voice', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        }),
      );
    } catch (e) {
      input?.getTracks().forEach((t) => t.stop());
      await context.close();
      throw e;
    }
  }
  preset(id: MonsterVoiceId, mix = 1) {
    const p = monsterVoice(id),
      now = this.context.currentTime;
    this.node.port.postMessage({
      ratio: p ? 2 ** (p.semitones / 12) : 1,
      layerRatio: p ? 2 ** (p.layer / 12) : 1,
      layerMix: p?.layerMix || 0,
      drive: p?.drive || 0,
      ring: p?.ring || 0,
      ringHz: p?.ringHz || 0,
      mix: id === 'natural' ? 0 : mix,
    });
    this.high.frequency.setTargetAtTime(p?.highpass || 70, now, 0.04);
    this.low.frequency.setTargetAtTime(p?.lowpass || 8000, now, 0.04);
    this.bass.gain.setTargetAtTime(p?.bass || 0, now, 0.04);
    this.wet.gain.setTargetAtTime((p?.reverb || 0) * mix, now, 0.08);
    this.echo.gain.setTargetAtTime((p?.echo || 0) * mix, now, 0.08);
  }
  mute(muted: boolean) {
    this.muted = muted;
    this.gain(this.volume);
  }
  gain(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.output.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.02);
  }
  monitor(enabled: boolean) {
    this.monitorGain.gain.setTargetAtTime(enabled ? 0.45 : 0, this.context.currentTime, 0.04);
  }
  level() {
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    return Math.min(1, Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) * 4);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.input.getTracks().forEach((t) => t.stop());
    this.destination.stream.getTracks().forEach((t) => t.stop());
    this.node.disconnect();
    this.node.port.close();
    void this.context.close();
  }
}
