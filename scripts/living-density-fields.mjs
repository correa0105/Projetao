// Original seamless density fields: each model has its own geometry and material.
const tau = Math.PI * 2,
  g = (d, w) => Math.exp(-((d / w) ** 2)),
  sat = (n) => Math.max(0, Math.min(1, n));
const hash = (x, y) => {
  let n = Math.imul(x + 61, 374761393) ^ Math.imul(y + 197, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967295;
};
function noise(x, y) {
  const a = Math.floor(x),
    b = Math.floor(y),
    u = x - a,
    v = y - b,
    U = u * u * (3 - 2 * u),
    V = v * v * (3 - 2 * v);
  return (
    (hash(a, b) * (1 - U) + hash(a + 1, b) * U) * (1 - V) +
    (hash(a, b + 1) * (1 - U) + hash(a + 1, b + 1) * U) * V
  );
}
const fbm = (x, y) =>
  noise(x, y) * 0.55 +
  noise(x * 2.03 + 13, y * 2.03 - 7) * 0.29 +
  noise(x * 4.13 - 9, y * 4.13 + 21) * 0.16;
const angleDistance = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function livingField(kind, x, y, t) {
  const r = Math.hypot(x, y),
    a = Math.atan2(y, x),
    s = Math.sin(t),
    co = Math.cos(t),
    n = fbm(x * 5 + s, y * 5 + co),
    fine = fbm(x * 22 + co * 2, y * 22 + s * 2),
    warp = (n - 0.5) * 0.07,
    q = r + warp;
  let d = 0,
    hot = 0,
    shade = 0.75 + fine * 0.3;
  const filament = (distance, width = 0.025) => g(distance, width) * (0.6 + fine * 0.45);
  if (kind === 'phoenix-plumage') {
    for (let i = 0; i < 7; i++) {
      const b = a - (i * tau) / 7 - s * 0.1,
        reach = 0.68 + 0.12 * Math.sin(t + i),
        axis = Math.cos(b);
      const edge = Math.sin(b) * r - 0.035 * Math.sin(r * 15 + t + i);
      const plume = g(edge, 0.055 + r * 0.08) * g(r - reach * 0.78, 0.23) * sat(axis * 8);
      const veins = 0.65 + 0.35 * Math.sin(r * 42 + fine * 4 - t * 2) ** 2;
      d += plume * veins;
      d += plume * g(edge, 0.13) * 0.22;
      hot += filament(edge, 0.014) * g(r - 0.52, 0.2) * sat(axis * 8);
    }
  } else if (kind === 'argent-crossroads') {
    for (let i = 0; i < 4; i++) {
      const b = (i * tau) / 4 + t,
        xx = x * Math.cos(b) + y * Math.sin(b),
        yy = -x * Math.sin(b) + y * Math.cos(b);
      const curve = 0.16 * Math.sin(xx * 5 + t + i);
      d += filament(yy - curve + warp * 0.35, 0.054) * g(xx, 0.74) * sat((r - 0.23) * 8);
      d += g(xx - (0.48 + 0.07 * Math.sin(t + i)), 0.035) * g(yy - curve, 0.045);
      hot += g(yy - curve, 0.012) * g(xx - 0.55 * Math.sin(t + i), 0.12);
    }
  } else if (kind === 'coral-bloom') {
    for (let i = 0; i < 3; i++) {
      const b = (i * tau) / 3 + 0.3,
        xx = x * Math.cos(b) + y * Math.sin(b),
        yy = -x * Math.sin(b) + y * Math.cos(b),
        bend = 0.02 * Math.sin(xx * 9 + t + i);
      const stem = g(yy - bend, 0.028) * g(xx - 0.56, 0.2);
      d += stem;
      hot += stem * 0.42;
      for (let j = 0; j < 4; j++) {
        const side = j % 2 ? -1 : 1,
          root = 0.4 + j * 0.075,
          u = xx - root,
          v = yy - bend - side * (0.075 + u * 0.68),
          branch = g(v + 0.015 * Math.sin(u * 22 + t), 0.026) * g(u - 0.045, 0.085),
          bud = g(Math.hypot(u - 0.11, v), 0.042);
        d += branch * (0.75 + fine * 0.35) + bud * 0.85;
        hot += branch * 0.2 + bud * 0.45;
      }
    }
  } else if (kind === 'mercury-ribbon') {
    for (let i = 0; i < 3; i++) {
      const b = t + (i * tau) / 3,
        xx = x * Math.cos(b) + y * Math.sin(b),
        yy = -x * Math.sin(b) + y * Math.cos(b);
      const curve = (0.19 + i * 0.1) * Math.sin(xx * 4 + s + i);
      const z = yy - curve + warp;
      d += g(z, 0.095) * g(xx, 0.73) * sat((r - 0.2) * 10);
      hot += g(z + 0.04, 0.021) * g(xx, 0.69) * 0.7;
      shade = 0.52 + 0.48 * Math.sin(xx * 6 + s + i) ** 2;
    }
  } else if (kind === 'ink-bloom') {
    const R = 0.57 + 0.14 * Math.sin(a * 3 + s) + 0.06 * Math.sin(a * 7 - co);
    const volume = g(q - R, 0.17) * sat((n - 0.2) * 2.1);
    d = volume * (0.42 + fine * 0.58);
    hot = g(q - R - 0.07, 0.028) * (0.18 + fine * 0.25);
    shade = 0.3 + fine * 0.4;
  } else if (kind === 'lotus-wake') {
    const R = 0.58 + 0.15 * Math.cos(a * 6 + s * 0.6);
    const surface = g(q - R, 0.09),
      foam = Math.pow(sat((fine - 0.48) * 3), 2);
    d = surface * (0.25 + n * 0.7) + g(q - R + 0.035, 0.025) * foam * 0.8;
    hot = foam * surface * 0.7;
    d += g(q - R - 0.08, 0.05) * (0.16 + fine * 0.18);
  } else if (kind === 'thorn-covenant') {
    for (let i = 0; i < 5; i++) {
      const b = angleDistance(a, (i * tau) / 5),
        curve = 0.6 + 0.08 * Math.sin(b * 3 + t + i);
      const branch = g(q - curve, 0.022) * g(b, 0.6);
      d += branch * (0.6 + fine * 0.5);
      const leaf = g(Math.sin(b * 9 + s) * r, 0.065) * g(q - curve - 0.05, 0.085) * g(b, 0.5);
      d += leaf * (0.85 + fine * 0.3);
      hot += leaf * g(Math.sin(b * 9 + s) * r, 0.014) * 0.3;
      hot += branch * 0.16;
    }
  } else if (kind === 'starlit-fall') {
    for (let i = 0; i < 8; i++) {
      const b = i * 2.399,
        xx = x - (0.57 + 0.16 * Math.sin(t + i)) * Math.cos(b),
        yy = y - (0.57 + 0.16 * Math.sin(t + i)) * Math.sin(b);
      const along = (xx + yy) * 0.707,
        across = (xx - yy) * 0.707;
      d +=
        g(across + 0.008 * Math.sin(along * 24 + t), 0.032) *
        g(along + 0.1, 0.17) *
        sat(-along * 20 + 0.4);
      d += g(Math.hypot(xx, yy), 0.035) * 1.2;
      hot += g(Math.hypot(xx, yy), 0.045) * 0.9;
    }
  } else if (kind === 'moon-shards') {
    for (let i = 0; i < 6; i++) {
      const b = (i * tau) / 6 + t,
        xx = x - 0.67 * Math.cos(b),
        yy = y - 0.67 * Math.sin(b),
        turn = t + i;
      const X = xx * Math.cos(turn) + yy * Math.sin(turn),
        Y = -xx * Math.sin(turn) + yy * Math.cos(turn),
        shape = Math.abs(X) / 0.09 + Math.abs(Y) / (0.17 + 0.025 * Math.sin(t + i));
      const face = sat((1 - shape) * 18);
      d += face * 0.88;
      hot += g(shape - 1, 0.09) * 0.55 + face * g(X + Y * 0.35, 0.014) * 0.48;
      shade = 0.45 + sat((X + Y) * 5 + 0.4) * 0.52;
    }
  } else if (kind === 'golden-moths') {
    for (let i = 0; i < 7; i++) {
      const b = i * 2.399,
        reach = 0.66 + 0.065 * Math.sin(t + i),
        ox = x - reach * Math.cos(b + s * 0.18),
        oy = y - reach * Math.sin(b + s * 0.18),
        turn = b + 0.6 * Math.sin(t + i),
        xx = ox * Math.cos(turn) + oy * Math.sin(turn),
        yy = -ox * Math.sin(turn) + oy * Math.cos(turn),
        span = 0.055 + 0.065 * Math.cos(t * 3 + i) ** 2;
      for (const side of [-1, 1]) {
        const top = Math.hypot((xx - side * span * 0.5) / (span * 0.62), (yy + 0.035) / 0.07),
          bottom = Math.hypot((xx - side * span * 0.36) / (span * 0.42), (yy - 0.035) / 0.05),
          face = Math.max(sat((1 - top) * 8), sat((1 - bottom) * 8));
        d += face * (0.65 + fine * 0.35);
        hot += face * (0.15 + g(xx - side * span * 0.4, 0.018) * 0.55);
      }
      d += g(xx, 0.009) * g(yy, 0.068);
      hot += g(xx, 0.012) * g(yy, 0.07) * 0.8;
      d += g(Math.hypot(xx + 0.035 * s, yy + 0.12), 0.045) * sat((fine - 0.6) * 4) * 0.4;
    }
  } else if (kind === 'crimson-lattice') {
    for (let i = 0; i < 3; i++) {
      const curve = 0.36 * Math.sin(x * 5 + t + (i * tau) / 3) + 0.1 * Math.cos(x * 11 - t);
      d += filament(y - curve + warp, 0.035) * g(x, 0.77) * sat((r - 0.22) * 8);
      hot += g(y - curve, 0.012) * g(x - 0.57 * Math.sin(t + i), 0.18) * 0.65;
    }
    d += g(q - 0.71, 0.03) * (0.18 + fine * 0.32);
  } else if (kind === 'frost-lotus') {
    for (let i = 0; i < 8; i++) {
      const b = angleDistance(a, (i * tau) / 8 + s * 0.06),
        z = Math.sin(b) * r;
      const axis = Math.cos(b) * r,
        stem = g(z, 0.015) * g(r - 0.49, 0.28) * sat(Math.cos(b) * 8),
        face = sat((1 - Math.abs(z) / 0.065 - Math.abs(axis - 0.57) / 0.25) * 12),
        branches = g(Math.abs(z) - Math.abs(r - 0.57) * 0.45, 0.013) * g(r - 0.55, 0.15);
      d += face * (0.25 + fine * 0.4) + (stem + branches * 0.65) * (0.6 + fine * 0.45);
    }
    hot = 0.55 + fine * 0.2;
  } else if (kind === 'ether-sail') {
    for (let i = 0; i < 3; i++) {
      const b = (i * tau) / 3,
        xx = x * Math.cos(b) + y * Math.sin(b),
        yy = -x * Math.sin(b) + y * Math.cos(b),
        edge = 0.25 + 0.18 * Math.sin(xx * 4 + t + i);
      const face = g(yy - edge + warp, 0.13) * g(xx - 0.13, 0.48) * sat((r - 0.25) * 8);
      d += face * (0.25 + fine * 0.7);
      hot += g(yy - edge + 0.06, 0.024) * g(xx - 0.13, 0.43) * 0.4;
    }
  } else if (kind === 'obsidian-sun') {
    for (let i = 0; i < 8; i++) {
      const b = angleDistance(a, (i * tau) / 8 + s * 0.1),
        X = r * Math.sin(b),
        Y = r * Math.cos(b) - (0.67 + 0.025 * Math.sin(t + i)),
        shape = Math.abs(X) / 0.14 + Math.abs(Y) / 0.1,
        face = sat((1 - shape) * 18),
        crack = g(Y - X * 0.55 + 0.009 * Math.sin(X * 55 + i), 0.012) * face;
      d += face * 0.96 + g(shape - 1, 0.15) * 0.28;
      hot += crack * (0.6 + 0.3 * Math.sin(t * 2 + i) ** 2) + g(shape - 1, 0.14) * 0.25;
    }
    d += g(q - 0.75, 0.08) * sat((fine - 0.53) * 3.2) * 0.34;
    shade = 0.14 + fine * 0.3;
  } else if (kind === 'thunder-roots') {
    for (let i = 0; i < 5; i++) {
      const b = a - (i * tau) / 5,
        axis = Math.cos(b),
        z = Math.sin(b) * r + 0.025 * Math.sin(r * 37 + i + s * 3) + warp * 0.25;
      const pulse = 0.18 + 0.82 * Math.sin(t * 2 + i) ** 8;
      d += filament(z, 0.018) * g(r - 0.55, 0.26) * sat(axis * 8) * pulse;
      d += filament(Math.abs(z) - Math.abs(r - 0.55) * 0.4, 0.01) * g(r - 0.58, 0.11) * pulse * 0.6;
      hot += g(z, 0.006) * g(r - 0.55, 0.25) * pulse;
    }
  } else if (kind === 'jade-cocoons') {
    for (let i = 0; i < 5; i++) {
      const b = (i * tau) / 5 + s * 0.13,
        xx = x - (0.66 + 0.05 * Math.sin(t + i)) * Math.cos(b),
        yy = y - (0.66 + 0.05 * Math.sin(t + i)) * Math.sin(b),
        R = Math.hypot(xx / 0.125, yy / 0.18);
      const shell = g(R - 1, 0.12),
        inside = sat((1 - R) * 5) * (0.28 + fine * 0.32),
        sheen = g(xx + 0.035, 0.025) * g(yy + 0.065, 0.055);
      d += shell * 0.72 + inside + sheen * 0.25;
      hot += shell * (0.25 + 0.5 * sat((-xx - yy) * 7)) + sheen * 0.58;
      d += g(xx - 0.025 * Math.sin(yy * 24 + t), 0.013) * g(yy, 0.145) * 0.5;
    }
  } else if (kind === 'sand-chronicle') {
    for (let i = 0; i < 3; i++) {
      const curve = (i - 1) * 0.27 + 0.13 * Math.sin(x * 5 + t + i),
        wave = g(y - curve + warp, 0.1) * g(x, 0.72) * sat((r - 0.22) * 7);
      d += wave * (0.5 + n * 0.55);
      hot += g(y - curve - 0.028, 0.018) * g(x, 0.7) * 0.35;
    }
    d += g(q - 0.75, 0.08) * sat((fine - 0.6) * 5) * 0.3;
  } else if (kind === 'opal-cascade') {
    for (let i = 0; i < 9; i++) {
      const b = i * 2.399 + t,
        xx = x - (0.65 + 0.08 * Math.sin(t + i)) * Math.cos(b),
        yy = y - (0.65 + 0.08 * Math.sin(t + i)) * Math.sin(b),
        R = Math.hypot(xx / (0.062 + 0.012 * Math.sin(t + i)), yy / 0.11),
        face = sat((1 - R) * 9),
        reflection = g(xx + 0.021, 0.018) * g(yy + 0.035, 0.035);
      d += g(R - 1, 0.15) * 0.45 + face * (0.6 + fine * 0.3);
      hot += reflection * 0.88 + face * g(yy + 0.018 * Math.sin(t + i), 0.014) * 0.3;
    }
  } else if (kind === 'soul-tethers') {
    for (let i = 0; i < 3; i++) {
      const b = (i * tau) / 3 + s * 0.3,
        xx = x * Math.cos(b) + y * Math.sin(b),
        yy = -x * Math.sin(b) + y * Math.cos(b),
        curve = 0.08 * Math.sin(xx * 9 + t * 2 + i);
      d += g(yy - curve + warp * 0.4, 0.048) * g(xx - 0.4, 0.33) * sat(xx * 12);
      const cx = 0.67 + 0.06 * Math.sin(t + i);
      d += g(Math.hypot(xx - cx, yy - curve), 0.085);
      d += g(yy - curve + 0.035, 0.018) * g(xx - 0.5, 0.25) * sat(xx * 12) * 0.35;
      hot += g(Math.hypot(xx - cx, yy - curve), 0.025) * 0.8;
    }
  } else if (kind === 'nova-breath') {
    for (let i = 0; i < 3; i++) {
      const R = 0.48 + 0.19 * Math.sin(t + (i * tau) / 3),
        front = g(q - R - 0.03 * Math.sin(a * 5 - t), 0.045),
        flame = sat((n - 0.3) * 2);
      d += front * (0.22 + flame * 0.7) * (0.6 + 0.4 * Math.cos(t + i) ** 2);
      hot += front * 0.4;
    }
    d += g(q - 0.69, 0.13) * sat((fine - 0.62) * 4) * 0.25;
  } else throw Error('Unknown living field ' + kind);
  d *= sat((0.93 - r) * 22);
  d *= sat((r - 0.18) * 14);
  return [sat(d), sat(hot), sat(shade)];
}
