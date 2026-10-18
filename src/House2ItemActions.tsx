import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Flame, FlameKindling, Pencil, X } from 'lucide-react';
import { house2RotatedSize, type House2Item } from '../shared/house-v2';

export function House2ItemActions({
  item,
  spec,
  map,
  view,
  busy,
  toggle,
  edit,
  close,
}: {
  item: House2Item;
  spec: { name: string; width: number; height: number };
  map: RefObject<SVGSVGElement | null>;
  view: { x: number; y: number; width: number; height: number };
  busy: boolean;
  toggle: () => void;
  edit: () => void;
  close: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const matrix = map.current?.getScreenCTM();
    if (!matrix || item.x === null || item.y === null) return;
    const size = house2RotatedSize(
      spec.width * item.scale,
      spec.height * item.scale,
      item.rotation,
    );
    const point = new DOMPoint(item.x + size.width / 2, item.y + size.height / 2).matrixTransform(
      matrix,
    );
    const w = panel.current?.offsetWidth ?? 216,
      h = panel.current?.offsetHeight ?? 114;
    setPosition({
      left: Math.max(8, Math.min(innerWidth - w - 8, point.x + 12)),
      top: Math.max(100, Math.min(innerHeight - h - 80, point.y + 12)),
    });
  }, [
    item.x,
    item.y,
    item.rotation,
    item.scale,
    spec.width,
    spec.height,
    view.x,
    view.y,
    view.width,
    view.height,
    map,
  ]);
  useEffect(() => {
    function outside(e: PointerEvent) {
      const el = e.target as Element;
      if (el.closest('[data-house2-item-actions]')) return;
      const owner = el.closest('[data-house2-piece],[data-house2-border-piece]');
      if (
        owner?.getAttribute('data-house2-piece') === item.id ||
        owner?.getAttribute('data-house2-border-piece') === item.id
      )
        return;
      close();
    }
    function escape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
      map.current?.querySelector<SVGElement>(`[data-house2-piece="${item.id}"]`)?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [item.id, close, map]);
  return (
    <div
      ref={panel}
      className="h2-item-actions"
      data-house2-item-actions={item.id}
      role="group"
      aria-label={`Ações de ${spec.name}`}
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
    >
      <strong>{spec.name}</strong>
      <button className="h2-item-actions-close" aria-label="Fechar ações do item" onClick={close}>
        <X size={14} />
      </button>
      <button disabled={busy} aria-pressed={!!item.light_on} onClick={toggle}>
        {item.light_on ? <FlameKindling size={17} /> : <Flame size={17} />}
        {item.light_on ? 'Apagar luz' : 'Acender luz'}
      </button>
      <button disabled={busy} onClick={edit}>
        <Pencil size={14} />
        Editar objeto
      </button>
    </div>
  );
}
