import { memo, useId, useMemo } from 'react';
import type { House2RenderWindow } from './house2-render-window';

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
    // Broad, low-amplitude variation avoids the old repeating saw-tooth shoreline.
    const grit = Math.sin(at * 0.73 + 1.4) * 0.025 + Math.sin(at * 1.31) * 0.015;
    const radius = width * (0.5 + grit);
    left.push(`${(p.x + nx * radius).toFixed(3)} ${(p.y + ny * radius).toFixed(3)}`);
    right.push(`${(p.x - nx * radius).toFixed(3)} ${(p.y - ny * radius).toFixed(3)}`);
  }
  // Semicircular caps extend beyond the centerline endpoints instead of cutting them square.
  const endRadius =
    width * (0.5 + Math.sin(length * 0.73 + 1.4) * 0.025 + Math.sin(length * 1.31) * 0.015);
  const startRadius = width * (0.5 + Math.sin(1.4) * 0.025);
  const result =
    'M' +
    left.join(' L') +
    ` A ${endRadius} ${endRadius} 0 0 0 ` +
    right.reverse().join(' L') +
    ` A ${startRadius} ${startRadius} 0 0 0 ${left[0]} Z`;
  if (outlines.size > 500) outlines.clear();
  outlines.set(key, result);
  return result;
}
/** Feather only the irregular margin; each layer samples the original crisp material. */
export const House2GroundPaint = memo(function House2GroundPaint({
  d,
  width,
  material,
  opacity = 1,
  view,
}: {
  d: string;
  width: number;
  material: string;
  opacity?: number;
  view?: House2RenderWindow;
}) {
  const id = useId().replaceAll(':', ''),
    mask = 'h2-ground-mask-' + id,
    filter = 'h2-ground-feather-' + id;
  const shapes = useMemo(
    () => ({ edge: outline(d, width), paint: outline(d, width * 1.6) }),
    [d, width],
  );
  const region = view
    ? { ...view, filterUnits: 'userSpaceOnUse' as const }
    : { x: '-30%', y: '-30%', width: '160%', height: '160%' };
  return (
    <g
      data-ground-blend={material}
      data-ground-centerline={d}
      opacity={opacity}
      fill={`url(#h2-village-${material})`}
      pointerEvents="none"
    >
      <defs>
        <filter id={filter} {...region} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={Math.min(0.24, width * 0.085)} />
        </filter>
        <mask
          id={mask}
          style={{ maskType: 'alpha' }}
          {...(view
            ? { maskUnits: 'userSpaceOnUse', ...view }
            : { x: '-30%', y: '-30%', width: '160%', height: '160%' })}
        >
          <path d={shapes.edge} fill="white" filter={`url(#${filter})`} />
        </mask>
      </defs>
      <path d={shapes.paint} mask={`url(#${mask})`} />
    </g>
  );
});
