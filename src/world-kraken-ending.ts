import * as THREE from 'three';

// Uneven rhythms deliberately overlap: there is no idle pose between strokes.
const strikes = [0.18, 0.47, 0.31, 0.67, 0.39, 0.58];
const periods = [0.46, 0.59, 0.53, 0.71, 0.49, 0.64];
const dives = [1.65, 1.85, 1.75, 2, 1.9, 2.1];
const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const cycle = (phase: number) => {
  const p = ((phase % 1) + 1) % 1;
  // Slow lift and fast slap, without a flat plateau at the waterline.
  return Math.sin(Math.PI * 0.5 * (p < 0.72 ? p / 0.72 : (1 - p) / 0.28)) ** 1.35;
};
export type KrakenEndingPose = { points: THREE.Vector3[]; impactAge: number };

/** Repeated chaotic inward strokes with a travelling bend, continuing into the dive. */
export function krakenEndingPose(
  age: number,
  index: number,
  angle: number,
  water: number,
): KrakenEndingPose {
  const first = strikes[index],
    period = periods[index],
    phase = (age - first) / period;
  const dive = smooth((age - dives[index]) / (2.85 - dives[index]));
  const activity = 1 - dive;
  const lift = cycle(phase) * activity;
  const follow = cycle(phase - 0.16) * activity;
  const wriggle = Math.sin(age * (8.1 + index * 0.71) + index * 1.9) * activity;
  const secondary = Math.sin(age * (13.2 - index * 0.6) + index * 0.7) * activity;
  const radii = [0.72, 0.6 + 0.075 * follow, 0.37 + 0.1 * lift, 0.14 + 0.025 * follow, 0.055];
  // Flex in the fixed radial lane; the ends remain over the wreck, never fling outward.
  const sides = [0, 0.08 * wriggle, 0.11 * secondary, 0.065 * wriggle, 0.012 * secondary];
  const heights = [
    -0.18,
    water - 0.1 + follow * 0.36 + 0.055 * secondary - dive * 0.65,
    water + 0.22 + follow * 0.44 + 0.07 * wriggle - dive * 0.75,
    water + 0.07 + lift * 0.48 + 0.045 * secondary - dive * 0.8,
    water - 0.04 + lift * (0.65 + 0.08 * Math.sin(age * 3.3 + index)) - dive * 0.95,
  ];
  const points = radii.map(
    (r, i) =>
      new THREE.Vector3(
        Math.cos(angle) * r - Math.sin(angle) * sides[i],
        Math.sin(angle) * r + Math.cos(angle) * sides[i],
        heights[i],
      ),
  );
  const lastHit = first + Math.floor((age - first) / period) * period;
  const elapsed = age - lastHit;
  return { points, impactAge: age >= first && elapsed < 0.28 && dive < 0.55 ? elapsed : -1 };
}

/** Smooth centerline, not a rigid arm spinning around its own axis. */
export function sampleKrakenEnding(pose: KrakenEndingPose, u: number, out: THREE.Vector3) {
  const t = THREE.MathUtils.clamp(u, 0, 1.01),
    v = 1 - t;
  const weights = [v ** 4, 4 * v ** 3 * t, 6 * v * v * t * t, 4 * v * t ** 3, t ** 4];
  out.set(0, 0, 0);
  pose.points.forEach((p, i) => out.addScaledVector(p, weights[i]));
  return out;
}
