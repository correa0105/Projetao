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
  const [shape, setShape] = useState({ width: 1, height: 1, targetY: 22 });
  useLayoutEffect(() => {
    const bubble = root.current!;
    const scene = bubble.parentElement!;
    const keeper = scene.querySelector<HTMLElement>(
      dark ? '.ginna-vision-keeper' : '.stable-keeper',
    )!;
    const portrait = keeper.querySelector<HTMLImageElement>('img')!;
    const measure = () => {
      if (!portrait.naturalWidth || !scene.clientWidth || !scene.clientHeight) return;
      // Use layout coordinates, so the balloon moves with the shaking scene.
      // object-fit contains the portrait inside a wider, partly empty hit area.
      const scale = Math.min(
        keeper.clientWidth / portrait.naturalWidth,
        keeper.clientHeight / portrait.naturalHeight,
      );
      const artWidth = portrait.naturalWidth * scale;
      const artHeight = portrait.naturalHeight * scale;
      const artLeft = keeper.offsetLeft + (keeper.clientWidth - artWidth) / 2;
      const artTop = keeper.offsetTop + keeper.clientHeight - artHeight;
      const faceLeft = artLeft + artWidth * 0.37;
      const mouthY = artTop + artHeight * (dark ? 0.19 : 0.125);
      const padding = dark ? 18 : 8; // The shaking scene extends 10 px outside the viewport.
      const width = Math.min(dark ? 350 : 320, faceLeft - 16 - padding);
      bubble.style.width = `${Math.max(100, width)}px`;
      bubble.style.maxHeight = `${scene.clientHeight - padding * 2}px`;
      bubble.style.right = 'auto';
      bubble.style.bottom = 'auto';
      const height = bubble.offsetHeight;
      const left = faceLeft - bubble.offsetWidth - 16;
      const top = Math.max(
        padding,
        Math.min(
          scene.clientHeight - height - padding,
          mouthY - Math.min(height - 22, Math.max(26, height * 0.35)),
        ),
      );
      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
      setShape((previous) => {
        const next = {
          width: bubble.clientWidth,
          height: bubble.clientHeight,
          targetY: mouthY - top,
        };
        return previous.width === next.width &&
          previous.height === next.height &&
          previous.targetY === next.targetY
          ? previous
          : next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bubble);
    observer.observe(scene);
    observer.observe(keeper);
    portrait.addEventListener('load', measure);
    measure();
    return () => {
      observer.disconnect();
      portrait.removeEventListener('load', measure);
    };
  }, [dark]);
  useEffect(() => {
    if (label)
      root.current?.querySelector<HTMLButtonElement>('.ginna-questions button')?.focus({
        preventScroll: true,
      });
  }, [label, text]);
  const { width: w, height: h, targetY } = shape;
  const y = Math.max(22, Math.min(h - 22, targetY));
  const tipY = Math.max(8, Math.min(h + 12, targetY));
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
        data-tail-y={tipY}
        width={w + 16}
        height={h + 14}
      >
        <path
          d={`M12 .5 H${w - 12} Q${w - 0.5} .5 ${w - 0.5} 12 V${y - 9} L${w + 14} ${tipY} L${w - 0.5} ${y + 9} V${h - 12} Q${w - 0.5} ${h - 0.5} ${w - 12} ${h - 0.5} H12 Q.5 ${h - 0.5} .5 ${h - 12} V12 Q.5 .5 12 .5 Z`}
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
