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
const magicTrails = magicCurves.map((curves) => {
  let start: Point = [54, 64];
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
    line: `M54 64 ${curves.map((curve) => `C${curve.join(' ')}`).join(' ')}`,
    ribbon: `M${edge(1).join('L')}L${edge(-1).reverse().join('L')}Z`,
  };
});

function LoreMagicWisps() {
  const id = useId().replaceAll(':', '');
  return (
    <g className="lore-magic-wisps">
      <defs>
        <radialGradient id={`${id}-light`}>
          <stop stopColor="#eaffff" />
          <stop offset=".35" stopColor="#74ecff" stopOpacity=".8" />
          <stop offset="1" stopColor="#2db4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-thread`} x1=".5" y1="1" x2=".4" y2="0">
          <stop stopColor="#dcffff" />
          <stop offset=".45" stopColor="#98f4ff" />
          <stop offset="1" stopColor="#55baff" stopOpacity=".35" />
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
      <circle className="lore-magic-source" cx="54" cy="64" r="8" fill={`url(#${id}-light)`} />
      {magicTrails.map((trail, i) => (
        <g
          key={i}
          className="lore-magic-wisp"
          style={
            {
              '--wisp-duration': `${3.4 + i * 0.65}s`,
              '--wisp-delay': `${-i * 0.9}s`,
              '--wisp-drift': `${(i % 2 ? 1 : -1) * 4}px`,
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
    </g>
  );
}

export function LoreVaseIcon({ rummaging = false }: { rummaging?: boolean }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg
      className={`lore-vase-icon ${rummaging ? 'is-rummaging' : ''}`}
      data-vase-state={rummaging ? 'hovered' : 'idle'}
      viewBox="0 0 108 144"
      aria-hidden="true"
      focusable="false"
    >
      <EngravedPaper id={id} />
      <defs>
        <linearGradient id={`${id}-bronze`} x1="0" x2="1" y2=".1">
          <stop stopColor="#241b16" />
          <stop offset=".16" stopColor="#775033" />
          <stop offset=".35" stopColor="#d6ab62" />
          <stop offset=".53" stopColor="#9b6c3d" />
          <stop offset=".8" stopColor="#5d3924" />
          <stop offset="1" stopColor="#231a16" />
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
      <ellipse cx="54" cy="120" rx="37" ry="5" fill="#050504" opacity=".65" />
      {/* Rear rim and cavity behind the rolls; the front wall conceals their lower ends. */}
      <g className="lore-vase-body">
        <path
          d="M23 62c-9-2-16 5-14 16 1 9 9 14 17 11l2-6c-6 2-12-2-12-7 0-6 3-8 9-7Zm62 0c9-2 16 5 14 16-1 9-9 14-17 11l-2-6c6 2 12-2 12-7 0-6-3-8-9-7Z"
          fill={`url(#${id}-bronze)`}
          stroke="#c09458"
          strokeWidth="1.8"
        />
        <ellipse
          cx="54"
          cy="58"
          rx="34"
          ry="12"
          fill={`url(#${id}-bronze)`}
          stroke="#e0ba7b"
          strokeWidth="2"
        />
        <ellipse cx="54" cy="59" rx="29" ry="8.6" fill={`url(#${id}-mouth)`} />
        <g className="lore-vase-rolls">
          <use href={`#${id}-roll`} transform="translate(33 17) rotate(-12)" />
          <use href={`#${id}-roll`} transform="translate(53 8) rotate(3)" />
          <use href={`#${id}-roll`} transform="translate(81 18) rotate(16)" />
          <use href={`#${id}-roll`} transform="translate(30 37) rotate(-7) scale(.9)" />
          <use href={`#${id}-roll`} transform="translate(66 29) rotate(8) scale(1.03)" />
        </g>
        <g className="lore-vase-escaping-scroll">
          <use href={`#${id}-roll`} transform="translate(48 38) rotate(-4) scale(.86)" />
          <g transform="translate(48 38) rotate(-4) scale(.86)">
            <circle cy="46" r="4.3" fill={`url(#${id}-seal)`} stroke="#d4905f" strokeWidth="1" />
            <path d="m0 43 2 3-2 3-2-3Z" fill="#e8bd82" />
          </g>
        </g>
        <path
          d="M21 60c0 8 2 12 0 20-3 16 3 31 14 37 8 4 30 4 38 0 11-6 17-21 14-37-2-8 0-12 0-20-9 10-55 10-66 0Z"
          fill={`url(#${id}-bronze)`}
          stroke="#d1a66b"
          strokeWidth="1.8"
        />
        <path
          d="M21 59c9 10 57 11 66 0l-1 7c-12 9-51 9-64-1Z"
          fill={`url(#${id}-bronze)`}
          stroke="#edcb8c"
          strokeWidth="1.8"
        />
        <path
          d="M23 74c15 6 45 6 61 0M26 108c16 8 40 8 56 0M33 117c11 3 32 3 42-1"
          fill="none"
          stroke="#e0b86e"
          strokeWidth="1.5"
        />
        <path
          d="M27 79c-3 10 0 23 6 29M34 80c-2 5-2 11-1 16"
          fill="none"
          stroke="#f4d593"
          strokeWidth="2.2"
          opacity=".45"
        />
        <path d="M79 77c5 13 0 27-5 31" fill="none" stroke="#241912" strokeWidth="4" opacity=".6" />
        <g fill="none" stroke="#d8b374" strokeWidth="1.2" opacity=".85">
          <path d="m54 80 11 15-11 15-11-15Z" />
          <path d="m54 85 6 10-6 10-6-10Z" />
          <path d="M42 95c-9-10-13-2-8 2 6 5 9-1 5-4M66 95c9-10 13-2 8 2-6 5-9-1-5-4" />
          <path d="M30 78v5m8-3v3m32-3v3m8-5v5" />
        </g>
        <g fill="#f2ce8b" stroke="#775234" strokeWidth=".8">
          {[27, 39, 54, 69, 81].map((x) => (
            <circle key={x} cx={x} cy={x === 27 || x === 81 ? 67 : 70} r="1.7" />
          ))}
        </g>
        <path
          d="m37 91 2 1m31 10 3-1m-29 10 3 1m15-29 2 1"
          stroke="#3a2c21"
          strokeWidth="1.6"
          opacity=".65"
        />
      </g>
      {rummaging && (
        <g className="lore-vase-grounded-glow" transform="translate(57 108) scale(.35)">
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
