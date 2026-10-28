import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {Coins,Sparkles,Volume2,VolumeX,X} from 'lucide-react';
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
import {CardReadingSurface} from './CardReadingSurface';
import {CardsLibrary} from './CardsLibrary';
import {CardsRoomLighting} from './CardsRoomLighting';
import {cardBacks} from './card-backs';
import {useSoundEffects} from './SiteMusic';
import {playCardReveal} from './card-reveal-audio';
import './card-reveal.css';
import './cards-salon.css';
export function CardFace({ card, small = false, level = 1, finish }: { card: Card; small?: boolean; level?: number; finish?:'original'|'chrome' }) {
  const visualLevel=cardVisualLevel(level),resolvedFinish=finish??(visualLevel===3?'chrome':'original');
  const nativePrism=resolvedFinish==='chrome';
  const art=nativePrism?`/cards/prismatic-clean-20261014/${card.id}.webp`:card.id==='raven'?`/cards/raven-corrected-20261014/raven-${visualLevel===1?1:2}.webp`:`/cards/tarot-symbolic-20261013/${card.id}-${visualLevel===1?1:2}.webp`;
  return (
    <span className={'arcana-card-face' + (small ? ' small' : '')} data-rarity={card.rarity} data-level={visualLevel} data-finish={resolvedFinish} data-prismatic-art={nativePrism}>
      <span
        className="arcana-card-art"
        style={
          {
            backgroundImage: `url('${art}')`,
          } as CSSProperties
        }
      />
      <CardFrame cell={card.cell} metallic={visualLevel>=2||nativePrism} chrome={nativePrism} gold={visualLevel===2&&!nativePrism}/>
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [speech, setSpeech] = useState(''),
    [conversation, setConversation] = useState(false),
    [questions, setQuestions] = useState(false);
  const [inspecting, setInspecting] = useState<Card | null>(null);
  const [library,setLibrary]=useState<'catalog'|'equip'|null>(null);
  const [previewLevel,setPreviewLevel]=useState(1);
  const dialogueBody=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{dialogueBody.current?.scrollTo({top:0});},[speech,conversation]);
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
    setLibrary(null);
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
  function openCard(card: Card) {
    setSelected(card);
    setPreviewLevel(cardVisualLevel(owned.find(item => item.card_id === card.id)?.level));
    setInspecting(card);
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
    if (!character || inFlight.current) return false;
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
        return true;
      }
    } catch (e) {
      if (live.current && currentCharacter.current === character.id) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
    return false;
  }
  async function finishEquip(ownedId:string|null) {
    if(await equip(ownedId)){setInspecting(null);setLibrary(null);}
  }
  function openSlot(position:number) {
    if(!character||busy)return;
    setSlot(position);setError('');setNotice('');setLibrary('equip');
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
                      onClick={() => void finishEquip(item.id)}
                    >
                      Equipar no espaço {slot}
                    </button>
                    {owned.some((c) => c.slot === slot) && (
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() => void finishEquip(null)}
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
        <CardsRoomLighting/>

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
            <div ref={dialogueBody} className="cards-host-dialogue-body">
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
            </div>
          </aside>
        )}
      </div>
      <div className="cards-room-content">
        <header>
          <span className="eyebrow">O SALÃO DA MEIA-NOITE</span>
          <h2>Um lugar para cada história.</h2>
          <p>{character?'Escolha um espaço na mesa para equipar suas cartas.':'Selecione um personagem para equipar suas cartas.'}</p>
        </header>
        <button type="button" className="cards-sound-toggle" onClick={sound.toggle} aria-label={sound.muted ? 'Ativar efeitos sonoros' : 'Silenciar efeitos sonoros'} aria-pressed={!sound.muted}>{sound.muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}<span>Som da sala</span></button>
      </div>
      <div className="cards-table">
        <CardReadingSurface>
          <button type="button" className="cards-deck" aria-label="Abrir acervo do Anfitrião" title="Ver o acervo do Anfitrião" disabled={busy} onClick={()=>{setError('');setLibrary('catalog');}}><span/><span/><img src={cardBacks.original} alt=""/><small>Acervo</small></button>
          <div className="cards-table-slots" aria-label="Três espaços de cartas na mesa">
            {[1,2,3].map(position=>{
              const equipped=owned.find(card=>card.slot===position),definition=cards.find(card=>card.id===equipped?.card_id);
              return <button type="button" key={position} className="cards-table-slot" data-filled={!!definition} aria-label={`Escolher carta para o espaço ${position}${definition?': '+definition.name:''}`} disabled={busy||!character||!collectionReady} onClick={()=>openSlot(position)}>
                {definition?<CardFace card={definition} level={equipped?.level}/>:<span className="cards-table-slot-empty"><span aria-hidden="true">✦</span><b>Escolher carta</b></span>}
                <span className="cards-table-slot-number" aria-hidden="true">{['I','II','III'][position-1]}</span>
              </button>;
            })}
          </div>
        </CardReadingSurface>
      </div>
      {!library&&!inspecting&&(error||notice)&&<p className="cards-room-message" role={error?'alert':'status'}>{error||notice}</p>}
      {library&&<CardsLibrary key={library+'-'+slot} mode={library} slot={slot} owned={owned} busy={busy} error={error} close={()=>setLibrary(null)} onBrowse={()=>{setError('');setLibrary('catalog');}} onInspect={openCard} onEquip={finishEquip}/>}
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
