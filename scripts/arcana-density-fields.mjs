// Original periodic fields: flowing volumes, membranes and facets, rather than rigid strokes.
const TAU = Math.PI * 2;
const gauss = (d, w) => Math.exp(-((d / w) ** 2));
const sat = (n) => Math.max(0, Math.min(1, n));
const grid = Float32Array.from({ length: 4096 }, (_, i) => {
  let n = Math.imul(i + 1, 374761393);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967295;
});
function noise(x, y) {
  const X = Math.floor(x),
    Y = Math.floor(y),
    fx = x - X,
    fy = y - Y;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const get = (a, b) => grid[(a & 63) + (b & 63) * 64];
  return (
    (get(X, Y) * (1 - u) + get(X + 1, Y) * u) * (1 - v) +
    (get(X, Y + 1) * (1 - u) + get(X + 1, Y + 1) * u) * v
  );
}
function fbm(x, y) {
  return (
    0.52 * noise(x, y) +
    0.29 * noise(x * 2.07 + 13, y * 2.07 - 7) +
    0.19 * noise(x * 4.13 - 9, y * 4.13 + 21)
  );
}
export function densityField(kind, x, y, t) {
  const s = Math.sin(t),
    co = Math.cos(t),
    r = Math.hypot(x, y),
    a = Math.atan2(y, x);
  const flowX = x * 5 + s * 1.6,
    flowY = y * 5 + co * 1.6;
  const n = fbm(flowX, flowY),
    wrinkle = fbm(x * 18 + co * 2 + (n - 0.5) * 4, y * 18 + s * 2);
  const warp = (n - 0.5) * 0.095,
    q = r + warp;
  const texture = sat(0.18 + (n - 0.25) * 1.65 + (wrinkle - 0.5) * 0.5);
  const folds = 0.5 + 0.5 * Math.sin(a * 9 + q * 18 + t * 2 + (n - 0.5) * 7);
  let d = 0,
    hot = 0,
    shade = 1;
  if (kind === 'liquid-aegis') {
    const R = 0.73 + 0.018 * Math.sin(a * 5 + t);
    const membrane = gauss(q - 0.64, 0.17) * (0.2 + texture * 0.4) * sat((0.8 - r) * 20);
    d =
      membrane + gauss(q - R, 0.026) * (0.48 + wrinkle * 0.5) + gauss(q - 0.7, 0.09) * folds * 0.35;
    hot = gauss(q - R, 0.028) * 0.7 + folds * 0.12;
  } else if (kind === 'aurora-veil') {
    for (let i = 0; i < 3; i++) {
      const curve = -0.33 + i * 0.25 + 0.17 * Math.sin(x * 4 + t + i * 0.8);
      const curtain = gauss(y - curve + warp, 0.15) * gauss(x, 0.77);
      const filament = 0.45 + 0.55 * Math.sin(x * 25 + t * 2 + i + wrinkle * 5) ** 2;
      d += curtain * filament * (0.45 + i * 0.08);
    }
    d *= sat((r - 0.22) * 5);
    hot = wrinkle * 0.35;
  } else if (kind === 'light-cathedral') {
    for (let i = 0; i < 3; i++) {
      const xx = x - (i - 1) * 0.4,
        yy = y + 0.04,
        arch = Math.hypot(xx, yy);
      const face =
        gauss(arch - (0.48 + 0.025 * Math.sin(t + i)), 0.075) *
        sat((-y + 0.03) * 8) *
        gauss(xx, 0.29);
      const pillar = gauss(Math.abs(xx) - 0.24 + warp, 0.055) * gauss(y - 0.13, 0.35);
      d += (face + pillar * 0.62) * (0.3 + texture * 0.85);
    }
    hot = folds * 0.35;
  } else if (kind === 'mirror-helix') {
    for (let i = 0; i < 2; i++) {
      const xx = Math.sin(y * 6 + t + i * Math.PI) * (0.43 + 0.07 * Math.sin(t * 2));
      d += gauss(x - xx + warp, 0.105) * gauss(y, 0.75) * (0.3 + texture * 0.72);
    }
    d *= sat((r - 0.24) * 5);
    hot = wrinkle * 0.65;
  } else if (kind === 'plasma-flower') {
    const R = 0.58 + 0.17 * Math.cos(a * 5 + Math.sin(t) * 0.8) + 0.025 * Math.sin(a * 10 - t * 2);
    d = gauss(q - R, 0.13) * (0.42 + texture * 0.78) + gauss(q - R + 0.06, 0.05) * folds * 0.27;
    hot = folds * 0.42;
  } else if (kind === 'nebula-mantle') {
    const R = 0.58 + 0.11 * Math.sin(a * 3 + t) + 0.045 * Math.sin(a * 7 - t);
    d = gauss(q - R, 0.22) * sat((n - 0.23) * 2.5) * (0.22 + wrinkle * 0.7);
    hot = sat((wrinkle - 0.65) * 2.5);
  } else if (kind === 'living-eclipse') {
    const dark = Math.hypot(x - 0.22 * s - 0.13, y - 0.11 * co);
    d = gauss(q - 0.69, 0.095) * sat((dark - 0.58) * 14) * (0.28 + texture * 0.9);
    d += gauss(dark - 0.61 + warp * 0.3, 0.04) * sat((0.75 - r) * 20) * 0.48;
    hot = gauss(dark - 0.61, 0.045) * 0.68;
  } else if (kind === 'tidal-lens') {
    const wave = 0.5 + 0.5 * Math.sin(q * 27 + Math.sin(t) * 3 + a * 2 + wrinkle * 4);
    d =
      gauss(q - 0.65, 0.145) * (0.18 + wave * 0.46 + texture * 0.22) + gauss(q - 0.74, 0.024) * 0.6;
    hot = wave * 0.35;
  } else if (kind === 'storm-lances') {
    for (let i = 0; i < 3; i++) {
      const b = a - (i * TAU) / 3 - t,
        curve = 0.14 * Math.sin(r * 12 + t * 2 + i);
      const z = Math.sin(b) - curve + (wrinkle - 0.5) * 0.04;
      const extent = gauss(r - 0.64, 0.25) * sat(Math.cos(b) * 6);
      d += extent * (gauss(z, 0.014) * 0.85 + gauss(z, 0.085) * (0.14 + texture * 0.48));
      hot += gauss(z, 0.014) * extent * 0.85;
    }
  } else if (kind === 'floating-prisms') {
    shade = 0.68;
    for (let i = 0; i < 6; i++) {
      const b = (i * TAU) / 6 + 0.12 * s,
        xx = x - Math.cos(b) * 0.7,
        yy = y - Math.sin(b) * 0.63 - 0.025 * Math.sin(t + i);
      const w = 0.095 + 0.02 * Math.sin(t + i),
        h = 0.16 + 0.02 * Math.cos(t + i),
        diamond = Math.abs(xx) / w + Math.abs(yy) / h;
      const face = sat((1 - diamond) * 16),
        light = 0.34 + 0.3 * sat(0.5 + (xx / w) * 0.65) + 0.18 * Math.sin(t * 2 + i + yy * 17);
      d += face * light + gauss(diamond - 1, 0.1) * 0.34;
      hot += face * (xx > 0 ? 0.22 : 0.02) + gauss(xx * 0.65 - yy * 0.6, 0.012) * face * 0.3;
      if (face > 0.1) shade = xx > 0 ? 0.95 : 0.52;
    }
  } else if (kind === 'arcane-harmony') {
    for (let i = 0; i < 3; i++) {
      const angle = (i * TAU) / 3,
        xx = x * Math.cos(angle) - y * Math.sin(angle),
        yy = x * Math.sin(angle) + y * Math.cos(angle);
      const z = yy - 0.19 * Math.sin(xx * 6 + t + i) + warp;
      d += gauss(z, 0.12) * gauss(xx, 0.78) * sat((r - 0.27) * 7) * (0.32 + texture * 0.72);
    }
    hot = folds * 0.35;
  } else if (kind === 'ruby-heart') {
    shade = 0.65;
    // Faceted pulsing ruby shards; the ID stays stable, with no flat heart pictogram.
    for (let i = 0; i < 3; i++) {
      const b = (i * TAU) / 3 + t * 0.0 + 0.15 * s,
        xx = x * Math.cos(b) + y * Math.sin(b) - 0.58,
        yy = -x * Math.sin(b) + y * Math.cos(b);
      const shape = Math.abs(xx) / (0.16 + 0.02 * Math.sin(t * 2 + i)) + Math.abs(yy) / 0.27,
        face = sat((1 - shape) * 14);
      d += face * (0.45 + 0.32 * sat(0.5 + xx * 3)) + gauss(shape - 1, 0.16) * 0.15;
      hot += face * sat(0.3 + yy * 2) * 0.6;
      if (face > 0.1) shade = xx > 0 ? 0.94 : 0.5;
    }
    d += gauss(q - 0.58, 0.16) * texture * 0.2;
  } else if (kind === 'constellation-breath') {
    for (let i = 0; i < 5; i++) {
      const b = (i * TAU) / 5 + 0.1 * Math.sin(t + i),
        rr = 0.47 + 0.25 * (0.5 + 0.5 * Math.sin(t + i));
      const xx = x - Math.cos(b) * rr,
        yy = y - Math.sin(b) * rr;
      const star =
        gauss(Math.hypot(xx, yy), 0.028) +
        gauss(xx, 0.012) * gauss(yy, 0.065) +
        gauss(yy, 0.012) * gauss(xx, 0.065);
      d += star + gauss(Math.sin(a - b) + warp, 0.065) * gauss(r - rr + 0.16, 0.18) * texture * 0.6;
      hot += star * 0.9;
    }
  } else if (kind === 'aether-drops') {
    for (let i = 0; i < 4; i++) {
      const b = (i * TAU) / 4 + t,
        xx = x - Math.cos(b) * 0.63,
        yy = y - Math.sin(b) * 0.59;
      const rr = Math.hypot(xx * (1 + 0.17 * Math.sin(t + i)), yy * (1 - 0.17 * Math.sin(t + i))),
        R = 0.135 + 0.023 * Math.sin(t * 2 + i);
      const fill = sat((R - rr) * 22);
      d +=
        gauss(rr - R, 0.016) * (0.4 + 0.3 * Math.cos(Math.atan2(yy, xx) + t)) +
        fill * (0.12 + wrinkle * 0.27);
      const reflection = gauss(Math.hypot(xx + 0.04, yy + 0.055), 0.026);
      d += reflection * 0.65;
      hot += reflection * 0.95;
    }
  } else if (kind === 'celestial-rosette') {
    const R = 0.43 + 0.32 * Math.abs(Math.cos(a * 3 + Math.sin(t) * 0.25));
    d = gauss(q - R, 0.08) * (0.5 + texture * 0.55) + gauss(q - R + 0.12, 0.12) * texture * 0.36;
    hot = folds * 0.58;
  } else if (kind === 'gravity-fold') {
    for (let i = 0; i < 2; i++) {
      const b = i * 1.4 + 0.2 * s,
        xx = x * Math.cos(b) - y * Math.sin(b),
        yy = x * Math.sin(b) + y * Math.cos(b);
      const R = Math.hypot(xx / 0.81, yy / 0.31) + warp;
      d += gauss(R - 1, 0.14) * sat((xx + 0.3) * 2) * (0.3 + texture * 0.8);
    }
    hot = wrinkle * 0.45;
  } else if (kind === 'discharge-matrix') {
    for (let i = 0; i < 4; i++) {
      const b = (i * Math.PI) / 2 + 0.18 * s,
        xx = x * Math.cos(b) - y * Math.sin(b),
        yy = x * Math.sin(b) + y * Math.cos(b);
      const jitter = 0.035 * Math.sin(xx * 53 + t * 4) + 0.022 * Math.sin(xx * 87 - t * 6),
        z = yy - 0.52 - jitter;
      const pulse = 0.3 + 0.7 * Math.sin(t * 4 + i * 1.5) ** 4;
      d += (gauss(z, 0.012) * 0.75 + gauss(z, 0.065) * texture * 0.4) * gauss(xx, 0.54) * pulse;
      d += gauss(Math.hypot(xx - 0.51, yy - 0.52), 0.03) * 0.8;
      hot += gauss(z, 0.014) * 0.8;
    }
  } else if (kind === 'threshold-wings') {
    const xx = Math.abs(x),
      curve = -0.16 - 0.35 * Math.sin(xx * 2.6) + 0.085 * s;
    const width = 0.15 + 0.07 * Math.sin(xx * 3),
      feathers = 0.4 + 0.6 * Math.sin(xx * 30 + y * 14 - t * 2 + wrinkle * 2) ** 2;
    d =
      gauss(y - curve + warp, width) *
      gauss(xx - 0.56, 0.26) *
      sat((xx - 0.15) * 8) *
      (0.35 + feathers * 0.65);
    hot = feathers * 0.5;
  } else if (kind === 'abyssal-veil') {
    const spiral = Math.sin(a * 2 + q * 8 + t + warp * 10);
    d =
      gauss(q - 0.59, 0.21) *
      sat((spiral + 0.15) * 1.25) *
      sat((n - 0.2) * 2.5) *
      (0.18 + wrinkle * 0.72);
    hot = sat((wrinkle - 0.5) * 0.8);
  } else if (kind === 'sapphire-iris') {
    const sector = Math.sin(a * 8 + 0.65 * s),
      R = 0.54 + 0.11 * sector;
    d = gauss(q - R, 0.095) * (0.3 + texture * 0.6) + gauss(q - 0.72, 0.05) * sat(sector) * 0.5;
    hot = folds * 0.48;
  }
  const brightness =
    kind === 'storm-lances'
      ? 1.85
      : kind === 'arcane-harmony'
        ? 1.45
        : kind === 'mirror-helix' || kind === 'aurora-veil'
          ? 1.25
          : 1;
  return [sat(d * brightness * sat((0.96 - r) * 35)), sat(hot), shade];
}
