import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Layers, Coins, Lock, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api, post } from './api';
import { cards, cardRarities, cardQuestions, type Card, type OwnedCard } from '../shared/cards';
import { money } from '../shared/rules';
import type { Character } from './types';
import './cards.css';
import './cards-rarity.css';
import { CardsHost } from './CardsHost';
import {CardFrame} from './CardFrame';
import {cardVisualLevel} from '../shared/card-presentation';
import {CardViewer3D} from './CardViewer3D';
import {CardPrismaticFoil} from './CardPrismaticFoil';
import {CardEngraving} from './CardEngraving';
import {CardReadingSurface} from './CardReadingSurface';
import {cardBacks} from './card-backs';
import {useSoundEffects} from './SiteMusic';
import {playCardReveal} from './card-reveal-audio';
import './cards-engraved.css';
import './cards-salon.css';
export function CardFace({ card, small = false, level = 1, finish }: { card: Card; small?: boolean; level?: number; finish?:'original'|'chrome' }) {
  const visualLevel=cardVisualLevel(level),resolvedFinish=finish??(visualLevel===3?'chrome':'original');
  const nativePrism=resolvedFinish==='chrome';
  return (
    <span className={'arcana-card-face arcana-card-face--engraved' + (small ? ' small' : '')} data-rarity={card.rarity} data-level={visualLevel} data-finish={resolvedFinish}>
      <CardEngraving card={card}/>
      <CardFrame cell={card.cell} engraved metallic={visualLevel>=2||nativePrism} chrome={nativePrism} gold={visualLevel===2&&!nativePrism}/>
      {nativePrism && <CardPrismaticFoil/>}
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
  const [collectionReady,setCollectionReady]=useState(!character);
  const sound = useSoundEffects();
  const [owned, setOwned] = useState<OwnedCard[]>([]),
    [selected, setSelected] = useState<Card>(cards[0]),
    [slot, setSlot] = useState(1),
    [filter, setFilter] = useState('Todas'),
    [handOpen, setHandOpen] = useState(false),
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
    setHandOpen(false);
    setInspecting(null);
    setNotice('');
    setError('');
    if (character)
      void api<OwnedCard[]>('/cards/' + character.id)
        .then((cards) => { if (!cancelled) setOwned(cards); })
        .catch((e) => { if (!cancelled) setError(e.message); }).finally(()=>{if(!cancelled)setCollectionReady(true);});
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
  function openCard(card: Card) {
    setSelected(card);
    setPreviewLevel(cardVisualLevel(owned.find(item => item.card_id === card.id)?.level));
    setInspecting(card);
    setHandOpen(false);
    key.current = crypto.randomUUID();
    setError('');
    setNotice('');
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
  const details = (<section
            className="cards-detail"
            id="selected-card-details"
            aria-label="Carta selecionada"
          >
            <div className="cards-detail-preview">
              <div className="cards-detail-meta">
              <span className="cards-rarity" data-rarity={selected.rarity} style={{color:cardRarities[selected.rarity].colour}}>{cardRarities[selected.rarity].name}</span>
              <div className="cards-level-preview" aria-label="Comparar níveis da carta">{[1,2,3].map(level=><button type="button" key={level} aria-label={'Prévia Nv '+level} aria-pressed={previewLevel===level} onClick={()=>setPreviewLevel(level)}>{'Nv '+level}</button>)}</div>
              </div>
            </div>
            <div className="cards-detail-copy">
              <h2>{selected.name}</h2>
              <p>{selected.description}</p>
              {item ? (
                <>
                  <span className="cards-level">
                    <Sparkles size={12} />
                    Nv {item.level} ·{' '}
                    {item.slot ? 'Equipada no espaço ' + item.slot : 'Na coleção'}
                  </span>
                  <fieldset className="cards-equip-slot-choice"><legend>Espaço para equipar</legend>{[1,2,3].map(position => <button type="button" key={position} aria-label={'Usar espaço '+position} aria-pressed={slot===position} disabled={busy} onClick={() => setSlot(position)}>{position}</button>)}</fieldset>
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
          </section>);
  return (
    <section data-page-preparing={!collectionReady && !error || undefined} className="cards-room cards-room--salon" aria-label="Salão das cartas">
      <div className="cards-scene">
        <div className="cards-room-backdrop" aria-hidden="true" />
        <div className="cards-room-shade" aria-hidden="true" />

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
      <div className="cards-room-content">
        <header>
          <span className="eyebrow">O SALÃO DA MEIA-NOITE</span>
          <h2>O acervo do Anfitrião</h2>
          <p>Toque em uma carta sobre a mesa para revelá-la.</p>
        </header>
        <button type="button" className="cards-sound-toggle" onClick={sound.toggle} aria-label={sound.muted ? 'Ativar efeitos sonoros' : 'Silenciar efeitos sonoros'} aria-pressed={!sound.muted}>{sound.muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}<span>Som da sala</span></button>
      </div>
      <div className="cards-workbench">
        <div className="cards-playset" data-open={handOpen}>
          <button type="button" className="cards-hand-toggle" aria-expanded={handOpen} aria-controls="salon-equipped-cards" onClick={() => setHandOpen(!handOpen)}><Layers size={15}/><span>Cartas equipadas</span><small>{owned.filter(card => card.slot).length}/3</small></button>
          {handOpen && <section id="salon-equipped-cards" className="cards-equipped" aria-label="Três cartas equipadas">
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
                      openCard(definition);
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
          </section>}
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
                  onClick={() => { setFilter(label); }}
                >
                  {label}
                </button>
              ))}
            </nav>
            <CardReadingSurface>
            <button type="button" className="cards-deck" aria-label={'Revelar '+selected.name} disabled={busy || !available.length} onClick={() => openCard(available.find(card => card.id === selected.id) || available[0])}><span/><span/><img src={cardBacks.original} alt=""/><small>Revelar</small></button>
            <div className="cards-catalog">
              {available
                .map((card) => (
                  <button
                    key={card.id}
                    aria-label={card.name}
                    disabled={busy}
                    aria-pressed={selected.id === card.id}
                    onClick={() => openCard(card)}
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
            </CardReadingSurface>
            {available.length === 0 && <p className="cards-catalog-empty">Nenhuma carta nesta coleção.</p>}
            <span className="cards-table-count" role="status">{available.length} {available.length===1 ? 'carta' : 'cartas'} no acervo</span>
          </div>

        </div>
      </div>
      {inspecting && <CardInspection card={inspecting} level={previewLevel} close={() => setInspecting(null)}>{details}</CardInspection>}
    </section>
  );
}
export function CardInspection({card, close, level=1, children}: {card: Card; close: () => void;level?:number;children?:ReactNode}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sound = useSoundEffects(), stopSound = useRef<() => void>(() => {});
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (!sound.muted) stopSound.current = playCardReveal(sound.volume);
    const hidden = () => { if (document.hidden) stopSound.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { stopSound.current();document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (sound.muted || sound.volume === 0) stopSound.current(); }, [sound.muted, sound.volume]);
  return createPortal(<dialog ref={dialog} className={'card-inspection card-inspection--reveal'+(children?' card-inspection--with-details':'')} aria-label={'Inspecionar '+card.name} onCancel={e => {e.preventDefault();close();}} onClick={e => {if(e.target === e.currentTarget) close();}}>
    <div className="card-inspection-content">
      <div className="card-reveal-aura" aria-hidden="true"><i/><i/>{Array.from({length:14},(_,i)=><span key={i} style={{'--spark-angle':`${i*360/14}deg`,'--spark-delay':`${i%4*.06}s`} as CSSProperties}/>)}</div>
      <div className="card-reveal-caption"><span>UMA HISTÓRIA SE REVELA</span><h2>{card.name}</h2></div>
      <button type="button" className="card-inspection-close" aria-label="Fechar inspeção" onClick={close}><X size={20}/></button>
      <button type="button" className="card-inspection-sound" onClick={sound.toggle} aria-label={sound.muted?'Ativar som da revelação':'Silenciar som da revelação'}>{sound.muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>
      <div className="card-reveal-entry"><CardViewer3D card={card} level={level}/></div>
      {children ? <div className="card-reveal-details">{children}</div> : <span className="cards-rarity" style={{color:cardRarities[card.rarity].colour}}>{cardRarities[card.rarity].name}</span>}
    </div>
  </dialog>, document.body);
}
