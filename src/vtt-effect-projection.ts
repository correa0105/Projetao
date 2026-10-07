// Nadir camera: world height approaches the viewer, rather than shifting an
// emitter toward the bottom of the sprite. Ground circles remain world circles.
export function projectOverheadEffect(
  plane: { rx: number; ry: number },
  radius: number,
  angle: number,
  height: number,
) {
  const z = Math.max(0, Math.min(1, height));
  const perspective = 3.2 / (3.2 - z);
  return {
    x: Math.cos(angle) * plane.rx * radius * perspective,
    y: Math.sin(angle) * plane.ry * radius * perspective,
    perspective,
  };
}
