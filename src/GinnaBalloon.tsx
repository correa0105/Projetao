import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function GinnaBalloon({
  text,
  speaker,
  children,
  close,
  label,
  dark = false,
}: {
  text: string;
  speaker: string;
  children?: ReactNode;
  close?: () => void;
  label?: string;
  dark?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  useLayoutEffect(() => {
    const bubble = root.current!;
    const measure = () => setSize({ width: bubble.clientWidth, height: bubble.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(bubble);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (label)
      root.current?.querySelector<HTMLButtonElement>('.ginna-questions button')?.focus({
        preventScroll: true,
      });
  }, [label]);
  const { width: w, height: h } = size;
  const y = Math.max(22, Math.min(h - 22, h * 0.35));
  return (
    <div
      ref={root}
      className={'ginna-balloon npc-speech' + (dark ? ' ginna-balloon-shadow' : '')}
      data-mode={children ? 'questions' : 'response'}
      role={label ? 'group' : undefined}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && close) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <svg
        className="merchant-speech-shape ginna-balloon-shape"
        aria-hidden="true"
        width={w + 16}
        height={h + 2}
      >
        <path
          d={`M12 .5 H${w - 12} Q${w - 0.5} .5 ${w - 0.5} 12 V${y - 9} L${w + 14} ${y + 6} L${w - 0.5} ${y + 9} V${h - 12} Q${w - 0.5} ${h - 0.5} ${w - 12} ${h - 0.5} H12 Q.5 ${h - 0.5} .5 ${h - 12} V12 Q.5 .5 12 .5 Z`}
        />
      </svg>
      <strong className="npc-speaker">{speaker}</strong>
      <p className="ginna-balloon-copy" role="status">
        {text}
      </p>
      {children && <div className="ginna-questions">{children}</div>}
    </div>
  );
}
