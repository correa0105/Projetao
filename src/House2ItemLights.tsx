import { useMemo, type CSSProperties } from 'react';
import { house2World, type House2Item, type House2Plot } from '../shared/house-v2';
import { house2LightItems } from '../shared/house2-items-lighting';
import { house2Contains } from '../shared/house2-tokens';
import { house2LightPolygon } from '../shared/house2-light-vision';
import { house2DayPhases, type House2DayPhase } from '../shared/house2-lighting';
type Source = House2Item & { x: number; y: number };
function Light({
  item,
  plots,
  mask = false,
}: {
  item: Source;
  plots: House2Plot[];
  mask?: boolean;
}) {
  const spec = house2LightItems[item.catalog_id],
    radius = spec.radius,
    key = plots
      .map((p) => [p.id, p.house_x, p.house_y, p.house_rotation, p.house_id, p.door_open].join(':'))
      .join('|'),
    path = useMemo(() => house2LightPolygon(item, radius, plots), [key, item.x, item.y, radius]),
    id = `h2-item-light-${item.id}${mask ? '-mask' : ''}`;
  return (
    <g data-house2-light={mask ? undefined : item.id} pointerEvents="none">
      <defs>
        <clipPath id={id + '-clip'}>
          <path d={path} />
        </clipPath>
        <radialGradient id={id + '-glow'}>
          <stop offset="0" stopColor={mask ? 'black' : spec.color} stopOpacity={mask ? 1 : 0.55} />
          <stop
            offset=".32"
            stopColor={mask ? 'black' : spec.color}
            stopOpacity={mask ? 1 : 0.24}
          />
          <stop
            offset=".65"
            stopColor={mask ? 'black' : spec.color}
            stopOpacity={mask ? 0.65 : 0.07}
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
        {!mask && (
          <g transform={`translate(${item.x} ${item.y})`} data-house2-flame={item.id}>
            <circle
              r={spec.sound === 'fire' ? 0.22 : 0.07}
              fill="#fff0bd"
              opacity=".8"
              className="h2-flame-core"
            />
            {spec.sound === 'fire' && (
              <path
                className="h2-flame-core"
                d="M-.18 .08Q-.38-.18-.1-.37Q.03-.48.04-.7Q.4-.3.19-.08Q.4.07.15.22Q-.1.37-.18.08Z"
                fill="#f5a03d"
                opacity=".8"
              />
            )}
          </g>
        )}
      </g>
    </g>
  );
}
export function House2ItemLights({
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
  const lights = items
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
    .filter((i) => !plots.some((p) => p.house_id && house2Contains(p, i) && p.id !== interior));
  const sun = house2DayPhases[phase];
  return (
    <g data-house2-item-lighting="true" pointerEvents="none">
      <defs>
        <mask
          id="h2-local-lights-mask"
          maskUnits="userSpaceOnUse"
          x={house2World.x}
          y={house2World.y}
          width="200"
          height="200"
        >
          <rect x={house2World.x} y={house2World.y} width="200" height="200" fill="white" />
          {lights.map((item) => (
            <Light key={item.id} item={item} plots={plots} mask />
          ))}
        </mask>
      </defs>
      <rect
        data-house2-day-phase={phase}
        x={house2World.x}
        y={house2World.y}
        width="200"
        height="200"
        fill={sun.tint}
        opacity={sun.tintOpacity}
        mask="url(#h2-local-lights-mask)"
      />
      <g opacity={phase === 'night' ? 0.8 : phase === 'dusk' ? 0.5 : 0.22}>
        {lights.map((item) => (
          <Light key={item.id} item={item} plots={plots} />
        ))}
      </g>
    </g>
  );
}
