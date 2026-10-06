import type { Point, VttDrawing, VttScene, VttToken } from './vtt.js';

const epsilon = 1e-7;
function cross(a: Point, b: Point, p: Point) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
function onSegment(p: Point, a: Point, b: Point) {
  return (
    Math.abs(cross(a, b, p)) < epsilon &&
    p.x >= Math.min(a.x, b.x) - epsilon &&
    p.x <= Math.max(a.x, b.x) + epsilon &&
    p.y >= Math.min(a.y, b.y) - epsilon &&
    p.y <= Math.max(a.y, b.y) + epsilon
  );
}
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return (
    onSegment(a, c, d) ||
    onSegment(b, c, d) ||
    onSegment(c, a, b) ||
    onSegment(d, a, b) ||
    (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
  );
}
function contains(points: Point[], p: Point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j],
      b = points[i];
    if (onSegment(p, a, b)) return true;
    if (a.y > p.y !== b.y > p.y && p.x < a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y))
      inside = !inside;
  }
  return inside;
}
function overlaps(lasso: Point[], shape: Point[], closed = true) {
  if (shape.some((p) => contains(lasso, p))) return true;
  if (closed && lasso.some((p) => contains(shape, p))) return true;
  for (let i = 0; i < shape.length - (closed ? 0 : 1); i++)
    for (let j = 0; j < lasso.length; j++)
      if (
        intersects(shape[i], shape[(i + 1) % shape.length], lasso[j], lasso[(j + 1) % lasso.length])
      )
        return true;
  return false;
}
function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}
function tokenShape(t: VttToken) {
  const angle = (t.rotation * Math.PI) / 180;
  return rectangle(-t.width / 2, -t.height / 2, t.width, t.height).map((p) => ({
    x: t.x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: t.y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
  }));
}
function drawingShape(d: VttDrawing): Point[] {
  const a = d.points[0],
    b = d.points.at(-1)!;
  if (d.kind === 'rect') return rectangle(a.x, a.y, b.x - a.x, b.y - a.y);
  if (d.kind === 'text')
    return rectangle(
      a.x,
      a.y - Math.max(16, d.width * 8),
      Math.max(...d.text.split('\n').map((line) => line.length)) * Math.max(10, d.width * 4.8),
      Math.max(20, d.width * 9.6) * d.text.split('\n').length,
    );
  if (d.kind === 'circle' || d.kind === 'cone') {
    const radius = Math.hypot(b.x - a.x, b.y - a.y);
    const cone = d.kind === 'cone';
    const start = cone ? Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 6 : 0;
    const arc = cone ? Math.PI / 3 : Math.PI * 2;
    const points = Array.from({ length: cone ? 17 : 64 }, (_, i) => {
      const angle = start + (arc * i) / (cone ? 16 : 64);
      return { x: a.x + radius * Math.cos(angle), y: a.y + radius * Math.sin(angle) };
    });
    return cone ? [a, ...points] : points;
  }
  return d.points;
}

/** Local selection only; the active layer determines which objects are eligible. */
export function lassoSelection(scene: VttScene, layer: string, points: Point[]): string[] {
  if (points.length < 3 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return [];
  // A click or a straight stroke must not select objects along a zero-area line.
  const second = points.find((p) => Math.hypot(p.x - points[0].x, p.y - points[0].y) > epsilon);
  if (!second || !points.some((p) => Math.abs(cross(points[0], second, p)) > epsilon)) return [];
  if (layer === 'lighting')
    return [
      ...scene.walls.filter((w) => overlaps(points, [w.a, w.b], false)).map((w) => w.id),
      ...scene.lights.filter((l) => contains(points, l)).map((l) => l.id),
    ];
  return [
    ...new Set([
      ...scene.tokens
        .filter((t) => t.layer === layer && overlaps(points, tokenShape(t)))
        .map((t) => t.id),
      ...scene.drawings
        .filter(
          (d) =>
            d.layer === layer &&
            overlaps(points, drawingShape(d), !['pen', 'line'].includes(d.kind)),
        )
        .map((d) => d.id),
    ]),
  ];
}
