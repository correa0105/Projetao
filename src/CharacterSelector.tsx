import { useEffect, useLayoutEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Character } from './types';

export function CharacterSelector({
  characters,
  selectedId,
  onSelect,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  keepAccountOpen = false,
}: {
  characters: Character[];
  selectedId: string;
  onSelect: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  keepAccountOpen?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [active, setActive] = useState(selectedId);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ value: '', time: 0 });
  const id = useId();
  const selected = characters.find((item) => item.id === selectedId) || characters[0];
  const activeIndex = Math.max(
    0,
    characters.findIndex((item) => item.id === active),
  );

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      const target = event.target as Element;
      if (keepAccountOpen && root.current?.closest('.profile-menu')?.contains(target)) return;
      if (
        !root.current?.contains(target) &&
        !document.getElementById(`${id}-list`)?.contains(target) &&
        !target.closest('.profile-avatar')
      )
        setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, keepAccountOpen]);
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, id]);
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const list = document.getElementById(`${id}-list`);
      if (!list) return;
      if (root.current?.closest('.profile-menu')) {
        list.style.left = 'auto';
        list.style.right = '0px';
        return;
      }
      list.style.left = '0px';
      const box = list.getBoundingClientRect();
      const shift =
        box.right > innerWidth - 18
          ? innerWidth - 18 - box.right
          : box.left < 18
            ? 18 - box.left
            : 0;
      list.style.left = `${shift}px`;
    };
    fit();
    if (hideTrigger) document.getElementById(`${id}-list`)?.focus({ preventScroll: true });
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open, id]);

  function choose(character: Character) {
    search.current = { value: '', time: 0 };
    onSelect(character.id);
    setOpen(false);
    if (hideTrigger)
      root.current
        ?.closest('.profile-menu')
        ?.querySelector<HTMLButtonElement>('.profile-avatar')
        ?.focus({ preventScroll: true });
    else trigger.current?.focus({ preventScroll: true });
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (!selected) return;
    if (!open) search.current = { value: '', time: 0 };
    const current = open
      ? activeIndex
      : Math.max(
          0,
          characters.findIndex((item) => item.id === selected.id),
        );
    let next = current;
    switch (event.key) {
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case 'Tab':
        setOpen(false);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) choose(characters[current]);
        else {
          setActive(selected.id);
          setOpen(true);
        }
        return;
      case 'ArrowDown':
        next = open ? Math.min(current + 1, characters.length - 1) : current;
        break;
      case 'ArrowUp':
        next = open ? Math.max(current - 1, 0) : current;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = characters.length - 1;
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
        const normalize = (value: string) =>
          value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR');
        const letter = normalize(event.key);
        const previous = event.timeStamp - search.current.time < 700 ? search.current.value : '';
        const term = previous + letter;
        search.current = { value: term, time: event.timeStamp };
        const match = characters.findIndex((item) => normalize(item.name).startsWith(term));
        if (match < 0) return;
        next = match;
      }
    }
    event.preventDefault();
    setActive(characters[next].id);
    setOpen(true);
  }
  if (!selected) return null;
  return (
    <div
      className="character-selector"
      ref={root}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !(event.relatedTarget as Element | null)?.closest('.profile-menu')
        )
          setOpen(false);
      }}
    >
      {!hideTrigger && (
        <button
          ref={trigger}
          type="button"
          className="character-selector-trigger"
          role="combobox"
          aria-label="Personagem ativo"
          aria-describedby={`${id}-value`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
          onKeyDown={keyboard}
          onClick={() => {
            search.current = { value: '', time: 0 };
            setActive(selected.id);
            setOpen(!open);
          }}
        >
          <span id={`${id}-value`}>{selected.name}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
      {open &&
        (() => {
          const list = (
            <div
              className="character-options profile-character-balloon"
              role="listbox"
              aria-label="Seus personagens"
              id={`${id}-list`}
              tabIndex={hideTrigger ? 0 : undefined}
              onKeyDown={hideTrigger ? keyboard : undefined}
              aria-activedescendant={hideTrigger ? `${id}-option-${activeIndex}` : undefined}
            >
              <div className="profile-characters-heading" aria-hidden="true">
                Seus personagens
              </div>
              {characters.map((item, index) => (
                <div
                  key={item.id}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-label={item.name}
                  aria-describedby={`${id}-detail-${index}`}
                  aria-selected={item.id === selected.id}
                  className={`character-option ${index === activeIndex ? 'is-highlighted' : ''}`}
                  onPointerMove={() => setActive(item.id)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small id={`${id}-detail-${index}`}>
                      {item.race} · {item.class} · Nível {item.level}
                    </small>
                  </span>
                  {item.id === selected.id && <Check size={15} aria-hidden="true" />}
                </div>
              ))}
            </div>
          );
          const host = root.current?.closest('.profile-menu');
          return host ? createPortal(list, host) : list;
        })()}
    </div>
  );
}
