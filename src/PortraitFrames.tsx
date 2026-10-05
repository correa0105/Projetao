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
}: {
  characters: FramedCharacter[];
  active: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layout = root.current!,
      stage = layout.closest<HTMLElement>('.cabinet-room-stage')!;
    const room =
      layout.closest<HTMLElement>('.public-achievements') ||
      layout.closest<HTMLElement>('.main-shell')!;
    const measure = () => {
      const raw = getComputedStyle(room).getPropertyValue('--room-width').trim();
      const width = raw.includes('clamp')
        ? Math.max(900, Math.min(2000, innerWidth))
        : raw.endsWith('vw')
          ? (parseFloat(raw) * innerWidth) / 100
          : parseFloat(raw) || room.clientWidth;
      const mobile = innerWidth <= (room.classList.contains('public-achievements') ? 800 : 700);
      const backgroundTop = room.classList.contains('public-achievements')
        ? parseFloat(getComputedStyle(room).getPropertyValue('--portrait-background-top')) || 0
        : mobile
          ? 125
          : 0;
      const offset = stage.getBoundingClientRect().top - room.getBoundingClientRect().top;
      stage.style.setProperty('--cabinet-stage-offset', offset + 'px');
      layout.style.setProperty(
        '--portrait-wall-top',
        width * 0.105 + backgroundTop - offset + 'px',
      );
      layout.style.setProperty('--portrait-room-width', width + 'px');
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
  }, []);
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
