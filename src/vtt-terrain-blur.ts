// Three separable box passes approximate a Gaussian in linear time, independent
// of the brush radius. Buffers are reused by the terrain renderer.
export function softenTerrainMask(data: Uint8ClampedArray, width: number, height: number,
  sigma: number, input: Float32Array, output: Float32Array) {
  const count = width * height;
  for (let i = 0; i < count; i++) input[i] = data[i * 4 + 3];
  let lower = Math.floor(Math.sqrt(4 * sigma * sigma + 1));
  if (lower % 2 === 0) lower--;
  lower = Math.max(1, lower);
  const upper = lower + 2;
  const narrow = Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4));
  for (let pass = 0; pass < 3; pass++) {
    const radius = ((pass < narrow ? lower : upper) - 1) / 2, divisor = radius * 2 + 1;
    for (let y = 0; y < height; y++) {
      const start = y * width;
      let sum = 0;
      for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += input[start + x];
      for (let x = 0; x < width; x++) {
        output[start + x] = sum / divisor;
        if (x - radius >= 0) sum -= input[start + x - radius];
        if (x + radius + 1 < width) sum += input[start + x + radius + 1];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += output[y * width + x];
      for (let y = 0; y < height; y++) {
        input[y * width + x] = sum / divisor;
        if (y - radius >= 0) sum -= output[(y - radius) * width + x];
        if (y + radius + 1 < height) sum += output[(y + radius + 1) * width + x];
      }
    }
  }
  for (let i = 0; i < count; i++) data[i * 4 + 3] = input[i];
}
