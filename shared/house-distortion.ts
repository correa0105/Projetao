import { houseDistortionLimit, type HouseDistortion } from './house.js';

export const houseImageCorners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
] as const;
export const houseCornerLabels = [
  'superior esquerdo',
  'superior direito',
  'inferior direito',
  'inferior esquerdo',
];
export function houseDistortionPoints(distortion?: HouseDistortion) {
  return houseImageCorners.map((corner, i) => ({
    x: corner.x + (distortion?.[i].x ?? 0),
    y: corner.y + (distortion?.[i].y ?? 0),
  }));
}
export function houseMoveDistortionCorner(
  distortion: HouseDistortion | undefined,
  index: number,
  x: number,
  y: number,
): HouseDistortion {
  return houseImageCorners.map((_, i) =>
    i === index
      ? {
          x: Math.max(-houseDistortionLimit, Math.min(houseDistortionLimit, x)),
          y: Math.max(-houseDistortionLimit, Math.min(houseDistortionLimit, y)),
        }
      : (distortion?.[i] ?? { x: 0, y: 0 }),
  ) as HouseDistortion;
}
/** Homography maps the four image corners to the bounded editable quadrilateral.
 * At ±12%, opposing edges stay apart and the quadrilateral stays convex. */
export function houseDistortionMatrix(
  distortion: HouseDistortion | undefined,
  width: number,
  height: number,
) {
  if (!distortion?.some((p) => p.x !== 0 || p.y !== 0) || width <= 0 || height <= 0) return 'none';
  const [tl, tr, br, bl] = houseDistortionPoints(distortion);
  const dx1 = tr.x - br.x,
    dx2 = bl.x - br.x,
    dx3 = tl.x - tr.x + br.x - bl.x;
  const dy1 = tr.y - br.y,
    dy2 = bl.y - br.y,
    dy3 = tl.y - tr.y + br.y - bl.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  const a = tr.x - tl.x + g * tr.x,
    b = bl.x - tl.x + h * bl.x;
  const d = tr.y - tl.y + g * tr.y,
    e = bl.y - tl.y + h * bl.y;
  return `matrix3d(${[
    a,
    (d * height) / width,
    0,
    g / width,
    (b * width) / height,
    e,
    0,
    h / height,
    0,
    0,
    1,
    0,
    tl.x * width,
    tl.y * height,
    0,
    1,
  ].join(',')})`;
}

export function houseDistortionHandlePositions(
  geometry: { x: number; y: number; width: number; height: number },
  rotation: number,
  distortion?: HouseDistortion,
) {
  const radians = (rotation * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  return houseDistortionPoints(distortion).map((point) => {
    const x = (point.x - 0.5) * geometry.width,
      y = (point.y - 1) * geometry.height;
    return { x: geometry.x + x * cos - y * sin, y: geometry.y + x * sin + y * cos };
  });
}
