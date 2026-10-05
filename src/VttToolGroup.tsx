import { useEffect, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
type Option = { id: string; name: string; icon: ComponentType<{ size?: number }> };
export function VttToolGroup({
  label,
  options,
  selected,
  choose,
}: {
  label: string;
  options: Option[];
  selected: string;
  choose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const anchor = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const Icon = (options.find((option) => option.id === selected) || options[0]).icon;
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    popup.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <>
      <button
        ref={anchor}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-pressed={options.some((option) => option.id === selected)}
        onClick={() => {
          const box = anchor.current!.getBoundingClientRect();
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
                setOpen(false);
                anchor.current?.focus();
              }
            }}
          >
            {options.map((option) => (
              <button
                key={option.id}
                aria-pressed={option.id === selected}
                onClick={() => {
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
