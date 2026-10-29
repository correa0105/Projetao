import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Footprints,
  Hammer,
  Image,
  Layers,
  Paintbrush,
  Search,
  Shield,
  Sparkles,
  Trees,
  X,
} from 'lucide-react';

export type VttLibrary =
  | 'images'
  | 'monsters'
  | 'spells'
  | 'presets'
  | 'premium'
  | 'nature'
  | 'animated'
  | 'scenery'
  | 'terrain';
const options: {
  id: VttLibrary;
  name: string;
  description: string;
  icon: typeof Image;
  gm?: boolean;
}[] = [
  { id: 'images', name: 'Imagens', description: 'Mapas e imagens enviadas à mesa', icon: Image },
  { id: 'monsters', name: 'Monstros', description: 'Criaturas e suas fichas', icon: Shield },
  {
    id: 'presets',
    name: 'Presets de monstros',
    description: 'Criaturas preparadas para a mesa',
    icon: Layers,
  },
  {
    id: 'premium',
    name: 'Criaturas vistas de cima',
    description: 'Galeria de tokens ilustrados',
    icon: Footprints,
  },
  { id: 'spells', name: 'Magias', description: 'Consulte as magias da biblioteca', icon: BookOpen },
  {
    id: 'nature',
    name: 'Cenários',
    description: 'Casas, comércios, plantas e mobiliário',
    icon: Trees,
  },
  {
    id: 'scenery',
    name: 'Peças de cenário',
    description: 'Objetos e elementos para compor o mapa',
    icon: Hammer,
  },
  {
    id: 'animated',
    name: 'Peças animadas',
    description: 'Elementos com movimento',
    icon: Sparkles,
  },
  {
    id: 'terrain',
    name: 'Terrenos e texturas',
    description: 'Materiais para pintar o mapa',
    icon: Paintbrush,
    gm: true,
  },
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function VttLibraryMenu({
  view,
  library,
  gm,
  choose,
  overview,
  close,
  children,
}: {
  view: 'menu' | 'content';
  library: VttLibrary;
  gm: boolean;
  choose: (library: VttLibrary) => void;
  overview: () => void;
  close: () => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>(view === 'menu' ? '.vtt-menu-search input' : '.vtt-menu-title')
      ?.focus({ preventScroll: true });
  }, [view, library]);
  const filtered = options.filter(
    (o) =>
      (!o.gm || gm) && normalize(o.name + ' ' + o.description).includes(normalize(query.trim())),
  );
  return (
    <section
      id="vtt-library-menu"
      ref={root}
      className="vtt-library-panel"
      aria-label="Biblioteca de assets"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <header className="vtt-menu-heading">
        <div>
          <span>IMAGENS, CRIATURAS E CENÁRIOS</span>
          <h2 className="vtt-menu-title" tabIndex={-1}>
            {view === 'menu' ? 'Biblioteca de assets' : options.find((o) => o.id === library)?.name}
          </h2>
        </div>
        <button className="vtt-menu-close" aria-label="Fechar biblioteca de assets" onClick={close}>
          <X size={18} />
        </button>
      </header>
      {view === 'menu' ? (
        <>
          <label className="vtt-menu-search">
            <Search size={16} />
            <input
              aria-label="Buscar categoria da biblioteca"
              placeholder="Buscar uma categoria…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <nav className="vtt-menu-options" aria-label="Categorias da biblioteca">
            {filtered.map((option) => (
              <button key={option.id} onClick={() => choose(option.id)}>
                <span className="vtt-menu-option-icon">
                  <option.icon size={19} />
                </span>
                <span>
                  <strong>{option.name}</strong>
                  <small>{option.description}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {!filtered.length && (
              <p className="vtt-menu-empty">Nenhuma categoria encontrada. Tente outro nome.</p>
            )}
          </nav>
        </>
      ) : (
        <>
          <button className="vtt-menu-back" onClick={overview}>
            <ArrowLeft size={15} />
            Todas as categorias
          </button>
          {children}
        </>
      )}
    </section>
  );
}
