import { useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  guildFitPerspective,
  guildMovePerspectiveCorner,
  type GuildPerspective,
  type GuildPerspectiveGuides,
} from '../shared/guild-perspective';
export type GuildPieceGeometry = {
  width: number;
  height: number;
  base: { left: number; top: number; width: number; height: number };
  points: { x: number; y: number }[];
};
const labels = [
  'superior esquerdo',
  'superior direito',
  'inferior direito',
  'inferior esquerdo',
];
export function GuildPerspectiveControls({
  stage,
  geometry,
  perspective,
  guides,
  changeGuides,
  change,
  active,
  toggle,
}: {
  stage: RefObject<HTMLDivElement | null>;
  geometry: GuildPieceGeometry | null;
  perspective?: GuildPerspective;
  guides: GuildPerspectiveGuides;
  changeGuides: (g: GuildPerspectiveGuides) => void;
  change: (p: GuildPerspective | undefined) => void;
  active: boolean;
  toggle: () => void;
}) {
  const drag = useRef<{
    index: number;
    pointer: number;
    x: number;
    y: number;
    original?: GuildPerspective;
    width: number;
    height: number;
  } | null>(null);
  const [snap, setSnap] = useState(true);
  const fit = (side: 'left' | 'right') => {
    if (geometry)
      change(
        guildFitPerspective(geometry.base, {
          x: guides[side] * geometry.width,
          y: guides.horizon * geometry.height,
        }),
      );
  };
  return (
    <section className="guild-perspective-panel" aria-label="Perspectiva do objeto">
      <button type="button" aria-pressed={active} onClick={toggle}>
        {active ? 'Concluir perspectiva' : 'Ajustar perspectiva'}
      </button>
      {active && (
        <>
          <p>
            Escolha uma vista próxima. Alinhe com uma fuga da sala ou arraste os quatro cantos
            da peça.
          </p>
          <div className="guild-perspective-presets">
            <button type="button" disabled={!geometry} onClick={() => fit('left')}>
              Fuga à esquerda
            </button>
            <button type="button" disabled={!geometry} onClick={() => fit('right')}>
              Fuga à direita
            </button>
          </div>
          <label className="guild-perspective-check">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />
            Aderir às linhas de fuga
          </label>
          <details>
            <summary>Calibrar as guias da sala</summary>
            {[
              ['horizon', 'Linha do horizonte', 0.1, 0.8],
              ['left', 'Ponto de fuga esquerdo', -3, 0.45],
              ['right', 'Ponto de fuga direito', 0.55, 4],
            ].map(([key, label, min, max]) => (
              <label key={key as string}>
                {label}
                <input
                  type="range"
                  aria-label={label as string}
                  min={min}
                  max={max}
                  step=".01"
                  value={guides[key as keyof GuildPerspectiveGuides]}
                  onChange={(e) =>
                    changeGuides({ ...guides, [key as string]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </details>
          <button type="button" onClick={() => change(undefined)}>
            Restaurar perspectiva
          </button>
        </>
      )}
      {active &&
        geometry &&
        stage.current &&
        createPortal(
          <div className="guild-perspective-overlay">
            <svg
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              preserveAspectRatio="none"
              aria-label="Guias de perspectiva da sala"
            >
              <line
                className="guild-horizon"
                x1="0"
                x2={geometry.width}
                y1={guides.horizon * geometry.height}
                y2={guides.horizon * geometry.height}
              />
              {(['left', 'right'] as const).map((side) =>
                [0, 0.2, 0.4, 0.6, 0.8, 1].map((x, i) => (
                  <line
                    className={'guild-fuga-' + side}
                    key={side + i}
                    x1={guides[side] * geometry.width}
                    y1={guides.horizon * geometry.height}
                    x2={x * geometry.width}
                    y2={geometry.height}
                  />
                )),
              )}
              <polygon
                className="guild-perspective-quad"
                points={geometry.points.map((p) => p.x + ',' + p.y).join(' ')}
              />
            </svg>
            {geometry.points.map((point, index) => (
              <button
                key={index}
                type="button"
                className="guild-perspective-handle"
                aria-label={'Ajustar canto ' + labels[index]}
                style={{
                  left: (point.x / geometry.width) * 100 + '%',
                  top: (point.y / geometry.height) * 100 + '%',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  drag.current = {
                    index,
                    pointer: e.pointerId,
                    x: e.clientX,
                    y: e.clientY,
                    original: perspective,
                    width: geometry.base.width,
                    height: geometry.base.height,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d || d.pointer !== e.pointerId || d.index !== index) return;
                  const start = d.original?.[index] ?? { x: 0, y: 0 };
                  let x = start.x + (e.clientX - d.x) / d.width,
                    y = start.y + (e.clientY - d.y) / d.height;
                  if (snap) {
                    const current = geometry.points[index],
                      target = {
                        x:
                          current.x +
                          (x - (perspective?.[index].x ?? 0)) * geometry.base.width,
                        y:
                          current.y +
                          (y - (perspective?.[index].y ?? 0)) * geometry.base.height,
                      };
                    const neighbor =
                      geometry.points[
                        index === 0 ? 1 : index === 1 ? 0 : index === 2 ? 3 : 2
                      ];
                    const candidates = (['left', 'right'] as const)
                      .map((side) => {
                        const vx = guides[side] * geometry.width,
                          vy = guides.horizon * geometry.height;
                        return vy + ((neighbor.y - vy) * (target.x - vx)) / (neighbor.x - vx);
                      })
                      .filter(Number.isFinite)
                      .sort((a, b) => Math.abs(a - target.y) - Math.abs(b - target.y));
                    if (candidates.length && Math.abs(candidates[0] - target.y) < 9)
                      y += (candidates[0] - target.y) / geometry.base.height;
                  }
                  change(guildMovePerspectiveCorner(d.original, index, x, y));
                }}
                onPointerUp={(e) => {
                  drag.current = null;
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
                onKeyDown={(e) => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
                    return;
                  e.preventDefault();
                  e.stopPropagation();
                  const p = perspective?.[index] ?? { x: 0, y: 0 },
                    step = e.shiftKey ? 0.04 : 0.01;
                  change(
                    guildMovePerspectiveCorner(
                      perspective,
                      index,
                      p.x +
                        (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
                      p.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
                    ),
                  );
                }}
              />
            ))}
          </div>,
          stage.current,
        )}
    </section>
  );
}
