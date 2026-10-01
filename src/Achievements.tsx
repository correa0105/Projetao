import { FlashMessage } from './FlashMessage';
import { useEffect, useState, useRef } from 'react';
import { Lock, Plus, Check, Search } from 'lucide-react';
import { api, post } from './api';
import { achievementCatalog, materials, emptyShelf, defaultPositions, type ShelfConfig, type AchievementState } from '../shared/achievements';
import './achievements.css';
function Medal({ code }: { code: string }) {
  return <img className={'fantasy-medal achievement-art art-' + code} src={'/trophies/' + code + '.png'} alt="" draggable={false} />;
}
export function AchievementShelf({ config, selected, onSelect, onMove }: { config: ShelfConfig; selected?: number | null; onSelect?: (index: number) => void; onMove?: (index: number, x: number) => void }) {
  const drag = useRef<{index:number; start:number; x:number; width:number; moved:boolean} | null>(null);
  const positions = config.positions ?? defaultPositions();
  return <div className="fantasy-cabinet" aria-label="Estante de conquistas">
    <img className={'cabinet-art material-' + config.material} src="/achievement-cabinet-v3.png" alt="Estante medieval entalhada com três prateleiras" />
    <div className="cabinet-spaces">{config.slots.map((code,i) => {
      const title = achievementCatalog.find(a => a.code === code)?.title;
      return <button key={i} type="button" style={{left: positions[i] + '%', bottom: [65.8,44.4,23.8][Math.floor(i/6)] + '%', zIndex: selected === i ? 100 : code ? 30+i : 1}} className={'cabinet-slot ' + (code ? 'occupied ' : '') + (selected === i ? 'selected' : '')} aria-label={`Posição ${i + 1}: ${title ?? 'vazia'}`} aria-pressed={selected === i} onPointerDown={e => {
          if (!code || !onMove || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current={index:i,start:e.clientX,x:positions[i],width:e.currentTarget.parentElement!.getBoundingClientRect().width,moved:false};
        }} onPointerMove={e => {
          const d=drag.current; if(!d || d.index!==i) return;
          if(Math.abs(e.clientX-d.start)>3) d.moved=true;
          if(d.moved) onMove?.(i,Math.max(0,Math.min(90,d.x+(e.clientX-d.start)/d.width*100)));
        }} onPointerUp={e => { if(drag.current?.moved) {e.preventDefault(); onSelect?.(i);} }}
        onPointerCancel={() => {drag.current=null;}}
        onClick={() => {const moved=drag.current?.moved;drag.current=null;if(!moved)onSelect?.(i);}}
        onKeyDown={e => {if(code && onMove && ['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();onMove(i,Math.max(0,Math.min(90,positions[i]+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:1))));}}}
        disabled={!onSelect}>
        {code ? <Medal code={code} /> : <Plus className="empty-position" size={18} />}
        {title && <span className="cabinet-title" role="tooltip">{title}</span>}
      </button>;
    })}</div>
  </div>;
}
export function Achievements({ characterId }: { characterId: string }) {
  const [data,setData] = useState<AchievementState | null>(null), [config,setConfig] = useState<ShelfConfig>(emptyShelf);
  const [selected,setSelected] = useState<number | null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [saved,setSaved] = useState(false), [retry,setRetry] = useState(0);
  const [filter,setFilter] = useState('Todas');
  const [query,setQuery] = useState('');
  const [page,setPage] = useState(1);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const visible = achievementCatalog.filter(a => normalize(a.title).includes(normalize(query)) && (filter === 'Todas' || (filter === 'Desbloqueadas') === Boolean(data?.unlocked.some(v => v.code === a.code))));
  const pages = Math.max(1, Math.ceil(visible.length / 5));
  const currentPage = Math.min(page, pages);
  const paginated = visible.slice((currentPage - 1) * 5, currentPage * 5);
  useEffect(() => {setPage(1);}, [query, filter, characterId]);
  useEffect(() => { let active = true; setError(''); api<AchievementState>(`/characters/${characterId}/achievements`).then(r => { if(active) {setData(r);setConfig(r.shelf);setSelected(null);} }).catch(e => {if(active)setError(e.message);}); return () => {active=false;}; },[characterId,retry]);
  useEffect(() => { if(saved) {const t=setTimeout(()=>setSaved(false),4000);return()=>clearTimeout(t);} },[saved]);
  function change(next: ShelfConfig) { setConfig(next);setSaved(false); }
  function place(code: string | null) {
    if (selected === null) return;
    const slots = config.slots.map(v => code && v === code ? null : v); slots[selected] = code;
    change({...config,slots});
  }
  async function save() { setBusy(true);setError('');try {const r=await post<AchievementState>(`/characters/${characterId}/achievements`,config);setData(r);setConfig(r.shelf);setSelected(null);setSaved(true);} catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  if(!data) return <div className="achievement-content">{error ? <><FlashMessage>{error}</FlashMessage><button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></> : <p role="status">Abrindo as conquistas…</p>}</div>;
  return <div className="achievement-content">
    <div className="cabinet-room-stage"><AchievementShelf config={config} selected={selected} onMove={busy ? undefined : (index,x) => {const positions=[...(config.positions ?? defaultPositions())];positions[index]=x;change({...config,positions});}} onSelect={busy ? undefined : (index) => setSelected(current => current === index ? null : index)} /></div>
    <details className="cabinet-personalization"><summary><span>Personalizar estante</span></summary><div className="cabinet-customization">
      <fieldset disabled={busy}><legend>Acabamento da estante</legend><div className="material-options">{Object.entries(materials).map(([key,label])=><label key={key}><input type="radio" name="material" checked={config.material===key} onChange={()=>change({...config,material:key as ShelfConfig['material']})}/><span className={'wood-swatch material-'+key}/>{label}</label>)}</div></fieldset>
      <label className="cabinet-type">Tipo de estante<select aria-label="Tipo de estante" value="classic" disabled={busy} onChange={() => {}}><option value="classic">Estante entalhada</option><option value="arcane" disabled>Estante arcana — Em breve</option><option value="stone" disabled>Estante de pedra — Em breve</option></select></label>
      <div className="cabinet-actions"><span>{selected === null ? 'Selecione uma posição na estante' : `Posição ${selected+1} selecionada`}</span><button className="text-button" disabled={busy || selected === null || !config.slots[selected]} onClick={()=>place(null)}>Esvaziar posição</button><button className="button primary" disabled={busy || JSON.stringify(config)===JSON.stringify(data.shelf)} onClick={()=>void save()}>{busy?'Salvando…':'Salvar estante'}</button>{saved && <FlashMessage kind="success">Estante salva.</FlashMessage>}</div>
      {error && <FlashMessage>{error}</FlashMessage>}
    </div></details>
    <section className="fantasy-catalog" aria-labelledby="catalog-title"><header><h2 id="catalog-title">Catálogo de conquistas</h2><p>Escolha uma conquista para a estante. Arraste os troféus na horizontal ou use as setas para ajustar; você pode sobrepor as peças.</p></header>
      <label className="achievement-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Buscar conquista por nome" placeholder="Buscar conquista por nome…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="catalog-filters" aria-label="Filtrar conquistas">{['Todas','Desbloqueadas','A conquistar'].map(v=><button key={v} className="button outline" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v}</button>)}</div>
      {paginated.map(a=> {
        const progress=data.progress[a.code];
        const earned=data.unlocked.find(v=>v.code===a.code),position=config.slots.indexOf(a.code);
        return <article className={'catalog-achievement '+(!earned?'locked':'')} key={a.code}><Medal code={a.code}/><div><span className="catalog-status">{earned?<Check size={12}/>:<Lock size={12}/>} {earned?'Desbloqueada':'Bloqueada'}</span><h3>{a.title}</h3><p>{a.description}</p>{progress && !earned && (progress.available ? <div className="achievement-progress"><span>{progress.current.toLocaleString('pt-BR')} / {progress.target.toLocaleString('pt-BR')} {progress.unit}</span><progress aria-label={'Progresso de ' + a.title} value={progress.current} max={progress.target}/></div> : <small className="achievement-pending">Em breve — sistema de reputação ainda não disponível.</small>)}{earned && <time dateTime={earned.unlocked_at}>{new Date(earned.unlocked_at).toLocaleDateString('pt-BR')}</time>}</div>{earned && <button className="button outline" disabled={busy || selected === null || position===selected} onClick={()=>place(a.code)}>{position===selected?'Nesta posição':position>=0?'Mover para cá':'Exibir na estante'}</button>}</article>;
      })}
      {pages > 1 && <nav className="achievement-pagination" aria-label="Paginação das conquistas">
        <button className="button outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
        <span aria-live="polite">Página {currentPage} de {pages}</span>
        <button className="button outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button>
      </nav>}
      {visible.length===0 && <p role="status">Nenhuma conquista encontrada com essa busca e filtro.</p>}
    </section>
  </div>;
}
