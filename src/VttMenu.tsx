import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Footprints,
  Hammer,
  HelpCircle,
  Image,
  Layers,
  Map,
  MessageSquare,
  Music,
  Paintbrush,
  PawPrint,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Swords,
  Trees,
  Users,
  Waves,
  Wrench,
  X,
} from 'lucide-react';

export type VttMenuTab =
  | 'menu'
  | 'tools'
  | 'art'
  | 'scene'
  | 'token'
  | 'library'
  | 'sheet'
  | 'mounts'
  | 'pets'
  | 'vehicles'
  | 'siege'
  | 'chat'
  | 'combat'
  | 'journal'
  | 'music'
  | 'table'
  | 'help';
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
type MenuOption = {
  name: string;
  description: string;
  tab: VttMenuTab;
  library?: VttLibrary;
  icon: typeof Map;
  gm?: boolean;
};
const sections: { name: string; options: MenuOption[] }[] = [
  {
    name: 'Na mesa',
    options: [
      {
        name: 'Chat',
        description: 'Conversas e resultados das rolagens',
        tab: 'chat',
        icon: MessageSquare,
      },
      {
        name: 'Personagens',
        description: 'Fichas e personagens do site',
        tab: 'sheet',
        icon: Users,
      },
      {
        name: 'Token selecionado',
        description: 'Aparência, controle e condições',
        tab: 'token',
        icon: Shield,
      },
      {
        name: 'Combate',
        description: 'Iniciativa e turnos da sessão',
        tab: 'combat',
        icon: Swords,
      },
      {
        name: 'Diário',
        description: 'Anotações e materiais da aventura',
        tab: 'journal',
        icon: BookOpen,
      },
    ],
  },
  {
    name: 'Biblioteca',
    options: [
      {
        name: 'Imagens',
        description: 'Mapas e imagens enviadas à mesa',
        tab: 'art',
        library: 'images',
        icon: Image,
      },
      {
        name: 'Monstros',
        description: 'Criaturas e suas fichas',
        tab: 'library',
        library: 'monsters',
        icon: Shield,
      },
      {
        name: 'Presets de monstros',
        description: 'Criaturas preparadas para a mesa',
        tab: 'library',
        library: 'presets',
        icon: Layers,
      },
      {
        name: 'Criaturas vistas de cima',
        description: 'Galeria de tokens ilustrados',
        tab: 'library',
        library: 'premium',
        icon: Footprints,
      },
      {
        name: 'Magias',
        description: 'Consulte as magias da biblioteca',
        tab: 'library',
        library: 'spells',
        icon: BookOpen,
      },
      {
        name: 'Cenários',
        description: 'Casas, comércios, plantas e mobiliário',
        tab: 'library',
        library: 'nature',
        icon: Trees,
      },
      {
        name: 'Peças de cenário',
        description: 'Objetos e elementos para compor o mapa',
        tab: 'library',
        library: 'scenery',
        icon: Hammer,
      },
      {
        name: 'Peças animadas',
        description: 'Elementos com movimento',
        tab: 'library',
        library: 'animated',
        icon: Sparkles,
      },
    ],
  },
  {
    name: 'Companhia e veículos',
    options: [
      {
        name: 'Montarias',
        description: 'Traga suas montarias para a sessão',
        tab: 'mounts',
        icon: Footprints,
      },
      {
        name: 'Mascotes',
        description: 'Seus companheiros na aventura',
        tab: 'pets',
        icon: PawPrint,
      },
      {
        name: 'Veículos',
        description: 'Embarcações e outros veículos',
        tab: 'vehicles',
        icon: Waves,
      },
      {
        name: 'Armas de cerco',
        description: 'Canhões, arpões e seus operadores',
        tab: 'siege',
        icon: Swords,
      },
    ],
  },
  {
    name: 'Mapa e ferramentas',
    options: [
      {
        name: 'Ferramentas do mapa',
        description: 'Selecionar, medir, desenhar e aplicar efeitos',
        tab: 'tools',
        icon: Wrench,
      },
      {
        name: 'Mapa e camadas',
        description: 'Grade, iluminação, barreiras e sobreposição',
        tab: 'scene',
        icon: Map,
      },
      {
        name: 'Pintar terreno',
        description: 'Texturas e pincéis do mapa',
        tab: 'art',
        library: 'terrain',
        icon: Paintbrush,
        gm: true,
      },
    ],
  },
  {
    name: 'Sessão',
    options: [
      {
        name: 'Som e voz',
        description: 'Música, ambiente e efeitos sonoros',
        tab: 'music',
        icon: Music,
      },
      {
        name: 'Configurações da mesa',
        description: 'Convite, preferências e controles da sessão',
        tab: 'table',
        icon: Settings2,
      },
      {
        name: 'Ajuda e atalhos',
        description: 'Como usar os recursos da mesa',
        tab: 'help',
        icon: HelpCircle,
      },
    ],
  },
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function vttMenuTitle(tab: VttMenuTab, library: VttLibrary) {
  return (
    sections
      .flatMap((s) => s.options)
      .find((o) => o.tab === tab && (!o.library || o.library === library))?.name || 'Menu da mesa'
  );
}
export function VttMenu({
  tab,
  library,
  gm,
  choose,
  overview,
  close,
  children,
}: {
  tab: VttMenuTab;
  library: VttLibrary;
  gm: boolean;
  choose: (option: MenuOption) => void;
  overview: () => void;
  close: () => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = root.current?.querySelector<HTMLElement>(
      tab === 'menu' ? '.vtt-menu-search input' : '.vtt-menu-title',
    );
    target?.focus({ preventScroll: true });
  }, [tab, library]);
  const filtered = sections.map((section) => ({
    ...section,
    options: section.options.filter(
      (option) =>
        (!option.gm || gm) &&
        normalize(option.name + ' ' + option.description + ' ' + section.name).includes(
          normalize(query.trim()),
        ),
    ),
  }));
  return (
    <aside
      id="vtt-menu"
      ref={root}
      className="vtt-panel vtt-unified-panel"
      aria-label="Menu da mesa"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <header className="vtt-menu-heading">
        <div>
          <span>{tab === 'menu' ? 'SUA MESA, EM UM LUGAR' : 'MENU DA MESA'}</span>
          <h2 className="vtt-menu-title" tabIndex={-1}>
            {vttMenuTitle(tab, library)}
          </h2>
        </div>
        <button
          type="button"
          className="vtt-menu-close"
          aria-label="Fechar menu da mesa"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      {tab === 'menu' ? (
        <>
          <label className="vtt-menu-search">
            <Search size={16} />
            <input
              aria-label="Buscar opção do menu"
              placeholder="O que você quer fazer?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <nav className="vtt-menu-options" aria-label="Todas as opções da mesa">
            {filtered.map(
              (section) =>
                section.options.length > 0 && (
                  <section key={section.name}>
                    <h3>{section.name}</h3>
                    {section.options.map((option) => (
                      <button type="button" key={option.name} onClick={() => choose(option)}>
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
                  </section>
                ),
            )}
            {!filtered.some((s) => s.options.length) && (
              <p className="vtt-menu-empty">Nenhuma opção encontrada. Tente outro nome.</p>
            )}
          </nav>
        </>
      ) : (
        <>
          <button type="button" className="vtt-menu-back" onClick={overview}>
            <ArrowLeft size={15} />
            Todas as opções
          </button>
          {children}
        </>
      )}
    </aside>
  );
}
