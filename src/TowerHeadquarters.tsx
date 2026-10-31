import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Diamond,
  Dices,
  DoorOpen,
  Menu,
  MessageCircle,
  Users,
  X,
} from 'lucide-react';
import {
  towerAnswers,
  towerQuestionLabels,
  towerRooms,
  type TowerRoom,
  type TowerTopic,
} from '../shared/tower-headquarters';
import { RisingEmbers } from './RisingEmbers';
import { NpcPortrait, useDialogueArt, useNpcMotion } from './NpcPortrait';
const icons = {
  reception: DoorOpen,
  atlas: BookOpen,
  expeditions: Users,
  crystals: Diamond,
  treasures: Dices,
};
export function TowerHeadquarters({
  room,
  change,
  characterName,
  crystals,
  pending,
  children,
}: {
  room: TowerRoom;
  change: (room: TowerRoom) => void;
  characterName?: string;
  crystals: number;
  pending: number;
  children: ReactNode;
}) {
  const current = towerRooms.find((r) => r.id === room)!;
  const roomMenu = useRef<HTMLDivElement>(null);
  const clerk = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scene, setScene] = useState({ image: current.image, portrait: current.portrait, room }),
    [loading, setLoading] = useState(false),
    [imageError, setImageError] = useState(false),
    [retry, setRetry] = useState(0);
  const [topic, setTopic] = useState<TowerTopic>('welcome'),
    [conversation, setConversation] = useState<TowerRoom | null>(null);
  useEffect(() => {
    if (scene.image === current.image && scene.portrait === current.portrait) {
      setLoading(false);
      setImageError(false);
      return;
    }
    let live = true;
    const images = [current.image, current.portrait].map((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'high';
      image.src = src;
      return image;
    });
    setLoading(true);
    setImageError(false);
    void Promise.all(images.map((image) => image.decode()))
      .then(() => {
        if (live) {
          setScene({ image: current.image, portrait: current.portrait, room });
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setImageError(true);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [current.image, current.portrait, retry]);
  useEffect(() => {
    setConversation(null);
    setTopic(current.topic);
  }, [room]);
  const talking = conversation === room,
    answer = towerAnswers[topic];
  const { visible, reduced } = useNpcMotion();
  const [idleReading, setIdleReading] = useState(false);
  useEffect(() => {
    if (!talking) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTalk();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [talking]);
  useEffect(() => {
    setIdleReading(false);
    if (talking || room !== 'reception' || !visible || reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setIdleReading(true);
        timer = setTimeout(() => {
          setIdleReading(false);
          schedule();
        }, 6000);
      }, 22000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [talking, room, visible, reduced]);
  const portraitRequest = !talking
    ? idleReading
      ? '/tower/headquarters-lia-atlas-20261030.webp'
      : scene.portrait
    : ['book', 'tower', 'discoveries', 'return', 'trade', 'uses'].includes(topic)
      ? '/tower/headquarters-lia-atlas-20261030.webp'
      : topic === 'expeditions'
        ? '/tower/headquarters-lia-expeditions-20261030.webp'
        : topic === 'crystals'
          ? '/tower/headquarters-lia-crystals-20261030.webp'
          : topic === 'treasures'
            ? '/tower/headquarters-lia-treasures-20261030.webp'
            : '/tower/headquarters-lia-explain-20261031.webp';
  const portrait = useDialogueArt(
    portraitRequest,
    scene.portrait,
    (talking || idleReading) && portraitRequest.includes('lia-atlas')
      ? '/tower/headquarters-lia-retrieve-20261031.webp'
      : undefined,
  );
  function talk(next: TowerTopic = current.topic) {
    setTopic(next);
    setConversation(room);
  }
  function closeTalk() {
    setConversation(null);
    clerk.current?.focus({ preventScroll: true });
  }
  function go(next: TowerRoom) {
    roomMenu.current?.hidePopover();
    setConversation(null);
    change(next);
  }
  return (
    <div className="tower-headquarters" data-room={room}>
      <div className="tower-headquarters-scene" aria-hidden="true">
        <div className="tower-scene-frame">
          <div className="tower-scene-art">
            <img
              src={scene.image}
              alt=""
              decoding="async"
              fetchPriority="high"
              className={loading ? 'changing' : ''}
            />
          </div>
        </div>
        <div className="tower-headquarters-shade" />
      </div>
      <RisingEmbers />
      <button
        ref={clerk}
        className="tower-clerk"
        data-room={scene.room}
        aria-label="Conversar com Lia"
        aria-expanded={talking}
        aria-controls={talking ? 'tower-clerk-conversation' : undefined}
        onClick={() => (talking ? closeTalk() : talk(topic))}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && talking) closeTalk();
        }}
      >
        <NpcPortrait
          src={portrait}
          kind="lia"
          portraitClass="tower-clerk-portrait"
          lightClass="tower-clerk-light"
        />
      </button>
      <header className="tower-headquarters-header">
        <div className="tower-headquarters-title">
          <h1 className="tower-room-heading" tabIndex={-1}>
            {current.title}
          </h1>
          <span>BASTIÃO DA ALVORADA · VIGÍLIA</span>
        </div>
        <div className="tower-headquarters-actions">
          {characterName && (
            <div className="tower-headquarters-wallet" title={'Cristais · ' + characterName}>
              <Diamond size={15} />
              <span>
                <b>{crystals.toLocaleString('pt-BR')}</b>
                <small>Cristais</small>
              </span>
            </div>
          )}
          <button
            className="tower-room-trigger"
            popoverTarget="tower-room-menu"
            aria-label="Abrir menu de salas"
            aria-controls="tower-room-menu"
            aria-expanded={menuOpen}
          >
            <Menu size={16} />
            <span>Salas</span>
            {pending > 0 && <em aria-label={pending + ' tesouros pendentes'}>{pending}</em>}
          </button>
        </div>
      </header>
      <div
        id="tower-room-menu"
        popover="auto"
        ref={roomMenu}
        className="tower-room-menu"
        onToggle={(event) => setMenuOpen(event.newState === 'open')}
      >
        <header>
          <span>Salas da sede</span>
          <button
            popoverTarget="tower-room-menu"
            popoverTargetAction="hide"
            aria-label="Fechar menu de salas"
          >
            <X size={15} />
          </button>
        </header>
        <nav aria-label="Salas da sede" className="tower-room-nav">
          {towerRooms.map((r) => {
            const Icon = icons[r.id];
            return (
              <button
                key={r.id}
                aria-label={r.name}
                aria-current={room === r.id ? 'page' : undefined}
                onClick={() => go(r.id)}
              >
                <Icon size={17} />
                <span>{r.name}</span>
                {r.id === 'treasures' && pending > 0 && <em aria-hidden="true">{pending}</em>}
              </button>
            );
          })}
        </nav>
      </div>
      {loading && (
        <p className="tower-room-status" role="status">
          Abrindo {current.name.toLocaleLowerCase('pt-BR')}…
        </p>
      )}
      {imageError && (
        <div className="tower-room-status" role="status">
          Não foi possível abrir a imagem da sala.{' '}
          <button onClick={() => setRetry((v) => v + 1)}>Tentar novamente</button>
        </div>
      )}
      <div
        className={
          'tower-headquarters-workspace ' +
          (talking || room === 'reception' ? 'is-conversation' : '') +
          (room === 'reception' && !talking ? ' is-idle' : '')
        }
      >
        {talking ? (
          <section
            id="tower-clerk-conversation"
            className="tower-conversation"
            aria-label="Conversa com a atendente"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeTalk();
              }
            }}
          >
            <header>
              <span>ATENDIMENTO · {current.name.toLocaleUpperCase('pt-BR')}</span>
              <b>
                Lia <small>Escrivã da Torre</small>
              </b>
              <button
                aria-label={room === 'reception' ? 'Fechar conversa' : 'Voltar aos registros'}
                onClick={closeTalk}
              >
                {room === 'reception' ? <X size={16} /> : <ArrowLeft size={16} />}
              </button>
            </header>
            <div className="tower-conversation-answer" aria-live="polite" aria-atomic="true">
              <h3>{answer.title}</h3>
              {answer.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {topic === 'welcome' && characterName && pending > 0 && (
                <p>
                  Há {pending} {pending === 1 ? 'tesouro aguardando' : 'tesouros aguardando'} sua
                  revelação, {characterName}.
                </p>
              )}
            </div>
            <div className="tower-conversation-options" aria-label="Perguntas para Lia">
              {answer.action && (
                <button className="tower-primary" onClick={() => go(answer.action!.room)}>
                  {answer.action.label}
                  <ArrowUpRight size={16} />
                </button>
              )}
              {answer.related.map((id, i) => (
                <button key={id} onClick={() => talk(id)}>
                  <small aria-hidden="true">{i + 1}</small>
                  <span>{towerQuestionLabels[id]}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {topic !== 'welcome' && (
                <button className="tower-conversation-back" onClick={() => talk('welcome')}>
                  <ArrowLeft size={14} />
                  Outras perguntas
                </button>
              )}
            </div>
            {room === 'reception' && children}
          </section>
        ) : room === 'reception' ? (
          children
        ) : (
          <section
            className="tower-headquarters-service"
            aria-label={'Registros · ' + current.name}
          >
            <header className="tower-service-guidance">
              <MessageCircle size={16} />
              <p>
                <b>Lia</b> · {current.description}
              </p>
              <button onClick={() => talk()}>Conversar</button>
            </header>
            <div className="tower-service-scroll" key={room}>
              {room === 'crystals' && (
                <section className="tower-crystal-office" aria-label="Registro de cristais">
                  <span className="tower-kicker">GABINETE DE CRISTAIS</span>
                  <h3>Seu registro no Véu.</h3>
                  <div className="tower-crystal-balance">
                    <Diamond size={30} />
                    <strong>{characterName ? crystals.toLocaleString('pt-BR') : '—'}</strong>
                    <span>
                      Cristais
                      <small>
                        {characterName || 'Escolha um personagem no seletor da página.'}
                      </small>
                    </span>
                  </div>
                  <p>
                    O saldo acompanha as recompensas já confirmadas para seu personagem. Consultar
                    este gabinete não gasta cristais.
                  </p>
                  <div className="tower-crystal-questions">
                    {(['crystals', 'trade', 'uses'] as const).map((id) => (
                      <button key={id} onClick={() => talk(id)}>
                        {towerQuestionLabels[id]}
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                  <div className="tower-crystal-notice">
                    <b>Entreposto ainda fechado</b>
                    <p>
                      A sede ainda não opera venda de cristais, câmbio por ouro ou compras com esse
                      saldo.
                    </p>
                  </div>
                  <button className="tower-primary" onClick={() => go('treasures')}>
                    Consultar meus tesouros
                    <ArrowUpRight size={16} />
                  </button>
                </section>
              )}
              {children}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
