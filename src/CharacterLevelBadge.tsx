import { useId, type ReactNode } from 'react';
import './character-level-badge.css';

const identities: Record<string, { id: string; accent: string; motif: string; glyph: string }> = {
  Artífice: {
    id: 'artificer',
    accent: '#827358',
    motif: 'gear',
    glyph: 'M6 4h5v5l-2 2 8 8-3 3-8-8-2 1-3-3 4-3V4Zm11-2 5 3-1 5-4 2-3-3 1-5Z',
  },
  Bárbaro: {
    id: 'barbarian',
    accent: '#8d4638',
    motif: 'fangs',
    glyph: 'm3 3 7 2 4 5-4 4-5-3L3 3Zm18 0-7 2-4 5 4 4 5-3 2-8ZM10 13l-6 8m10-8 6 8',
  },
  Bardo: {
    id: 'bard',
    accent: '#88624c',
    motif: 'strings',
    glyph: 'M5 3 8 7v9c0 4 8 4 8 0V7l3-4M7 6h10M10 7v10m4-10v10M8 21h8',
  },
  Bruxo: {
    id: 'warlock',
    accent: '#635776',
    motif: 'horns',
    glyph: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-4-3 4 3 4 3-4-3-4ZM3 3l3 4m15-4-3 4',
  },
  Clérigo: {
    id: 'cleric',
    accent: '#a78950',
    motif: 'rays',
    glyph: 'M10 2h4v6h6v4h-6v10h-4V12H4V8h6V2Zm-8 0 3 3m17-3-3 3M2 20l3-3m17 3-3-3',
  },
  Druida: {
    id: 'druid',
    accent: '#626e42',
    motif: 'leaves',
    glyph: 'M12 22V10M12 15C3 16 2 9 3 3c8 0 12 5 9 12Zm0 3c0-9 4-15 10-16 2 9-1 16-10 16Z',
  },
  Feiticeiro: {
    id: 'sorcerer',
    accent: '#986047',
    motif: 'flames',
    glyph: 'M13 2c2 6-4 7-2 11 2-2 5-3 5-6 7 8 3 15-4 15S1 15 7 8c-1 5 2 4 3 1 1-2 1-4 3-7Z',
  },
  Guerreiro: {
    id: 'fighter',
    accent: '#67737b',
    motif: 'blades',
    glyph: 'm4 2 7 8-2 3L2 6l2-4Zm16 0 2 4-7 7-3-3 8-8ZM8 12l-5 7m13-7 5 7M1 18l5 4m12 0 5-4',
  },
  Ladino: {
    id: 'rogue',
    accent: '#6d6471',
    motif: 'daggers',
    glyph: 'M12 2 6 9l4 8h4l4-8-6-7ZM8 17h8m-4 0v6m-3-1h6M12 4v11',
  },
  Mago: {
    id: 'wizard',
    accent: '#546b86',
    motif: 'runes',
    glyph:
      'M2 4c4-2 7-1 10 1 3-2 6-3 10-1v16c-4-2-7-1-10 1-3-2-6-3-10-1V4Zm10 1v16M5 8l4 1m6 0 4-1M5 12l4 1m6 0 4-1',
  },
  Monge: {
    id: 'monk',
    accent: '#947753',
    motif: 'beads',
    glyph:
      'M12 2c6 0 10 5 10 10s-4 10-10 10S2 17 2 12 6 2 12 2Zm0 0c-7 0-7 10 0 10s7 10 0 10M10 7h.1M14 17h.1',
  },
  Paladino: {
    id: 'paladin',
    accent: '#a28b56',
    motif: 'wings',
    glyph: 'M12 2 3 5v8c0 5 9 9 9 9s9-4 9-9V5l-9-3Zm0 3v14M7 10h10',
  },
  Patrulheiro: {
    id: 'ranger',
    accent: '#65734d',
    motif: 'arrows',
    glyph: 'M5 2c15 7 15 13 0 20L9 2v20M4 12h19m-4-4 4 4-4 4',
  },
};

function Ornament({
  motif,
  metal,
  tier,
}: {
  motif: string;
  metal: string;
  tier: number;
}): ReactNode {
  const common = {
    fill: 'none',
    stroke: metal,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (motif) {
    case 'gear':
      return (
        <g {...common}>
          {Array.from({ length: 4 + tier }, (_, i) => (
            <path key={i} d={`M25 ${33 + i * 11}h-9v6h8`} />
          ))}
          <path d="M28 29c-15 20-15 60 0 84" />
        </g>
      );
    case 'fangs':
      return (
        <g fill={metal} stroke="#332a22">
          {Array.from({ length: 2 + tier }, (_, i) => (
            <path key={i} d={`M28 ${29 + i * 14}Q9 ${34 + i * 14} 20 ${51 + i * 14}l9-13Z`} />
          ))}
          <path d="M32 33Q10 26 16 10Q3 35 28 49Z" />
        </g>
      );
    case 'strings':
      return (
        <g {...common}>
          <path d="M28 27C2 23 7 54 20 60C4 76 8 104 29 110M17 35v60m5-56v61" />
          {tier >= 3 && <path d="m11 109 11 13 9-3" />}
        </g>
      );
    case 'horns':
      return (
        <g fill={metal} stroke="#332a22">
          <path d="M31 47C7 37 8 17 20 8C17 24 25 28 34 29ZM29 105C10 104 8 82 14 71C15 88 22 90 31 89Z" />
          {tier >= 3 && <path d="M25 52 11 46l8 18-8 13 17-7Z" />}
        </g>
      );
    case 'rays':
      return (
        <g {...common}>
          {Array.from({ length: 3 + tier }, (_, i) => (
            <path key={i} d={`M26 ${31 + i * 12}l-12 -5m10 9-13 -1`} />
          ))}
          <path d="M25 27 15 15m14 7-3-12" />
        </g>
      );
    case 'leaves':
      return (
        <g stroke={metal} fill={metal} strokeWidth=".6">
          <path fill="none" strokeWidth="2" d="M31 122Q6 85 28 32" />
          {Array.from({ length: 2 + tier }, (_, i) => (
            <path
              key={i}
              d={`M${23 - (i % 2) * 3} ${40 + i * 12}q-17 -17-15 1q8 10 16 8q11 -18 8 -21q-8 0-9 12`}
            />
          ))}
        </g>
      );
    case 'flames':
      return (
        <path
          d={`M30 121C3 104 27 97 14 78C-1 55 25 52 14 27C35 41 18 59 30 65C22 43 40 36 27 12C53 37 31 49 39 66L34 108Z`}
          fill={metal}
          stroke="#39271e"
          strokeWidth="1"
        />
      );
    case 'blades':
      return (
        <g {...common}>
          <path fill={metal} stroke="#332b24" d="m25 18 5 13-12 82-5-2 6-83Z" />
          <path d="m7 108 17 4m-10 0-2 14m-5-1 10 2" />
          {tier >= 3 && <path d="m19 36-9 9 5 5m4 10L8 69l6 6" />}
        </g>
      );
    case 'daggers':
      return (
        <g {...common}>
          <path fill={metal} stroke="#312934" d="m22 19 8 16-7 39-8-2 1-39Z" />
          <path d="m10 75 18 3m-9-2-3 29m-5 1 10 1" />
          {tier >= 3 && <path d="m12 113 7 9 9-7" />}
        </g>
      );
    case 'runes':
      return (
        <g {...common}>
          <path d="M26 25 12 39v56l15 19M18 43l6 6-6 6m0 13 6 6-6 6m0 12 6 6" />
          {tier >= 3 && <path d="m27 12-10 6 10 6M26 119l-10 7 11 6" />}
        </g>
      );
    case 'beads':
      return (
        <g stroke={metal} strokeWidth="1.5" fill="#27241e">
          <path d="M29 24Q2 76 29 121" fill="none" />
          {Array.from({ length: 4 + tier }, (_, i) => (
            <circle
              key={i}
              cx={18 - Math.sin((i / (3 + tier)) * Math.PI) * 6}
              cy={32 + (i * 80) / (3 + tier)}
              r="4"
              fill={metal}
            />
          ))}
        </g>
      );
    case 'wings':
      return (
        <g fill={metal} stroke="#332c22" strokeWidth="1">
          {Array.from({ length: 3 + tier }, (_, i) => (
            <path
              key={i}
              d={`M31 ${39 + i * 9}Q6 ${32 + i * 8} 7 ${17 + i * 9}Q18 ${33 + i * 8} 33 ${33 + i * 10}Z`}
            />
          ))}
          <path d="M30 102q-9 6-9 20l12-9Z" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <path d="m18 23 6 8-1 78m-7-81 8-8 7 9M15 110l8 9 7-9m-4-69-13-2m13 19-14-3m14 20-14-3" />
          {tier >= 3 && <path d="M14 28Q3 14 9 7m7 16-5-14M24 28l8-15" />}
        </g>
      );
  }
}
export function CharacterLevelBadge({ className, level }: { className: string; level: number }) {
  const id = useId().replace(/:/g, ''),
    identity = identities[className] || identities.Guerreiro;
  const value = Math.max(1, Math.min(20, Math.trunc(level))),
    tier = Math.floor((value - 1) / 4) + 1;
  const palettes = [
    ['#a6a39a', '#555954', '#d5c9ac'],
    ['#c79b60', '#735238', '#edcda0'],
    ['#c6d0d2', '#647581', '#eef0df'],
    ['#efca7b', '#917143', '#fff0bc'],
    ['#f4db9d', '#95734b', '#fff7da'],
  ];
  const [light, dark, shine] = palettes[tier - 1],
    metal = `url(#${id}-metal)`;
  const shield =
    identity.motif === 'daggers'
      ? 'M70 17 113 52 105 115 70 146 35 115 27 52Z'
      : identity.motif === 'runes'
        ? 'M70 14 107 36 107 115 70 145 33 115 33 36Z'
        : 'M70 17 108 34 107 91Q106 126 70 145Q34 126 33 91L32 34Z';
  return (
    <div
      className="sheet-rank-level class-level-badge"
      role="img"
      aria-label={`${className}, nível ${value} de 20`}
      title={`${className} · Nível ${value} de 20`}
      data-class={identity.id}
      data-level={value}
      data-tier={tier}
    >
      <svg viewBox="0 0 140 160" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id + '-metal'} x1="0" y1="0" x2=".85" y2="1">
            <stop stopColor={shine} />
            <stop offset=".2" stopColor={dark} />
            <stop offset=".43" stopColor={light} />
            <stop offset=".58" stopColor={shine} />
            <stop offset=".74" stopColor={dark} />
            <stop offset="1" stopColor={light} />
          </linearGradient>
          <radialGradient id={id + '-face'} cx=".35" cy=".2" r=".9">
            <stop stopColor={identity.accent} />
            <stop offset=".45" stopColor="#272924" />
            <stop offset="1" stopColor="#111715" />
          </radialGradient>
        </defs>
        <g opacity={tier === 1 ? 0.65 : 1}>
          <Ornament motif={identity.motif} metal={metal} tier={tier} />
          <g transform="translate(140 0) scale(-1 1)">
            <Ornament motif={identity.motif} metal={metal} tier={tier} />
          </g>
        </g>
        <path d={shield} fill={metal} stroke="#29221b" strokeWidth="2" />
        <path
          d={shield}
          transform="translate(70 80) scale(.9) translate(-70 -80)"
          fill={`url(#${id}-face)`}
          stroke={shine}
          strokeWidth=".7"
        />
        <path
          d="M42 39 70 27 98 39M42 103Q48 124 70 135Q92 124 98 103"
          fill="none"
          stroke={light}
          strokeWidth=".8"
          opacity=".7"
        />
        {Array.from({ length: 20 }, (_, i) => {
          const side = i < 10 ? -1 : 1,
            n = i % 10;
          return (
            <circle
              key={i}
              className="level-growth-gem"
              cx={70 + side * (n < 2 ? 32 : 35 - (n - 2) * 0.6)}
              cy={43 + n * 8.2}
              r={tier >= 4 ? 1.8 : 1.5}
              fill={i < value ? shine : '#393b32'}
              stroke={dark}
              strokeWidth=".65"
            />
          );
        })}
        <g
          transform="translate(55 31) scale(1.25)"
          fill="none"
          stroke={metal}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={identity.glyph} />
        </g>
        <path d="M48 67h44m-42 2h40" stroke={light} opacity=".6" strokeWidth=".6" />
        <text x="70" y="82" textAnchor="middle" className="level-badge-label" fill={shine}>
          NÍVEL
        </text>
        <text x="70" y="113" textAnchor="middle" className="level-badge-number" fill="#f5ecd4">
          {value}
        </text>
        <path d="m70 120 4 5-4 5-4-5Z" fill={identity.accent} stroke={light} strokeWidth="1" />
        {tier >= 3 && <path d="m52 18 7-6 11 4 11-4 7 6-5 7H57Z" fill={metal} stroke="#332c22" />}
        {tier === 5 && (
          <path
            d="m55 18-3-11 11 6 7-10 7 10 11-6-3 11Z"
            fill={metal}
            stroke="#503b23"
            strokeWidth="1"
          />
        )}
        {value === 20 && (
          <g fill={shine}>
            <path d="m70 1 2 3-2 3-2-3Z" />
            <path d="m33 132 5 4-3 5-5-4Zm74 0-5 4 3 5 5-4Z" />
          </g>
        )}
      </svg>
    </div>
  );
}
