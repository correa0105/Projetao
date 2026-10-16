import { useMemo } from 'react';

const outlines = new Map<string, string>();
function outline(d: string, width: number) {
  const key = d + ':' + width,
    stored = outlines.get(key);
  if (stored) return stored;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const length = path.getTotalLength(),
    count = Math.min(1600, Math.max(8, Math.ceil(length / 0.26)));
  const left: string[] = [],
    right: string[] = [];
  for (let i = 0; i <= count; i++) {
    const at = (length * i) / count,
      p = path.getPointAtLength(at),
      a = path.getPointAtLength(Math.max(0, at - 0.05)),
      b = path.getPointAtLength(Math.min(length, at + 0.05));
    const magnitude = Math.hypot(b.x - a.x, b.y - a.y) || 1,
      nx = -(b.y - a.y) / magnitude,
      ny = (b.x - a.x) / magnitude;
    const grit = Math.sin(p.x * 7.3 + p.y * 11.7) * 0.055 + Math.sin(p.x * 2.7 - p.y * 3.1) * 0.075;
    const radius = width * (0.5 + grit);
    left.push(`${(p.x + nx * radius).toFixed(3)} ${(p.y + ny * radius).toFixed(3)}`);
    right.push(`${(p.x - nx * radius).toFixed(3)} ${(p.y - ny * radius).toFixed(3)}`);
  }
  const result = 'M' + left.join(' L') + ' L' + right.reverse().join(' L') + ' Z';
  if (outlines.size > 500) outlines.clear();
  outlines.set(key, result);
  return result;
}
/** Feather only the irregular margin; each layer samples the original crisp material. */
export function House2GroundPaint({
  d,
  width,
  material,
  opacity = 1,
}: {
  d: string;
  width: number;
  material: string;
  opacity?: number;
}) {
  const rings = useMemo(
    () =>
      [
        [1.24, 0.1],
        [1.13, 0.18],
        [1.03, 0.29],
        [0.94, 0.55],
        [0.85, 0.95],
      ].map(([scale, alpha]) => ({ d: outline(d, width * scale), alpha })),
    [d, width],
  );
  return (
    <g
      data-ground-blend={material}
      opacity={opacity}
      fill={`url(#h2-village-${material})`}
      pointerEvents="none"
    >
      {rings.map((ring, i) => (
        <path key={i} d={ring.d} opacity={ring.alpha} />
      ))}
    </g>
  );
}
