import type { PointerEvent } from 'react';
import {
  guildEstateFurnitureCatalog,
  guildEstateFurnitureFlat,
  type GuildEstateFurniture,
} from '../shared/guild-estate';
export function GuildEstateFurnitureLayer({
  items,
  selected,
  editing,
  start,
  change,
  select,
}: {
  items: GuildEstateFurniture[];
  selected: string | null;
  editing: boolean;
  start: (i: GuildEstateFurniture, e: PointerEvent<SVGGElement>) => void;
  change: (id: string, v: Record<string, unknown>) => void;
  select: (id: string) => void;
}) {
  return (
    <g data-estate-furniture-layer="owned">
      {[...items]
        .sort(
          (a, b) =>
            Number(guildEstateFurnitureFlat(b.catalog)) -
            Number(guildEstateFurnitureFlat(a.catalog)),
        )
        .filter((i) => i.x !== null && i.y !== null)
        .map((i) => {
          const f = guildEstateFurnitureCatalog.find((f) => f.id === i.catalog)!,
            w = f.width * 1.4 * i.scale,
            h = f.height * 1.4 * i.scale;
          return (
            <g
              key={i.id}
              role="button"
              tabIndex={0}
              data-estate-interactive="furniture"
              data-estate-owned-item={i.id}
              data-x={i.x}
              data-y={i.y}
              data-rotation={i.rotation}
              aria-label={f.name}
              className={'guild-estate-item' + (selected === i.id ? ' selected' : '')}
              transform={`translate(${i.x} ${i.y})`}
              onClick={() => select(i.id)}
              onPointerDown={(e) => start(i, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(i.id);
                }
                if (!editing) return;
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                  e.preventDefault();
                  change(i.id, {
                    x: i.x! + (e.key === 'ArrowLeft' ? -0.25 : e.key === 'ArrowRight' ? 0.25 : 0),
                    y: i.y! + (e.key === 'ArrowUp' ? -0.25 : e.key === 'ArrowDown' ? 0.25 : 0),
                  });
                }
                if (e.key.toLowerCase() === 'r') {
                  e.preventDefault();
                  change(i.id, { rotation: (i.rotation + 90) % 360 });
                }
              }}
            >
              <title>{f.name}</title>
              <g transform={`rotate(${i.rotation})`}>
                <rect
                  x={-w / 2 - 0.1}
                  y={-h / 2 - 0.1}
                  width={w + 0.2}
                  height={h + 0.2}
                  className="guild-estate-selection"
                />
                <image
                  href={f.image}
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  preserveAspectRatio="xMidYMid meet"
                  filter={guildEstateFurnitureFlat(i.catalog) ? undefined : 'url(#ge-shadow)'}
                />
              </g>
            </g>
          );
        })}
    </g>
  );
}
