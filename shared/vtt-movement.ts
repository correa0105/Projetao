import { blockingWalls, intersection, type Point, type VttScene } from './vtt.js';
import { attachedGroup, attachmentRoot } from './vtt-attachments.js';
import type { VttToken } from './vtt.js';

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
export function attachmentMovementError(
  scene: VttScene,
  base: VttToken,
  path: Point[],
): string | null {
  const root = attachmentRoot(scene.tokens, base);
  for (const member of attachedGroup(scene.tokens, root)) {
    const dx = member.x - root.x,
      dy = member.y - root.y;
    let from = { x: member.x, y: member.y };
    for (const point of path) {
      const to = { x: point.x + dx, y: point.y + dy };
      if (to.x < 0 || to.y < 0 || to.x > scene.width || to.y > scene.height)
        return 'Movimento fora do mapa.';
      if (member.layer === 'tokens' && movementBlocked(scene, from, to))
        return 'Uma parede, porta fechada ou janela fechada bloqueia o movimento.';
      from = to;
    }
  }
  return null;
}
