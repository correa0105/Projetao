import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronLeft, ChevronRight, Coins, Lock, Sparkles, X, ZoomIn } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api, post } from './api';
import { cards, cardRarities, cardQuestions, type Card, type OwnedCard } from '../shared/cards';
import { money } from '../shared/rules';
import type { Character } from './types';
import './cards.css';
import './cards-manor.css';
import './cards-rarity.css';
import { CardsHost } from './CardsHost';
import {CardFrame} from './CardFrame';
import {cardVisualLevel} from '../shared/card-presentation';
export function CardFace({ card, small = false, level = 1 }: { card: Card; small?: boolean; level?: number }) {
  const visualLevel=cardVisualLevel(level);
  return (
    <span className={'arcana-card-face' + (small ? ' small' : '')} data-rarity={card.rarity} data-level={visualLevel}>
      <span
        className="arcana-card-art"
        style={
          {
            backgroundImage: `url('/cards/tarot-symbolic-20261013/${card.id}-${visualLevel===1?1:2}.webp')`,
          } as CSSProperties
        }
      />
      {visualLevel===3 && <span className="arcana-card-metallic" aria-hidden="true"/>}
      <CardFrame cell={card.cell} metallic={visualLevel===3}/>
      <span className="arcana-card-title">
        <span className="arcana-card-name" style={{fontSize: `${Math.min(7.5, 112 / card.name.length)}cqw`}}>{card.name}</span>
      </span>
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
    [catalogPage, setCatalogPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [speech, setSpeech] = useState(''),
    [conversation, setConversation] = useState(false),
    [questions, setQuestions] = useState(false);
  const [inspecting, setInspecting] = useState<Card | null>(null);
  const [previewLevel,setPreviewLevel]=useState(1);
  const key = useRef(crypto.randomUUID()),
    inFlight = useRef(false),
    live = useRef(true),
    currentCharacter = useRef(character?.id),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  currentCharacter.current = character?.id;
  useEffect(() => {
    let cancelled = false;
    live.current = true;
    setOwned([]);
    setCatalogPage(0);
    setNotice('');
    setError('');
    if (character)
      void api<OwnedCard[]>('/cards/' + character.id)
        .then((cards) => { if (!cancelled) setOwned(cards); })
        .catch((e) => { if (!cancelled) setError(e.message); });
    return () => {
      cancelled = true;
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
  useEffect(()=>setPreviewLevel(cardVisualLevel(item?.level)),[selected.id,item?.level,character?.id]);
  const available = cards.filter(c => filter === 'Todas' ||
    (filter === 'À venda' ? c.buyable : owned.some(o => o.card_id === c.id)));
  const pages = Math.max(1, Math.ceil(available.length / 4));
  const currentPage = Math.min(catalogPage, pages - 1);
  const visibleCards = available.slice(currentPage * 4, currentPage * 4 + 4);
  function turnPage(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pages - 1, currentPage + direction));
    setCatalogPage(next);
    if(available[next * 4]) setSelected(available[next * 4]);
    key.current = crypto.randomUUID(); setError(''); setNotice('');
  }
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
      const collection = await api<OwnedCard[]>('/cards/' + character.id);
      if (live.current && currentCharacter.current === character.id) {
        key.current = crypto.randomUUID();
        setOwned(collection);
        setNotice('A carta foi guardada na sua coleção.');
        say(
          'Uma boa escolha. Agora decida qual lugar ela ocupa entre as três cartas que acompanham você.',
        );
      }
      await onPurchased();
    } catch (e) {
      if (live.current && currentCharacter.current === character.id) setError((e as Error).message);
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
      if (live.current && currentCharacter.current === character.id) {
        setOwned(updated);
        setNotice(ownedId ? 'Carta equipada.' : 'Espaço liberado.');
      }
    } catch (e) {
      if (live.current && currentCharacter.current === character.id) setError((e as Error).message);
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

        <div className="cards-room-content">
          <header>
            <span className="eyebrow">O SALÃO DA MEIA-NOITE</span>
            <h2>Histórias que escolhem companhia.</h2>
            <p>Escolha as cartas que seguirão com {character?.name || 'seu personagem'}.</p>
          </header>
        </div>
        <CardsHost
          expanded={conversation && questions}
          onTalk={() =>
            say(
              'Entre. A cadeira está livre, e ninguém aqui vai lhe pedir pressa. Estava examinando estas cartas; alguma chamou sua atenção?',
              true,
            )
          }
        />
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
      <div className="cards-workbench">
        <div className="cards-playset">
          <div>
            <span className="eyebrow">COM {character?.name || 'SEU PERSONAGEM'}</span>
            <h2>Cartas equipadas</h2>
            <p>Selecione um espaço, depois equipe uma carta.</p>
          </div>
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
                    <CardFace card={definition} small level={equipped?.level}/>
                  ) : (
                    <span className="cards-empty-slot">
                      <span>✦</span>
                      <small>{position}</small>
                    </span>
                  )}
                  <span className="cards-slot-index">{position}</span>
                </button>
              );
            })}
          </section>
        </div>
        <div className="cards-browse">
          <div className="cards-table">
            <div className="cards-catalog-heading">
              <span className="eyebrow">O ACERVO DO ANFITRIÃO</span>
              <h2>Escolha sua carta</h2>
            </div>
            <nav className="cards-filters" aria-label="Filtrar cartas">
              {['Todas', 'Minha coleção', 'À venda'].map((label) => (
                <button
                  key={label}
                  aria-pressed={filter === label}
                  onClick={() => { setFilter(label); setCatalogPage(0); }}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="cards-catalog">
              {visibleCards
                .map((card) => (
                  <button
                    key={card.id}
                    aria-label={card.name}
                    disabled={busy}
                    aria-pressed={selected.id === card.id}
                    onClick={() => {
                      setSelected(card);
                      key.current = crypto.randomUUID();
                      setError('');
                      setNotice('');
                      setSpeech(card.comment);
                      if (matchMedia('(max-width: 650px)').matches)
                        document.getElementById('selected-card-details')?.scrollIntoView({
                          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                            ? 'instant'
                            : 'smooth',
                          block: 'start',
                        });
                    }}
                  >
                    <CardFace card={card} level={owned.find(c=>c.card_id===card.id)?.level}/>
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
            {available.length === 0 && <p className="cards-catalog-empty">Nenhuma carta nesta coleção.</p>}
            <nav className="cards-pagination" aria-label="Navegar pelas cartas">
              <button type="button" aria-label="Cartas anteriores" disabled={busy || currentPage === 0} onClick={() => turnPage(-1)}><ChevronLeft size={16}/></button>
              <span role="status">Página {currentPage + 1} de {pages}<small>{available.length ? `${currentPage * 4 + 1}–${Math.min((currentPage + 1) * 4, available.length)} de ${available.length} cartas` : '0 cartas'}</small></span>
              <button type="button" aria-label="Próximas cartas" disabled={busy || currentPage === pages - 1} onClick={() => turnPage(1)}><ChevronRight size={16}/></button>
            </nav>
          </div>
          <section
            className="cards-detail"
            id="selected-card-details"
            aria-label="Carta selecionada"
          >
            <div className="cards-detail-preview">
              <button type="button" className="cards-inspect-art" aria-label={'Inspecionar '+selected.name} onClick={() => setInspecting(selected)}><CardFace card={selected} level={previewLevel}/></button>
            </div>
            <div className="cards-detail-copy">
              <span className="eyebrow">{selected.family}</span>
              <h2>{selected.name}</h2>
              <span className="cards-rarity" data-rarity={selected.rarity} style={{color:cardRarities[selected.rarity].colour}}>{cardRarities[selected.rarity].name}</span>
              <div className="cards-level-preview" aria-label="Comparar níveis da carta"><span>Prévia</span>{[1,2,3].map(level=><button type="button" key={level} aria-label={'Prévia nível '+level} aria-pressed={previewLevel===level} onClick={()=>setPreviewLevel(level)}>{level===3?'3 · Metálica':level}</button>)}</div>
              <p>{selected.description}</p>
              <button type="button" className="cards-inspect-button" onClick={() => setInspecting(selected)}><ZoomIn size={13}/>Inspecionar</button>
              {item ? (
                <>
                  <span className="cards-level">
                    <Sparkles size={12} />
                    Nível {item.level} ·{' '}
                    {item.slot ? 'Equipada no espaço ' + item.slot : 'Na coleção'}
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
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() => void equip(null)}
                      >
                        Esvaziar espaço {slot}
                      </button>
                    )}
                  </div>
                </>
              ) : selected.buyable ? (
                <>
                  <div className="cards-gold">
                    <strong>{money(selected.price_cp)} PO</strong>
                    <span>
                      <Coins size={12} />
                      {character
                        ? (character.gold_unlimited ? '∞' : money(character.gold_cp)) +
                          ' PO disponíveis'
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
            </div>
          </section>
        </div>
      </div>
      {inspecting && <CardInspection card={inspecting} level={previewLevel} close={() => setInspecting(null)}/>}
    </section>
  );
}
export function CardInspection({card, close, level=1}: {card: Card; close: () => void;level?:number}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="card-inspection" aria-label={'Inspecionar '+card.name} onCancel={e => {e.preventDefault();close();}} onClick={e => {if(e.target === e.currentTarget) close();}}>
    <div className="card-inspection-content">
      <button type="button" className="card-inspection-close" aria-label="Fechar inspeção" onClick={close}><X size={20}/></button>
      <CardFace card={card} level={level}/>
      <span className="cards-rarity" style={{color:cardRarities[card.rarity].colour}}>{cardRarities[card.rarity].name}</span>
    </div>
  </dialog>, document.body);
}
