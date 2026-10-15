import {useEffect,useRef} from 'react';
import {startLoreSmoke} from './lore-smoke-renderer';
import './lore-smoke.css';
/** Ambient smoke stays behind the reading surface and never captures a click or focus. */
export function LoreSmoke(){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const canvas=ref.current,container=canvas?.closest<HTMLElement>('.lore-library');if(canvas&&container)return startLoreSmoke(canvas,container);},[]);
  return <canvas ref={ref} className="lore-smoke" aria-hidden="true"/>;
}
