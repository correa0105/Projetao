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
  const retract = (delay: number) =>
    smooth((age - delay - index * 0.08) / (2.85 - delay - index * 0.08));
  const shoulder = retract(1.35),
    middle = retract(1.12),
    end = retract(0.95);
  const radii = [0.72, 0.61 - shoulder * 0.15, 0.4 - middle * 0.13, 0.17, 0.055];
  const heights = [
    -0.18,
    water + 0.43 - fold * 0.12 - shoulder * 0.95,
    water + 0.56 - fold * 0.16 - middle * 1.05,
    water + 0.16 - fold * 0.04 - end * 0.96,
    water + 0.04 - end,
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
