import { conditionIcon } from '../shared/vtt-condition-icons';
const paths = new Map<string, Path2D>();
export function conditionBadgeLayout(
  token: { x: number; y: number; width: number; height: number; conditions: string[] },
  zoom: number,
) {
  const size = 22 / Math.max(0.05, zoom),
    gap = 2 / Math.max(0.05, zoom);
  return token.conditions
    .slice(0, 30)
    .map((name, index) => ({
      name,
      x: token.x - token.width / 2 + index * (size + gap),
      y: token.y - token.height / 2,
      size,
    }));
}
export function drawConditionBadges(
  c: CanvasRenderingContext2D,
  token: { x: number; y: number; width: number; height: number; conditions: string[] },
  zoom: number,
) {
  for (const badge of conditionBadgeLayout(token, zoom)) {
    const icon = conditionIcon(badge.name);
    c.save();
    c.translate(badge.x, badge.y);
    c.scale(badge.size / 28, badge.size / 28);
    c.beginPath();
    c.moveTo(4, 0.7);
    c.lineTo(24, 0.7);
    c.lineTo(27.3, 4);
    c.lineTo(27.3, 24);
    c.lineTo(24, 27.3);
    c.lineTo(4, 27.3);
    c.lineTo(0.7, 24);
    c.lineTo(0.7, 4);
    c.closePath();
    c.fillStyle = '#11161fec';
    c.fill();
    c.strokeStyle = '#d9b772';
    c.lineWidth = 1.3;
    c.stroke();
    c.translate(3, 3);
    c.scale(22 / 24, 22 / 24);
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.fillStyle = c.strokeStyle = icon?.color || '#e5d3ad';
    if (icon)
      for (const glyph of icon.paths) {
        let path = paths.get(glyph.d);
        if (!path) {
          path = new Path2D(glyph.d);
          paths.set(glyph.d, path);
        }
        if (glyph.fill) c.fill(path, 'evenodd');
        else c.stroke(path);
      }
    else {
      c.beginPath();
      c.moveTo(12, 2);
      c.lineTo(22, 12);
      c.lineTo(12, 22);
      c.lineTo(2, 12);
      c.closePath();
      c.stroke();
      c.font = 'bold 10px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(badge.name.slice(0, 1).toUpperCase(), 12, 12);
    }
    c.restore();
  }
}
