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

/** Check a carried offset's rotational arc after translation, before saving. */
export function attachmentRotationError(
  scene: VttScene,
  previous: VttScene,
  base: VttToken,
): string | null {
  const group = attachedGroup(scene.tokens, base);
  const root = attachmentRoot(scene.tokens, base),
    oldRoot = previous.tokens.find((t) => t.id === root.id);
  if (!oldRoot) return null;
  const degrees = ((((root.rotation - oldRoot.rotation + 180) % 360) + 360) % 360) - 180;
  const steps = Math.max(1, Math.ceil(Math.abs(degrees) / 10));
  for (const token of group) {
    if (token.id === root.id) continue;
    const old = previous.tokens.find((t) => t.id === token.id);
    if (!old) continue;
    const x = old.x - oldRoot.x,
      y = old.y - oldRoot.y;
    let from = { x: root.x + x, y: root.y + y };
    for (let step = 1; step <= steps; step++) {
      const a = (((degrees * Math.PI) / 180) * step) / steps,
        to = {
          x: root.x + x * Math.cos(a) - y * Math.sin(a),
          y: root.y + x * Math.sin(a) + y * Math.cos(a),
        };
      if (to.x < 0 || to.y < 0 || to.x > scene.width || to.y > scene.height)
        return 'A rotação do token vinculado ultrapassa o mapa.';
      if (token.layer === 'tokens' && movementBlocked(scene, from, to))
        return 'Uma parede bloqueia a rotação do token vinculado.';
      from = to;
    }
  }
  return null;
}
