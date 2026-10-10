import { useLayoutEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { UserRound } from 'lucide-react';
import './portrait-frames.css';
export type FramedCharacter = {
  id: string;
  name: string;
  portrait_revision?: number;
  portrait?: string;
};
export function PortraitCabinet({
  characters,
  active,
  onSelect,
  children,
  sceneAligned = false,
}: {
  characters: FramedCharacter[];
  active: string;
  onSelect: (id: string) => void;
  children: ReactNode;
  sceneAligned?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layout = root.current!,
      stage = layout.closest<HTMLElement>('.cabinet-room-stage')!;
    const room = sceneAligned
      ? stage
      : layout.closest<HTMLElement>('.public-achievements') ||
        layout.closest<HTMLElement>('.main-shell')!;
    const measure = () => {
      const raw = getComputedStyle(room).getPropertyValue('--room-width').trim();
      const width = sceneAligned
        ? stage.clientWidth
        : raw.includes('clamp')
          ? Math.max(900, Math.min(2000, innerWidth))
          : raw.endsWith('vw')
            ? (parseFloat(raw) * innerWidth) / 100
            : parseFloat(raw) || room.clientWidth;
      const mobile = innerWidth <= (room.classList.contains('public-achievements') ? 800 : 700);
      const backgroundTop = sceneAligned
        ? 0
        : room.classList.contains('public-achievements')
          ? parseFloat(getComputedStyle(room).getPropertyValue('--portrait-background-top')) || 0
          : mobile
            ? 125
            : 0;
      const offset = stage.getBoundingClientRect().top - room.getBoundingClientRect().top;
      stage.style.setProperty('--cabinet-stage-offset', offset + 'px');
      if (sceneAligned) stage.style.setProperty('--cabinet-floor-y', width * 0.425 + 'px');
      layout.style.setProperty('--portrait-wall-top', width * 0.14 + backgroundTop - offset + 'px');
      layout.style.setProperty('--portrait-room-width', width + 'px');
      const stoneBottom = room.getBoundingClientRect().top + backgroundTop + width * 0.318;
      for (const wall of layout.querySelectorAll<HTMLElement>('.portrait-frame-wall')) {
        // Fit the whole pair, including its plaques, within the stone above the wainscot.
        // Scaling the pair preserves the frame proportions and the space between them.
        wall.style.setProperty('--portrait-wall-scale', '1');
        const top = wall.getBoundingClientRect().top;
        const bottom = Math.max(
          ...Array.from(
            wall.querySelectorAll<HTMLElement>('.antique-portrait, .antique-portrait-plaque'),
            (element) => element.getBoundingClientRect().bottom,
          ),
        );
        const scale = Math.min(1, Math.max(0.1, (stoneBottom - top) / (bottom - top)));
        wall.style.setProperty('--portrait-wall-scale', String(scale));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(room);
    observer.observe(stage);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sceneAligned]);
  function frame(index: number) {
    const c = characters[index],
      path = c?.portrait
        ? c.portrait + (c.portrait.includes('?') ? '&' : '?') + 'face=1&crop=2'
        : `/api/characters/${c?.id}/portrait?v=${c?.portrait_revision || 0}`;
    return (
      <button
        key={index}
        className={`antique-portrait frame-style-${index} ${c?.id === active ? 'selected' : ''} ${!c ? 'empty' : ''}`}
        aria-label={c ? `Ver conquistas de ${c.name}` : `Quadro reservado ${index + 1}`}
        aria-pressed={Boolean(c && c.id === active)}
        disabled={!c}
        onClick={() => c && onSelect(c.id)}
        style={{ '--frame-mask': `url('/profiles/frame-${index}-mask.png')` } as CSSProperties}
      >
        <span className="antique-portrait-opening">
          {c && (c.portrait_revision || 0) > 0 ? (
            <img
              src={path}
              alt={c.name}
              onLoad={(e) => e.currentTarget.style.removeProperty('display')}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <UserRound size={45} />
          )}
        </span>
        <img className="antique-frame-art" src={`/profiles/frame-${index}-v1.webp`} alt="" />
        <span className="antique-portrait-plaque">{c?.name || 'Retrato reservado'}</span>
      </button>
    );
  }
  return (
    <div className="portrait-cabinet-layout" ref={root}>
      <div className="portrait-frame-wall left">
        {frame(0)}
        {frame(1)}
      </div>
      <div className="portrait-cabinet-center">{children}</div>
      <div className="portrait-frame-wall right">
        {frame(2)}
        {frame(3)}
      </div>
    </div>
  );
}
