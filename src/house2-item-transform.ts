import {
  house2Clamp,
  house2RotatedSize,
  type House2Layout,
  type House2Plot,
} from '../shared/house-v2';

type Item = House2Layout['items'][number];
type Plot = Pick<House2Plot, 'x' | 'y' | 'width' | 'height'>;
type Point = { x: number; y: number };
type Size = { width: number; height: number };
export const house2BorderHandles = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
} as const;
export type House2BorderHandle = keyof typeof house2BorderHandles;

function rotate(p: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

/** Keep the opposite border fixed, preserve the art's proportions and fit the entire sprite. */
export function house2ResizeFromBorder(
  plot: Plot,
  item: Item,
  size: Size,
  handle: House2BorderHandle,
  delta: Point,
): Item {
  const [sx, sy] = house2BorderHandles[handle];
  const local = rotate(delta, -item.rotation),
    scale = item.scale ?? 1;
  const vx = sx * size.width,
    vy = sy * size.height;
  const requested = scale + (local.x * vx + local.y * vy) / (vx * vx + vy * vy);
  const center = rotate({ x: vx / 2, y: vy / 2 }, item.rotation);
  const anchor = { x: item.x - center.x * scale, y: item.y - center.y * scale };
  const bounds = house2RotatedSize(size.width, size.height, item.rotation);
  const extent = {
    x: bounds.width / 2,
    y: bounds.height / 2,
  };
  let maximum = 3;
  for (const axis of ['x', 'y'] as const) {
    const minimum = plot[axis],
      end = minimum + (axis === 'x' ? plot.width : plot.height);
    for (const sign of [-1, 1]) {
      const coefficient = center[axis] + sign * extent[axis];
      if (coefficient > 1e-9) maximum = Math.min(maximum, (end - anchor[axis]) / coefficient);
      else if (coefficient < -1e-9)
        maximum = Math.min(maximum, (minimum - anchor[axis]) / coefficient);
    }
  }
  const next = Math.max(0.25, Math.min(maximum, requested));
  return { ...item, scale: next, x: anchor.x + center.x * next, y: anchor.y + center.y * next };
}

export function house2RotateFromBorder(
  plot: Plot,
  item: Item,
  size: Size,
  start: Point,
  point: Point,
  snap = false,
): Item {
  const angle =
    Math.atan2(point.y - item.y, point.x - item.x) - Math.atan2(start.y - item.y, start.x - item.x);
  const degrees = item.rotation + (angle * 180) / Math.PI;
  return house2SetItemRotation(plot, item, size, snap ? Math.round(degrees / 15) * 15 : degrees);
}

export function house2SetItemRotation(plot: Plot, item: Item, size: Size, degrees: number): Item {
  const rotation = (Math.round((((degrees % 360) + 360) % 360) * 100) / 100) % 360;
  const bounds = house2RotatedSize(size.width, size.height, rotation);
  const scale = Math.min(item.scale ?? 1, plot.width / bounds.width, plot.height / bounds.height);
  const next = { ...item, rotation, scale };
  return { ...next, ...house2Clamp(plot, next, size.width * scale, size.height * scale) } as Item;
}
