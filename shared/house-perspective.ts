import viewSizes from './house-view-sizes.json';
import intermediateSizes from './house-intermediate-sizes.json';
import expansionSizes from './house-expansion-sizes.json';
export function houseViewWidth(id: string, facing = 0) {
  return (
    (expansionSizes as Record<string, number[]>)[id]?.[facing] ||
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

/** Back edge of the usable ground in each unchanged background, not the wall. */
export const houseFloorPlanes: Record<string, { back: number; front: number }> = {
  'hall-hearth': { back: 0.5, front: 0.98 },
  'hall-library': { back: 0.5, front: 0.98 },
  'hall-vault': { back: 0.52, front: 0.98 },
  'hall-manor': { back: 0.53, front: 0.98 },
  'kitchen-hearth': { back: 0.51, front: 0.98 },
  'kitchen-manor': { back: 0.55, front: 0.98 },
  'kitchen-herbal': { back: 0.5, front: 0.98 },
  'kitchen-cellar': { back: 0.44, front: 0.98 },
  'porch-pines': { back: 0.54, front: 0.98 },
  'porch-coast': { back: 0.5, front: 0.98 },
  'porch-castle': { back: 0.54, front: 0.98 },
  'porch-vines': { back: 0.55, front: 0.98 },
  'garden-courtyard': { back: 0.52, front: 0.98 },
  'garden-herbs': { back: 0.42, front: 0.98 },
  'garden-moon': { back: 0.47, front: 0.98 },
  'garden-orchard': { back: 0.42, front: 0.98 },
};
export function houseFloorPlane(template = 'hall-hearth') {
  return houseFloorPlanes[template] ?? houseFloorPlanes['hall-hearth'];
}
/** Size at the feet/contact point; furniture and characters share the same plane. */
export function houseFloorScale(y: number, template = 'hall-hearth') {
  const plane = houseFloorPlane(template),
    footY = Math.max(plane.back, Math.min(plane.front, y));
  return 0.3 + ((footY - plane.back) * 0.7) / (0.84 - plane.back);
}

export function houseFloorDragPosition(
  cursor: { x: number; y: number },
  grab: { x: number; y: number },
  bounds: { width: number; height: number },
  previousY: number,
  template = 'hall-hearth',
) {
  const plane = houseFloorPlane(template),
    slope = 0.7 / (0.84 - plane.back),
    intercept = 0.3 - plane.back * slope,
    denominator = bounds.height + grab.y * slope;
  const projected =
    denominator > 1e-8
      ? (cursor.y - grab.y * intercept) / denominator
      : previousY +
        (cursor.y - (previousY * bounds.height + grab.y * houseFloorScale(previousY, template))) /
          bounds.height;
  const y = Math.max(plane.back, Math.min(plane.front, projected));
  return {
    x: Math.max(
      0.02,
      Math.min(0.98, (cursor.x - grab.x * houseFloorScale(y, template)) / bounds.width),
    ),
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
