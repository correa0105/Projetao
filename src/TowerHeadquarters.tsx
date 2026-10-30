import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Diamond,
  Dices,
  DoorOpen,
  Eye,
  MessageCircle,
  Users,
} from 'lucide-react';
import {
  towerAnswers,
  towerQuestionLabels,
  towerRooms,
  type TowerRoom,
  type TowerTopic,
} from '../shared/tower-headquarters';
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
  const [backdrop, setBackdrop] = useState(current.image),
    [loading, setLoading] = useState(false),
    [imageError, setImageError] = useState(false),
    [retry, setRetry] = useState(0);
  const [topic, setTopic] = useState<TowerTopic>('welcome'),
    [conversation, setConversation] = useState<TowerRoom | null>(null),
    [peek, setPeek] = useState(false);
  useEffect(() => {
    setPeek(false);
    if (backdrop === current.image) {
      setLoading(false);
      setImageError(false);
      return;
    }
    let live = true;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    setLoading(true);
    setImageError(false);
    image.src = current.image;
    void image
      .decode()
      .then(() => {
        if (live) {
          setBackdrop(image.src.replace(location.origin, ''));
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
  }, [current.image, retry]);
  useEffect(() => {
    setConversation(null);
    setTopic(current.topic);
    setPeek(false);
  }, [room]);
  const talking = room === 'reception' || conversation === room,
    answer = towerAnswers[topic];
  function talk(next: TowerTopic = current.topic) {
    setTopic(next);
    setConversation(room);
    setPeek(false);
  }
  function go(next: TowerRoom) {
    setConversation(null);
    setPeek(false);
    change(next);
  }
  return (
    <div className="tower-headquarters" data-room={room} data-peeking={peek}>
      <div className="tower-headquarters-scene" aria-hidden="true">
        <img
          src={backdrop}
          alt=""
          decoding="async"
          fetchPriority="high"
          className={loading ? 'changing' : ''}
        />
        <div className="tower-headquarters-shade" />
      </div>
      <header className="tower-headquarters-header">
        <div className="tower-headquarters-title">
          <span>BASTIÃO DA ALVORADA · VIGÍLIA</span>
          <h2 className="tower-room-heading" tabIndex={-1}>
            {current.title}
          </h2>
        </div>
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
                <span>
                  {r.id === 'atlas' ? (
                    <>
                      Arquivo<span className="tower-room-word"> da Torre</span>
                    </>
                  ) : (
                    r.name
                  )}
                </span>
                {r.id === 'treasures' && pending > 0 && <em aria-hidden="true">{pending}</em>}
              </button>
            );
          })}
        </nav>
        {characterName && (
          <div className="tower-headquarters-wallet">
            <Diamond size={17} />
            <span>
              <b>{crystals.toLocaleString('pt-BR')}</b>
              <small>Cristais · {characterName}</small>
            </span>
          </div>
        )}
      </header>
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
      <button className="tower-clerk-hotspot" onClick={() => talk()} aria-label="Conversar com Lia">
        <MessageCircle size={16} />
        <span>
          <b>Lia</b>
          <small>Escrivã da Torre</small>
        </span>
      </button>
      <div
        className={'tower-headquarters-workspace ' + (talking ? 'is-conversation' : '')}
        inert={peek}
      >
        {talking ? (
          <section className="tower-conversation" aria-label="Conversa com a atendente">
            <header>
              <span>ATENDIMENTO · {current.name.toLocaleUpperCase('pt-BR')}</span>
              <b>
                Lia <small>Escrivã da Torre</small>
              </b>
              {room !== 'reception' && (
                <button aria-label="Voltar aos registros" onClick={() => setConversation(null)}>
                  <ArrowLeft size={16} />
                </button>
              )}
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
      <footer className="tower-headquarters-footer">
        <span>
          {room === 'reception'
            ? '100 andares · 20 regiões · Até 8 aventureiros'
            : 'DIRETORIA DA TORRE · ' + current.name.toLocaleUpperCase('pt-BR')}
        </span>
        <button onClick={() => setPeek((v) => !v)}>
          <Eye size={15} />
          {peek ? 'Voltar ao atendimento' : 'Ver a sala'}
        </button>
      </footer>
    </div>
  );
}
