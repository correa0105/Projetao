import type { Point, TerrainStroke, VttScene } from './vtt';

function strokeAlpha(point: Point, stroke: TerrainStroke) {
  let distance = Infinity;
  for (let i = 0; i < stroke.points.length; i++) {
    const a = stroke.points[i],
      b = stroke.points[Math.min(i + 1, stroke.points.length - 1)],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    const x = Math.abs(point.x - a.x - dx * t),
      y = Math.abs(point.y - a.y - dy * t);
    distance = Math.min(distance, stroke.shape === 'square' ? Math.max(x, y) : Math.hypot(x, y));
  }
  const softness = Math.max(0.08, stroke.softness),
    radius = stroke.radius;
  return Math.max(0, Math.min(1, (radius - distance) / (radius * softness))) * stroke.opacity;
}
/** Sample paint semantics once per shot; never read map pixels or scan the map every frame. */
export function siegeWaterAt(scene: VttScene, point: Point) {
  let water = scene.ocean?.enabled ? 1 : 0;
  for (const layer of scene.terrainLayers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    let alpha = 0,
      wet = 0;
    for (const stroke of scene.terrain) {
      if (stroke.layer !== layer.id) continue;
      const a = strokeAlpha(point, stroke);
      if (!a) continue;
      if (stroke.erase) {
        alpha *= 1 - a;
        wet *= 1 - a;
      } else {
        alpha = a + alpha * (1 - a);
        wet = (stroke.texture === 'water' ? a : 0) + wet * (1 - a);
      }
    }
    water = water * (1 - alpha * layer.opacity) + wet * layer.opacity;
  }
  return water >= 0.5;
}
