import { blockingWalls, intersection, type Point, type VttScene } from './vtt.js';

const epsilon = 1e-7;
function onSegment(p: Point, a: Point, b: Point) {
  return (
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < epsilon &&
    p.x >= Math.min(a.x, b.x) - epsilon &&
    p.x <= Math.max(a.x, b.x) + epsilon &&
    p.y >= Math.min(a.y, b.y) - epsilon &&
    p.y <= Math.max(a.y, b.y) + epsilon
  );
}
/** Walls are physical barriers regardless of the legacy lighting/movement toggle. */
export function movementBlocked(scene: VttScene, from: Point, to: Point) {
  if (Math.hypot(to.x - from.x, to.y - from.y) < epsilon) return false;
  return blockingWalls(scene, true).some((w) => {
    // A token placed on a wall by the master can move away, but cannot travel along it.
    if (onSegment(from, w.a, w.b)) return onSegment(to, w.a, w.b);
    return (
      !!intersection(from, to, w.a, w.b, true) ||
      onSegment(w.a, from, to) ||
      onSegment(w.b, from, to)
    );
  });
}
