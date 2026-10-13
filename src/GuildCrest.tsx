import { useId } from 'react';
import { crestSchema, type Crest } from '../shared/guilds';

export const crestNames: Record<string, string> = {
  sword: 'Espada',
  wolf: 'Lobo',
  crown: 'Coroa',
  raven: 'Corvo',
  tree: 'Carvalho',
  flame: 'Chama',
  moon: 'Lua',
  star: 'Estrela',
  anchor: 'Âncora',
  book: 'Livro',
  dragon: 'Dragão',
  mountain: 'Montanha',
  plain: 'Inteiro',
  quartered: 'Quartelado',
  diagonal: 'Banda',
  stripes: 'Palado',
  chevron: 'Divisa',
  sunburst: 'Sol nascente',
  shield: 'Escudo',
  round: 'Medalhão',
  banner: 'Estandarte',
  diamond: 'Losango',
  hexagon: 'Hexágono',
  laurel: 'Louros',
  beveled: 'Metal lapidado',
  riveted: 'Rebites',
  braided: 'Corda trançada',
  runic: 'Runas gravadas',
  thorns: 'Espinhos',
};
const shapes = {
  shield: 'M18 10 Q50 3 82 10 V44 Q83 72 50 94 Q17 72 18 44Z',
  round: 'M50 7 A43 43 0 1 1 49.99 7Z',
  banner: 'M18 8 H82 V93 L50 78 L18 93Z',
  diamond: 'M50 5 L94 50 L50 95 L6 50Z',
  hexagon: 'M28 8 H72 L95 50 L72 92 H28 L5 50Z',
  laurel: 'M50 7 A43 43 0 1 1 49.99 7Z',
};
const symbols = {
  sword: (
    <>
      <path d="M45 65V14L50 3 55 14V65L62 61 70 67 62 74 54 70V88L59 94 50 99 41 94 46 88V70L38 74 30 67 38 61Z" />
      <path className="engraving" d="M50 14V63M43 79H57M44 84H56M36 67L50 69 64 67" />
    </>
  ),
  wolf: (
    <>
      <path d="M15 72L22 53 16 37 34 41 50 10 58 34 76 13 73 45 85 57 97 64 84 78 69 80 55 94 25 94 32 77Z" />
      <path
        className="engraving"
        d="M34 44L46 40 39 54 50 63 43 79M62 46L73 52 64 56M77 70L91 65M53 83L62 70M27 63L38 65"
      />
      <path fill="currentColor" d="M67 50l9 4-9 3zM88 61l8 3-6 6z" />
    </>
  ),
  crown: (
    <>
      <path d="M15 71L8 28 32 46 50 13 68 46 92 28 85 71V85Q50 98 15 85Z" />
      <path
        className="engraving"
        d="M18 73Q50 83 82 73M20 85Q50 92 80 85M18 41L24 62 35 61 50 36 65 61 76 62 82 41"
      />
      <circle cx="50" cy="65" r="5" fill="currentColor" />
      <circle cx="8" cy="25" r="5" />
      <circle cx="50" cy="10" r="5" />
      <circle cx="92" cy="25" r="5" />
    </>
  ),
  raven: (
    <>
      <path d="M5 26L32 33 45 50 48 35 55 24 65 24 73 32 92 37 72 43 68 59 78 77 91 94 70 90 60 78 57 91 51 78 43 91 43 71 27 77 15 70 33 67 10 62 26 58 4 49 24 49 1 38 26 42Z" />
      <path
        className="engraving"
        d="M13 31L44 61 54 67 63 52M18 48L42 61M23 66L43 67M59 74L74 86"
      />
      <circle cx="65" cy="32" r="2.5" fill="currentColor" />
    </>
  ),
  tree: (
    <>
      <path d="M45 94L46 70 36 59 25 63 21 54 10 55 6 42 14 32 12 21 23 16 31 19 36 7 51 4 62 10 67 7 79 14 79 24 91 29 95 42 89 51 79 55 76 65 63 64 55 73 56 94 70 98H31Z" />
      <path
        className="engraving"
        d="M50 87V41M49 68L32 48 22 39M51 58L68 38 82 34M35 53L20 52M62 46V29M46 48L40 25"
      />
    </>
  ),
  flame: (
    <>
      <path d="M55 3Q67 25 57 40Q77 31 75 17Q108 58 81 84Q60 107 30 88Q0 66 22 35Q19 58 34 61Q25 31 55 3Z" />
      <path
        fill="currentColor"
        d="M52 48Q63 69 53 77Q66 76 70 67Q76 94 48 94Q26 89 37 70Q39 84 48 80Q40 67 52 48Z"
      />
    </>
  ),
  moon: (
    <>
      <path d="M66 4Q19 11 16 51Q16 91 60 97Q24 108 9 76Q-9 39 24 13Q41 0 66 4ZM80 20L84 31 96 35 84 39 80 51 76 39 64 35 76 31ZM65 65L68 72 75 75 68 78 65 85 62 78 55 75 62 72Z" />
      <path className="engraving" d="M25 18Q4 39 13 67Q19 85 36 91" />
    </>
  ),
  star: (
    <>
      <path d="M50 1L60 34 88 13 68 41 100 50 68 59 88 88 60 67 50 100 40 67 12 88 32 59 0 50 32 41 12 13 40 34Z" />
      <path className="engraving" d="M50 8V93M7 50H93M19 19L81 81M19 81L81 19" />
      <circle cx="50" cy="50" r="9" />
    </>
  ),
  anchor: (
    <>
      <path
        d="M43 24A14 14 0 1 1 57 24V38H78V48H57V77Q73 76 82 63L75 59 95 51 94 73 87 69Q73 91 50 99Q27 91 13 69L6 73 5 51 25 59 18 63Q27 76 43 77V48H22V38H43ZM50 8A7 7 0 1 0 50 22A7 7 0 1 0 50 8Z"
        fillRule="evenodd"
      />
      <path className="engraving" d="M50 30V88M28 84L50 94 73 83" />
    </>
  ),
  book: (
    <>
      <path
        d="M5 21Q29 9 50 25Q71 9 95 21V85Q70 74 50 92Q30 74 5 85ZM15 29V74Q33 69 45 78V33Q31 21 15 29ZM55 33V78Q67 69 85 74V29Q69 21 55 33Z"
        fillRule="evenodd"
      />
      <path
        className="engraving"
        d="M50 28V86M20 35Q30 32 39 39M20 45Q30 42 39 49M20 55Q30 52 39 59M61 39Q70 32 80 35M61 49Q70 42 80 45M61 59Q70 52 80 55"
      />
    </>
  ),
  dragon: (
    <>
      <path
        d="M62 10L69 0 73 13 87 9 81 23 98 30 80 35 73 30 64 42 68 52 88 38 83 60 96 57 91 73 75 78 70 68 63 76 65 92 74 98 55 98 50 78 39 87 18 81 9 65 12 45 3 28 29 36 27 19 48 36 55 25 52 16ZM37 48L24 46 22 64 30 73 40 73 51 60Z"
        fillRule="evenodd"
      />
      <path
        className="engraving"
        d="M13 34L39 60 44 43M29 28L42 46M58 35L60 56 52 70M76 45L69 61M18 67Q16 92 6 89Q2 80 13 84"
      />
      <circle cx="75" cy="22" r="2.5" fill="currentColor" />
    </>
  ),
  mountain: (
    <>
      <path d="M0 87L36 13 55 50 67 28 100 87Z" />
      <path
        fill="currentColor"
        d="M36 23L20 58 31 52 38 62 44 52 50 60ZM67 37L57 60 67 55 77 63Z"
      />
      <path className="engraving" d="M37 64L30 85M62 71L67 83" />
    </>
  ),
};
function mix(hex: string, target: number, amount: number) {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + target * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function perimeter(shape: Crest['border']) {
  if (shape === 'round' || shape === 'laurel')
    return Array.from({ length: 40 }, (_, i) => {
      const a = (i * Math.PI) / 20;
      return [50 + 43 * Math.sin(a), 50 - 43 * Math.cos(a), i * 9];
    });
  const points =
    shape === 'shield'
      ? [
          [18, 10],
          [50, 7],
          [82, 10],
          [82, 44],
          [78, 60],
          [67, 77],
          [50, 94],
          [33, 77],
          [22, 60],
          [18, 44],
        ]
      : shape === 'banner'
        ? [
            [18, 8],
            [82, 8],
            [82, 93],
            [50, 78],
            [18, 93],
          ]
        : shape === 'diamond'
          ? [
              [50, 5],
              [94, 50],
              [50, 95],
              [6, 50],
            ]
          : [
              [28, 8],
              [72, 8],
              [95, 50],
              [72, 92],
              [28, 92],
              [5, 50],
            ];
  return points.flatMap((p, i) => {
    const q = points[(i + 1) % points.length],
      count = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 8));
    return Array.from({ length: count }, (_, j) => [
      p[0] + ((q[0] - p[0]) * j) / count,
      p[1] + ((q[1] - p[1]) * j) / count,
      (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI,
    ]);
  });
}
export function GuildCrest({
  crest: input,
  size = 100,
  decorative = false,
}: {
  crest: Crest;
  size?: number;
  decorative?: boolean;
}) {
  const crest = crestSchema.parse(input),
    id = 'crest-' + useId().replaceAll(':', ''),
    d = shapes[crest.border];
  const metal = (key: string, color: string) => (
    <linearGradient id={id + key} x1="0" y1="0" x2=".85" y2="1" gradientUnits="objectBoundingBox">
      {[
        [0, 0.55],
        [0.2, 0.08],
        [0.37, 0.38],
        [0.5, -0.4],
        [0.66, 0.15],
        [0.85, -0.5],
        [1, 0.08],
      ].map(([offset, a]) => (
        <stop key={offset} offset={offset} stopColor={mix(color, a < 0 ? 0 : 255, Math.abs(a))} />
      ))}
    </linearGradient>
  );
  return (
    <svg
      className="guild-crest"
      width={size}
      height={size * 1.08}
      viewBox="-10 -10 120 130"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Brasão da guilda'}
    >
      <defs>
        <clipPath id={id + 'clip'}>
          <path d={d} />
        </clipPath>
        {metal('rim', crest.borderColor)}
        {metal('symbol', crest.iconColor)}
        <radialGradient id={id + 'enamel'} cx=".3" cy=".2" r=".85">
          <stop stopColor={mix(crest.fieldColor, 255, 0.15)} />
          <stop offset=".55" stopColor={crest.fieldColor} />
          <stop offset="1" stopColor={mix(crest.fieldColor, 0, 0.65)} />
        </radialGradient>
        <linearGradient id={id + 'shade'} x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".13" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
        <pattern id={id + 'weave'} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0H3M0 0V3" stroke="#fff" strokeWidth=".25" opacity=".18" />
          <circle cx="1.5" cy="1.5" r=".3" fill="#000" opacity=".35" />
        </pattern>
      </defs>
      <path d={d} fill="#090a09" stroke="#090a09" strokeWidth="10" transform="translate(0 2)" />
      <path d={d} fill={`url(#${id}enamel)`} stroke={`url(#${id}rim)`} strokeWidth="8" />
      <g clipPath={`url(#${id}clip)`}>
        <g fill={crest.fieldColor2}>
          {crest.field === 'quartered' && <path d="M0 0H50V50H100V100H50V50H0Z" />}
          {crest.field === 'diagonal' && <path d="M-15 3L3-15 115 97 97 115Z" />}
          {crest.field === 'stripes' &&
            [22, 42, 62, 82].map((x) => <rect key={x} x={x} width="10" height="100" />)}
          {crest.field === 'chevron' && <path d="M0 68L50 27 100 68V87L50 46 0 87Z" />}
          {crest.field === 'sunburst' &&
            Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M50 74L36-15H50Z" transform={`rotate(${i * 30} 50 74)`} />
            ))}
        </g>
        <path d={d} fill={`url(#${id}weave)`} />
        <path d={d} fill={`url(#${id}shade)`} />
        <path
          d={d}
          fill="none"
          stroke="#050707"
          strokeWidth="2"
          transform="translate(5 5) scale(.9)"
        />
        <path
          d={d}
          fill="none"
          stroke={crest.borderColor}
          strokeWidth=".6"
          opacity=".7"
          transform="translate(6 6) scale(.88)"
        />
      </g>
      <path
        d={d}
        fill="none"
        stroke={mix(crest.borderColor, 255, 0.35)}
        strokeWidth=".6"
        transform="translate(-.7 -.7)"
        opacity=".7"
      />
      {crest.ornament === 'braided' && (
        <>
          <path
            d={d}
            fill="none"
            stroke={mix(crest.borderColor, 0, 0.65)}
            strokeWidth="4"
            strokeDasharray="4 1"
          />
          <path
            d={d}
            fill="none"
            stroke={mix(crest.borderColor, 255, 0.3)}
            strokeWidth="2"
            strokeDasharray="2 3"
            strokeDashoffset="2"
          />
        </>
      )}
      {(crest.ornament === 'riveted' || crest.ornament === 'runic') &&
        perimeter(crest.border)
          .filter((_, i) => i % 2 === 0)
          .map(([x, y, a], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
              {crest.ornament === 'riveted' ? (
                <>
                  <circle cy=".7" r="1.7" fill="#080909" />
                  <circle r="1.4" fill={`url(#${id}rim)`} />
                  <circle cy="-.5" r=".45" fill="#fff9" />
                </>
              ) : (
                <path
                  d={
                    i % 3 === 0
                      ? 'M-1.6 2V-2L1.6 0-1.6 1M1.6-2V2'
                      : i % 3 === 1
                        ? 'M-1.7-2L0 0 1.7-2M0 0V2'
                        : 'M-1.5 2L1.5-2M-1.5-2L1.5 2'
                  }
                  fill="none"
                  stroke={mix(crest.borderColor, 0, 0.7)}
                  strokeWidth=".65"
                />
              )}
            </g>
          ))}
      <g
        transform="translate(24 25) scale(.52)"
        fill={`url(#${id}symbol)`}
        stroke={mix(crest.iconColor, 0, 0.65)}
        strokeWidth="1.7"
        strokeLinejoin="round"
        color={mix(crest.fieldColor, 0, 0.55)}
      >
        <style>{`#${id}mark .engraving{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;opacity:.7}`}</style>
        <g id={id + 'mark'}>{symbols[crest.icon]}</g>
      </g>
      {(crest.ornament === 'laurel' ||
        crest.ornament === 'thorns' ||
        crest.border === 'laurel') && (
        <g fill={`url(#${id}rim)`} stroke={mix(crest.borderColor, 0, 0.45)} strokeWidth=".4">
          {[-1, 1].map((side) => (
            <g key={side} transform={side < 0 ? 'translate(100 0) scale(-1 1)' : undefined}>
              <path d="M53 104Q1 86 3 30" fill="none" stroke={`url(#${id}rim)`} strokeWidth="1.7" />
              {Array.from({ length: 9 }, (_, i) => {
                const t = i / 8,
                  x = 5 + 39 * t * t,
                  y = 33 + 65 * t;
                return (
                  <g key={i} transform={`translate(${x} ${y}) rotate(${-20 - i * 5})`}>
                    {crest.ornament === 'thorns' ? (
                      <path d="M0 0L-8-8-3 2 5 7 0-3 8-6Z" />
                    ) : (
                      <>
                        <path d="M0 0Q-13-1-11-12Q0-10 0 0Z" />
                        <path d="M0 2Q10-1 8-10Q0-7 0 2Z" />
                        <path d="M-2-3L-8-9" stroke={mix(crest.borderColor, 0, 0.5)} fill="none" />
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      )}
      <path d="M47 98L50 94 53 98 50 102Z" fill={`url(#${id}rim)`} />
    </svg>
  );
}
