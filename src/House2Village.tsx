import { useMemo } from 'react';
import {
  villageTextures,
  villageScenery,
  villageRiver,
  villageLanePoints,
  villageGrassVariants,
  villageGrassPatches,
} from '../shared/house-village-scenery';
import {
  house2World,
  house2DoorPoint,
  house2HousePlacement,
  house2Houses,
  type House2Plot,
} from '../shared/house-v2';

const lanes = [
  'M 50 185 C 46 162 49 142 44 118 C 40 101 26 88 25 69 C 23 58 34 52 52 57 C 70 61 80 73 97 81 C 109 92 102 110 110 132 L 119 155',
  'M 32 99 C 46 99 50 109 65 112 C 81 114 95 114 107 106',
  'M 44 118 C 61 114 67 117 71 128',
  'M 52 57 C 57 67 62 67 65 77',
];
export function House2Village({ plots }: { plots: House2Plot[] }) {
  const scenery = useMemo(() => villageScenery(plots), [plots]);
  return (
    <g className="h2-village-landscape" pointerEvents="none">
      <defs>
        {Object.entries(villageTextures).map(([name, image]) => (
          <pattern
            key={name}
            id={'h2-village-' + name}
            patternUnits="userSpaceOnUse"
            width={name === 'grass' ? 22 : 8}
            height={name === 'grass' ? 22 : 8}
          >
            <image
              href={image}
              width={name === 'grass' ? 22 : 8}
              height={name === 'grass' ? 22 : 8}
            />
          </pattern>
        ))}
        <filter id="h2-village-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation=".35" />
        </filter>
        <filter id="h2-grass-blend" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        {villageGrassVariants.map((image, index) => (
          <g key={image}>
            <pattern
              id={'h2-grass-detail-' + index}
              width={20 + index * 3}
              height={20 + index * 3}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${index * 71 + 19})`}
            >
              <image href={image} width={20 + index * 3} height={20 + index * 3} />
            </pattern>
            <mask
              id={'h2-grass-area-' + index}
              maskUnits="userSpaceOnUse"
              x={-50}
              y={-15}
              width={200}
              height={200}
            >
              <g fill="white" filter="url(#h2-grass-blend)">
                {villageGrassPatches
                  .filter((p) => p.variant === index)
                  .map((p) => (
                    <path
                      key={p.id}
                      transform={`translate(${p.x} ${p.y}) rotate(${p.rotation})`}
                      d={`M ${-p.rx} 0 C ${-p.rx} ${-p.ry * 0.8} ${-p.rx * 0.15} ${-p.ry * 1.12} ${p.rx * 0.45} ${-p.ry * 0.7} S ${p.rx * 1.15} ${p.ry * 0.3} ${p.rx * 0.65} ${p.ry * 0.7} S ${-p.rx * 0.75} ${p.ry * 1.14} ${-p.rx} 0Z`}
                    />
                  ))}
              </g>
            </mask>
          </g>
        ))}
      </defs>
      <rect
        x={house2World.x}
        y={house2World.y}
        width={200}
        height={200}
        fill="url(#h2-village-grass)"
      />
      {villageGrassVariants.map((image, index) => (
        <rect
          key={image}
          data-grass-variant={index}
          x={house2World.x}
          y={house2World.y}
          width={200}
          height={200}
          fill={`url(#h2-grass-detail-${index})`}
          mask={`url(#h2-grass-area-${index})`}
        />
      ))}
      <path
        d={villageRiver}
        fill="none"
        stroke="url(#h2-village-earth)"
        strokeWidth={11}
        opacity={0.75}
      />
      <path d={villageRiver} fill="none" stroke="url(#h2-village-water)" strokeWidth={7.5} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {lanes.map((d) => (
          <g key={d}>
            <path
              d={d}
              stroke="url(#h2-village-earth)"
              strokeWidth={3.6}
              opacity={0.4}
              filter="url(#h2-village-soft)"
            />
            <path d={d} stroke="url(#h2-village-earth)" strokeWidth={2.5} opacity={0.85} />
          </g>
        ))}
        {plots.map((p) => {
          const placement = p.house_id
              ? { x: p.house_x!, y: p.house_y!, rotation: p.house_rotation }
              : house2HousePlacement(p),
            door = house2DoorPoint(placement.x, placement.y, placement.rotation);
          const a = (placement.rotation * Math.PI) / 180,
            edge = { x: door.x - Math.sin(a) * 3, y: door.y + Math.cos(a) * 3 };
          // Paths are scenery; they do not move a fixed house or alter anyone's inventory.
          const joins = villageLanePoints;
          const nearest = joins.reduce((a, b) =>
            Math.hypot(b[0] - edge.x, b[1] - edge.y) < Math.hypot(a[0] - edge.x, a[1] - edge.y)
              ? b
              : a,
          );
          return (
            <path
              key={p.id}
              className="h2-garden-path"
              d={`M ${nearest[0]} ${nearest[1]} Q ${(nearest[0] + edge.x) / 2 + 0.5} ${(nearest[1] + edge.y) / 2 - 1} ${edge.x} ${edge.y} L ${door.x} ${door.y}`}
              stroke="url(#h2-village-earth)"
              strokeWidth={1.5}
              opacity={0.8}
            />
          );
        })}
      </g>
      <g data-house2-scenery="overhead">
        {scenery.map((s) => (
          <image
            key={s.id}
            data-nature-kind={s.kind}
            href={s.image}
            x={-s.size / 2}
            y={-s.size / 2}
            width={s.size}
            height={s.size}
            transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}
          />
        ))}
      </g>
      <g transform="translate(60 78)">
        <circle r="2.1" fill="url(#h2-village-earth)" opacity={0.7} />
        <circle r="1.05" fill="url(#h2-village-stone)" stroke="#514d40" strokeWidth=".13" />
        <circle r=".66" fill="#172022" stroke="#c5c4ab" strokeWidth=".09" />
        <path d="M-1.05 0H1.05" stroke="#53412a" strokeWidth=".18" />
      </g>
    </g>
  );
}
export function House2VillageRoofs({
  plots,
  interior,
  selected,
  hover,
  choose,
  enter,
  onHover,
}: {
  plots: House2Plot[];
  interior: string | null;
  selected: string | null;
  hover: string | null;
  choose: (p: House2Plot) => void;
  enter: (p: House2Plot) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <>
      {plots
        .filter((p) => p.house_id || !p.character_id)
        .map((p) => {
          const preview = !p.house_id,
            spec = preview
              ? house2Houses[(((p.village_slot ?? 1) - 1) * 3 + 4) % house2Houses.length]
              : house2Houses.find((h) => h.id === p.house_id);
          if (!spec) return null;
          const position = preview
              ? house2HousePlacement(p)
              : { x: p.house_x!, y: p.house_y!, rotation: p.house_rotation },
            door = house2DoorPoint(position.x, position.y, position.rotation);
          return (
            <g
              key={p.id}
              data-house2-plot={p.id}
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
            >
              {(preview || interior !== p.id) && (
                <g
                  data-house2-fixed={preview ? undefined : 'true'}
                  transform={`translate(${position.x} ${position.y}) rotate(${position.rotation})`}
                  onClick={() => choose(p)}
                >
                  <image
                    className={preview ? 'h2-house-preview' : 'h2-house-fixed'}
                    href={spec.image}
                    x={-spec.width / 2}
                    y={-spec.height / 2}
                    width={spec.width}
                    height={spec.height}
                    filter="url(#h2-house-shadow)"
                  />
                  <title>
                    {preview
                      ? `Modelo ilustrativo · Terreno ${p.number} disponível · escolha sua casa após adquirir o terreno`
                      : `${spec.name} · Casa de ${p.owner_name} (${p.player_name})`}
                  </title>
                </g>
              )}
              {!preview ? (
                <g
                  className="h2-door"
                  role="button"
                  tabIndex={0}
                  aria-label={`${interior === p.id ? 'Sair da' : 'Entrar na'} casa de ${p.owner_name}`}
                  transform={`translate(${door.x} ${door.y})`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => enter(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      enter(p);
                    }
                  }}
                >
                  <circle r=".52" fill="#191710" stroke="#c2a469" strokeWidth=".045" />
                  <path
                    d="M-.2 .24v-.47h.36v.47m-.5 0h.65"
                    fill="none"
                    stroke="#e1cca0"
                    strokeWidth=".04"
                  />
                </g>
              ) : (
                (hover === p.id || selected === p.id) && (
                  <g transform={`translate(${door.x} ${door.y})`} pointerEvents="none">
                    <circle r=".48" fill="#252b1e" stroke="#d2ba79" strokeWidth=".04" />
                    <text textAnchor="middle" y=".17" fontSize=".5" fill="#e8d9ab">
                      +
                    </text>
                  </g>
                )
              )}
            </g>
          );
        })}
    </>
  );
}
