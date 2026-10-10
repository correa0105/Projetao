import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Maximize2, Minus, Move, X } from 'lucide-react';
import './vtt-sheet-window.css';

export function VttSheetWindow({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [bottom, setBottom] = useState(136);
  function move(x: number, y: number) {
    const box = dialog.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      x: Math.max(8, Math.min(x, innerWidth - box.width - 8)),
      y: Math.max(8, Math.min(y, innerHeight - bottom - box.height - 8)),
    });
  }
  useLayoutEffect(() => {
    const bar = document.querySelector('.vtt-hotbar');
    const measure = () => {
      const top = bar?.getBoundingClientRect().top ?? innerHeight;
      setBottom(Math.min(innerHeight - 140, Math.max(136, innerHeight - top + 12)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (bar) observer.observe(bar);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  useLayoutEffect(() => {
    const adjust = () => {
      const box = dialog.current?.getBoundingClientRect();
      if (!box) return;
      setPosition((p) => {
        if (!p) return p;
        const x = Math.max(8, Math.min(p.x, innerWidth - box.width - 8));
        const y = Math.max(8, Math.min(p.y, innerHeight - bottom - box.height - 8));
        return x === p.x && y === p.y ? p : { x, y };
      });
    };
    adjust();
    window.addEventListener('resize', adjust);
    return () => window.removeEventListener('resize', adjust);
  }, [minimized, bottom]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className={'vtt-modal-backdrop vtt-sheet-backdrop' + (minimized ? ' minimized' : '')}
      style={{ '--sheet-bottom': bottom + 'px' } as CSSProperties}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        className={'vtt-map-dialog wide vtt-sheet-window' + (minimized ? ' minimized' : '')}
        role="dialog"
        aria-label={title}
        aria-modal={!minimized}
        tabIndex={-1}
        style={position ? { position: 'fixed', left: position.x, top: position.y } : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
            return;
          }
          if (minimized || e.key !== 'Tab') return;
          const items = [
            ...dialog.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]',
            ),
          ].filter((el) => !!el.getClientRects().length);
          const first = items[0],
            last = items.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first || document.activeElement === dialog.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header
          className="vtt-sheet-window-handle"
          tabIndex={0}
          aria-label="Mover janela da ficha"
          title="Arraste para mover a ficha; use as setas quando o cabeçalho estiver selecionado"
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as Element).closest('button')) return;
            const box = dialog.current!.getBoundingClientRect();
            e.preventDefault();
            drag.current = { id: e.pointerId, dx: e.clientX - box.x, dy: e.clientY - box.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current?.id === e.pointerId)
              move(e.clientX - drag.current.dx, e.clientY - drag.current.dy);
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || !e.key.startsWith('Arrow')) return;
            e.preventDefault();
            e.stopPropagation();
            const box = dialog.current!.getBoundingClientRect(),
              step = e.shiftKey ? 40 : 10;
            move(
              box.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
              box.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
            );
          }}
        >
          <div className="vtt-sheet-window-title">
            <Move size={16} aria-hidden="true" />
            <h2>{title}</h2>
          </div>
          <div className="vtt-sheet-window-buttons">
            <button
              aria-label={minimized ? 'Restaurar ficha' : 'Minimizar ficha'}
              title={minimized ? 'Restaurar ficha' : 'Minimizar ficha'}
              aria-expanded={!minimized}
              onClick={() => setMinimized((v) => !v)}
            >
              {minimized ? <Maximize2 size={18} /> : <Minus size={18} />}
            </button>
            <button aria-label={'Fechar ' + title} title="Fechar ficha" onClick={close}>
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="vtt-sheet-window-body" hidden={minimized}>
          {children}
        </div>
      </div>
    </div>
  );
}
