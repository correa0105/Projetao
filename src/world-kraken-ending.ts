import * as THREE from 'three';

const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
export type KrakenEndingPose = { points: THREE.Vector3[]; impactAge: number };

/** Fold around the wreckage, then pull down continuously without surface strikes. */
export function krakenEndingPose(
  age: number,
  index: number,
  angle: number,
  water: number,
): KrakenEndingPose {
  const fold = smooth((age + 0.1) / 0.8);
  const dive = smooth((age - 1.05 - index * 0.1) / (1.8 - index * 0.1));
  const radii = [0.72, 0.61 - fold * 0.05, 0.4 - fold * 0.04, 0.17, 0.055];
  const heights = [
    -0.18,
    water + 0.08 + fold * 0.12 - dive * 0.85,
    water + 0.28 - fold * 0.06 - dive * 0.92,
    water + 0.12 - fold * 0.04 - dive * 0.96,
    water + 0.04 - dive,
  ];
  const points = radii.map(
    (r, i) => new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, heights[i]),
  );
  return { points, impactAge: -1 };
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
