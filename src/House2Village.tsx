import { useMemo } from 'react';
import { House2GroundPaint } from './House2GroundPaint';
import { house2Architecture } from './house2-architecture';
import { House2Roof } from './House2Roof';
import { house2RoofOccluded } from './house2-roof-visibility';
import type { House2Token } from '../shared/house2-tokens';
import {
  villageTextures,
  villageScenery,
  villageRiver,
  villageGrassVariants,
  villageGrassPatches,
} from '../shared/house-village-scenery';
import { villageLanePaths, villageConnection, villageWell } from '../shared/house-village-paths';
import {
  house2World,
  house2DoorPoint,
  house2HousePlacement,
  house2Houses,
  type House2Plot,
} from '../shared/house-v2';

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
            width={name === 'grass' ? 10 : name === 'earth' ? 3.5 : 8}
            height={name === 'grass' ? 10 : name === 'earth' ? 3.5 : 8}
          >
            <image
              href={image}
              preserveAspectRatio="xMidYMid slice"
              width={name === 'grass' ? 10 : name === 'earth' ? 3.5 : 8}
              height={name === 'grass' ? 10 : name === 'earth' ? 3.5 : 8}
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
          <g key={index}>
            <pattern
              id={'h2-grass-detail-' + index}
              width={10 + index * 2}
              height={10 + index * 2}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${index * 71 + 19})`}
            >
              <image
                href={image}
                width={10 + index * 2}
                height={10 + index * 2}
                preserveAspectRatio="xMidYMid slice"
              />
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
          opacity={index === 0 ? 0.12 : index === 1 ? 0.1 : 0.06}
        />
      ))}
      <House2GroundPaint d={villageRiver} width={9.2} material="earth" opacity={0.55} />
      <House2GroundPaint d={villageRiver} width={7.5} material="water" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {villageLanePaths.map((d) => (
          <House2GroundPaint key={d} d={d} width={2.7} material="earth" />
        ))}
        {plots.map((p) => {
          const placement = p.house_id
              ? { x: p.house_x!, y: p.house_y!, rotation: p.house_rotation }
              : house2HousePlacement(p),
            door = house2DoorPoint(placement.x, placement.y, placement.rotation);
          const a = (placement.rotation * Math.PI) / 180,
            edge = { x: door.x - Math.sin(a) * 3, y: door.y + Math.cos(a) * 3 };
          // Paths are scenery; they do not move a fixed house or alter anyone's inventory.
          return (
            <House2GroundPaint
              key={p.id}
              d={`${villageConnection(edge)} L ${door.x} ${door.y}`}
              material="earth"
              width={1.65}
            />
          );
        })}
        <House2GroundPaint d={villageConnection(villageWell)} material="earth" width={1.65} />
        <House2GroundPaint
          d="M 59 78.2 Q 60 77.5 61 78"
          material="earth"
          width={3.4}
          opacity={0.7}
        />
      </g>
      <g data-house2-scenery="overhead">
        {scenery.map((s) => (
          <g key={s.id} transform={`translate(${s.x} ${s.y})`} filter={`url(#h2-shadow-${s.kind})`}>
            <image
              data-nature-kind={s.kind}
              data-nature-zone={s.zone}
              href={s.image}
              x={-s.size / 2}
              y={-s.size / 2}
              width={s.size}
              height={s.size}
              transform={`rotate(${s.rotation})`}
              filter={s.kind === 'rock' ? 'url(#h2-rock-tone)' : undefined}
            />
          </g>
        ))}
      </g>
      <g
        data-house2-well="true"
        transform={`translate(${villageWell.x} ${villageWell.y})`}
        filter="url(#h2-shadow-rock)"
      >
        <image
          href="/vtt/medieval-expansion-20261017/outdoor-021.webp"
          x={-1.55}
          y={-1.55}
          width={3.1}
          height={3.1}
        />
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
  doorControls = true,
  actors = [],
}: {
  plots: House2Plot[];
  interior: string | null;
  selected: string | null;
  hover: string | null;
  choose: (p: House2Plot) => void;
  enter: (p: House2Plot) => void;
  onHover: (id: string | null) => void;
  doorControls?: boolean;
  actors?: House2Token[];
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
          const architecture = house2Architecture(spec.id);
          const roofWidth = spec.width * (architecture?.roofScale ?? 1);
          const roofHeight = spec.height * (architecture?.roofScale ?? 1);
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
                <g filter="url(#h2-shadow-house)">
                  <g
                    data-house2-fixed={preview ? undefined : 'true'}
                    transform={`translate(${position.x} ${position.y}) rotate(${position.rotation})`}
                    onClick={() => choose(p)}
                  >
                    <House2Roof
                      house={spec}
                      instance={p.id}
                      preview={preview}
                      fade={!preview && house2RoofOccluded(p, actors)}
                      width={roofWidth}
                      height={roofHeight}
                    />
                    <title>
                      {preview
                        ? `Modelo ilustrativo · Terreno ${p.number} disponível · escolha sua casa após adquirir o terreno`
                        : `${spec.name} · Casa de ${p.owner_name} (${p.player_name})`}
                    </title>
                  </g>
                </g>
              )}
              {doorControls &&
                (!preview ? (
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
                ))}
            </g>
          );
        })}
    </>
  );
}
