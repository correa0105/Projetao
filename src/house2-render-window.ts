export type House2RenderWindow = { x: number; y: number; width: number; height: number };

/** Keep an overscan band, changing the expensive SVG layers only at cell boundaries. */
export function house2RenderWindow(view: House2RenderWindow): House2RenderWindow {
  const cell = 8,
    padding = 8;
  const x = Math.floor(view.x / cell) * cell - padding;
  const y = Math.floor(view.y / cell) * cell - padding;
  return {
    x,
    y,
    width: Math.ceil((view.x + view.width) / cell) * cell + padding - x,
    height: Math.ceil((view.y + view.height) / cell) * cell + padding - y,
  };
}
export function house2InRenderWindow(
  view: House2RenderWindow | undefined,
  x: number,
  y: number,
  radius: number,
) {
  return (
    !view ||
    (x + radius >= view.x &&
      x - radius <= view.x + view.width &&
      y + radius >= view.y &&
      y - radius <= view.y + view.height)
  );
}
