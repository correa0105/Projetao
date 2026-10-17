import { useRef, type PointerEvent } from 'react';
import { terrainTextures, type TerrainTextureId } from '../shared/vtt-terrain';
import type { House2GroundStroke, House2Plot } from '../shared/house-v2';
export function House2Ground({ plots }: { plots: House2Plot[] }) {
  const materials = new Set(plots.flatMap((p) => (p.ground ?? []).map((s) => s.material)));
  return (
    <g pointerEvents="none" data-house2-ground="true">
      <defs>
        {terrainTextures
          .filter((t) => materials.has(t.id))
          .map((t) => (
            <pattern
              key={t.id}
              id={'h2-ground-' + t.id}
              patternUnits="userSpaceOnUse"
              width="4"
              height="4"
            >
              <image href={t.image} width="4" height="4" />
            </pattern>
          ))}
        {plots.map((p) => (
          <clipPath key={p.id} id={'h2-ground-clip-' + p.id}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height} />
          </clipPath>
        ))}
      </defs>
      {plots.map((p) => (
        <g key={p.id} clipPath={'url(#h2-ground-clip-' + p.id + ')'}>
          {p.ground?.map((s, i) => {
            const d = s.points.map((v, n) => (n ? 'L' : 'M') + v.x + ' ' + v.y).join(' ');
            return (
              <g
                key={i}
                stroke={'url(#h2-ground-' + s.material + ')'}
                fill={'url(#h2-ground-' + s.material + ')'}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {[
                  [1.2, 0.12],
                  [1, 0.26],
                  [0.82, 0.9],
                ].map(([scale, opacity], n) =>
                  s.points.length === 1 ? (
                    <circle
                      key={n}
                      cx={s.points[0].x}
                      cy={s.points[0].y}
                      r={(s.width * scale) / 2}
                      opacity={opacity}
                    />
                  ) : (
                    <path
                      key={n}
                      d={d}
                      fill="none"
                      strokeWidth={s.width * scale}
                      opacity={opacity}
                    />
                  ),
                )}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}
export function House2GroundEditor({
  plot,
  strokes,
  material,
  width,
  world,
  change,
  notice,
}: {
  plot: House2Plot;
  strokes: House2GroundStroke[];
  material: TerrainTextureId;
  width: number;
  world: (x: number, y: number) => { x: number; y: number };
  change: (s: House2GroundStroke[]) => void;
  notice: (s: string) => void;
}) {
  const drag = useRef<{
    pointer: number;
    before: House2GroundStroke[];
    stroke: House2GroundStroke;
  } | null>(null);
  const point = (e: PointerEvent<SVGRectElement>) => {
    const p = world(e.clientX, e.clientY);
    return {
      x: Math.round(Math.max(plot.x, Math.min(plot.x + plot.width, p.x)) * 100) / 100,
      y: Math.round(Math.max(plot.y, Math.min(plot.y + plot.height, p.y)) * 100) / 100,
    };
  };
  function down(e: PointerEvent<SVGRectElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (strokes.length >= 250 || strokes.reduce((n, s) => n + s.points.length, 0) > 4800) {
      notice('Limite de pintura atingido. Desfaça alguns traços para continuar.');
      return;
    }
    const stroke = { material, width, points: [point(e)] };
    drag.current = { pointer: e.pointerId, before: strokes, stroke };
    e.currentTarget.setPointerCapture(e.pointerId);
    change([...strokes, stroke]);
  }
  function move(e: PointerEvent<SVGRectElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    e.stopPropagation();
    const p = point(e),
      last = d.stroke.points.at(-1)!;
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.08 || d.stroke.points.length >= 200) return;
    d.stroke = { ...d.stroke, points: [...d.stroke.points, p] };
    change([...d.before, d.stroke]);
  }
  function up(e: PointerEvent<SVGRectElement>, cancel = false) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    e.stopPropagation();
    if (cancel) change(d.before);
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return (
    <rect
      data-house2-ground-editor="true"
      x={plot.x}
      y={plot.y}
      width={plot.width}
      height={plot.height}
      fill="transparent"
      stroke="#c4a16d"
      strokeWidth=".04"
      strokeDasharray=".2 .12"
      style={{ cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={(e) => up(e)}
      onPointerCancel={(e) => up(e, true)}
    />
  );
}
