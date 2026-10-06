import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Coins, Lock, Sparkles, X } from 'lucide-react';
import { api, post } from './api';
import { cards, cardQuestions, type Card, type OwnedCard } from '../shared/cards';
import { money } from '../shared/rules';
import type { Character } from './types';
import './cards.css';
export function CardFace({ card, small = false }: { card: Card; small?: boolean }) {
  return (
    <span className={'arcana-card-face' + (small ? ' small' : '')}>
      <span
        className="arcana-card-art"
        style={
          {
            backgroundPosition: `${((card.cell % 4) * 100) / 3}% ${Math.floor(card.cell / 4) * 100}%`,
          } as CSSProperties
        }
      />
      <span className="arcana-card-ornament" aria-hidden="true">
        ✦
      </span>
      <span className="arcana-card-name">{card.name}</span>
      <span className="arcana-card-family">{card.family}</span>
    </span>
  );
}
export function Cards({
  character,
  onPurchased,
}: {
  character?: Character;
  onPurchased: () => Promise<void>;
}) {
  const [owned, setOwned] = useState<OwnedCard[]>([]),
    [selected, setSelected] = useState<Card>(cards[0]),
    [slot, setSlot] = useState(1),
    [filter, setFilter] = useState('Todas'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [speech, setSpeech] = useState(''),
    [conversation, setConversation] = useState(false),
    [questions, setQuestions] = useState(false);
  const key = useRef(crypto.randomUUID()),
    inFlight = useRef(false),
    live = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    live.current = true;
    if (character)
      void api<OwnedCard[]>('/cards/' + character.id)
        .then(setOwned)
        .catch((e) => setError(e.message));
    return () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [character?.id]);
  useEffect(() => {
    if (!conversation) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConversation(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [conversation]);
  function say(text: string, showQuestions = false) {
    if (timer.current) clearTimeout(timer.current);
    setSpeech(text);
    setQuestions(showQuestions);
    setConversation(true);
    if (!showQuestions) timer.current = setTimeout(() => setConversation(false), 14000);
  }
  const item = owned.find((c) => c.card_id === selected.id);
  async function purchase() {
    if (!character || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await post<{ card: OwnedCard }>('/cards/purchase', {
        character_id: character.id,
        card_id: selected.id,
        idempotency_key: key.current,
      });
      if (live.current) {
        key.current = crypto.randomUUID();
        setOwned(await api<OwnedCard[]>('/cards/' + character.id));
        setNotice('A carta foi guardada na sua coleção.');
        say(
          'Uma boa escolha. Agora decida qual lugar ela ocupa entre as três cartas que acompanham você.',
        );
      }
      await onPurchased();
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function equip(ownedId: string | null) {
    if (!character || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const slots = Array.from(
      { length: 3 },
      (_, i) => owned.find((c) => c.slot === i + 1)?.id || null,
    ).map((id) => (id === ownedId ? null : id));
    slots[slot - 1] = ownedId;
    try {
      await api('/cards/' + character.id + '/equipment', {
        method: 'PUT',
        body: JSON.stringify({ slots }),
      });
      const updated = await api<OwnedCard[]>('/cards/' + character.id);
      if (live.current) {
        setOwned(updated);
        setNotice(ownedId ? 'Carta equipada.' : 'Espaço liberado.');
      }
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section className="cards-room" aria-label="Salão das cartas">
      <div className="cards-scene">
        <div className="cards-room-backdrop" aria-hidden="true" />
        <div className="cards-room-shade" aria-hidden="true" />
        <div className="cards-moon-dust" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ '--dust-i': i } as CSSProperties} />
          ))}
        </div>
        <div className="cards-room-content">
          <header>
            <span className="eyebrow">O SALÃO DA MEIA-NOITE</span>
            <h1>O que a noite guarda.</h1>
            <p>Escolha as cartas que seguirão com {character?.name || 'seu personagem'}.</p>
          </header>
          <section className="cards-equipped" aria-label="Três cartas equipadas">
            {[1, 2, 3].map((position) => {
              const equipped = owned.find((c) => c.slot === position),
                definition = cards.find((c) => c.id === equipped?.card_id);
              return (
                <button
                  key={position}
                  disabled={busy}
                  aria-label={`Selecionar espaço ${position}${definition ? ': ' + definition.name : ''}`}
                  aria-pressed={slot === position}
                  onClick={() => {
                    setSlot(position);
                    if (definition) {
                      setSelected(definition);
                      say(definition.comment);
                    }
                  }}
                >
                  {definition ? (
                    <CardFace card={definition} small />
                  ) : (
                    <span className="cards-empty-slot">
                      <span>✦</span>
                      <small>Espaço {position}</small>
                    </span>
                  )}
                  <span className="cards-slot-index">{position}</span>
                </button>
              );
            })}
          </section>
          <div className="cards-table">
            <nav className="cards-filters" aria-label="Filtrar cartas">
              {['Todas', 'Minha coleção', 'À venda'].map((label) => (
                <button
                  key={label}
                  aria-pressed={filter === label}
                  onClick={() => setFilter(label)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="cards-catalog">
              {cards
                .filter(
                  (c) =>
                    filter === 'Todas' ||
                    (filter === 'À venda' ? c.buyable : owned.some((o) => o.card_id === c.id)),
                )
                .map((card, index, collection) => (
                  <button
                    key={card.id}
                    style={
                      {
                        '--fan-angle': `${(index - (collection.length - 1) / 2) * 6}deg`,
                        '--fan-drop': `${Math.abs(index - (collection.length - 1) / 2) ** 2 * 2.5}px`,
                        '--fan-layer': index + 1,
                      } as CSSProperties
                    }
                    disabled={busy}
                    aria-pressed={selected.id === card.id}
                    onClick={() => {
                      setSelected(card);
                      key.current = crypto.randomUUID();
                      setError('');
                      setNotice('');
                      say(card.comment);
                    }}
                  >
                    <CardFace card={card} />
                    <span className="cards-catalog-price">
                      {owned.some((o) => o.card_id === card.id) ? (
                        <>
                          <Check size={12} />
                          Na coleção
                        </>
                      ) : card.buyable ? (
                        money(card.price_cp) + ' PO'
                      ) : (
                        <>
                          <Lock size={11} />
                          Outra história
                        </>
                      )}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
        <button
          className="cards-host-hit"
          aria-label="Conversar com o Anfitrião"
          aria-expanded={conversation && questions}
          onClick={() =>
            say(
              'Entre. A cadeira está livre, e ninguém aqui vai lhe pedir pressa. Estava examinando estas cartas; alguma chamou sua atenção?',
              true,
            )
          }
        >
          <span>Conversar</span>
        </button>
        {conversation && (
          <aside className="cards-host-dialogue" aria-label="Conversa com o Anfitrião">
            <button
              className="cards-conversation-close"
              aria-label="Encerrar conversa"
              onClick={() => setConversation(false)}
            >
              <X size={16} />
            </button>
            <span className="eyebrow">O ANFITRIÃO</span>
            <p key={speech} aria-live="polite">
              {speech}
            </p>
            {questions && (
              <div className="cards-host-questions">
                {cardQuestions.map((q) => (
                  <button key={q.question} onClick={() => say(q.answer, true)}>
                    {q.question}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
      <section className="cards-detail" aria-label="Carta selecionada">
        <span className="eyebrow">{selected.family}</span>
        <h2>{selected.name}</h2>
        <p>{selected.description}</p>
        {item ? (
          <>
            <span className="cards-level">
              <Sparkles size={12} />
              Nível {item.level} · {item.slot ? 'Equipada no espaço ' + item.slot : 'Na coleção'}
            </span>
            <div className="cards-detail-actions">
              <button
                className="button primary"
                disabled={busy || item.slot === slot}
                onClick={() => void equip(item.id)}
              >
                Equipar no espaço {slot}
              </button>
              {owned.some((c) => c.slot === slot) && (
                <button className="button outline" disabled={busy} onClick={() => void equip(null)}>
                  Esvaziar espaço {slot}
                </button>
              )}
            </div>
            <small className="cards-upgrade-note">
              Os aprimoramentos serão definidos em uma próxima etapa.
            </small>
          </>
        ) : selected.buyable ? (
          <>
            <div className="cards-gold">
              <strong>{money(selected.price_cp)} PO</strong>
              <span>
                <Coins size={12} />
                {character
                  ? (character.gold_unlimited ? '∞' : money(character.gold_cp)) + ' PO disponíveis'
                  : 'Selecione um personagem'}
              </span>
            </div>
            <button
              className="button primary"
              disabled={
                busy ||
                !character ||
                (!character.gold_unlimited && character.gold_cp < selected.price_cp)
              }
              onClick={() => void purchase()}
            >
              {busy ? 'Guardando a carta…' : 'Comprar carta'}
            </button>
          </>
        ) : (
          <p className="cards-unavailable">
            Esta carta ainda não tem uma forma de obtenção disponível.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </section>
    </section>
  );
}
