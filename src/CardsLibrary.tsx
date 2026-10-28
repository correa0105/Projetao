import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Lock,X} from 'lucide-react';
import {cards,type Card,type OwnedCard} from '../shared/cards';
import {money} from '../shared/rules';
import {CardFace} from './Cards';
import './cards-library.css';

export function CardsLibrary({mode,slot,owned,busy,error,close,onBrowse,onInspect,onEquip,isFaceDown,onFlip}:{
  mode:'catalog'|'equip';slot:number;owned:OwnedCard[];busy:boolean;error:string;
  close:()=>void;onBrowse:()=>void;onInspect:(card:Card)=>void;onEquip:(id:string|null)=>Promise<void>;
  isFaceDown?:(id:string)=>boolean;onFlip?:(id:string)=>void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [filter,setFilter]=useState('Todas');
  const [choice,setChoice]=useState(owned.find(card=>card.slot===slot)?.id || owned[0]?.id || '');
  const choosing=mode==='equip',current=owned.find(card=>card.slot===slot);
  const chosen=owned.find(card=>card.id===choice),definition=cards.find(card=>card.id===chosen?.card_id);
  const available=cards.filter(card=>choosing || filter==='Minha coleção'
    ?owned.some(item=>item.card_id===card.id):filter==='À venda'?card.buyable:true);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.showModal();
    return()=>{if(previous?.isConnected)previous.focus();};
  },[]);
  return createPortal(<dialog ref={dialog} className="cards-library" aria-label={choosing?`Equipar carta no espaço ${slot}`:'Acervo do Anfitrião'} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <button type="button" className="cards-library-close" onClick={close} aria-label="Fechar seleção de cartas"><X size={19}/></button>
    <header className="cards-library-heading"><span>{choosing?'SUA COLEÇÃO':'O BARALHO DO ANFITRIÃO'}</span><h2>{choosing?`Escolha a carta do espaço ${slot}`:'Histórias à sua espera'}</h2><p>{choosing?'Escolha uma das suas cartas e equipe neste espaço.':'Abra uma carta para conhecer sua história e disponibilidade.'}</p></header>
    {!choosing && <nav className="cards-library-filters" aria-label="Filtrar acervo">{['Todas','Minha coleção','À venda'].map(label=><button key={label} type="button" aria-pressed={filter===label} onClick={()=>setFilter(label)}>{label}</button>)}</nav>}
    <div className="cards-library-grid">{available.map(card=>{
      const item=owned.find(item=>item.card_id===card.id);
      return <button type="button" key={card.id} className="cards-library-card" disabled={busy} aria-label={choosing?'Selecionar '+card.name:card.name} aria-pressed={choosing?choice===item?.id:undefined} onClick={()=>choosing?setChoice(item!.id):onInspect(card)}>
        <CardFace card={card} level={item?.level}/>
        <span className="cards-library-card-meta">{item?<><Check size={12}/>Nv {item.level}{item.slot?` · Espaço ${item.slot}`:''}</>:card.buyable?`${money(card.price_cp)} PO`:<><Lock size={11}/>Indisponível</>}</span>
      </button>;
    })}</div>
    {!available.length && <div className="cards-library-empty"><p>{choosing?'Você ainda não possui cartas.':'Nenhuma carta nesta coleção.'}</p>{choosing&&<button type="button" className="button outline" onClick={onBrowse}>Ver o acervo do Anfitrião</button>}</div>}
    {error&&<p className="cards-library-error" role="alert">{error}</p>}
    {choosing&&<footer className="cards-library-actions">
      {chosen&&definition&&<button type="button" className="button outline" disabled={busy} onClick={()=>onInspect(definition)}>Inspecionar</button>}
      {chosen?.slot&&onFlip&&<button type="button" className="button outline" aria-pressed={isFaceDown?.(chosen.id)||false} disabled={busy} onClick={()=>onFlip(chosen.id)}>{isFaceDown?.(chosen.id)?'Mostrar frente na mesa':'Deixar verso na mesa'}</button>}
      {current&&<button type="button" className="button outline" disabled={busy} onClick={()=>void onEquip(null)}>Retirar carta do espaço {slot}</button>}
      <button type="button" className="button primary" disabled={busy||!chosen||chosen.slot===slot} onClick={()=>void onEquip(choice)}>{busy?'Equipando…':`Equipar no espaço ${slot}`}</button>
    </footer>}
  </dialog>,document.body);
}
