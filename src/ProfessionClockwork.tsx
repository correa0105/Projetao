import { professionToolArtwork } from '../shared/profession-production';
export const clockworkAxles = [
  { x: 724, y: 229, direction: 1 },
  { x: 774, y: 238, direction: -1 },
] as const;
export function ProfessionClockwork({
  rotation,
  phase,
  working,
  reduced,
}: {
  rotation: number;
  phase: number;
  working: boolean;
  reduced: boolean;
}) {
  const turn = reduced ? 0 : rotation,
    roll = 0.9 + 0.1 * Math.cos((turn * Math.PI) / 90),
    tip = clockworkAxles[0];
  return (
    <g className="pf-clockwork-assembly" data-clockwork-turn={turn}>
      {clockworkAxles.map((axle, i) => (
        <g
          key={i}
          transform={`translate(${axle.x} ${axle.y}) scale(1 .62)`}
          className="pf-clockwork-wheel"
          data-gear-direction={axle.direction}
        >
          <g
            transform={`translate(0 2.2) rotate(${turn * axle.direction + (i ? 7.5 : 0)})`}
            opacity=".9"
          >
            <image
              href="/professions/polish-20261116/clockwork-gear.webp"
              x="-29.6"
              y="-30"
              width="60"
              height="60"
              style={{ filter: 'brightness(.46)' }}
            />
          </g>
          <g
            transform={`rotate(${turn * axle.direction + (i ? 7.5 : 0)})`}
            data-gear-angle={turn * axle.direction + (i ? 7.5 : 0)}
          >
            <image
              href="/professions/polish-20261116/clockwork-gear.webp"
              x="-29.6"
              y="-30"
              width="60"
              height="60"
            />
          </g>
        </g>
      ))}
      <g
        className="pf-clockwork-driver"
        data-driver-x={tip.x}
        data-driver-y={tip.y}
        transform={`translate(${tip.x} ${tip.y}) rotate(${-12 + (working && !reduced ? Math.sin(phase * Math.PI * 2) * 1.2 : 0)}) scale(${roll} 1)`}
      >
        <image
          href={professionToolArtwork('precision-driver')}
          x="-22.3"
          y="-63"
          width="44.6"
          height="67"
        />
      </g>
    </g>
  );
}
