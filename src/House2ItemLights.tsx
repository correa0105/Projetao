import { memo, useMemo, type CSSProperties } from 'react';
import { type House2Item, type House2Plot } from '../shared/house-v2';
import { house2LightItems } from '../shared/house2-items-lighting';
import { house2Contains } from '../shared/house2-tokens';
import { house2LightPolygon } from '../shared/house2-light-vision';
import { house2DayPhases, type House2DayPhase } from '../shared/house2-lighting';
type Source = House2Item & { x: number; y: number };
function Light({ item, path, mask = false }: { item: Source; path: string; mask?: boolean }) {
  const spec = house2LightItems[item.catalog_id],
    radius = spec.radius,
    id = `h2-item-light-${item.id}${mask ? '-mask' : ''}`;
  return (
    <g data-house2-light={mask ? undefined : item.id} pointerEvents="none">
      <defs>
        <clipPath id={id + '-clip'}>
          <path d={path} />
        </clipPath>
        <radialGradient id={id + '-glow'}>
          <stop
            offset="0"
            stopColor={mask ? 'black' : spec.color}
            stopOpacity={mask ? 0.96 : spec.strength * 0.5}
          />
          <stop
            offset=".2"
            stopColor={mask ? 'black' : spec.color}
            stopOpacity={mask ? 0.8 : spec.strength * 0.28}
          />
          <stop
            offset=".55"
            stopColor={mask ? 'black' : spec.color}
            stopOpacity={mask ? 0.28 : spec.strength * 0.06}
          />
          <stop offset="1" stopColor={mask ? 'black' : spec.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <circle
          className="h2-light-wave"
          style={
            {
              '--light-period': spec.pulse + 's',
              '--light-delay': -(parseInt(item.id.slice(0, 4), 16) % 31) / 10 + 's',
            } as CSSProperties
          }
          cx={item.x}
          cy={item.y}
          r={radius}
          fill={`url(#${id}-glow)`}
        />
      </g>
    </g>
  );
}
export const House2ItemLights = memo(function House2ItemLights({
  items,
  plots,
  interior,
  phase,
  view,
}: {
  items: House2Item[];
  plots: House2Plot[];
  interior: string | null;
  phase: House2DayPhase;
  view: { x: number; y: number; width: number; height: number };
}) {
  const lights = useMemo(
    () =>
      items
        .filter(
          (i): i is Source =>
            !!i.light_on && !!house2LightItems[i.catalog_id] && i.x !== null && i.y !== null,
        )
        .filter((i) => {
          const r = house2LightItems[i.catalog_id].radius;
          return (
            i.x + r > view.x &&
            i.x - r < view.x + view.width &&
            i.y + r > view.y &&
            i.y - r < view.y + view.height
          );
        })
        .filter((i) => !plots.some((p) => p.house_id && house2Contains(p, i) && p.id !== interior))
        .map((item) => ({
          item,
          path: house2LightPolygon(item, house2LightItems[item.catalog_id].radius, plots),
        })),
    [items, plots, interior, view],
  );
  const sun = house2DayPhases[phase];
  return (
    <g data-house2-item-lighting="true" pointerEvents="none">
      {!!lights.length && (
        <defs>
          <mask id="h2-local-lights-mask" maskUnits="userSpaceOnUse" {...view}>
            <rect {...view} fill="white" />
            {lights.map(({ item, path }) => (
              <Light key={item.id} item={item} path={path} mask />
            ))}
          </mask>
        </defs>
      )}
      <rect
        data-house2-day-phase={phase}
        {...view}
        fill={sun.tint}
        opacity={sun.tintOpacity}
        mask={lights.length ? 'url(#h2-local-lights-mask)' : undefined}
      />
      <g opacity={phase === 'night' ? 0.8 : phase === 'dusk' ? 0.5 : 0.22}>
        {lights.map(({ item, path }) => (
          <Light key={item.id} item={item} path={path} />
        ))}
      </g>
    </g>
  );
});
