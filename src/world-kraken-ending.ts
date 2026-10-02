import * as THREE from 'three';

const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
export type KrakenEndingPose = {
  points: THREE.Vector3[];
  impactAge: number;
  age: number;
  index: number;
  angle: number;
  curl?: { center: THREE.Vector3; amount: number };
};

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
  return { points, impactAge: -1, age, index, angle };
}

/** Smooth centerline, not a rigid arm spinning around its own axis. */
export function sampleKrakenEnding(pose: KrakenEndingPose, u: number, out: THREE.Vector3) {
  const t = THREE.MathUtils.clamp(u, 0, 1.01),
    v = 1 - t;
  const weights = [v ** 4, 4 * v ** 3 * t, 6 * v * v * t * t, 4 * v * t ** 3, t ** 4];
  out.set(0, 0, 0);
  pose.points.forEach((p, i) => out.addScaledVector(p, weights[i]));
  // Travelling flex changes the entire arm, fading at both anchors and underwater.
  const envelope = Math.sin(Math.PI * t) ** 2 * (1 - smooth((pose.age - 2.1) / 0.65));
  const wave = Math.sin(t * 7.5 - pose.age * 3.2 + pose.index * 1.7) * envelope;
  out.x += -Math.sin(pose.angle) * wave * 0.075;
  out.y += Math.cos(pose.angle) * wave * 0.075;
  out.z += Math.sin(t * 9 - pose.age * 3.6 + pose.index) * envelope * 0.09;
  if (pose.curl && t > 0.68) {
    const p = (t - 0.68) / 0.32;
    const theta = p * Math.PI * (0.7 + pose.curl.amount * 1.7);
    const radius = 0.065 - p * 0.016;
    const mix = smooth((t - 0.68) / 0.18) * pose.curl.amount;
    out.x = THREE.MathUtils.lerp(
      out.x,
      pose.curl.center.x + Math.cos(pose.angle) * Math.cos(theta) * radius,
      mix,
    );
    out.y = THREE.MathUtils.lerp(
      out.y,
      pose.curl.center.y + Math.sin(pose.angle) * Math.cos(theta) * radius,
      mix,
    );
    out.z = THREE.MathUtils.lerp(out.z, pose.curl.center.z + Math.sin(theta) * radius, mix);
  }
  return out;
}
