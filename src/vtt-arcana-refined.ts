import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, glow, star, tau, tint } from './vtt-effects-primitives';
import { texturedDischarge } from './vtt-effects-textured-lightning';
import { drawArcanaEffect } from './vtt-effects-arcana';
type Random = (index: number) => number;
export const refinedArcanaKinds = new Set(['discharge-matrix','aether-drops','constellation-breath','storm-lances','liquid-aegis','prismatic-barrier']);
function point(t:number,i:number,random:Random) {
  const angle=t*(.22+random(i+90)*.18)*(i%2?-1:1)+i*2.4;
  const radius=65+random(i+130)*18+Math.sin(t*.73+i)*7;
  return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*.96};
}
function droplet(c:CanvasRenderingContext2D,t:number,i:number,random:Random,color:string) {
  const p=point(t,i,random),r=6+random(i+10)*5;
  c.save();c.translate(p.x,p.y);c.rotate(t*.45+i);
  c.scale(1+.13*Math.sin(t*1.9+i),1+.12*Math.cos(t*1.6+i));
  glow(c,0,0,r*2,color,.12);
  const water=c.createRadialGradient(-r*.35,-r*.38,0,0,0,r);
  water.addColorStop(0,alpha(tint(color,.92),.84));water.addColorStop(.16,alpha(color,.22));
  water.addColorStop(.58,alpha(color,.04));water.addColorStop(.85,alpha(color,.3));water.addColorStop(1,alpha(tint(color,.55),.76));
  c.fillStyle=water;c.beginPath();
  for(let j=0;j<=48;j++){const a=j/48*tau,k=r*(1+.045*Math.sin(a*3+t*2+i));const x=Math.cos(a)*k,y=Math.sin(a)*k; if(!j)c.moveTo(x,y);else c.lineTo(x,y);}
  c.closePath();c.fill();
  c.strokeStyle=alpha('#e1ffff',.7);c.lineWidth=.65;c.beginPath();c.arc(-r*.09,-r*.1,r*.65,3.4,4.55);c.stroke();
  c.restore();
}
function constellation(c:CanvasRenderingContext2D,t:number,i:number,random:Random,color:string) {
  const position=(time:number)=>{
    const age=fract(time*(.1+random(i+80)*.045)+random(i+2));
    const a=i*2.4+age*2.8+t*.13, radius=25+age*70;
    return {x:Math.cos(a)*radius,y:Math.sin(a)*radius,age};
  };
  const p=position(t),fade=Math.sin(p.age*Math.PI)**1.4;
  c.save();c.globalAlpha*=fade;
  const tail=c.createLinearGradient(p.x,p.y,position(t-.42).x,position(t-.42).y);
  tail.addColorStop(0,alpha(color,.66));tail.addColorStop(1,alpha(color,0));
  c.strokeStyle=tail;c.lineWidth=.65;c.beginPath();
  for(let j=0;j<9;j++){const q=position(t-j*.05);if(!j)c.moveTo(q.x,q.y);else c.lineTo(q.x,q.y);}
  c.stroke();glow(c,p.x,p.y,6,color,.27);
  c.fillStyle=tint(color,.85);star(c,p.x,p.y,i%4===0?2.8+random(i+40):1.2+random(i+40));c.restore();
}
function membrane(c:CanvasRenderingContext2D,t:number,color:string,front:boolean,prism:boolean) {
  c.save();c.globalCompositeOperation='screen';
  if(!front){const volume=c.createRadialGradient(-26,-35,25,0,0,106);volume.addColorStop(0,alpha(color,0));volume.addColorStop(.66,alpha(color,.02));volume.addColorStop(.9,alpha(color,.12));volume.addColorStop(1,alpha(color,0));c.fillStyle=volume;c.fillRect(-110,-110,220,220);}
  for(let layer=0;layer<(prism?3:2);layer++) {
    c.beginPath();
    const start=front?0:Math.PI,end=front?Math.PI:tau;
    for(let j=0;j<=90;j++) {
      const a=start+(end-start)*j/90;
      const wave=2.4*Math.sin(a*7-t*1.8+layer*.6)+1.3*Math.sin(a*19+t*2.3);
      const r=94+wave-layer*1.8;
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      if(!j)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.strokeStyle=alpha(layer===0?tint(color,.75):color,layer===0?.45:.12);
    c.lineWidth=layer===0?.65:1.5;c.shadowColor=color;c.shadowBlur=layer===0?4:0;c.stroke();
  }
  c.shadowBlur=0;
  for(let i=0;i<(prism?18:12);i++) {
    const a=i*tau/(prism?18:12)+t*.11;
    if((Math.sin(a)>0)!==front)continue;
    const r=89+3*Math.sin(t*1.3+i*1.9),tone=prism?tint(color,.3,['#86deff','#a49aff','#ff9dde'][i%3]):color;
    c.save();c.translate(Math.cos(a)*r,Math.sin(a)*r);c.rotate(a+Math.PI/2);
    c.globalAlpha*=.3+.15*Math.sin(t*1.5+i);
    if(prism){const g=c.createLinearGradient(-9,-7,8,7);g.addColorStop(0,alpha(tone,0));g.addColorStop(.5,alpha(tone,.35));g.addColorStop(1,alpha(tint(tone,.6),.05));c.fillStyle=g;c.beginPath();c.moveTo(0,-10);c.quadraticCurveTo(15,-4,11,7);c.quadraticCurveTo(0,13,-11,7);c.quadraticCurveTo(-15,-4,0,-10);c.fill();}
    else{c.strokeStyle=alpha(tint(color,.8),.8);c.lineWidth=.8;c.beginPath();c.arc(0,0,6+2*Math.sin(t+i),.3,2.3);c.stroke();}
    c.restore();
  }
  c.restore();
}
/** Continuous trajectories and analytic highlights: no atlas frame holds. */
export function drawRefinedArcana(c:CanvasRenderingContext2D,e:TokenEffect,f:EffectFootprint,t:number,random:Random,front:boolean) {
  if(!refinedArcanaKinds.has(e.kind))return false;
  c.save();
  try{
    if(e.kind==='liquid-aegis') {c.save();c.globalAlpha*=.9;drawArcanaEffect(c,e,f,t,random,front,1);c.restore();}
    c.scale(f.plane.rx/80,f.plane.ry/80);
    if(e.kind==='liquid-aegis'||e.kind==='prismatic-barrier')membrane(c,t,e.color,front,e.kind==='prismatic-barrier');
    else if(e.kind==='aether-drops')for(let i=0;i<8;i++){const p=point(t,i,random);if((p.y>0)===front)droplet(c,t,i,random,e.color);}
    else if(e.kind==='constellation-breath')for(let i=0;i<26;i++){const a=i*2.4+fract(t*(.1+random(i+80)*.045)+random(i+2))*2.8+t*.13;if((Math.sin(a)>0)===front)constellation(c,t,i,random,e.color);}
    else if(e.kind==='discharge-matrix') {
      const nodes=Array.from({length:7},(_,i)=>{const a=i*tau/7+t*.12+.1*Math.sin(t*.6+i),r=92+Math.sin(t*.9+i*1.7)*6;return{x:Math.cos(a)*r,y:Math.sin(a)*r};});
      for(let i=0;i<7;i++) {
        const a=nodes[i],b=nodes[(i+1)%7];if(((a.y+b.y)>0)!==front)continue;
        const phase=t*2.7+i*.43,age=fract(phase),fade=Math.sin(age*Math.PI)**3;
        c.save();c.globalAlpha*=fade;texturedDischarge(c,a,b,random,Math.floor(phase)*137+i*49,e.color,.88);c.restore();
        glow(c,a.x,a.y,7,e.color,.45);c.fillStyle=tint(e.color,.9);c.beginPath();c.arc(a.x,a.y,1.3,0,tau);c.fill();
      }
    } else if(e.kind==='storm-lances')for(let i=0;i<3;i++) {
      const age=fract(t*.62+i/3),a=i*tau/3+t*.21;
      if((Math.sin(a)>0)!==front)continue;
      const r=29+age*69,start={x:Math.cos(a-.6)*34,y:Math.sin(a-.6)*34},tip={x:Math.cos(a)*r,y:Math.sin(a)*r};
      c.save();c.globalAlpha*=Math.sin(age*Math.PI)**.8;
      const fade=c.createLinearGradient(start.x,start.y,tip.x,tip.y);fade.addColorStop(0,alpha(e.color,0));fade.addColorStop(.85,alpha(e.color,.85));fade.addColorStop(1,'#e9faff');
      c.strokeStyle=fade;c.lineWidth=1.7;c.shadowColor=e.color;c.shadowBlur=6;c.beginPath();c.moveTo(start.x,start.y);c.quadraticCurveTo(Math.cos(a-.3)*65,Math.sin(a-.3)*65,tip.x,tip.y);c.stroke();c.shadowBlur=0;
      glow(c,tip.x,tip.y,8,e.color,.7);c.fillStyle='#e9faff';star(c,tip.x,tip.y,2.1);
      texturedDischarge(c,tip,{x:tip.x+Math.sin(t*13+i)*13,y:tip.y+Math.cos(t*11+i)*13},random,i*40+Math.floor(t*6)*100,e.color,.45);
      c.restore();
    }
  }finally{c.restore();}
  return true;
}
