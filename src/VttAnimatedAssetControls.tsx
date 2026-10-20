import type { VttToken } from '../shared/vtt';

export function VttAnimatedAssetControls({token,gridSize,edit,enableEffects,effectsEnabled}:{token:VttToken;gridSize:number;edit:(patch:Partial<VttToken>)=>void;enableEffects:()=>void;effectsEnabled:boolean}) {
  const side=Math.max(token.width,token.height);
  const resize=(value:number)=>{const ratio=Math.max(8/Math.min(token.width,token.height),Math.min(8000/side,value/side));edit({width:token.width*ratio,height:token.height*ratio});};
  return <div role="group" aria-label="Controles do asset selecionado" style={{position:'absolute',top:58,left:'50%',transform:'translateX(-50%)',zIndex:20,background:'#101b22ee',border:'1px solid #9c814a',borderRadius:8,padding:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',maxWidth:'calc(100% - 24px)',color:'#e8d6b4'}} onPointerDown={e=>e.stopPropagation()}>
    <strong>{token.name}</strong>
    <button type="button" aria-label="Diminuir asset" onClick={()=>resize(side*.8)}>− Diminuir</button>
    <label>Tamanho <input aria-label="Tamanho do asset em quadrados" type="number" min={8/gridSize} max={8000/gridSize} step={.25} value={Number((side/gridSize).toFixed(2))} style={{width:72}} onChange={e=>{const v=e.currentTarget.valueAsNumber;if(Number.isFinite(v))resize(v*gridSize);}}/> quadrados</label>
    <button type="button" aria-label="Aumentar asset" onClick={()=>resize(side*1.25)}>+ Aumentar</button>
    <button type="button" onClick={()=>{enableEffects();edit({animatedAsset:{...token.animatedAsset!,playing:!(token.animatedAsset!.playing && effectsEnabled)}});}}>{token.animatedAsset?.playing && effectsEnabled?'Pausar':'Animar'}</button>
  </div>;
}
