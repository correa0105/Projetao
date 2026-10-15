import './vtt-scenery-actions.css';
import {ArrowUpRight,Link2} from 'lucide-react';
import type {VttToken} from '../shared/vtt';
import {attachmentError} from '../shared/vtt-attachments';
export function VttSceneryActions({token,tokens,busy,convert,bind}:{token:VttToken;tokens:VttToken[];busy:boolean;convert:()=>void;bind:(id:string|null)=>void}){
 const candidates=tokens.filter(p=>p.id!==token.id&&p.layer==='tokens'&&!attachmentError(tokens.map(t=>t.id===token.id?{...t,layer:'tokens',attachment:{tokenId:p.id,offsetX:t.x-p.x,offsetY:t.y-p.y}}:t)));
 return <section className="vtt-scenery-actions" aria-label="Cenário como token">
  {!token.sceneryToken&&<button disabled={busy} onClick={convert}><ArrowUpRight size={14}/>Transformar cenário em token</button>}
  <label><Link2 size={14}/>Vincular a um token<select aria-label="Vincular cenário a um token" disabled={busy} value={token.attachment?.tokenId??''} onChange={e=>bind(e.target.value||null)}><option value="">{token.sceneryToken?'Independente':'Escolha um token'}</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <small>{token.sceneryToken?'Objeto na camada de tokens, sem pontos de vida.':'O vínculo transforma somente esta peça em token, mantendo sua posição.'}</small>
 </section>;
}
