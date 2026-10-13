import type { Point, VttToken } from './vtt';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type Rectangle = Pick<VttToken, 'x' | 'y' | 'width' | 'height' | 'rotation'>;
const directions: Record<ResizeHandle, [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function tokenResizeHandles(token: Rectangle, zoom: number) {
  const angle = (token.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const pad = 4 / zoom;
  return (Object.entries(directions) as [ResizeHandle, [number, number]][])
    .filter(([, [sx, sy]]) => (sx && sy) || (sx ? token.height : token.width) * zoom >= 40)
    .map(([handle, [sx, sy]]) => {
      const x = sx * (token.width / 2 + pad),
        y = sy * (token.height / 2 + pad);
      return { handle, x: token.x + x * c - y * s, y: token.y + x * s + y * c };
    });
}
export function tokenResizeHandleAt(token: Rectangle, point: Point, zoom: number) {
  return tokenResizeHandles(token, zoom)
    .map((h) => ({ ...h, distance: Math.hypot(h.x - point.x, h.y - point.y) * zoom }))
    .sort((a, b) => a.distance - b.distance)
    .find((h) => h.distance <= 10)?.handle;
}
export function tokenResizeCursor(handle: ResizeHandle, rotation: number) {
  const [x, y] = directions[handle];
  const angle = Math.atan2(y, x) + (rotation * Math.PI) / 180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][
    ((Math.round(angle / (Math.PI / 4)) % 4) + 4) % 4
  ];
}
export function resizeTokenRectangle(
  token: Rectangle,
  handle: ResizeHandle,
  start: Point,
  point: Point,
  scene: { width: number; height: number },
  freeAspect = false,
): Pick<VttToken, 'x' | 'y' | 'width' | 'height'> {
  const original = { x: token.x, y: token.y, width: token.width, height: token.height };
  if (![point.x, point.y, start.x, start.y].every(Number.isFinite)) return original;
  const [sx, sy] = directions[handle],
    angle = (token.rotation * Math.PI) / 180;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const dx = (point.x - start.x) * c + (point.y - start.y) * s;
  const dy = -(point.x - start.x) * s + (point.y - start.y) * c;
  let width = sx ? clamp(token.width + sx * dx, 8, 8000) : token.width;
  let height = sy ? clamp(token.height + sy * dy, 8, 8000) : token.height;
  if (sx && sy && !freeAspect) {
    const factor = clamp(
      1 + (sx * dx * token.width + sy * dy * token.height) / (token.width ** 2 + token.height ** 2),
      Math.max(8 / token.width, 8 / token.height),
      Math.min(8000 / token.width, 8000 / token.height),
    );
    width = token.width * factor;
    height = token.height * factor;
  }
  const at = (factor: number) => {
    const w = token.width + (width - token.width) * factor;
    const h = token.height + (height - token.height) * factor;
    const x = (sx * (w - token.width)) / 2,
      y = (sy * (h - token.height)) / 2;
    return { width: w, height: h, x: token.x + x * c - y * s, y: token.y + x * s + y * c };
  };
  const fits = (r: typeof original) => {
    const w = (Math.abs(c) * r.width + Math.abs(s) * r.height) / 2;
    const h = (Math.abs(s) * r.width + Math.abs(c) * r.height) / 2;
    return (
      r.x - w >= -1e-7 &&
      r.x + w <= scene.width + 1e-7 &&
      r.y - h >= -1e-7 &&
      r.y + h <= scene.height + 1e-7
    );
  };
  let factor = 1;
  if (fits(original) && !fits(at(1))) {
    let low = 0,
      high = 1;
    for (let i = 0; i < 32; i++) {
      const middle = (low + high) / 2;
      if (fits(at(middle))) low = middle;
      else high = middle;
    }
    factor = low;
  }
  const result = at(factor);
  result.x = clamp(result.x, 0, scene.width);
  result.y = clamp(result.y, 0, scene.height);
  return result;
}
