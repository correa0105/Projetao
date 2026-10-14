import {useState} from 'react';
import {natureAssets,natureAssetMime,type NatureAsset} from '../shared/vtt-nature-assets';
import './vtt-nature-assets.css';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function VttNatureAssets({query,gm,add}:{query:string;gm:boolean;add:(id:string,scale:number)=>void}) {
  const [category,setCategory]=useState('Plantas'),[selected,setSelected]=useState<NatureAsset|null>(null),[scale,setScale]=useState(1),[inside,setInside]=useState(false);
  const terms=normalize(query).trim().split(/\s+/).filter(Boolean),items=natureAssets.filter(a=>a.category===category&&terms.every(t=>normalize(a.name+' '+a.category).includes(t)));
  return <section className="vtt-nature">
    <nav aria-label="Plantas e casas">{['Plantas','Casas'].map(c=><button key={c} aria-pressed={category===c} onClick={()=>{setCategory(c);setSelected(null);}}>{c}<small>25</small></button>)}</nav>
    <p>{items.length} peças · {gm?'Arraste para o mapa ou abra a prévia':'Escolha uma peça para ver a arte'}</p>
    {selected&&<div className="vtt-nature-detail">
      <button className="vtt-nature-close" aria-label="Fechar prévia do cenário" onClick={()=>setSelected(null)}>×</button>
      <img src={inside&&selected.interior?selected.interior:selected.image} alt={selected.name+(inside?' · Interior':'')}/>
      <h3>{selected.name}</h3>
      {selected.interior&&<><div className="vtt-nature-views">{[false,true].map(v=><button key={String(v)} aria-pressed={inside===v} onClick={()=>setInside(v)}>{v?'Interior':'Telhado'}</button>)}</div><p>Paredes automáticas. Entre pela porta principal para revelar o interior.</p></>}
      <label>Escala<select value={scale} onChange={e=>setScale(Number(e.target.value))}>{[.5,1,1.5,2,3].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
      <p>{Number((selected.width*scale).toFixed(2))} × {Number((selected.height*scale).toFixed(2))} quadrados</p>
      {gm&&<button onClick={()=>add(selected.id,scale)}>Colocar no mapa</button>}
    </div>}
    <div className="vtt-nature-grid">{items.map(a=><button key={a.id} className="vtt-nature-card" draggable={gm} aria-pressed={selected?.id===a.id} onClick={()=>{setSelected(a);setScale(1);setInside(false);}} onDragStart={e=>{e.dataTransfer.setData(natureAssetMime,JSON.stringify({id:a.id,scale:1}));e.dataTransfer.effectAllowed='copy';}}><img src={a.image} alt="" loading="lazy" draggable={false}/><span>{a.name}</span></button>)}</div>
  </section>;
}
