import { houseFloorScale, houseFloorDragPosition } from './house-perspective.js';
const template = (scene?: string) => (scene === 'tavern' ? 'hall-hearth' : scene);
/** The lobby keeps the old House's shared ground plane and depth scaling. */
export function rpFloorScale(y: number, scene?: string) {
  return houseFloorScale(y, template(scene));
}
export function rpDragPosition(
  cursor: { x: number; y: number },
  grab: { x: number; y: number },
  bounds: { width: number; height: number },
  previousY: number,
  scene?: string,
) {
  const next = houseFloorDragPosition(cursor, grab, bounds, previousY, template(scene), 0.4);
  return { ...next, x: Math.max(0.03, Math.min(0.97, next.x)) };
}
