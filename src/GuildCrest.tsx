import {additionalCrestNames} from '../shared/guild-crest-options';
import {crestGlyphs,CrestFieldDefs,CrestExtraField,CrestRimDetails} from './guild-crest-designs';
import { useId } from 'react';
import { crestSchema, type Crest } from '../shared/guilds';

export const crestNames: Record<string, string> = {
  ...additionalCrestNames,
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
const symbols=crestGlyphs;
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
          <path d={d} transform="translate(50 50) scale(.84) translate(-50 -50)"/>
        </clipPath>
        <CrestFieldDefs id={id} color={crest.fieldColor2}/>
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
          <path d="M0 0H3M0 0V3" stroke="#fff" strokeWidth=".18" opacity=".055" />

        </pattern>
      </defs>
      <path d={d} fill="#090a09" stroke="#090a09" strokeWidth="10" transform="translate(0 2)" />
      <path data-crest-layer="rim" d={d} fill={`url(#${id}rim)`}/>
      <g data-crest-layer="field" clipPath={`url(#${id}clip)`}>
        <path d={d} fill={`url(#${id}enamel)`}/>
        <g fill={crest.fieldColor2}>
          <CrestExtraField field={crest.field} id={id} color={crest.fieldColor2}/>
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
        <path d={d} fill="none" stroke="#080b0a" strokeWidth="1.2" transform="translate(50 50) scale(.84) translate(-50 -50)" opacity=".7"/>
      </g>
      <CrestRimDetails ornament={crest.ornament} points={perimeter(crest.border)} id={id} dark={mix(crest.borderColor,0,.65)}/>
      {crest.ornament === 'braided' && (
        <>
          <path
            d={d}
            fill="none"
            stroke={mix(crest.borderColor, 0, 0.65)}
            strokeWidth="4"
            strokeDasharray="4 1"
            transform="translate(50 50) scale(.92) translate(-50 -50)"
          />
          <path
            d={d}
            fill="none"
            stroke={mix(crest.borderColor, 255, 0.3)}
            strokeWidth="2"
            strokeDasharray="2 3"
            transform="translate(50 50) scale(.92) translate(-50 -50)"
            strokeDashoffset="2"
          />
        </>
      )}
      {(crest.ornament === 'riveted' || crest.ornament === 'runic') &&
        perimeter(crest.border)
          .filter((_, i) => i % 2 === 0)
          .map(([x, y, a], i) => (
            <g key={i} transform={`translate(${50+(x-50)*.92} ${50+(y-50)*.92}) rotate(${a})`}>
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
        transform={crest.border==='diamond'?'translate(29 29) scale(.42)':crest.border==='banner'?'translate(27 21) scale(.46)':'translate(25 24) scale(.5)'}
        fill={`url(#${id}symbol)`}
        stroke={mix(crest.iconColor, 0, 0.65)}
        strokeWidth="1.15"
        strokeLinejoin="round"
        color={mix(crest.fieldColor, 0, 0.55)}
      >
        <style>{`#${id}mark .engraving{fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;opacity:.8}`}</style>
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

    </svg>
  );
}
