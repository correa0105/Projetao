import { useId } from 'react';
import type { RuleChapter, RulebookSymbol } from '../shared/rulebook';

export const rulebookSymbolNames: Record<RulebookSymbol, string> = {
  codex: 'Livro',
  dice: 'Dado',
  crest: 'Escudo',
  coins: 'Moedas',
  compass: 'Bússola',
  oath: 'Acordo',
  swords: 'Espadas',
  quill: 'Pena',
  arcana: 'Magia',
};

export function chapterSymbol(chapter: RuleChapter): RulebookSymbol {
  if (chapter.symbol) return chapter.symbol;
  const text = (chapter.id + ' ' + chapter.title)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  if (/combate|batalha|arma/.test(text)) return 'swords';
  if (/atributo|ficha|rolagem|teste/.test(text)) return 'dice';
  if (/patente|evolu|nivel/.test(text)) return 'crest';
  if (/ouro|economia|mochila|equipamento|compra/.test(text)) return 'coins';
  if (/miss|aventura|viagem|mapa/.test(text)) return 'compass';
  if (/guilda|acordo|conduta/.test(text)) return 'oath';
  if (/magia|arcano|feitico/.test(text)) return 'arcana';
  return 'codex';
}

// Drawn as engraved metal rather than UI glyphs, with a common patina and bevel.
export function RulebookEmblem({
  symbol,
  className = '',
}: {
  symbol: RulebookSymbol;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const bronze = `url(#${id}-bronze)`,
    ink = `url(#${id}-ink)`;
  return (
    <svg
      className={'rb-emblem ' + className}
      data-symbol={symbol}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id + '-bronze'} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#e2c897" />
          <stop offset=".28" stopColor="#a57e4b" />
          <stop offset=".53" stopColor="#d7b67a" />
          <stop offset=".76" stopColor="#765535" />
          <stop offset="1" stopColor="#b89260" />
        </linearGradient>
        <radialGradient id={id + '-ink'} cx=".36" cy=".28" r=".8">
          <stop stopColor="#36352f" />
          <stop offset=".7" stopColor="#1b1d1c" />
          <stop offset="1" stopColor="#111313" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="53" r="43" fill="#000" opacity=".5" />
      <path
        d="M50 3 61 9 74 8 81 20 93 27 91 41 97 50 91 61 93 74 81 81 74 93 60 91 50 97 39 91 26 93 19 81 7 74 9 60 3 50 9 39 7 26 19 19 26 7 40 9Z"
        fill={bronze}
        stroke="#34281c"
        strokeWidth="1.5"
      />
      <circle cx="50" cy="50" r="40" fill={ink} stroke={bronze} strokeWidth="2" />
      <circle cx="50" cy="50" r="35.5" fill="none" stroke="#927143" strokeWidth=".7" />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="#e1c388"
        strokeWidth="1.3"
        strokeDasharray=".8 5.15"
        opacity=".65"
      />
      <g fill="none" stroke={bronze} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        {symbol === 'codex' && (
          <>
            <path d="M22 31Q36 25 50 33Q64 25 78 31V69Q63 64 50 73Q36 64 22 69Z" fill="#ac855037" />
            <path
              d="M50 33V73M26 35Q37 30 46 36M26 41Q37 36 46 42M26 48Q37 43 46 49M26 55Q37 50 46 56M55 36Q65 30 74 35M55 43Q65 37 74 42M55 50Q65 44 74 49M55 57Q65 51 74 56M18 34V73Q36 69 50 77Q64 69 82 73V34"
              strokeWidth="1.2"
            />
            <path d="M59 30V54L64 49 69 52V28" fill={bronze} strokeWidth=".5" />
          </>
        )}
        {symbol === 'dice' && (
          <>
            <path d="m50 19 29 21-7 34H28L21 40Z" fill="#b68b4933" />
            <path
              d="m50 19-17 37 39 18-22-55 17 37-39 18 22-55M21 40l12 16h34l12-16M33 56l17 18 17-18"
              strokeWidth="1.3"
            />
            <path
              d="m40 42 5-3v14m-5 0h10m8-14q-8 0-8 7t8 7q7 0 7-7t-7-7Z"
              stroke="#e2c48c"
              strokeWidth="1.9"
            />
          </>
        )}
        {symbol === 'crest' && (
          <>
            <path d="m50 24 24 9-3 29Q62 73 50 80Q38 73 29 62L26 33Z" fill="#9c7a4533" />
            <path d="m50 31 17 7-2 22Q59 68 50 73Q41 68 35 60L33 38Z" strokeWidth="1" />
            <path
              d="m50 36 4 10 11 1-8 7 2 11-9-6-9 6 2-11-8-7 11-1Z"
              fill={bronze}
              strokeWidth=".6"
            />
            <path
              d="M18 63q-9-19 2-34m-2 25-6-5m6-6-5-6M82 63q9-19-2-34m2 25 6-5m-6-6 5-6"
              strokeWidth="1.3"
            />
          </>
        )}
        {symbol === 'coins' && (
          <>
            <ellipse cx="41" cy="67" rx="19" ry="7" fill="#4b3c27" />
            <path d="M22 56v11m38-11v11M23 62q18 13 36 0M24 57q17 13 33 0" strokeWidth="1.2" />
            <ellipse cx="41" cy="55" rx="19" ry="7" fill="#866440" />
            <circle cx="60" cy="42" r="18" fill="#4b3b26" strokeWidth="3" />
            <circle cx="60" cy="42" r="13" strokeWidth="1" strokeDasharray="1 2.5" />
            <path d="m60 31 4 7 8 4-8 4-4 7-4-7-8-4 8-4Z" fill={bronze} strokeWidth=".5" />
          </>
        )}
        {symbol === 'compass' && (
          <>
            <circle cx="50" cy="50" r="24" strokeWidth="1.2" />
            <path
              d="M50 19v10m0 42v10M19 50h10m42 0h10M28 28l7 7m30 30 7 7M72 28l-7 7M35 65l-7 7"
              strokeWidth="1.3"
            />
            <path d="m50 23 7 20 20 7-20 7-7 20-7-20-20-7 20-7Z" fill="#b48c4833" />
            <path d="m50 23-7 34 7-7 7-7Zm27 27-34 7 7-7Z" fill={bronze} strokeWidth=".5" />
            <circle cx="50" cy="50" r="3" fill="#202120" />
          </>
        )}
        {symbol === 'oath' && (
          <>
            <path d="m23 38 15-9 11 9-20 28-11-9Zm54 0-15-9-11 9 20 28 11-9Z" fill="#b08e5133" />
            <path
              d="m35 39 12-2 15 12q5 5 0 8L51 70q-4 4-7 0L30 56m11-13 8 7q4 3 7-1M42 62l9 8m-3-14 10 9m-4-16 11 8M26 36l-5 5m53-5 5 5"
              strokeWidth="2"
            />
            <path d="M36 77h28M41 81h18" strokeWidth="1" />
          </>
        )}
        {symbol === 'swords' && (
          <>
            <path d="m24 22 14 7 28 33-5 5-33-31Zm52 0-14 7-28 33 5 5 33-31Z" fill="#b894553d" />
            <path d="m30 29 34 35m6-35L36 64M53 70l18-17M29 53l18 17M63 69l9 9m-35-9-9 9" />
            <path d="m70 76 5-5 6 6-5 5Zm-40 0-5-5-6 6 5 5Z" fill={bronze} />
          </>
        )}
        {symbol === 'quill' && (
          <>
            <path d="M29 74q0-36 41-52 7 36-26 45l-8 2Z" fill="#b78e4b30" />
            <path
              d="m25 80 41-50M40 63l-1-14m9 6-1-14m9 7-1-13M48 54l15-2M55 45l12-2M28 80h45"
              strokeWidth="1.3"
            />
          </>
        )}
        {symbol === 'arcana' && (
          <>
            <circle cx="50" cy="50" r="27" strokeWidth="1.3" />
            <path d="m50 21 25 44H25Zm0 58L25 35h50Z" strokeWidth="1" />
            <path d="m50 34 4 11 12 5-12 4-4 12-5-12-11-4 11-5Z" fill={bronze} strokeWidth=".7" />
            <circle cx="50" cy="50" r="3" fill="#242320" />
          </>
        )}
      </g>
      <path d="M21 25q25-26 56 0" fill="none" stroke="#f0d8a4" strokeWidth=".8" opacity=".45" />
      <g fill="#e2c08a" stroke="#4b3620" strokeWidth=".6">
        <circle cx="50" cy="9" r="1.8" />
        <circle cx="91" cy="50" r="1.8" />
        <circle cx="50" cy="91" r="1.8" />
        <circle cx="9" cy="50" r="1.8" />
      </g>
    </svg>
  );
}

export function CodexIllustration() {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 150 120" className="rb-codex-art" aria-hidden="true">
      <defs>
        <linearGradient id={id + '-leather'} x2=".8" y2="1">
          <stop stopColor="#4a4840" />
          <stop offset=".45" stopColor="#262b28" />
          <stop offset="1" stopColor="#111816" />
        </linearGradient>
        <linearGradient id={id + '-paper'} x2=".7" y2="1">
          <stop stopColor="#d3c49e" />
          <stop offset=".6" stopColor="#998766" />
          <stop offset="1" stopColor="#66563e" />
        </linearGradient>
        <linearGradient id={id + '-gold'} x2=".9" y2="1">
          <stop stopColor="#e9d1a0" />
          <stop offset=".38" stopColor="#8b6538" />
          <stop offset=".6" stopColor="#d5b67b" />
          <stop offset="1" stopColor="#5e432a" />
        </linearGradient>
      </defs>
      <ellipse cx="76" cy="108" rx="56" ry="7" fill="#000" opacity=".4" />
      <g transform="rotate(-9 75 60)">
        <path
          d="M35 18 116 24v82l-81-6-9-7V22Z"
          fill="#161b19"
          stroke="#907144"
          strokeWidth="1.6"
        />
        <path d="m40 22 71 5v71l-71-4Z" fill={`url(#${id}-paper)`} />
        <g stroke="#524635" strokeWidth=".65" opacity=".75">
          <path d="m41 90 69 5m-69-9 69 5m-69-9 69 5m-69-9 69 5m-69-9 69 5" />
        </g>
        <path d="m87 81 10 1v30l-5-5-5 4Z" fill="#703b36" stroke="#382420" />
        <g className="rb-codex-cover">
          <path
            d="m35 12 81 6v78l-81-6-9-7V16Z"
            fill={`url(#${id}-leather)`}
            stroke={`url(#${id}-gold)`}
            strokeWidth="2"
          />
          <path d="m40 20 67 5v63l-67-5Z" fill="none" stroke="#806a43" strokeWidth="1" />
          <path
            d="m43 24 61 4v56l-61-5Z"
            fill="none"
            stroke="#aaa079"
            strokeWidth=".6"
            strokeDasharray="1 2.2"
            opacity=".55"
          />
          <path d="m35 12 3 77-12-6V16Z" fill="#303730" stroke="#655839" strokeWidth=".8" />
          <g stroke={`url(#${id}-gold)`} strokeWidth="2">
            <path d="m27 29 10 1m-10 13 10 1m-10 27 10 1m-10 9 10 1" />
          </g>
          <path
            d="m42 23 12 1-12 12Zm62 5-12-1 12 12ZM45 80l12 1-12-12Zm59 4-12-1 12-12Z"
            fill={`url(#${id}-gold)`}
          />
          <g transform="translate(43 27) scale(.55)">
            <RulebookEmblem symbol="codex" />
          </g>
          <path d="m104 55 16 1v10l-16-1Z" fill={`url(#${id}-gold)`} stroke="#3a2d1f" />
          <circle cx="115" cy="61" r="1.5" fill="#32281c" />
        </g>
      </g>
    </svg>
  );
}
