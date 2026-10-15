import {Lightbulb,MousePointer2} from 'lucide-react';
import {lightPresets,lightPresetValues,lightAnimationNames,type LightAnimation,type LightPresetId} from '../shared/vtt-lighting';
import './vtt-lighting-controls.css';

export function VttLightPresets({value,unit,onChange,onPlace,onApply}:{value:LightPresetId;unit:'ft'|'m';onChange:(id:LightPresetId)=>void;onPlace:()=>void;onApply?:()=>void}){
  const p=lightPresetValues(value,unit);
  return <section className="vtt-light-presets" aria-label="Presets de iluminação">
    <h3><Lightbulb size={15}/>Luzes prontas</h3>
    <label>Preset de iluminação<select aria-label="Preset de iluminação" value={value} onChange={e=>onChange(e.target.value as LightPresetId)}>{lightPresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <p>{p.bright} {unit} de luz forte + {p.dim} {unit} de luz fraca · {lightAnimationNames[p.animation]}</p>
    <div className="vtt-row"><button onClick={onPlace}><MousePointer2 size={14}/>Colocar luz no mapa</button>{onApply&&<button onClick={onApply}>Aplicar à luz selecionada</button>}</div>
    <small>Escolha uma luz e clique no mapa para posicioná-la.</small>
  </section>;
}
export function VttLightEffectFields({animation,speed,onChange}:{animation:LightAnimation;speed:number;onChange:(value:{animation:LightAnimation;effectSpeed:number})=>void}){
  return <div className="vtt-light-effect-fields">
    <label>Animação da luz<select aria-label="Animação da luz" value={animation} onChange={e=>onChange({animation:e.target.value as LightAnimation,effectSpeed:speed})}>{Object.entries(lightAnimationNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Velocidade do efeito <output>{speed.toLocaleString('pt-BR',{maximumFractionDigits:2})}×</output><input aria-label="Velocidade do efeito de luz" type="range" min=".25" max="3" step=".05" disabled={animation==='none'} value={speed} onChange={e=>onChange({animation,effectSpeed:Number(e.target.value)})}/></label>
  </div>;
}
