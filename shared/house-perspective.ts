import viewSizes from './house-view-sizes.json';
import intermediateSizes from './house-intermediate-sizes.json';
export function houseViewWidth(id: string, facing = 0) {
  return (
    (intermediateSizes as Record<string, (number | null)[]>)[id]?.[facing] ||
    (viewSizes as Record<string, number[]>)[id]?.[facing] ||
    1
  );
}
export const houseViewLabels = [
  'Frente',
  'Frente e direita',
  'Direita',
  'Trás e direita',
  'Trás',
  'Trás e esquerda',
  'Esquerda',
  'Frente e esquerda',
] as const;

/** Base size is calibrated at y=.84; moving changes only the displayed size. */
export function housePerspectiveScale(y: number) {
  const depth = (Math.max(0.08, Math.min(0.98, y)) - 0.08) / 0.76;
  return 0.15 + 0.85 * depth;
}

/** Floor vanishing point measured from hall-hearth; base size remains at y=.84. */
export function houseFloorScale(y: number) {
  return Math.max(0.12, (Math.max(0.08, Math.min(0.98, y)) - 0.34) / 0.5);
}

export function houseFloorDragPosition(
  cursor: { x: number; y: number },
  grab: { x: number; y: number },
  bounds: { width: number; height: number },
  previousY: number,
) {
  const denominator = bounds.height + grab.y * 2;
  const projected =
    denominator > 1e-8
      ? (cursor.y + grab.y * 0.68) / denominator
      : previousY +
        (cursor.y - (previousY * bounds.height + grab.y * houseFloorScale(previousY))) /
          bounds.height;
  // Below the projection's minimum, the object keeps a small visible size.
  const y = Math.max(
    0.08,
    Math.min(0.98, projected < 0.4 ? (cursor.y - grab.y * 0.12) / bounds.height : projected),
  );
  return {
    x: Math.max(0.02, Math.min(0.98, (cursor.x - grab.x * houseFloorScale(y)) / bounds.width)),
    y,
  };
}

/** Lighting is specific to the exact hearth background, not applied to daylight rooms. */
export function houseHearthLight(x: number, y: number) {
  const hearth = Math.exp(-(((x - 0.5) / 0.3) ** 2 + ((y - 0.52) / 0.35) ** 2));
  const window = Math.exp(-(((x - 0.12) / 0.3) ** 2 + ((y - 0.65) / 0.5) ** 2));
  return { brightness: 0.62 + 0.17 * hearth + 0.08 * window, warmth: hearth, cool: window };
}

export const houseDepthLayers = [1, 2, 3, 4, 5, 6] as const;
/** One is in front of two. Keep legacy ordering within a layer for older layouts. */
export function housePaintLayer(depthLayer: number | null | undefined, legacyOrder: number) {
  return (7 - (depthLayer ?? 3)) * 1000 + legacyOrder;
}

/** Solve the floor anchor while the grabbed point stays under the pointer as size changes. */
export function houseDragPosition(
  cursor: { x: number; y: number },
  grab: { x: number; y: number },
  bounds: { width: number; height: number },
  previousY: number,
  minY = 0.08,
) {
  const slope = 0.85 / 0.76,
    denominator = bounds.height + grab.y * slope;
  // An oversized sprite can have its grabbed point outside the room's projection.
  // Keep that exceptional drag continuous instead of jumping to another floor anchor.
  const projectedY =
    denominator > 1e-8
      ? (cursor.y - grab.y * (0.15 - 0.08 * slope)) / denominator
      : previousY +
        (cursor.y - (previousY * bounds.height + grab.y * housePerspectiveScale(previousY))) /
          bounds.height;
  const y = Math.max(minY, Math.min(0.98, projectedY));
  return {
    x: Math.max(
      0.02,
      Math.min(0.98, (cursor.x - grab.x * housePerspectiveScale(y)) / bounds.width),
    ),
    y,
  };
}

/** Swap adjacent paint positions, including ties and gaps from older layouts. */
export function shiftHouseLayer<T extends { id: string; layer: number }>(
  placements: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const ordered = placements
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => a.piece.layer - b.piece.layer || a.index - b.index);
  const from = ordered.findIndex((v) => v.piece.id === id),
    to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return placements;
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  const layers = new Map(ordered.map((v, index) => [v.piece.id, index]));
  return placements.map((piece) => ({ ...piece, layer: layers.get(piece.id)! }));
}
