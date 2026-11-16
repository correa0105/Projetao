import type { WorkPoint, professionSurface } from './profession-work-surfaces';
import { surfacePath } from './profession-work-surfaces';
type Props = {
  id: string;
  bench: string;
  surface: ReturnType<typeof professionSurface>;
  contact: WorkPoint;
  travel: number;
  phase: number;
  working: boolean;
  reduced: boolean;
  kind: string;
  part?: 'contents' | 'front' | 'submerge';
};
export function ProfessionLiquidWork(p: Props) {
  const { id, bench, surface: s, contact, phase, working, kind, part = 'contents' } = p,
    path = surfacePath(s);
  const minX = Math.min(...s.polygon.map((v) => v.x)),
    maxX = Math.max(...s.polygon.map((v) => v.x)),
    minY = Math.min(...s.polygon.map((v) => v.y)),
    maxY = Math.max(...s.polygon.map((v) => v.y));
  const travel = p.reduced ? 0 : p.travel,
    ramp = Math.min(1, Math.abs(travel) / 12),
    dx = Math.sin(travel * 0.08) * 2 * ramp,
    dy = Math.sin(travel * 0.13) * 0.4 * ramp;
  const image = (
    <image
      className="pf-liquid-texture"
      href={bench}
      width="960"
      height="640"
      filter={ramp ? 'url(#' + id + '-flow)' : undefined}
      transform={ramp ? `translate(${dx} ${dy})` : undefined}
    />
  );
  if (part === 'front')
    return (
      <image
        className="pf-container-lip"
        data-occluder="container-only"
        href={bench}
        width="960"
        height="640"
        mask={'url(#' + id + '-front)'}
      />
    );
  if (part === 'submerge')
    return (
      <g clipPath={'url(#' + id + '-contents)'}>
        <g mask={'url(#' + id + '-wet-blade)'}>{image}</g>
      </g>
    );
  return (
    <>
      <defs>
        <clipPath id={id + '-contents'}>
          <path d={path} />
        </clipPath>
        <filter
          id={id + '-flow'}
          filterUnits="userSpaceOnUse"
          x={minX - 30}
          y={minY - 25}
          width={maxX - minX + 60}
          height={maxY - minY + 50}
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            baseFrequency={kind === 'poison' ? '.017 .045' : '.024 .08'}
            numOctaves="2"
            seed="11"
            result="grain"
          />
          <feOffset
            in="grain"
            dx={Math.sin(travel * 0.05) * 15}
            dy={Math.cos(travel * 0.06) * 7}
            result="flow"
          />
          <feColorMatrix
            in="flow"
            type="matrix"
            values="1 0 0 0 0  0 .18 0 0 .41  0 0 1 0 0  0 0 0 1 0"
            result="flat-flow"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="flat-flow"
            scale={(kind === 'poison' ? 9 : 11) * ramp}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <mask id={id + '-front'} maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="640">
          <rect x={minX - 32} y={s.y} width={maxX - minX + 64} height="280" fill="white" />
          <path d={path} fill="black" />
        </mask>
        <filter id={id + '-water-edge'}>
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <mask
          id={id + '-wet-blade'}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="960"
          height="640"
        >
          <ellipse
            cx={contact.x + 7}
            cy={contact.y + 13}
            rx="32"
            ry="12"
            fill="white"
            filter={'url(#' + id + '-water-edge)'}
          />
        </mask>
      </defs>
      <g
        clipPath={'url(#' + id + '-contents)'}
        data-whole-contents={kind}
        data-material-travel={travel}
      >
        {image}
        {kind === 'poison' && working && !p.reduced && phase > 0.5 && (
          <ellipse
            className="pf-dose-ripple"
            cx={contact.x}
            cy={contact.y}
            rx={4 + (phase - 0.5) * 75}
            ry={1 + (phase - 0.64) * 17}
            opacity={(1 - phase) * 1.7}
          />
        )}
      </g>
    </>
  );
}
export function ProfessionPoisonDrop({
  contact,
  phase,
  working,
  reduced,
  tipLift,
}: {
  contact: WorkPoint;
  phase: number;
  working: boolean;
  reduced: boolean;
  tipLift: number;
}) {
  const t = Math.max(0, Math.min(1, (phase - 0.38) / 0.12));
  if (!working || reduced || phase < 0.38 || phase > 0.5) return null;
  return (
    <ellipse
      className="pf-poison-drop"
      data-drop-x={contact.x}
      data-drop-y={contact.y + tipLift * (1 - t * t)}
      cx={contact.x}
      cy={contact.y + tipLift * (1 - t * t)}
      rx={1.5 + t * 0.8}
      ry={2.8 + t * 0.8}
    />
  );
}
