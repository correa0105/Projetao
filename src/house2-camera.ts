import { house2World } from '../shared/house-v2';
export type House2Camera = { x: number; y: number; span: number };
type Viewport = { width: number; height: number };

/** Clamp the whole viewport, including its corners, inside the playable square. */
export function boundHouse2Camera(camera: House2Camera, viewport: Viewport): House2Camera {
  const aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
  const maximum = Math.min(86, 140 / aspect);
  const span = Math.max(Math.min(9, maximum), Math.min(maximum, camera.span));
  const halfWidth = (span * aspect) / 2,
    halfHeight = span / 2;
  return {
    span,
    x: Math.max(
      house2World.x + halfWidth,
      Math.min(house2World.x + house2World.width - halfWidth, camera.x),
    ),
    y: Math.max(
      house2World.y + halfHeight,
      Math.min(house2World.y + house2World.height - halfHeight, camera.y),
    ),
  };
}
export function initialHouse2Camera(viewport: Viewport): House2Camera {
  return boundHouse2Camera(
    { x: 50, y: 85, span: Math.min(70, (120 * viewport.height) / Math.max(1, viewport.width)) },
    viewport,
  );
}
