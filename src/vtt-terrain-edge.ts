/** Keep the player's broad softness; even a hard brush gets a narrow material contact edge. */
export function terrainContactSoftness(s: { softness: number; radius: number; erase: boolean }) {
  return s.erase ? s.softness : Math.max(s.softness, Math.min(0.4, 8 / Math.max(1, s.radius)));
}
const hash = (x: number, y: number) => {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  let u = x - ix,
    v = y - iy;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return (
    (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
    (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
  );
}
/** Only alpha along the contact changes. World coordinates keep adjacent cached tiles seamless. */
export function roughenTerrainMargin(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  left: number,
  top: number,
  density: number,
) {
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4 + 3,
        a = data[index] / 255;
      if (a === 0 || a === 1) continue;
      const wx = left + x / density,
        wy = top + y / density;
      const grit = (noise(wx / 3, wy / 3) - 0.5) * 0.65 + (noise(wx * 1.2, wy * 1.2) - 0.5) * 0.12;
      data[index] = Math.max(0, Math.min(255, (a + grit * 4 * a * (1 - a)) * 255));
    }
}
