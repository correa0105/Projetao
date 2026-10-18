import { memo, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { terrainTextures, type TerrainTextureId } from '../shared/vtt-terrain';
import type { House2GroundStroke, House2Plot } from '../shared/house-v2';
import { groundPaintRuns, groundPlotMargin } from './house2-ground-blend';

const GroundPlot = memo(function GroundPlot({ plot: p }: { plot: House2Plot }) {
  const runs = useMemo(() => groundPaintRuns(p.ground ?? []), [p.ground]),
    margin = useMemo(() => groundPlotMargin(p), [p.x, p.y, p.width, p.height]),
    id = 'h2-ground-' + p.id,
    region = { x: p.x, y: p.y, width: p.width, height: p.height };
  if (!runs.length) return null;
  return (
    <g clipPath={'url(#' + id + '-clip)'} data-house2-ground-plot={p.id}>
      <defs>
        <clipPath id={id + '-clip'}>
          <rect {...region} />
        </clipPath>
        <filter
          id={id + '-margin-blur'}
          filterUnits="userSpaceOnUse"
          {...region}
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation=".15" />
        </filter>
        <mask
          id={id + '-margin'}
          maskUnits="userSpaceOnUse"
          {...region}
          style={{ maskType: 'alpha' }}
        >
          <path d={margin} fill="white" filter={'url(#' + id + '-margin-blur)'} />
        </mask>
      </defs>
      <g mask={'url(#' + id + '-margin)'} data-house2-ground-blended="true">
        {runs.map((run, index) => {
          const mask = id + '-run-' + index,
            blur = mask + '-blur';
          return (
            <g key={index} data-house2-ground-material={run.material}>
              <defs>
                <filter
                  id={blur}
                  filterUnits="userSpaceOnUse"
                  {...region}
                  colorInterpolationFilters="sRGB"
                >
                  <feGaussianBlur stdDeviation={run.width * 0.12} />
                </filter>
                <mask
                  id={mask}
                  maskUnits="userSpaceOnUse"
                  {...region}
                  style={{ maskType: 'alpha' }}
                >
                  <g
                    filter={'url(#' + blur + ')'}
                    fill="white"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {run.strokes.map((s, i) =>
                      s.points.length === 1 ? (
                        <circle
                          key={i}
                          data-house2-ground-stroke="true"
                          cx={s.points[0].x}
                          cy={s.points[0].y}
                          r={s.width * 0.38}
                          stroke="none"
                        />
                      ) : (
                        <path
                          key={i}
                          data-house2-ground-stroke="true"
                          d={s.points.map((v, n) => (n ? 'L' : 'M') + v.x + ' ' + v.y).join(' ')}
                          fill="none"
                          strokeWidth={s.width * 0.76}
                        />
                      ),
                    )}
                  </g>
                </mask>
              </defs>
              <rect
                {...region}
                fill={'url(#h2-ground-' + run.material + ')'}
                mask={'url(#' + mask + ')'}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
});

export const House2Ground = memo(function House2Ground({ plots }: { plots: House2Plot[] }) {
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
              <image href={t.image} width="4" height="4" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ))}
      </defs>
      {plots.map((p) => (
        <GroundPlot key={p.id} plot={p} />
      ))}
    </g>
  );
});
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
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    pointer: number;
    before: House2GroundStroke[];
    stroke: House2GroundStroke;
  } | null>(null);
  useLayoutEffect(() => {
    if (!pointer) {
      setCursor(null);
      return;
    }
    const p = world(pointer.x, pointer.y);
    setCursor({
      x: Math.round(Math.max(plot.x, Math.min(plot.x + plot.width, p.x)) * 100) / 100,
      y: Math.round(Math.max(plot.y, Math.min(plot.y + plot.height, p.y)) * 100) / 100,
    });
  }, [pointer, world, plot.x, plot.y, plot.width, plot.height]);
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
    setPointer({ x: e.clientX, y: e.clientY });
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
    setPointer({ x: e.clientX, y: e.clientY });
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
    if (cancel || e.pointerType === 'touch') setPointer(null);
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    e.stopPropagation();
    if (cancel) change(d.before);
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return (
    <>
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
        onPointerEnter={(e) => setPointer({ x: e.clientX, y: e.clientY })}
        onPointerLeave={() => {
          if (!drag.current) setPointer(null);
        }}
        onPointerUp={(e) => up(e)}
        onPointerCancel={(e) => up(e, true)}
        onLostPointerCapture={(e) => {
          if (drag.current?.pointer === e.pointerId) up(e, true);
        }}
      />
      {cursor && (
        <g data-house2-ground-cursor="true" aria-hidden="true" pointerEvents="none">
          <circle
            cx={cursor.x}
            cy={cursor.y}
            r={width / 2}
            fill="#d6b77b12"
            stroke="#111b25"
            strokeWidth={4}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            data-house2-brush-footprint="true"
            cx={cursor.x}
            cy={cursor.y}
            r={width / 2}
            fill="none"
            stroke="#f3e5c9"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </>
  );
}
