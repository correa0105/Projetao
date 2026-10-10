import { useEffect, useRef, useState } from 'react';
import type { VttToken } from '../shared/vtt';
import './vtt-token-scale.css';
export function VttTokenScaleControl({token,gridSize,busy,change}:{token:VttToken;gridSize:number;busy:boolean;change:(size:{width:number;height:number})=>void}) {
  const aspect=token.height/token.width,current=token.width/gridSize;
  const min=Math.max(8/gridSize,8/(gridSize*aspect),.1),max=Math.min(8000/gridSize,8000/(gridSize*aspect),Math.max(12,current));
  const [value,setValue]=useState(current),dragging=useRef(false),committed=useRef(current);
  useEffect(()=>{if(!dragging.current){setValue(current);committed.current=current;}},[current,token.id]);
  function commit(){dragging.current=false;if(Math.abs(value-committed.current)<1e-7)return;committed.current=value;change({width:value*gridSize,height:value*gridSize*aspect});}
  return <label className="vtt-token-scale">Tamanho do token <span>{Number(value.toFixed(2))} quadrados</span>
    <input type="range" aria-label="Tamanho do token" min={min} max={max} step="0.05" value={value} disabled={busy}
      onPointerDown={()=>{dragging.current=true;}} onChange={e=>{dragging.current=true;setValue(Number(e.target.value));}}
      onPointerUp={commit} onKeyUp={commit} onBlur={commit} onPointerCancel={()=>{dragging.current=false;setValue(current);}} />
  </label>;
}
