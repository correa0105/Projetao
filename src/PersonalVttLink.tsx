import { useEffect, useState } from 'react';
import { api } from './api';
import { copyText } from './copy-text';
import { vttPersonalHref } from '../shared/vtt-links';

export function PersonalVttLink() {
  const [id,setId]=useState(''),[url,setUrl]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    let live=true;
    api<{personal:{public_id:string;url?:string}}>('/vtt').then(data=>{if(live){setId(data.personal.public_id);setUrl(data.personal.url || '');}}).catch(error=>{if(live)setNotice(error.message);});
    return()=>{live=false;};
  },[]);
  const link=id?(url||new URL(vttPersonalHref(id),location.href).href):'';
  return <fieldset className="personal-vtt-link">
    <legend>Sua mesa virtual</legend>
    <p>O mesmo link será usado em todas as suas missões. Prepare os mapas antes de publicar; os jogadores entram no mapa ativo da sua mesa.</p>
    <label>Link fixo do VTT<input readOnly value={link} placeholder="Preparando seu link…" /></label>
    {id&&<div className="vtt-link-actions">
      <button type="button" className="button outline" onClick={()=>void copyText(link).then(()=>setNotice('Link copiado.')).catch(error=>setNotice(error.message))}>Copiar link do VTT</button>
      <a className="button outline" href={vttPersonalHref(id)} target="_blank" rel="noopener noreferrer">Preparar minha mesa</a>
    </div>}
    {notice&&<p role="status">{notice}</p>}
  </fieldset>;
}
