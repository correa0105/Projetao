import { useId, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  DoorOpen,
  History,
  ImagePlus,
  Menu,
  Plus,
  X,
} from 'lucide-react';
import type { EventScene } from '../shared/events';
import './events-venue.css';

type View = 'reception' | 'agenda' | 'memories';
type Topic = 'welcome' | 'agenda' | 'participation' | 'memories';
const titles = {
  reception: 'Átrio dos Encontros',
  agenda: 'Agenda de Eventos',
  memories: 'Memórias da Guilda',
};
const questions = {
  welcome: 'Seja bem-vindo ao átrio.',
  agenda: 'Quais são os próximos eventos?',
  participation: 'Como participo de um encontro?',
  memories: 'Onde encontro as histórias passadas?',
};
export function EventsVenue({
  scene,
  upcoming,
  memories,
  canEdit,
  filter,
  changeFilter,
  create,
  editScene,
  children,
}: {
  scene: EventScene;
  upcoming: number;
  memories: number;
  canEdit: boolean;
  filter: string;
  changeFilter: (filter: string) => void;
  create: () => void;
  editScene: () => void;
  children: ReactNode;
}) {
  const [view, setView] = useState<View>('reception');
  const [talking, setTalking] = useState(false);
  const [topic, setTopic] = useState<Topic>('welcome');
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLButtonElement>(null);
  const light = useId();
  function go(next: View) {
    menu.current?.hidePopover();
    setView(next);
    setTalking(false);
    changeFilter(next === 'memories' ? 'Memórias' : next === 'agenda' ? 'Próximos' : 'Todos');
  }
  function closeTalk() {
    setTalking(false);
    host.current?.focus({ preventScroll: true });
  }
  function ask(next: Topic) {
    setTopic(next);
    setTalking(true);
  }
  return (
    <div className="events-venue" data-view={view}>
      <header className="events-venue-heading">
        <div>
          <h1>{titles[view]}</h1>
          <span>BASTIÃO DA ALVORADA · VIGÍLIA</span>
        </div>
        <button
          className="events-venue-trigger"
          popoverTarget="events-venue-menu"
          aria-label="Abrir menu dos eventos"
          aria-controls="events-venue-menu"
          aria-expanded={menuOpen}
        >
          <Menu size={16} />
          <span>Encontros</span>
          {upcoming > 0 && <em>{upcoming}</em>}
        </button>
      </header>
      <div
        id="events-venue-menu"
        className="events-venue-menu"
        popover="auto"
        ref={menu}
        onToggle={(e) => setMenuOpen(e.newState === 'open')}
      >
        <header>
          <span>Encontros da Alvorada</span>
          <button
            popoverTarget="events-venue-menu"
            popoverTargetAction="hide"
            aria-label="Fechar menu dos eventos"
          >
            <X size={15} />
          </button>
        </header>
        <nav aria-label="Ambientes dos eventos">
          {(
            [
              ['reception', 'Recepção', DoorOpen],
              ['agenda', 'Agenda de eventos', CalendarDays],
              ['memories', 'Memórias da guilda', History],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => go(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id !== 'reception' && <small>{id === 'agenda' ? upcoming : memories}</small>}
            </button>
          ))}
        </nav>
        {canEdit && (
          <div className="events-venue-administration">
            <button
              onClick={() => {
                menu.current?.hidePopover();
                setTalking(false);
                setView('agenda');
                changeFilter('Todos');
                create();
              }}
            >
              <Plus size={16} />
              Criar evento
            </button>
            <button
              onClick={() => {
                menu.current?.hidePopover();
                editScene();
              }}
            >
              <ImagePlus size={16} />
              Editar cenário
            </button>
          </div>
        )}
      </div>
      <button
        ref={host}
        className="events-host"
        aria-label="Conversar com o anfitrião dos eventos"
        aria-expanded={talking}
        aria-controls={talking ? 'events-host-conversation' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && talking) closeTalk();
        }}
        onClick={() => (talking ? closeTalk() : ask('welcome'))}
      >
        <svg viewBox="0 0 1024 1536" aria-hidden="true">
          <defs>
            <filter
              id={light}
              x="-10%"
              y="-5%"
              width="120%"
              height="110%"
              colorInterpolationFilters="sRGB"
            >
              <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="expanded" />
              <feGaussianBlur in="expanded" stdDeviation="6" result="soft" />
              <feComposite in="soft" in2="SourceAlpha" operator="out" result="outside" />
              <feFlood floodColor="#ecc263" floodOpacity="0.55" result="warm" />
              <feComposite in="warm" in2="outside" operator="in" result="halo" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
              <feGaussianBlur in="edge" stdDeviation="0.85" result="softEdge" />
              <feFlood floodColor="#f5d58b" floodOpacity="0.92" result="gold" />
              <feComposite in="gold" in2="softEdge" operator="in" result="rim" />
              <feMerge>
                <feMergeNode in="halo" />
                <feMergeNode in="rim" />
              </feMerge>
            </filter>
          </defs>
          <image href="/events/host-20261030.webp" width="1024" height="1536" />
          <image
            className="events-host-light"
            href="/events/host-20261030.webp"
            width="1024"
            height="1536"
            filter={`url(#${light})`}
          />
        </svg>
      </button>
      {talking && (
        <section
          id="events-host-conversation"
          className="events-host-conversation"
          role="region"
          aria-label="Conversa com o anfitrião dos eventos"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closeTalk();
            }
          }}
        >
          <div className="events-host-conversation-body">
            <header>
              <span>ATENDIMENTO · ENCONTROS</span>
              <b>
                O Anfitrião<small>Organizador do átrio</small>
              </b>
              <button onClick={closeTalk} aria-label="Fechar conversa">
                <X size={17} />
              </button>
            </header>
            <h2>{questions[topic]}</h2>
            {topic === 'welcome' && (
              <>
                <p>
                  {scene.subtitle ||
                    'Todo encontro começa com uma boa companhia. Aqui reunimos os chamados e as histórias da Alvorada.'}
                </p>
                <p>
                  Posso mostrar o que está por vir, explicar como participar ou abrir o registro dos
                  encontros passados.
                </p>
              </>
            )}
            {topic === 'agenda' && (
              <>
                <p>
                  {upcoming
                    ? `Há ${upcoming} ${upcoming === 1 ? 'encontro anunciado' : 'encontros anunciados'} entre os próximos e os que já estão acontecendo.`
                    : 'Ainda não há próximos encontros anunciados. Quando a equipe publicar um novo evento, ele aparecerá na agenda.'}
                </p>
                <p>Confira a data, o local e as orientações de cada organizador antes de partir.</p>
                <button className="events-host-destination" onClick={() => go('agenda')}>
                  Consultar a agenda
                  <ArrowUpRight size={15} />
                </button>
              </>
            )}
            {topic === 'participation' && (
              <>
                <p>
                  Abra o evento na agenda para ler a descrição, a data e o local. Quando o
                  organizador disponibilizar um destino, use <strong>Participar do encontro</strong>{' '}
                  para seguir as orientações.
                </p>
                <p>
                  Recompensas e regras especiais são as informadas no anúncio. A consulta do evento
                  não concede ouro nem progressão automaticamente.
                </p>
                <button className="events-host-destination" onClick={() => go('agenda')}>
                  Escolher um encontro
                  <ArrowUpRight size={15} />
                </button>
              </>
            )}
            {topic === 'memories' && (
              <>
                <p>
                  {memories
                    ? `O registro guarda ${memories} ${memories === 1 ? 'encontro passado' : 'encontros passados'} da guilda.`
                    : 'Este registro reúne os encontros concluídos e encerrados. As primeiras memórias aparecerão aqui quando forem registradas.'}
                </p>
                <p>
                  Os anúncios continuam disponíveis para revisitar suas histórias e os detalhes
                  publicados.
                </p>
                <button className="events-host-destination" onClick={() => go('memories')}>
                  Abrir as memórias
                  <ArrowUpRight size={15} />
                </button>
              </>
            )}
            <nav aria-label="Perguntas ao anfitrião">
              {(['agenda', 'participation', 'memories'] as const)
                .filter((t) => t !== topic)
                .map((t) => (
                  <button key={t} onClick={() => ask(t)}>
                    {questions[t]}
                    <ChevronRight size={14} />
                  </button>
                ))}
            </nav>
            {topic !== 'welcome' && (
              <button className="events-host-back" onClick={() => ask('welcome')}>
                <ArrowLeft size={13} />
                Outras perguntas
              </button>
            )}
          </div>
        </section>
      )}
      {view !== 'reception' && !talking && (
        <section className="events-venue-workspace" aria-label={titles[view]}>
          <header className="events-venue-panel-heading">
            <span>{view === 'agenda' ? 'OS PRÓXIMOS ENCONTROS' : 'O QUE A GUILDA VIVEU'}</span>
            <h2>{scene.title}</h2>
            <button aria-label="Voltar à recepção dos eventos" onClick={() => go('reception')}>
              <X size={16} />
            </button>
          </header>
          <nav className="events-filters" aria-label="Filtrar eventos">
            {['Todos', 'Próximos', 'Memórias'].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => {
                  changeFilter(f);
                  setView(f === 'Memórias' ? 'memories' : 'agenda');
                }}
              >
                {f}
              </button>
            ))}
          </nav>
          {children}
        </section>
      )}
    </div>
  );
}
