import { useEffect, useState } from 'react';
import { Lock, Plus, Check, Search, ChevronDown } from 'lucide-react';
import { api, post } from './api';
import { achievementCatalog, materials, emptyShelf, type ShelfConfig, type AchievementState } from '../shared/achievements';
import './achievements.css';
function Medal({ code }: { code: string }) {
  return <span className={'fantasy-medal achievement-art art-' + code} aria-hidden="true" />;
}
export function AchievementShelf({ config, selected, onSelect }: { config: ShelfConfig; selected?: number | null; onSelect?: (index: number) => void }) {
  return <div className="fantasy-cabinet" aria-label="Estante de conquistas">
    <img className={'cabinet-art material-' + config.material} src="/achievement-cabinet-v3.png" alt="Estante medieval entalhada com três prateleiras" />
    <div className="cabinet-spaces">{config.slots.map((code,i) => {
      const title = achievementCatalog.find(a => a.code === code)?.title;
      return <button key={i} type="button" className={'cabinet-slot ' + (selected === i ? 'selected' : '')} aria-label={`Posição ${i + 1}: ${title ?? 'vazia'}`} aria-pressed={selected === i} onClick={() => onSelect?.(i)} disabled={!onSelect}>
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
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const visible = achievementCatalog.filter(a => normalize(a.title).includes(normalize(query)) && (filter === 'Todas' || (filter === 'Desbloqueadas') === Boolean(data?.unlocked.some(v => v.code === a.code))));
  useEffect(() => { let active = true; setError(''); api<AchievementState>(`/characters/${characterId}/achievements`).then(r => { if(active) {setData(r);setConfig(r.shelf);} }).catch(e => {if(active)setError(e.message);}); return () => {active=false;}; },[characterId,retry]);
  useEffect(() => { if(saved) {const t=setTimeout(()=>setSaved(false),4000);return()=>clearTimeout(t);} },[saved]);
  function change(next: ShelfConfig) { setConfig(next);setSaved(false); }
  function place(code: string | null) {
    if (selected === null) return;
    const slots = config.slots.map(v => code && v === code ? null : v); slots[selected] = code;
    change({...config,slots});
  }
  async function save() { setBusy(true);setError('');try {const r=await post<AchievementState>(`/characters/${characterId}/achievements`,config);setData(r);setSelected(null);setSaved(true);} catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  if(!data) return <div className="achievement-content">{error ? <><p role="alert">{error}</p><button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></> : <p role="status">Abrindo as conquistas…</p>}</div>;
  return <div className="achievement-content">
    <div className="cabinet-room-stage"><AchievementShelf config={config} selected={selected} onSelect={busy ? undefined : (index) => setSelected(current => current === index ? null : index)} /></div>
    <details className="cabinet-personalization"><summary><span>Personalizar estante</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="cabinet-customization">
      <fieldset disabled={busy}><legend>Acabamento da estante</legend><div className="material-options">{Object.entries(materials).map(([key,label])=><label key={key}><input type="radio" name="material" checked={config.material===key} onChange={()=>change({...config,material:key as ShelfConfig['material']})}/><span className={'wood-swatch material-'+key}/>{label}</label>)}</div></fieldset>
      <label className="cabinet-type">Tipo de estante<select aria-label="Tipo de estante" value="classic" disabled={busy} onChange={() => {}}><option value="classic">Estante entalhada</option><option value="arcane" disabled>Estante arcana — Em breve</option><option value="stone" disabled>Estante de pedra — Em breve</option></select></label>
      <div className="cabinet-actions"><span>{selected === null ? 'Selecione uma posição na estante' : `Posição ${selected+1} selecionada`}</span><button className="text-button" disabled={busy || selected === null || !config.slots[selected]} onClick={()=>place(null)}>Esvaziar posição</button><button className="button primary" disabled={busy || JSON.stringify(config)===JSON.stringify(data.shelf)} onClick={()=>void save()}>{busy?'Salvando…':'Salvar estante'}</button>{saved && <span role="status">Estante salva.</span>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div></details>
    <section className="fantasy-catalog" aria-labelledby="catalog-title"><header><h2 id="catalog-title">Catálogo de conquistas</h2><p>Selecione uma posição na estante e escolha uma conquista desbloqueada para exibir.</p></header>
      <label className="achievement-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Buscar conquista por nome" placeholder="Buscar conquista por nome…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="catalog-filters" aria-label="Filtrar conquistas">{['Todas','Desbloqueadas','A conquistar'].map(v=><button key={v} className="button outline" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v}</button>)}</div>
      {visible.map(a=> {
        const progress=data.progress[a.code];
        const earned=data.unlocked.find(v=>v.code===a.code),position=config.slots.indexOf(a.code);
        return <article className={'catalog-achievement '+(!earned?'locked':'')} key={a.code}><Medal code={a.code}/><div><span className="catalog-status">{earned?<Check size={12}/>:<Lock size={12}/>} {earned?'Desbloqueada':'Bloqueada'}</span><h3>{a.title}</h3><p>{a.description}</p>{progress && !earned && (progress.available ? <div className="achievement-progress"><span>{progress.current.toLocaleString('pt-BR')} / {progress.target.toLocaleString('pt-BR')} {progress.unit}</span><progress aria-label={'Progresso de ' + a.title} value={progress.current} max={progress.target}/></div> : <small className="achievement-pending">Em breve — sistema de reputação ainda não disponível.</small>)}{earned && <time dateTime={earned.unlocked_at}>{new Date(earned.unlocked_at).toLocaleDateString('pt-BR')}</time>}</div>{earned && <button className="button outline" disabled={busy || selected === null || position===selected} onClick={()=>place(a.code)}>{position===selected?'Nesta posição':position>=0?'Mover para cá':'Exibir na estante'}</button>}</article>;
      })}
      {visible.length===0 && <p role="status">Nenhuma conquista encontrada com essa busca e filtro.</p>}
    </section>
  </div>;
}
