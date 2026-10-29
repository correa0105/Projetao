import {useState} from 'react';
import {natureAssets,natureCategories,natureAssetMime,type NatureAsset} from '../shared/vtt-nature-assets';
import './vtt-nature-assets.css';
import {vttVisualSource,vttVisualThumbnail} from '../shared/vtt-asset-visuals';
import { VttAssetImage } from './VttAssetImage';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function VttNatureAssets({query,gm,add,category:fixedCategory}:{query:string;gm:boolean;add:(id:string,scale:number)=>void;category?:string}) {
  const [category,setCategory]=useState(fixedCategory??'Plantas'),[selected,setSelected]=useState<NatureAsset|null>(null),[scale,setScale]=useState(1),[inside,setInside]=useState(false);
  const terms=normalize(query).trim().split(/\s+/).filter(Boolean),items=natureAssets.filter(a=>a.category===category&&terms.every(t=>normalize(a.name+' '+a.category+' '+(a.notes??'')+' '+(a.species??'')).includes(t)));
  return <section className="vtt-nature">
    {!fixedCategory&&<nav aria-label="Coleções de cenário">{natureCategories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>{setCategory(c);setSelected(null);}}>{c}<small>{natureAssets.filter(a=>a.category===c).length}</small></button>)}</nav>}
    <p>{items.length} peças · {gm?'Arraste para o mapa ou abra a prévia':'Escolha uma peça para ver a arte'}</p>
    {selected&&<div className="vtt-nature-detail">
      <button className="vtt-nature-close" aria-label="Fechar prévia do cenário" onClick={()=>setSelected(null)}>×</button>
      <VttAssetImage key={selected.id+String(inside)} src={vttVisualSource(inside&&selected.interior?selected.interior:selected.image)} alt={selected.name+(inside?' · Interior':'')}/>
      <h3>{selected.name}</h3>
      {selected.actor&&<p>{selected.notes} Mova e gire este personagem como os demais tokens.</p>}
      {selected.interior&&<><div className="vtt-nature-views">{[false,true].map(v=><button key={String(v)} aria-pressed={inside===v} onClick={()=>setInside(v)}>{v?'Interior':'Telhado'}</button>)}</div><p>Escala ampla para personagens de um quadrado. Clique no ícone da porta para abrir ou fechar; entre para revelar o interior.</p></>}
      <label>Escala<select value={scale} onChange={e=>setScale(Number(e.target.value))}>{[.5,1,1.5,2,3].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
      <p>{Number((selected.width*scale).toFixed(2))} × {Number((selected.height*scale).toFixed(2))} quadrados</p>
      {gm&&<button onClick={()=>add(selected.id,scale)}>Colocar no mapa</button>}
    </div>}
    <div className="vtt-nature-grid">{items.map(a=><button key={a.id} className="vtt-nature-card" draggable={gm} aria-pressed={selected?.id===a.id} onClick={()=>{setSelected(a);setScale(1);setInside(false);}} onDragStart={e=>{e.dataTransfer.setData(natureAssetMime,JSON.stringify({id:a.id,scale:selected?.id===a.id?scale:1}));e.dataTransfer.effectAllowed='copy';}}><VttAssetImage thumbnail src={vttVisualThumbnail(a.image,a.thumbnail)} fallback={vttVisualSource(a.image)} alt="" loading="lazy" draggable={false}/><span>{a.name}</span></button>)}</div>
  </section>;
}
