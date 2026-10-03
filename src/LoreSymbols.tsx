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
      viewBox="0 0 128 160"
      aria-hidden="true"
      focusable="false"
    >
      <EngravedPaper id={id} />
      <defs>
        <linearGradient id={`${id}-leather`} x1="0" x2="1" y2=".1">
          <stop stopColor="#261a14" />
          <stop offset=".18" stopColor="#795237" />
          <stop offset=".38" stopColor="#a87a4c" />
          <stop offset=".65" stopColor="#70432c" />
          <stop offset="1" stopColor="#2b1b15" />
        </linearGradient>
        <linearGradient id={`${id}-wood`} x1="0" x2="1" y2=".15">
          <stop stopColor="#30251a" />
          <stop offset=".22" stopColor="#9c7444" />
          <stop offset=".42" stopColor="#d3af72" />
          <stop offset=".68" stopColor="#80603a" />
          <stop offset="1" stopColor="#3c281b" />
        </linearGradient>
        <linearGradient id={`${id}-strap`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#3e271b" />
          <stop offset=".4" stopColor="#805736" />
          <stop offset="1" stopColor="#4a2d1e" />
        </linearGradient>
        <radialGradient id={`${id}-mouth`} cx=".5" cy=".28" r=".8">
          <stop stopColor="#765038" />
          <stop offset=".45" stopColor="#2e211a" />
          <stop offset="1" stopColor="#0d0d0b" />
        </radialGradient>
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
      <ellipse cx="55" cy="127" rx="33" ry="4" fill="#050504" opacity=".65" />
      {rummaging && (
        <ellipse
          className="lore-scroll-holder-floor-shadow"
          cx="121"
          cy="133"
          rx="29"
          ry="3"
          fill="#050504"
        />
      )}
      {/* The front leather wall conceals the rolls until they rise completely above the wooden rim. */}
      <g className="lore-scroll-holder-body">
        <ellipse
          data-holder-rim=""
          cx="55"
          cy="55"
          rx="31"
          ry="10"
          fill={`url(#${id}-wood)`}
          stroke="#cba871"
          strokeWidth="2"
        />
        <ellipse cx="55" cy="55" rx="26" ry="7" fill={`url(#${id}-mouth)`} />
        <g className="lore-scroll-holder-rolls">
          <use href={`#${id}-roll`} transform="translate(35 15) rotate(-9)" />
          <use href={`#${id}-roll`} transform="translate(53 8) rotate(2)" />
          <use href={`#${id}-roll`} transform="translate(77 18) rotate(12)" />
          <use href={`#${id}-roll`} transform="translate(34 34) rotate(-5) scale(.9)" />
          <use href={`#${id}-roll`} transform="translate(68 29) rotate(7) scale(.95)" />
        </g>
        <g className="lore-scroll-holder-escaping-scroll">
          <use href={`#${id}-roll`} transform="translate(55 36) scale(.8)" />
          <g transform="translate(55 36) scale(.8)">
            <circle cy="46" r="4.3" fill={`url(#${id}-seal)`} stroke="#d4905f" strokeWidth="1" />
            <path d="m0 43 2 3-2 3-2-3Z" fill="#e8bd82" />
          </g>
        </g>
        <path
          d="M24 56 29 117c1 11 51 11 52 0l5-61c-11 10-51 10-62 0Z"
          fill={`url(#${id}-leather)`}
          stroke="#b98d59"
          strokeWidth="1.8"
          filter={`url(#${id}-grain)`}
        />
        <path d="M27 67 31 115M80 67 77 115" stroke="#24170f" strokeWidth="3" opacity=".65" />
        <path
          d="M31 69 35 115M76 69 73 115"
          fill="none"
          stroke="#dfbb80"
          strokeWidth="1.3"
          strokeDasharray="2 3"
        />
        <path d="M39 64h13v58c-4 1-8 0-12-1Z" fill={`url(#${id}-strap)`} stroke="#c39962" />
        <path
          d="M42 67v51M49 67v51"
          fill="none"
          stroke="#d8b77d"
          strokeWidth="1"
          strokeDasharray="1.5 3"
        />
        <rect
          x="38"
          y="83"
          width="15"
          height="16"
          rx="2.3"
          fill="#2c2118"
          stroke="#bd985c"
          strokeWidth="2.3"
        />
        <rect
          x="41"
          y="86"
          width="9"
          height="10"
          rx="1"
          fill={`url(#${id}-strap)`}
          stroke="#624927"
        />
        <path d="M38 91h9l2-2M41 84h9" fill="none" stroke="#ead095" strokeWidth="1.4" />
        <circle cx="45.5" cy="106" r="1.2" fill="#291b13" />
        <circle cx="45.5" cy="113" r="1.2" fill="#291b13" />
        <g fill="none" stroke="#d2a46a" strokeWidth="1.15" opacity=".65">
          <path d="M58 73h14v38H58Z" />
          <path d="m65 78 4 7-4 7-4-7Zm0 17v9m-4-6 4 6 4-6" />
          <path d="m58 73 3 3m11-3-3 3m-11 35 3-3m11 3-3-3" />
        </g>
        <path
          d="M34 76 35 95m22-27 1 11m17 23-2 10m-37-4 1 7M60 113l7-1"
          fill="none"
          stroke="#e1b880"
          strokeWidth="1"
          opacity=".42"
        />
        <path
          d="M29 114c13 7 39 7 52 0l-1 8c-13 7-37 7-50 0Z"
          fill={`url(#${id}-wood)`}
          stroke="#ba935d"
          strokeWidth="1.5"
        />
        <path
          d="M30 117c14 7 36 7 49 0M31 121c13 6 33 6 47 0"
          fill="none"
          stroke="#493320"
          strokeWidth="1"
        />
        <path
          d="M24 55c9 10 53 10 62 0l-1 7c-12 9-48 9-60 0Z"
          fill={`url(#${id}-wood)`}
          stroke="#d6b57b"
          strokeWidth="1.8"
        />
        <path d="M28 61c14 6 40 6 54 0" fill="none" stroke="#493320" strokeWidth="1.3" />
        <g fill="#d6b878" stroke="#6b4c2b" strokeWidth=".7">
          <circle cx="31" cy="65" r="1.5" />
          <circle cx="77" cy="65" r="1.5" />
          <circle cx="33" cy="121" r="1.5" />
          <circle cx="76" cy="121" r="1.5" />
        </g>
      </g>
      {rummaging && (
        <g className="lore-scroll-holder-grounded-glow" transform="translate(102 103) scale(.35)">
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
