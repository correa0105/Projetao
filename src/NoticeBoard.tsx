import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import type { Post } from './types';
import './notice-board.css';
const categories = [
  {kind:'hook',title:'Ganchos',image:'hooks'},
  {kind:'mission',title:'Missões',image:'missions'},
  {kind:'event',title:'Eventos',image:'events'},
] as const;
export function NoticeBoard({posts, renderPost, canCreateEvent, onPublish, feedback}: {
  feedback?:string;
  posts:Post[]; renderPost:(post:Post)=>ReactNode; canCreateEvent:boolean;
  onPublish:(kind:'mission'|'event')=>void;
}) {
  const [selected,setSelected]=useState<Post['kind'] | null>(null);
  const [filter,setFilter]=useState('Atuais');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(selected && dialog.current && !dialog.current.open) {dialog.current.showModal();heading.current?.focus();}},[selected]);
  const heading=useRef<HTMLHeadingElement>(null);
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  const current=categories.find(c=>c.kind===selected);
  const items=posts.filter(p=>p.kind===selected && (filter==='Todos' || (filter==='Histórico' ? ['completed','closed'].includes(p.status) : ['open','active'].includes(p.status))));
  function open(kind:Post['kind']) {setSelected(kind);setFilter('Atuais');}

  function close() {const i=categories.findIndex(c=>c.kind===selected);dialog.current?.close();setSelected(null);buttons.current[i]?.focus();}
  return <div className="notice-board-page">
    <div className="notice-board" aria-label="Mural de avisos da guilda">
      <div className="notice-board-notices">{categories.map((c,i)=><button key={c.kind} ref={el=>{buttons.current[i]=el;}} type="button" className={'notice-category notice-'+c.image} aria-label={'Abrir '+c.title} aria-expanded={selected===c.kind} aria-controls="notice-category-panel" onClick={()=>open(c.kind)}>
        <span className="notice-paper">
          <img src={'/notices/'+c.image+'-v4.png'} alt="" draggable={false}/>
          <span className="notice-paper-title">{c.title}</span>
        </span>
      </button>)}</div>
    </div>
    {current && <dialog ref={dialog} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}} className="notice-category-panel notice-dialog" id="notice-category-panel" aria-labelledby="notice-panel-title">
      <header><h2 id="notice-panel-title" ref={heading} tabIndex={-1}>{current.title}</h2><button className="icon-button" aria-label="Fechar lista de avisos" onClick={close}><X size={20}/></button></header>
      <div className="notice-panel-toolbar"><div className="tabs">{['Atuais','Todos','Histórico'].map(t=><button key={t} aria-pressed={filter===t} className={filter===t?'active':''} onClick={()=>setFilter(t)}>{t}</button>)}</div>
        {selected!=='hook' && (selected==='mission' || canCreateEvent) && <button className="button primary" onClick={()=>onPublish(selected as 'mission'|'event')}><Plus size={16}/>{selected==='mission'?'Publicar missão':'Publicar evento'}</button>}
      </div>
      {feedback && <p className="notice-feedback" role="status">{feedback}</p>}
      <div className="quest-grid">{items.map(item=>renderPost(item))}</div>
      {items.length===0 && <p className="notice-empty">Nenhum aviso nesta categoria e filtro.</p>}
      {selected==='hook' && <p className="source-note">Ganchos nascem da conclusão de uma missão.</p>}
    </dialog>}
  </div>;
}
