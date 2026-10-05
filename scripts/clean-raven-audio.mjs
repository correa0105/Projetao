// Offline cleanup for Bidone/Freesound 66763. Keep the two caws and their pitch;
// learn the wind spectrum from the recording's quiet sections, never from a caw.
export const ravenCleanup = {
  noise: [
    [0.04, 0.22],
    [0.93, 1.1],
    [1.82, 1.98],
  ],
  calls: [
    [0.245, 0.865],
    [1.115, 1.755],
  ],
};

function fft(real, imaginary, inverse = false) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let width = 2; width <= size; width *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / width;
    for (let start = 0; start < size; start += width) {
      for (let i = 0; i < width / 2; i++) {
        const a = start + i,
          b = a + width / 2;
        const cosine = Math.cos(angle * i),
          sine = Math.sin(angle * i);
        const r = real[b] * cosine - imaginary[b] * sine;
        const im = real[b] * sine + imaginary[b] * cosine;
        real[b] = real[a] - r;
        imaginary[b] = imaginary[a] - im;
        real[a] += r;
        imaginary[a] += im;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < size; i++) {
      real[i] /= size;
      imaginary[i] /= size;
    }
  }
}

export function cleanRavenAudio(samples, rate) {
  const size = 2048,
    hop = 256,
    bins = size / 2 + 1;
  const window = Float64Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
  );
  const frames = [];
  for (let center = 0; center < samples.length + size / 2; center += hop) {
    const start = center - size / 2;
    const real = Float64Array.from(window, (w, i) => w * (samples[start + i] || 0));
    const imaginary = new Float64Array(size);
    fft(real, imaginary);
    frames.push({ start, time: center / rate, real, imaginary });
  }
  const quiet = frames.filter(({ time }) =>
    ravenCleanup.noise.some(([start, end]) => time >= start && time <= end),
  );
  const noise = Float64Array.from({ length: bins }, (_, bin) => {
    const powers = quiet
      .map(({ real, imaginary }) => real[bin] ** 2 + imaginary[bin] ** 2)
      .sort((a, b) => a - b);
    return powers[Math.floor((powers.length - 1) * 0.85)];
  });
  const masks = frames.map(({ real, imaginary }) =>
    Float64Array.from(noise, (floor, bin) => {
      const power = real[bin] ** 2 + imaginary[bin] ** 2;
      return Math.sqrt(Math.max(0.0001, 1 - (2 * floor) / Math.max(1e-12, power)));
    }),
  );
  const output = new Float64Array(samples.length),
    weight = new Float64Array(samples.length);
  frames.forEach(({ start, real, imaginary }, frame) => {
    for (let bin = 0; bin < bins; bin++) {
      // Smooth the gain in time/frequency to avoid metallic speckles after denoising.
      let gain = 0,
        count = 0;
      for (let t = Math.max(0, frame - 1); t <= Math.min(frames.length - 1, frame + 1); t++) {
        for (let f = Math.max(0, bin - 2); f <= Math.min(bins - 1, bin + 2); f++) {
          gain += masks[t][f];
          count++;
        }
      }
      const frequency = (bin * rate) / size;
      // Wind is predominantly below 250 Hz; the caws are centered above 1 kHz.
      gain = (gain / count) * (bin ? 1 / Math.sqrt(1 + (450 / frequency) ** 8) : 0);
      real[bin] *= gain;
      imaginary[bin] *= gain;
      if (bin > 0 && bin < size / 2) {
        real[size - bin] *= gain;
        imaginary[size - bin] *= gain;
      }
    }
    fft(real, imaginary, true);
    for (let i = 0; i < size; i++) {
      const index = start + i;
      if (index >= 0 && index < samples.length) {
        output[index] += real[i] * window[i];
        weight[index] += window[i] ** 2;
      }
    }
  });
  const offset = ravenCleanup.calls[0][0],
    end = ravenCleanup.calls.at(-1)[1];
  const cleaned = Float32Array.from(
    output.slice(Math.round(offset * rate), Math.round(end * rate)),
    (value, i) => {
      const index = i + Math.round(offset * rate),
        time = index / rate;
      let envelope = 0;
      for (const [start, finish] of ravenCleanup.calls) {
        if (time >= start && time <= finish) {
          const fade = Math.max(0, Math.min(1, (time - start) / 0.018, (finish - time) / 0.055));
          envelope = Math.sin((Math.PI * fade) / 2) ** 2;
        }
      }
      // Exact silence outside the calls; smooth edges prevent clicks.
      return (value / Math.max(1e-12, weight[index])) * envelope;
    },
  );
  let peak = 0;
  for (const value of cleaned) peak = Math.max(peak, Math.abs(value));
  for (let i = 0; i < cleaned.length; i++) cleaned[i] *= 0.7 / Math.max(0.001, peak);
  return { samples: cleaned, offset };
}
