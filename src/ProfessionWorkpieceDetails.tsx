import type { WorkPoint } from './profession-work-surfaces';
export function ProfessionWorkpieceDetails({
  id,
  profession,
  bench,
  phase,
  working,
  foreground = false,
}: {
  id: string;
  profession: string;
  bench: string;
  phase: number;
  working: boolean;
  foreground?: boolean;
}) {
  if (foreground) {
    if (profession !== 'weaving') return null;
    return (
      <>
        <defs>
          <mask
            id={id + '-warp-front'}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="960"
            height="640"
          >
            {Array.from({ length: 30 }, (_, i) => {
              const t = (i + 1) / 31;
              return (
                <path
                  key={i}
                  d={`M${317 + (700 - 317) * t} ${115 + 27 * t} L${232 + (636 - 232) * t} ${375 + 24 * t}`}
                  stroke="white"
                  strokeWidth=".8"
                />
              );
            })}
          </mask>
        </defs>
        <image
          href={bench}
          width="960"
          height="640"
          mask={'url(#' + id + '-warp-front)'}
          data-material-foreground="warp"
        />
      </>
    );
  }
  if (profession === 'jewelry')
    return (
      <>
        <defs>
          <clipPath id={id + '-ruby'}>
            <path d="M289 80L305 72L320 76L330 88L317 103L297 105L285 94Z" />
          </clipPath>
          <linearGradient id={id + '-facet-light'}>
            <stop stopColor="#fff5dc" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff2d7" stopOpacity=".3" />
            <stop offset="1" stopColor="#fff5dc" stopOpacity="0" />
          </linearGradient>
        </defs>
        {working && (
          <g clipPath={'url(#' + id + '-ruby)'}>
            <rect
              x={278 + phase * 46}
              y="65"
              width="12"
              height="60"
              transform="rotate(-20 307 90)"
              fill={'url(#' + id + '-facet-light)'}
            />
          </g>
        )}
      </>
    );
  if (profession === 'thieves-tools')
    return (
      <>
        <defs>
          <clipPath id={id + '-key-core'}>
            <ellipse cx="759" cy="258" rx="10" ry="15" />
          </clipPath>
        </defs>
        <g
          clipPath={'url(#' + id + '-key-core)'}
          data-key-core-angle={working ? Math.sin(phase * Math.PI * 2) * 6 : 0}
        >
          <image
            href={bench}
            width="960"
            height="640"
            transform={`translate(759 254) rotate(${working ? Math.sin(phase * Math.PI * 2) * 6 : 0}) translate(-759 -254)`}
          />
        </g>
      </>
    );
  return null;
}
export function ProfessionMaterialDebris({
  technique,
  contact,
  phase,
  working,
}: {
  technique: string;
  contact: WorkPoint;
  phase: number;
  working: boolean;
}) {
  if (!working || !['plane', 'carve', 'chisel', 'piece'].includes(technique)) return null;
  const stone = technique === 'chisel',
    age = (phase * (stone ? 4 : 1) + 0.8) % 1,
    fade = Math.max(0, 1 - age * 1.8);
  return (
    <g
      className={'pf-material-debris' + (stone ? ' is-stone' : '')}
      opacity={fade}
      transform={`translate(${contact.x} ${contact.y})`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <path
          key={i}
          transform={`translate(${Math.cos(i * 2.4) * age * 19} ${-age * (8 + i * 2) + age * age * 38}) rotate(${age * (i % 2 ? -140 : 140)})`}
          d={stone ? 'M-1-1L1.6-.5L1 1.3L-1.4.7Z' : 'M-1.5-.6Q0-1.6 2.6 0L1.6 1Q0-.3-1.5.6Z'}
        />
      ))}
    </g>
  );
}
