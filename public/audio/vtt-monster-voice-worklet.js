/* Original granular voice processor. Runs on the audio rendering thread. */
class MonsterVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(32768);
    this.write = 0;
    this.phase = 0;
    this.secondPhase = 0;
    this.ringPhase = 0;
    this.envelope = 0;
    this.gate = 0;
    this.target = { ratio: 1, layerRatio: 1, layerMix: 0, drive: 0, ring: 0, ringHz: 0, mix: 1 };
    this.params = { ...this.target };
    this.port.onmessage = (e) => {
      for (const k of Object.keys(this.target))
        if (Number.isFinite(e.data[k]))
          this.target[k] = Math.max(
            k === 'ratio' || k === 'layerRatio' ? 0.25 : 0,
            Math.min(k === 'ringHz' ? 150 : k === 'ratio' || k === 'layerRatio' ? 3 : 1, e.data[k]),
          );
    };
  }
  tap(delay) {
    let index = (this.write - delay + this.buffer.length * 2) % this.buffer.length;
    const first = Math.floor(index),
      fraction = index - first;
    return (
      this.buffer[first] * (1 - fraction) + this.buffer[(first + 1) % this.buffer.length] * fraction
    );
  }
  pitch(ratio, phase) {
    const size = sampleRate * 0.065,
      other = (phase + 0.5) % 1;
    const weight = Math.sin(Math.PI * phase) ** 2;
    return (
      this.tap(sampleRate * 0.008 + phase * size) * weight +
      this.tap(sampleRate * 0.008 + other * size) * (1 - weight)
    );
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0],
      output = outputs[0]?.[0];
    if (!output) return true;
    const keys = Object.keys(this.params);
    for (let i = 0; i < output.length; i++) {
      const x = input?.[i] || 0;
      this.buffer[this.write] = x;
      for (const k of keys) this.params[k] += (this.target[k] - this.params[k]) * 0.001;
      const p = this.params;
      this.envelope = Math.max(Math.abs(x), this.envelope * 0.999);
      const gateTarget = this.envelope > 0.006 ? 1 : 0;
      this.gate += (gateTarget - this.gate) * 0.003;
      this.phase = (this.phase + (1 - p.ratio) / (sampleRate * 0.065) + 1) % 1;
      this.secondPhase = (this.secondPhase + (1 - p.layerRatio) / (sampleRate * 0.065) + 1) % 1;
      let processed = this.pitch(p.ratio, this.phase),
        layer = this.pitch(p.layerRatio, this.secondPhase);
      processed = (processed + layer * p.layerMix) / (1 + p.layerMix * 0.65);
      this.ringPhase = (this.ringPhase + (2 * Math.PI * p.ringHz) / sampleRate) % (2 * Math.PI);
      processed *= 1 - p.ring + p.ring * Math.sin(this.ringPhase);
      const drive = 1 + p.drive * 5;
      processed = Math.tanh(processed * drive) / Math.sqrt(drive);
      output[i] = ((1 - p.mix) * this.tap(sampleRate * 0.04) + p.mix * processed) * this.gate;
      this.write = (this.write + 1) % this.buffer.length;
    }
    return true;
  }
}
registerProcessor('alvorada-monster-voice', MonsterVoiceProcessor);
