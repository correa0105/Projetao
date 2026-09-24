import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import {
  Backpack,
  BookOpen,
  Compass,
  Feather,
  House,
  Map,
  ScrollText,
  Shield,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { CandleIcon, HelmetIcon, SwordIcon, PouchIcon, MapIcon, BookIcon } from './GuildIcons';
import type { Page } from './types';

type Destination = { page: Page; label: string; icon: ComponentType<{ size?: number }> };

const packages: { id: string; label: string; icon: Destination['icon']; items: Destination[] }[] = [
  {
    id: 'character',
    label: 'Personagem',
    icon: HelmetIcon,
    items: [
      { page: 'characters', label: 'Personagens', icon: Users },
      { page: 'profile', label: 'Perfil', icon: Shield },
      { page: 'inventory', label: 'Inventário', icon: Backpack },
      { page: 'achievements', label: 'Conquistas', icon: Trophy },
      { page: 'mercenaries', label: 'Mercenários', icon: Swords },
    ],
  },
  {
    id: 'adventure',
    label: 'Aventura',
    icon: SwordIcon,
    items: [
      { page: 'missions', label: 'Missões', icon: Compass },
      { page: 'board', label: 'Mural & eventos', icon: ScrollText },
      { page: 'hooks', label: 'Ganchos', icon: Feather },
    ],
  },
  {
    id: 'explore',
    label: 'Explorar',
    icon: MapIcon,
    items: [
      { page: 'world', label: 'Mundo', icon: Map },
      { page: 'house', label: 'House', icon: House },
    ],
  },
  {
    id: 'library',
    label: 'Biblioteca',
    icon: BookIcon,
    items: [
      { page: 'lore', label: 'Lore', icon: BookOpen },
      { page: 'rules', label: 'Regras', icon: ScrollText },
    ],
  },
];

export function Navigation({
  page,
  go,
  postCount,
}: {
  page: Page;
  go: (page: Page) => void;
  postCount: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [panelPosition, setPanelPosition] = useState<CSSProperties>({});
  const root = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInside = useRef(false);
  function cancelTimer() {
    if (timer.current) clearTimeout(timer.current);
  }
  function collapse(restoreFocus = false) {
    cancelTimer();
    setCaption(null);
    if (restoreFocus || root.current?.contains(document.activeElement))
      requestAnimationFrame(() => handle.current?.focus());
    setOpen(null);
    setRevealed(false);
  }
  useEffect(() => () => cancelTimer(), []);
  const group = packages.find((item) => item.id === open);
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const dock = root.current;
    const button = dock.querySelector<HTMLElement>(`#dock-${open}`);
    if (!button) return;
    function positionPanel() {
      const outer = dock.getBoundingClientRect();
      const anchor = button!.getBoundingClientRect();
      const width = Math.min(198, window.innerWidth - 28.8);
      const center = anchor.x + anchor.width / 2;
      const left = Math.max(16, Math.min(center - width / 2, window.innerWidth - width - 16));
      setPanelPosition({
        left: left - outer.x - 1,
        bottom: outer.bottom - anchor.top + 15.2,
        '--panel-tip': `${center - left}px`,
        '--panel-space': `${Math.max(79.2, anchor.top - 77.4)}px`,
      } as CSSProperties);
    }
    positionPanel();
    const observer = new ResizeObserver(positionPanel);
    observer.observe(dock);
    observer.observe(button);
    window.addEventListener('resize', positionPanel);
    dock.addEventListener('transitionend', positionPanel);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionPanel);
      dock.removeEventListener('transitionend', positionPanel);
    };
  }, [open]);
  useEffect(() => {
    setOpen(null);
    setRevealed(false);
    setCaption(null);
  }, [page]);
  useEffect(() => {
    if (!revealed) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) collapse();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (open) {
          root.current?.querySelector<HTMLButtonElement>(`#dock-${open}`)?.focus();
          setOpen(null);
        } else collapse(true);
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, revealed]);
  function navigate(target: Page) {
    collapse(true);
    go(target);
  }
  function packageButton(item: (typeof packages)[number]) {
    const Icon = item.icon;
    const active = item.items.some((destination) => destination.page === page);
    return (
      <div className="dock-package" key={item.id}>
        <button
          id={`dock-${item.id}`}
          aria-label={item.label}
          className={`dock-item ${active ? 'is-active' : ''}`}
          aria-expanded={open === item.id}
          aria-controls={`dock-panel-${item.id}`}
          onClick={() => setOpen(open === item.id ? null : item.id)}
        >
          <span className="dock-orb">
            <Icon size={44} />
          </span>
        </button>
      </div>
    );
  }
  return (
    <nav
      ref={root}
      className={`journey-dock ${revealed ? 'is-revealed' : ''}`}
      aria-label="Navegação principal"
      onPointerOver={(event) => {
        if (event.pointerType !== 'mouse') return;
        const button = (event.target as Element).closest('.dock-item');
        if (button) setCaption(button.getAttribute('aria-label'));
      }}
      onFocusCapture={(event) => {
        const button = (event.target as Element).closest('.dock-item');
        if (button) setCaption(button.getAttribute('aria-label'));
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse') return;
        const orb = (event.target as Element).closest<HTMLElement>('.dock-orb');
        if (!orb) return;
        const bounds = orb.getBoundingClientRect();
        orb.style.setProperty(
          '--glow-x',
          `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
        );
        orb.style.setProperty(
          '--glow-y',
          `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
        );
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return;
        pointerInside.current = true;
        cancelTimer();
        timer.current = setTimeout(() => setRevealed(true), 140);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        pointerInside.current = false;
        setCaption(null);
        cancelTimer();
        timer.current = setTimeout(() => collapse(), 350);
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !pointerInside.current
        )
          collapse();
      }}
    >
      {revealed && caption && !open && (
        <div className="dock-caption" aria-hidden="true">
          <span key={caption}>{caption}</span>
        </div>
      )}
      <button
        ref={handle}
        className="dock-handle"
        aria-label={revealed ? 'Recolher navegação' : 'Abrir navegação'}
        aria-expanded={revealed}
        aria-controls="navigation-tray"
        tabIndex={revealed ? -1 : 0}
        onClick={(event) => {
          cancelTimer();
          if (revealed) collapse(true);
          else {
            setRevealed(true);
            if (event.detail === 0)
              requestAnimationFrame(() =>
                root.current?.querySelector<HTMLButtonElement>('.dock-item')?.focus(),
              );
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            cancelTimer();
            setRevealed(true);
            requestAnimationFrame(() =>
              root.current?.querySelector<HTMLButtonElement>('.dock-item')?.focus(),
            );
          }
        }}
      >
        <span>Menu</span>
      </button>
      <div id="navigation-tray" className="dock-tray" inert={!revealed}>
        <div className="dock-buttons">
          <button
            className={`dock-item ${page === 'overview' ? 'is-active' : ''}`}
            aria-label="Início"
            aria-current={page === 'overview' ? 'page' : undefined}
            onClick={() => navigate('overview')}
          >
            <span className="dock-orb">
              <CandleIcon size={44} />
            </span>
          </button>
          {packages.slice(0, 2).map(packageButton)}
          <button
            className={`dock-item ${page === 'shop' ? 'is-active' : ''}`}
            aria-label="Loja"
            aria-current={page === 'shop' ? 'page' : undefined}
            onClick={() => navigate('shop')}
          >
            <span className="dock-orb">
              <PouchIcon size={44} />
            </span>
          </button>
          {packages.slice(2).map(packageButton)}
        </div>
      </div>
      {open && group && (
        <section
          key={group.id}
          id={`dock-panel-${group.id}`}
          className="dock-panel"
          style={panelPosition}
          aria-label={`Opções de ${group.label}`}
          onBlur={(event) => {
            if (event.relatedTarget && !root.current?.contains(event.relatedTarget)) setOpen(null);
          }}
        >
          <div className="dock-panel-heading">
            <span>{group.label}</span>
          </div>
          <div className="dock-destinations">
            {group.items.map(({ page: target, label, icon: ItemIcon }) => (
              <button
                key={target}
                className="dock-destination"
                aria-current={page === target ? 'page' : undefined}
                onClick={() => navigate(target)}
              >
                <ItemIcon size={16.2} />
                <span>{label}</span>
                {target === 'board' && <small>{postCount}</small>}
              </button>
            ))}
          </div>
        </section>
      )}
    </nav>
  );
}
