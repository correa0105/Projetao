import { useId, useRef, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import './sheet-help.css';

export function SheetHelp({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const tip = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function show() {
    const box = trigger.current?.getBoundingClientRect();
    if (!box || !tip.current) return;
    tip.current.showPopover();
    const height = tip.current.offsetHeight;
    const width = tip.current.offsetWidth;
    tip.current.style.left = `${Math.max(12, Math.min(box.left, innerWidth - width - 12))}px`;
    tip.current.style.top = `${Math.max(12, box.bottom + height + 20 < innerHeight ? box.bottom + 8 : box.top - height - 8)}px`;
  }
  return (
    <span
      className="sheet-help"
      onMouseEnter={show}
      onMouseLeave={() => {
        if (document.activeElement !== trigger.current) tip.current?.hidePopover();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="sheet-help-trigger"
        aria-label={`Informações sobre ${label}`}
        aria-describedby={id}
        onFocus={show}
        onBlur={() => tip.current?.hidePopover()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          show();
        }}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span ref={tip} id={id} role="tooltip" popover="auto" className="sheet-help-tooltip">
        {children}
      </span>
    </span>
  );
}
