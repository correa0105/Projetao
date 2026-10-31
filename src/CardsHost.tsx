import { useId, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { cardsHostOutlines } from './cards-host-outlines';

export function CardsHost({
  expanded,
  onTalk,
  buttonRef,
}: {
  expanded: boolean;
  onTalk: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const light = useId();
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    const room = buttonRef.current?.closest<HTMLElement>('.cards-room');
    if (!room) return;
    const update = () => {
      const width = room.clientWidth,
        height = room.clientHeight;
      const shape = cardsHostOutlines[width <= 900 ? 'mobile' : 'desktop'];
      const scale = Math.max(width / shape.width, height / shape.height);
      setPosition({
        left: (width - shape.width * scale) / 2 + shape.bounds.x * scale,
        top: (height - shape.height * scale) / 2 + shape.bounds.y * scale,
        width: shape.bounds.width * scale,
        height: shape.bounds.height * scale,
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(room);
    update();
    return () => observer.disconnect();
  }, [buttonRef]);
  return (
    <button
      ref={buttonRef}
      type="button"
      className="cards-host-hit"
      style={position}
      aria-label="Conversar com o Anfitrião"
      aria-expanded={expanded}
      aria-controls={expanded ? 'cards-host-dialogue' : undefined}
      onClick={onTalk}
    >
      {(['desktop', 'mobile'] as const).map((kind) => {
        const shape = cardsHostOutlines[kind];
        return (
          <svg
            key={kind}
            className={'cards-host-silhouette cards-host-silhouette--' + kind}
            viewBox={`${shape.bounds.x} ${shape.bounds.y} ${shape.bounds.width} ${shape.bounds.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter
                id={light + '-' + kind}
                x="-8%"
                y="-8%"
                width="116%"
                height="116%"
                colorInterpolationFilters="sRGB"
              >
                <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="expanded" />
                <feGaussianBlur in="expanded" stdDeviation="4" result="soft" />
                <feComposite in="soft" in2="SourceAlpha" operator="out" result="outside" />
                <feFlood floodColor="#ecc263" floodOpacity="0.55" result="warm" />
                <feComposite in="warm" in2="outside" operator="in" result="halo" />
                <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
                <feGaussianBlur in="edge" stdDeviation="0.65" result="softEdge" />
                <feFlood floodColor="#f5d58b" floodOpacity="0.92" result="gold" />
                <feComposite in="gold" in2="softEdge" operator="in" result="rim" />
                <feMerge>
                  <feMergeNode in="halo" />
                  <feMergeNode in="rim" />
                </feMerge>
              </filter>
              <clipPath id={`${light}-${kind}-desk`}>
                <rect width={shape.width} height={shape.clipY} />
              </clipPath>
            </defs>
            <path className="cards-host-target" d={shape.path} />
            <g clipPath={`url(#${light}-${kind}-desk)`}>
              <path
                className="cards-host-light"
                d={shape.path}
                fill="white"
                filter={`url(#${light}-${kind})`}
              />
            </g>
          </svg>
        );
      })}
    </button>
  );
}
