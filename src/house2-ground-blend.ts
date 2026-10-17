import type { House2GroundStroke } from '../shared/house-v2';

/** Join adjacent passes before feathering so their overlap never leaves brush rings. */
export function groundPaintRuns(strokes: House2GroundStroke[]) {
  const runs: {
    material: House2GroundStroke['material'];
    width: number;
    strokes: House2GroundStroke[];
  }[] = [];
  for (const stroke of strokes) {
    const previous = runs.at(-1);
    if (previous?.material === stroke.material && previous.width === stroke.width)
      previous.strokes.push(stroke);
    else
      runs.push({
        material: stroke.material,
        width: stroke.width,
        strokes: [stroke],
      });
  }
  return runs;
}

/** An inward, gently uneven margin fades out before the ownership boundary. */
export function groundPlotMargin(p: { x: number; y: number; width: number; height: number }) {
  const inset = Math.min(0.65, Math.min(p.width, p.height) / 8),
    corner = Math.min(0.7, (Math.min(p.width, p.height) - inset * 2) / 4),
    x0 = p.x + inset,
    y0 = p.y + inset,
    x1 = p.x + p.width - inset,
    y1 = p.y + p.height - inset;
  const points: string[] = [];
  function point(x: number, y: number, nx: number, ny: number) {
    const variation =
      inset * (Math.sin(x * 2.1 + y * 0.7) * 0.14 + Math.sin(y * 2.7 - x * 0.9) * 0.1);
    points.push(`${(x + nx * variation).toFixed(3)} ${(y + ny * variation).toFixed(3)}`);
  }
  function line(ax: number, ay: number, bx: number, by: number, nx: number, ny: number) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2);
    for (let i = 0; i < steps; i++)
      point(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps, nx, ny);
  }
  function arc(cx: number, cy: number, start: number) {
    for (let i = 0; i <= 10; i++) {
      const a = start + ((Math.PI / 2) * i) / 10;
      point(cx + Math.cos(a) * corner, cy + Math.sin(a) * corner, -Math.cos(a), -Math.sin(a));
    }
  }
  line(x0 + corner, y0, x1 - corner, y0, 0, 1);
  arc(x1 - corner, y0 + corner, -Math.PI / 2);
  line(x1, y0 + corner, x1, y1 - corner, -1, 0);
  arc(x1 - corner, y1 - corner, 0);
  line(x1 - corner, y1, x0 + corner, y1, 0, -1);
  arc(x0 + corner, y1 - corner, Math.PI / 2);
  line(x0, y1 - corner, x0, y0 + corner, 1, 0);
  arc(x0 + corner, y0 + corner, Math.PI);
  return 'M' + points.join(' L') + ' Z';
}
