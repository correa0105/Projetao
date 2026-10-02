import * as THREE from 'three';

const strikes = [0.28, 0.63, 0.42, 1.05, 0.83, 1.22];
const dives = [1.35, 1.7, 1.45, 1.9, 1.8, 2];
const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
export type KrakenEndingPose = { points: THREE.Vector3[]; impactAge: number };

/** One inward stroke, with the bend travelling through the whole arm, then a dive. */
export function krakenEndingPose(
  age: number,
  index: number,
  angle: number,
  water: number,
): KrakenEndingPose {
  const hit = strikes[index],
    lift = smooth((age - hit + 0.46) / 0.3) * (1 - smooth((age - hit + 0.12) / 0.12));
  // The middle follows the tip with a short delay instead of moving as one rigid arch.
  const follow = smooth((age - hit + 0.35) / 0.25) * (1 - smooth((age - hit - 0.05) / 0.18));
  const dive = smooth((age - dives[index]) / (2.85 - dives[index]));
  const radii = [0.72, 0.63 + 0.07 * follow, 0.38 + 0.12 * lift, 0.13 + 0.04 * lift, 0.055];
  const sides = [0, -0.045, 0.1, -0.065, 0.012 * Math.sin(index * 2)];
  const heights = [
    -0.18,
    water - 0.12 + follow * 0.32 - dive * 0.55,
    water + 0.28 + follow * 0.45 - dive * 0.65,
    water + 0.12 + lift * 0.43 - dive * 0.75,
    water - 0.035 + lift * 0.7 - dive * 0.95,
  ];
  const points = radii.map(
    (r, i) =>
      new THREE.Vector3(
        Math.cos(angle) * r - Math.sin(angle) * sides[i],
        Math.sin(angle) * r + Math.cos(angle) * sides[i],
        heights[i],
      ),
  );
  return { points, impactAge: age >= hit && age < hit + 0.38 ? age - hit : -1 };
}

/** Quartic Bézier skin centerline: smooth curvature, no rotation around its own axis. */
export function sampleKrakenEnding(pose: KrakenEndingPose, u: number, out: THREE.Vector3) {
  const t = THREE.MathUtils.clamp(u, 0, 1.01),
    v = 1 - t;
  const weights = [v ** 4, 4 * v ** 3 * t, 6 * v * v * t * t, 4 * v * t ** 3, t ** 4];
  out.set(0, 0, 0);
  pose.points.forEach((p, i) => out.addScaledVector(p, weights[i]));
  return out;
}
