import { useId, type CSSProperties } from 'react';

export function LoreVaseIcon() {
  const id = useId().replaceAll(':', '');
  return (
    <svg className="lore-vase-icon" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-pot`} x1="0" x2="1">
          <stop stopColor="#49301e" />
          <stop offset=".4" stopColor="#b38a50" />
          <stop offset=".7" stopColor="#745333" />
          <stop offset="1" stopColor="#3d2a1c" />
        </linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" x2="1">
          <stop stopColor="#987648" />
          <stop offset=".45" stopColor="#e2c68b" />
          <stop offset="1" stopColor="#b6945d" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-paper)`} stroke="#5b4328" strokeWidth="1.4">
        <path d="m12 38-6-27 9-2 8 28Z" />
        <ellipse cx="10" cy="10" rx="5" ry="3" transform="rotate(-12 10 10)" />
        <path d="m27 37-4-33 10-1 3 34Z" />
        <ellipse cx="28" cy="4" rx="5" ry="3" />
        <path d="m38 38 5-30 9 2-5 30Z" />
        <ellipse cx="48" cy="9" rx="5" ry="3" transform="rotate(12 48 9)" />
        <path d="m22 41-4-23 9-2 5 25Z" />
        <ellipse cx="22" cy="17" rx="5" ry="3" />
        <path d="m34 40 1-20 9 1-2 21Z" />
        <ellipse cx="40" cy="21" rx="5" ry="3" />
      </g>
      <path
        d="M16 34c-5 10-6 18-2 27 3 6 12 8 18 8s15-2 18-8c4-9 3-17-2-27Z"
        fill={`url(#${id}-pot)`}
        stroke="#cfab70"
        strokeWidth="1.4"
      />
      <ellipse cx="32" cy="34" rx="18" ry="5" fill="#2c251c" stroke="#c7a064" strokeWidth="2" />
      <path d="M17 34c4 3 10 4 15 4s11-1 15-4" fill="none" stroke="#e0bf80" />
      <path
        d="M14 48c9 5 27 5 36 0M17 62c8 4 22 4 30 0"
        fill="none"
        stroke="#d0a96b"
        strokeWidth="1.5"
        opacity=".65"
      />
      <path d="m32 44 6 8-6 8-6-8Z" fill="none" stroke="#d4b377" />
      <path d="M20 42c-3 8-2 14 0 17" fill="none" stroke="#e0bf87" opacity=".35" strokeWidth="2" />
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
      <svg viewBox="0 0 68 74" focusable="false">
        <defs>
          <linearGradient id={`${id}-scroll`} x1="0" y1="0" x2="1" y2=".7">
            <stop stopColor="#f0d9a3" />
            <stop offset=".4" stopColor="#cba36a" />
            <stop offset="1" stopColor="#8b653d" />
          </linearGradient>
          <linearGradient id={`${id}-sheet`} x2="0" y2="1">
            <stop stopColor="#bd935d" />
            <stop offset=".25" stopColor="#e6cc94" />
            <stop offset=".8" stopColor="#d2b17a" />
            <stop offset="1" stopColor="#a17b4a" />
          </linearGradient>
        </defs>
        <g
          className="lore-scroll-closed"
          transform="rotate(-24 34 37)"
          stroke="#77512e"
          strokeWidth="1.4"
        >
          <path d="M24 10h20v54H24Z" fill={`url(#${id}-scroll)`} />
          <ellipse cx="34" cy="10" rx="10" ry="5" fill="#dfbd83" />
          <ellipse cx="34" cy="64" rx="10" ry="5" fill="#b48a53" />
          <ellipse cx="34" cy="10" rx="5" ry="2" fill="#725235" />
          <path d="M30 15v43" stroke="#f2dba4" opacity=".65" />
          <path d="M24 35h20v7H24Z" fill="#773b27" stroke="#aa6441" />
          <circle cx="34" cy="38.5" r="5.5" fill="#a95032" stroke="#d49255" />
          <path d="m34 35 2 3-2 3-2-3Z" fill="#deb278" />
        </g>
        <g className="lore-scroll-open" stroke="#8a6539" strokeWidth="1.2">
          <path d="M15 13h37v48H14c5-5 5-11 4-17L15 13Z" fill={`url(#${id}-sheet)`} />
          <path d="M12 10h42c6 0 6 9 0 9H12c-6 0-6-9 0-9Z" fill={`url(#${id}-scroll)`} />
          <ellipse cx="12" cy="14.5" rx="4" ry="4.5" fill="#edcf93" />
          <ellipse cx="12" cy="14.5" rx="1.7" ry="2" fill="#8e673b" />
          <path d="M14 57h40c6 0 6 9 0 9H14c-6 0-6-9 0-9Z" fill={`url(#${id}-scroll)`} />
          <ellipse cx="54" cy="61.5" rx="4" ry="4.5" fill="#ad824d" />
          <path d="M25 29h18M24 35h21M24 41h19M26 47h15" opacity=".65" stroke="#89693b" />
          <path d="m32 23 3 3-3 3-3-3Z" fill="#997443" stroke="none" />
        </g>
      </svg>
      <span className="lore-scroll-embers">
        {Array.from({ length: 7 }, (_, i) => (
          <i
            key={i}
            style={
              {
                '--start': `${i * 5 - 15}px`,
                '--drift': `${((i * 13) % 38) - 19}px`,
                '--rise': `${28 + ((i * 11) % 42)}px`,
                '--duration': `${2.6 + (i % 4) * 0.4}s`,
                '--delay': `${-i * 0.51}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>
    </span>
  );
}
