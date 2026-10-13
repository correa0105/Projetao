import { useEffect, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
type Option = { id: string; name: string; icon: ComponentType<{ size?: number }>; options?: Option[] };
export function VttToolGroup({
  label,
  options,
  selected,
  choose,
  icon: GroupIcon,
}: {
  label: string;
  options: Option[];
  selected: string;
  choose: (id: string) => void;
  icon?: Option['icon'];
}) {
  const [open, setOpen] = useState(false),
    [branch, setBranch] = useState<Option | null>(null),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const anchor = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const active = (option: Option): boolean => option.id === selected || !!option.options?.some(active);
  const Icon = GroupIcon || (options.find(active) || options[0]).icon;
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if ((e.target as Element)?.closest?.('canvas[data-selection-count]')) return;
      if (!anchor.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    popup.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open, branch]);
  return (
    <>
      <button
        ref={anchor}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-pressed={options.some(active)}
        onClick={() => {
          const box = anchor.current!.getBoundingClientRect();
          setBranch(null);
          setPosition({
            left: Math.min(innerWidth - 224, box.right + 8),
            top: Math.max(8, Math.min(box.top, innerHeight - options.length * 40 - 22)),
          });
          setOpen(!open);
        }}
      >
        <Icon size={19} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            className="vtt-tool-popup"
            role="group"
            aria-label={`Opções de ${label}`}
            style={position}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                if (branch) { setBranch(null); return; }
                setOpen(false);
                anchor.current?.focus();
              }
            }}
          >
            {branch && <button onClick={() => setBranch(null)} aria-label={`Voltar às opções de ${label}`}>← {label}</button>}
            {(branch?.options || options).map((option) => (
              <button
                key={option.id}
                aria-pressed={active(option)}
                aria-expanded={option.options ? branch?.id === option.id : undefined}
                onClick={() => {
                  if (option.options) { setBranch(option); return; }
                  choose(option.id);
                  setOpen(false);
                  anchor.current?.focus();
                }}
              >
                <option.icon size={16} />
                {option.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
