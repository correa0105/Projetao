import { useId, type CSSProperties } from 'react';

function EngravedPaper({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2=".15">
        <stop stopColor="#704929" />
        <stop offset=".17" stopColor="#c69a58" />
        <stop offset=".4" stopColor="#f8e5b3" />
        <stop offset=".65" stopColor="#d6b17a" />
        <stop offset="1" stopColor="#87603a" />
      </linearGradient>
      <linearGradient id={`${id}-sheet`} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#b58a51" />
        <stop offset=".18" stopColor="#f3dfad" />
        <stop offset=".58" stopColor="#e5c78f" />
        <stop offset="1" stopColor="#a57842" />
      </linearGradient>
      <radialGradient id={`${id}-seal`} cx=".32" cy=".25" r=".85">
        <stop stopColor="#db6946" />
        <stop offset=".45" stopColor="#a93625" />
        <stop offset="1" stopColor="#4e1718" />
      </radialGradient>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency=".68"
          numOctaves="3"
          seed="19"
          result="grain"
        />
        <feColorMatrix in="grain" type="saturate" values="0" />
        <feComposite in2="SourceGraphic" operator="in" />
        <feBlend in="SourceGraphic" mode="soft-light" />
      </filter>
    </defs>
  );
}

// Sample four different cubic trails into filled ribbons, narrowing smoothly at the tips.
type Point = [number, number];
const magicOrigins: Point[] = [
  [35, 62],
  [72, 71],
  [56, 38],
  [46, 89],
];
const magicCurves: number[][][] = [
  [
    [48, 60, 20, 82, 14, 68],
    [8, 52, 43, 42, 33, 30],
    [17, 17, -2, 44, 7, 21],
    [15, 2, 29, 7, 27, 1],
  ],
  [
    [67, 74, 89, 78, 94, 62],
    [106, 46, 64, 50, 74, 27],
    [84, 3, 112, 25, 93, 8],
    [83, -5, 68, 2, 71, -4],
  ],
  [
    [57, 44, 22, 40, 28, 57],
    [34, 70, 71, 41, 61, 27],
    [51, 13, 45, 17, 53, 7],
    [60, -1, 66, 13, 67, 3],
  ],
  [
    [74, 54, 82, 103, 55, 100],
    [25, 97, 28, 72, 20, 82],
    [7, 105, -2, 90, 6, 76],
    [15, 61, 13, 60, 10, 50],
  ],
];
const magicTrails = magicCurves.map((curves, index) => {
  const origin = magicOrigins[index];
  let start: Point = origin;
  const points: Point[] = [start];
  for (const [x1, y1, x2, y2, x3, y3] of curves) {
    for (let step = 1; step <= 22; step++) {
      const t = step / 22,
        s = 1 - t;
      points.push([
        s ** 3 * start[0] + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t ** 3 * x3,
        s ** 3 * start[1] + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t ** 3 * y3,
      ]);
    }
    start = [x3, y3];
  }
  const edge = (side: number) =>
    points.map(([x, y], i) => {
      const before = points[Math.max(0, i - 1)],
        after = points[Math.min(points.length - 1, i + 1)];
      const dx = after[0] - before[0],
        dy = after[1] - before[1],
        length = Math.hypot(dx, dy) || 1;
      const width = 2.1 * (1 - i / (points.length - 1)) ** 1.45;
      return `${(x - ((side * dy) / length) * width).toFixed(2)},${(y + ((side * dx) / length) * width).toFixed(2)}`;
    });
  return {
    origin,
    line: `M${origin.join(' ')} ${curves.map((curve) => `C${curve.join(' ')}`).join(' ')}`,
    ribbon: `M${edge(1).join('L')}L${edge(-1).reverse().join('L')}Z`,
  };
});

function LoreMagicWisps() {
  const id = useId().replaceAll(':', '');
  return (
    <g className="lore-magic-wisps">
      <defs>
        <radialGradient id={`${id}-light`}>
          <stop stopColor="#c4e3e8" stopOpacity=".75" />
          <stop offset=".35" stopColor="#6fbacb" stopOpacity=".45" />
          <stop offset="1" stopColor="#2db4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-thread`} x1=".5" y1="1" x2=".4" y2="0">
          <stop stopColor="#b8dede" />
          <stop offset=".45" stopColor="#6fc7d8" />
          <stop offset="1" stopColor="#458aa6" stopOpacity=".35" />
        </linearGradient>
        {magicTrails.map((trail, i) => (
          <mask
            key={i}
            id={`${id}-reveal-${i}`}
            maskUnits="userSpaceOnUse"
            x="-20"
            y="-25"
            width="155"
            height="175"
          >
            <path
              className="lore-wisp-reveal"
              d={trail.line}
              pathLength="100"
              fill="none"
              stroke="white"
              strokeWidth="12"
              strokeLinecap="round"
              style={
                {
                  '--wisp-duration': `${3.4 + i * 0.65}s`,
                  '--wisp-delay': `${-i * 0.9}s`,
                } as CSSProperties
              }
            />
          </mask>
        ))}
      </defs>
      {magicTrails.map((trail, i) => (
        <circle
          key={i}
          className="lore-magic-source"
          cx={trail.origin[0]}
          cy={trail.origin[1]}
          r="5"
          fill={`url(#${id}-light)`}
          style={{ animationDelay: `${-i * 0.65}s` }}
        />
      ))}
      {magicTrails.map((trail, i) => (
        <g
          key={i}
          className="lore-magic-wisp"
          style={
            {
              '--wisp-duration': `${3.4 + i * 0.65}s`,
              '--wisp-delay': `${-i * 0.9}s`,
              '--wisp-drift': `${(i % 2 ? 1 : -1) * 4}px`,
              transformOrigin: `${trail.origin[0]}px ${trail.origin[1]}px`,
            } as CSSProperties
          }
        >
          <path
            className="lore-wisp-ribbon"
            d={trail.ribbon}
            fill={`url(#${id}-thread)`}
            mask={`url(#${id}-reveal-${i})`}
          />
        </g>
      ))}
      <g className="lore-magic-stars" fill="#e8ffff">
        <path d="m54 32 2 7 6 3-6 2-2 8-2-8-6-2 6-3Z" />
        <path d="M13 44l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />
        <path d="m94 57 1 3 3 1-3 1-1 4-1-4-3-1 3-1Z" />
      </g>
    </g>
  );
}

export function LoreScrollHolderIcon({ rummaging = false }: { rummaging?: boolean }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg
      className={`lore-scroll-holder-icon ${rummaging ? 'is-rummaging' : ''}`}
      data-holder-state={rummaging ? 'hovered' : 'idle'}
      viewBox="0 0 180 160"
      aria-hidden="true"
      focusable="false"
    >
      <EngravedPaper id={id} />
      <defs>
        <linearGradient id={`${id}-bronze`} x1="0" x2="1" y2=".15">
          <stop stopColor="#302118" />
          <stop offset=".18" stopColor="#987044" />
          <stop offset=".38" stopColor="#d7b87e" />
          <stop offset=".62" stopColor="#a37b4b" />
          <stop offset="1" stopColor="#493021" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f2d397" />
          <stop offset=".45" stopColor="#aa8050" />
          <stop offset="1" stopColor="#543820" />
        </linearGradient>
        <radialGradient id={`${id}-mouth`} cx=".5" cy=".3" r=".8">
          <stop stopColor="#876441" />
          <stop offset=".45" stopColor="#4e3725" />
          <stop offset="1" stopColor="#16120f" />
        </radialGradient>
        <clipPath id={`${id}-mascot-stage`}>
          <rect x="-92" width="272" height="160" />
        </clipPath>
        <g id={`${id}-roll`} stroke="#765032" strokeWidth="1.3">
          <path d="M-7 0h14l-1 68H-6Z" fill={`url(#${id}-paper)`} />
          <path d="M-4 6v53M-1 10v31" stroke="#ffedc0" opacity=".6" />
          <path d="M4 4 3 52M-6 30l5-1M3 41l4 1" opacity=".45" />
          <ellipse cy="0" rx="7" ry="4.8" fill="#eacb90" />
          <ellipse cy="0" rx="4.7" ry="3.1" fill="#513923" />
          <path d="M-3-1c6-3 8 3 3 3-3 0-3-3 0-3" fill="none" stroke="#eacb90" strokeWidth="1.2" />
          <path d="M-7 44h14v5H-7Z" fill="#593a2b" />
          <path d="M-7 46h14" stroke="#d0a565" />
        </g>
      </defs>
      <ellipse cx="68" cy="143" rx="37" ry="4" fill="#050504" opacity=".65" />
      {rummaging && (
        <ellipse
          className="lore-scroll-holder-floor-shadow"
          cx="144"
          cy="150"
          rx="25"
          ry="3"
          fill="#050504"
        />
      )}
      <g clipPath={`url(#${id}-mascot-stage)`} pointerEvents="none" data-site-mascot="crystal-fox">
        <g className="lore-mascot-traveler">
          <foreignObject x="0" y="36" width="116" height="116">
            <div className="lore-mascot-run-sprite" />
          </foreignObject>
        </g>
      </g>
      {/* The shallow rim is the pivot: the impact tips one roll out instead of lifting it. */}
      <g className="lore-scroll-holder-body">
        <ellipse
          data-holder-rim=""
          cx="68"
          cy="106"
          rx="43"
          ry="11"
          fill={`url(#${id}-rim)`}
          stroke="#dcbb80"
          strokeWidth="2"
        />
        <ellipse cx="68" cy="106" rx="37.5" ry="7.6" fill={`url(#${id}-mouth)`} />
        <g className="lore-scroll-holder-rolls">
          <use href={`#${id}-roll`} transform="translate(37 77) rotate(-17) scale(.76)" />
          <use href={`#${id}-roll`} transform="translate(54 66) rotate(-5) scale(.9)" />
          <use href={`#${id}-roll`} transform="translate(72 71) rotate(6) scale(.84)" />
          <use href={`#${id}-roll`} transform="translate(48 91) rotate(-9) scale(.65)" />
          <use href={`#${id}-roll`} transform="translate(83 85) rotate(8) scale(.65)" />
        </g>
        <g className="lore-scroll-holder-escaping-scroll">
          <use href={`#${id}-roll`} transform="translate(100 60) scale(.7)" />
          <g transform="translate(100 60) scale(.7)">
            <circle cy="46" r="4.3" fill={`url(#${id}-seal)`} stroke="#d4905f" strokeWidth="1" />
            <path d="m0 43 2 3-2 3-2-3Z" fill="#e8bd82" />
          </g>
        </g>
        <ellipse
          cx="68"
          cy="139"
          rx="18"
          ry="5"
          fill={`url(#${id}-bronze)`}
          stroke="#b99159"
          strokeWidth="1.5"
        />
        <path
          d="M25 106c4 22 18 34 43 34s39-12 43-34c-17 12-69 12-86 0Z"
          fill={`url(#${id}-bronze)`}
          stroke="#b88d54"
          strokeWidth="1.7"
        />
        <path
          d="M32 117c17 8 55 8 72 0M43 132c14 6 36 6 50 0"
          fill="none"
          stroke="#e4c58d"
          strokeWidth="1.3"
        />
        <path
          d="M32 115c3 10 9 16 18 18M37 119l4 6"
          fill="none"
          stroke="#f4dba5"
          strokeWidth="2.3"
          opacity=".55"
        />
        <path
          d="M102 117c-4 10-11 15-21 17"
          fill="none"
          stroke="#49301e"
          strokeWidth="3"
          opacity=".65"
        />
        <g fill="none" stroke="#eccf93" strokeWidth="1.35">
          <path d="m68 118 6 7-6 7-6-7Z" />
          <path d="M57 125c-8-10-15-5-11 0 3 4 9 3 8-1m25 1c8-10 15-5 11 0-3 4-9 3-8-1" />
          <path d="m43 119 3 5m47-5-3 5M58 134l3 2m17-2-3 2" />
        </g>
        <path d="m68 120 4 5-4 5-4-5Z" fill="#476f87" stroke="#f0d399" strokeWidth="1.2" />
        <path d="m68 121-2 4 2-1 2 1Z" fill="#9bc9d8" />
        <path
          d="M25 105c10 12 76 12 86 0l-1 6c-15 12-69 12-84 0Z"
          fill={`url(#${id}-rim)`}
          stroke="#e7c78c"
          strokeWidth="1.8"
        />
        <path d="M29 112c16 8 62 8 78 0" fill="none" stroke="#533820" strokeWidth="1.2" />
        <g fill="#ead09b" stroke="#755131" strokeWidth=".65">
          {[35, 46, 57, 68, 79, 90, 101].map((x) => (
            <circle key={x} cx={x} cy={116 - Math.abs(68 - x) * 0.08} r="1.3" />
          ))}
        </g>
      </g>
      {rummaging && (
        <g className="lore-scroll-holder-grounded-glow" transform="translate(127 123) scale(.32)">
          <LoreMagicWisps />
        </g>
      )}
    </svg>
  );
}

export function LoreScrollIcon({ open = false }: { open?: boolean }) {
  const id = useId().replaceAll(':', '');
  return (
    <span
      className={`lore-scroll-symbol ${open ? 'is-open' : 'is-closed'}`}
      data-scroll-state={open ? 'open' : 'closed'}
      aria-hidden="true"
    >
      <svg viewBox="0 0 108 128" focusable="false">
        <EngravedPaper id={id} />
        <g
          className="lore-scroll-closed"
          transform="rotate(-22 54 64)"
          stroke="#704729"
          strokeWidth="1.4"
        >
          <path d="M34 22c3-6 33-7 39 0l-3 87c-9 5-25 5-34-1Z" fill={`url(#${id}-paper)`} />
          <path
            d="M40 29 42 98M45 33v22"
            fill="none"
            stroke="#ffedbf"
            strokeWidth="2"
            opacity=".62"
          />
          <path d="M65 27 63 97M58 30l1 22m-20 30 7-2m14 18 9-1" fill="none" opacity=".48" />
          <path d="M34 21c0-8 39-10 40 0s-38 10-40 0Z" fill="#efd19b" />
          <ellipse cx="54" cy="21" rx="13" ry="5" fill="#533622" />
          <path
            d="M44 20c9-7 23 1 15 4-8 3-18-3-11-5 5-2 10 1 5 2"
            fill="none"
            stroke="#d3b27b"
            strokeWidth="1.8"
          />
          <path d="M36 108c0-7 34-8 35 0s-34 8-35 0Z" fill="#b68b52" />
          <path d="M38 105c7 5 24 4 31 0" stroke="#f1cd8d" fill="none" />
          <path d="m35 61 36-3-1 15-35 3Z" fill="#5a2d24" stroke="#ad7050" />
          <path d="m35 63 35-3m-34 13 33-3" stroke="#d09e64" strokeWidth="1" />
          <path
            d="m53 71-10 21 8-3 5 5 3-22m4-3 10 19-7-2-3 4-7-19"
            fill="#8e3d2c"
            stroke="#b36142"
          />
          <path
            d="m53 55 6 2 6-1 4 5 1 7-4 6-7 3-7-2-5-5-1-7 3-5Z"
            fill={`url(#${id}-seal)`}
            stroke="#e29860"
          />
          <circle cx="58" cy="66" r="7.2" fill="none" stroke="#e48b55" strokeWidth="1" />
          <path d="m58 60 4 6-4 6-4-6Zm0 3v6" fill="none" stroke="#f0b77b" strokeWidth="1.4" />
          <path d="M38 44h2m24-5 3-1m-25 56 3-1m-5 7 2 1" stroke="#916537" opacity=".6" />
        </g>
        <g className="lore-scroll-open" stroke="#886139" strokeWidth="1.4">
          <path
            d="M20 22h68l-4 27 3 14-4 22 5 21H20l3-25-4-16 4-19Z"
            fill={`url(#${id}-sheet)`}
            filter={`url(#${id}-grain)`}
          />
          <path
            d="M25 24c5 22-4 55 1 77M81 27c-4 17 2 49-1 72"
            fill="none"
            stroke="#ffe9b5"
            opacity=".65"
          />
          <path d="M28 26h49v70H28Z" fill="none" stroke="#997449" opacity=".5" />
          <path d="m29 32 5-5m39 0 5 5m-49 57 5 6m39 0 5-6" stroke="#a47d46" fill="none" />
          <g fill="none" stroke="#80603c" opacity=".82" strokeWidth="1.25">
            <path d="m54 35 6 7-6 7-6-7Zm0 3v8M35 55h37M36 61h31M35 67h38M37 73h29M36 79h33M42 85h19" />
            <path d="m33 52 2 3-2 3m42 10-3 3 3 3" />
          </g>
          <path d="M18 15h73c10 0 11 14 0 14H18c-10 0-11-14 0-14Z" fill={`url(#${id}-paper)`} />
          <ellipse cx="18" cy="22" rx="6" ry="7" fill="#efcf91" />
          <ellipse cx="18" cy="22" rx="3.5" ry="4" fill="#5a3a23" />
          <path d="M17 19c5-1 5 6 1 5-2-1-2-4 0-3" fill="none" stroke="#d6ad6b" strokeWidth="1.1" />
          <path d="M27 17h56" stroke="#ffedc3" strokeWidth="1.8" opacity=".68" />
          <path d="M20 101h72c10 0 10 14 0 14H20c-10 0-10-14 0-14Z" fill={`url(#${id}-paper)`} />
          <ellipse cx="92" cy="108" rx="6" ry="7" fill="#a47742" />
          <ellipse cx="92" cy="108" rx="3" ry="4" fill="#604126" />
          <path d="M23 104h59" stroke="#f9dba1" strokeWidth="1.7" opacity=".68" />
          <path d="M19 42l5 3m59 42-4 4m-48 6 3-2m40-60 3 2" stroke="#9a723d" opacity=".5" />
        </g>
        {open && (
          <g className="lore-scroll-magic">
            <LoreMagicWisps />
          </g>
        )}
      </svg>
      <span className="lore-scroll-embers">
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            style={
              {
                '--start': `${(i % 5) * 8 - 16}px`,
                '--drift': `${((i * 17) % 68) - 34}px`,
                '--rise': `${52 + ((i * 13) % 52)}px`,
                '--duration': `${2.8 + (i % 4) * 0.45}s`,
                '--delay': `${-i * 0.43}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>
    </span>
  );
}
