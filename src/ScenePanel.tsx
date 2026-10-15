import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './scene-panel.css';

/** A non-modal drawer keeps the scene usable; focus never gets trapped behind it. */
export function ScenePanel({
  id,
  title,
  side = 'right',
  close,
  children,
}: {
  id: string;
  title: string;
  side?: 'left' | 'right';
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null),
    onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      onClose.current();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [id]);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      id={'scene-panel-' + id}
      className={'scene-panel panel-' + side}
      aria-label={title}
    >
      <header className="scene-panel-heading">
        <h2>{title}</h2>
        <button onClick={close} aria-label={'Fechar ' + title}>
          <X size={17} />
        </button>
      </header>
      <div className="scene-panel-content">{children}</div>
    </aside>
  );
}
