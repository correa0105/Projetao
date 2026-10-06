import viewSizes from './house-view-sizes.json';
export function houseViewWidth(id: string, facing = 0) {
  return (viewSizes as Record<string, number[]>)[id]?.[facing] || 1;
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
  return 0.15 + 0.85 * depth * depth;
}

/** Solve the floor anchor while the grabbed point stays under the pointer as size changes. */
export function houseDragPosition(
  cursor: { x: number; y: number },
  grab: { x: number; y: number },
  bounds: { width: number; height: number },
  previousY: number,
  minY = 0.08,
) {
  const a = (grab.y * 0.85) / 0.76 ** 2,
    b = bounds.height - 0.16 * a,
    c = 0.08 ** 2 * a + grab.y * 0.15 - cursor.y;
  const roots: number[] = [];
  if (Math.abs(a) < 1e-8) roots.push(-c / b);
  else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0)
      roots.push(
        (-b + Math.sqrt(discriminant)) / (2 * a),
        (-b - Math.sqrt(discriminant)) / (2 * a),
      );
  }
  const valid = roots.filter((v) => Number.isFinite(v) && v >= minY && v <= 0.98);
  let y = valid.sort((v, w) => Math.abs(v - previousY) - Math.abs(w - previousY))[0];
  if (y === undefined) {
    const candidates = [minY, 0.98, ...roots.map((v) => Math.max(minY, Math.min(0.98, v)))];
    if (Math.abs(a) > 1e-8) candidates.push(Math.max(minY, Math.min(0.98, -b / (2 * a))));
    y = candidates
      .filter(Number.isFinite)
      .sort(
        (v, w) =>
          Math.abs(v * bounds.height + grab.y * housePerspectiveScale(v) - cursor.y) -
          Math.abs(w * bounds.height + grab.y * housePerspectiveScale(w) - cursor.y),
      )[0];
  }
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
