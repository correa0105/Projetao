import {z} from 'zod';

export const lightAnimationSchema=z.enum(['none','torch','campfire','candle','pulse','arcane']);
export type LightAnimation=z.infer<typeof lightAnimationSchema>;
export const lightEffectSpeedSchema=z.number().finite().min(.25).max(3);
export const lightAnimationNames:Record<LightAnimation,string>={none:'Sem animação',torch:'Tocha — chama irregular',campfire:'Fogueira — labaredas',candle:'Vela — oscilação suave',pulse:'Pulsação',arcane:'Brilho arcano'};
export const lightPresets=[
  {id:'torch',name:'Tocha',bright:20,dim:20,color:'#ffb86b',animation:'torch'},
  {id:'campfire',name:'Fogueira',bright:30,dim:30,color:'#ff994f',animation:'campfire'},
  {id:'candle',name:'Vela',bright:5,dim:5,color:'#ffda97',animation:'candle'},
  {id:'lantern',name:'Lanterna',bright:30,dim:30,color:'#ffd49c',animation:'candle'},
  {id:'brazier',name:'Braseiro',bright:15,dim:15,color:'#ff824a',animation:'campfire'},
  {id:'arcane',name:'Luz arcana',bright:20,dim:20,color:'#9ccaff',animation:'arcane'},
] as const;
export type LightPresetId=typeof lightPresets[number]['id'];
export function lightPresetValues(id:string,unit:'ft'|'m'='ft'){
  const p=lightPresets.find(p=>p.id===id)??lightPresets[0],factor=unit==='m'?.3048:1;
  return {name:p.name,bright:Math.round(p.bright*factor*100)/100,dim:Math.round(p.dim*factor*100)/100,color:p.color,animation:p.animation,effectSpeed:1,angle:360,rotation:0,enabled:true};
}
type Source={id:string;animation?:LightAnimation;effectSpeed?:number};
export function lightAnimationState(source:Source,now:number,reduced=false){
  if(reduced||!source.animation||source.animation==='none')return {intensity:1,core:1,warmth:0};
  let seed=0;for(const c of source.id)seed=(seed*31+c.charCodeAt(0))>>>0;
  const phase=seed%6283/1000,t=now/1000*(source.effectSpeed??1);
  const flame=(Math.sin(t*4.1+phase)*.55+Math.sin(t*9.7+phase*1.7)*.3+Math.sin(t*17.3+phase*.7)*.15);
  switch(source.animation){
    case 'torch':return {intensity:.92+flame*.075,core:.94+flame*.04,warmth:flame*.04};
    case 'campfire':return {intensity:.87+flame*.12,core:.90+flame*.07,warmth:flame*.07};
    case 'candle':return {intensity:.975+flame*.023,core:.98+flame*.015,warmth:flame*.015};
    case 'pulse':return {intensity:.86+Math.sin(t*2+phase)*.13,core:.9+Math.sin(t*2+phase)*.08,warmth:0};
    case 'arcane':return {intensity:.93+Math.sin(t*1.4+phase)*.06,core:.93+Math.sin(t*2.3+phase)*.06,warmth:0};
  }
}
type LitScene={lights:{enabled:boolean;animation?:LightAnimation}[];tokens:{light:number;dimLight:number;lightAnimation?:LightAnimation;hidden?:boolean;layer?:string}[]};
export function sceneHasAnimatedLights(scene:LitScene){
  return scene.lights.some(l=>l.enabled&&l.animation&&l.animation!=='none')||scene.tokens.some(t=>!t.hidden&&t.layer!=='gm'&&t.light+t.dimLight>0&&t.lightAnimation&&t.lightAnimation!=='none');
}
