import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {RotateCcw, Rotate3D} from 'lucide-react';
import type {Card} from '../shared/cards';
import {CardFace} from './Cards';
import {cardBacks} from './card-backs';
import {cardVisualLevel} from '../shared/card-presentation';
import {CardPrismaticFoil} from './CardPrismaticFoil';

export function CardViewer3D({card,level=1}:{card:Card;level?:number}) {
  const stage=useRef<HTMLDivElement>(null),model=useRef<HTMLDivElement>(null);
  const front=useRef<HTMLDivElement>(null),back=useRef<HTMLDivElement>(null);
  const rotation=useRef({x:0,y:0}),frame=useRef<number|null>(null);
  const light=useRef({x:0,y:0});
  const drag=useRef<{id:number;x:number;y:number;rx:number;ry:number;width:number;height:number}|null>(null);
  const [chromePreview,setChromePreview]=useState(false),[side,setSide]=useState('Frente');
  const chrome=cardVisualLevel(level)===3||chromePreview;
  function paint() {
    frame.current=null;
    model.current?.style.setProperty('--card-rotation-x',rotation.current.x+'deg');
    model.current?.style.setProperty('--card-rotation-y',rotation.current.y+'deg');
    // Pointer and tilt move the light independently of the continuous foil cycle.
    const tilt=Math.sin(rotation.current.y*Math.PI/180),pitch=Math.sin(rotation.current.x*Math.PI/180);
    model.current?.style.setProperty('--card-chrome-angle',(122+tilt*24+pitch*12)+'deg');
    model.current?.style.setProperty('--card-chrome-x',(48+tilt*32)+'%');
    model.current?.style.setProperty('--card-chrome-y',(46+pitch*30)+'%');
    model.current?.style.setProperty('--card-foil-x',(tilt*12+light.current.x*10)+'%');
    model.current?.style.setProperty('--card-foil-y',(pitch*10+light.current.y*8)+'%');
    model.current?.style.setProperty('--card-foil-light',String(.65+Math.abs(tilt)*.25+Math.abs(pitch)*.1));
    const reversed=Math.cos(rotation.current.y*Math.PI/180)<0;
    front.current?.setAttribute('aria-hidden',String(reversed));
    back.current?.setAttribute('aria-hidden',String(!reversed));
  }
  function queue() {if(frame.current===null)frame.current=requestAnimationFrame(paint);}
  function settle() {if(frame.current!==null)cancelAnimationFrame(frame.current);paint();setSide(Math.cos(rotation.current.y*Math.PI/180)<0?'Verso':'Frente');}
  function rotate(y:number,x=rotation.current.x) {
    rotation.current={x:Math.max(-30,Math.min(30,x)),y};queue();
  }
  function end(pointerId:number) {
    if(drag.current?.id!==pointerId)return;
    drag.current=null;
    if(stage.current)stage.current.dataset.dragging='false';
    if(stage.current?.hasPointerCapture(pointerId))stage.current.releasePointerCapture(pointerId);
    settle();
  }
  useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
  return <>
    <div ref={stage} className="card-viewer-stage" role="group" tabIndex={0}
      aria-label={'Girar '+card.name+' em 3D'} aria-describedby="card-viewer-help" data-dragging="false"
      onPointerDown={event=>{
        if(event.button!==0)return;
        event.preventDefault();event.currentTarget.focus({preventScroll:true});
        const rect=event.currentTarget.getBoundingClientRect();
        drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,rx:rotation.current.x,ry:rotation.current.y,width:rect.width,height:rect.height};
        event.currentTarget.dataset.dragging='true';event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event=>{
        const rect=event.currentTarget.getBoundingClientRect();
        light.current={x:(event.clientX-rect.left)/rect.width-.5,y:(event.clientY-rect.top)/rect.height-.5};
        const held=drag.current;if(!held||held.id!==event.pointerId){queue();return;}
        rotate(held.ry+(event.clientX-held.x)*360/held.width,held.rx-(event.clientY-held.y)*45/held.height);
      }}
      onPointerLeave={()=>{if(!drag.current){light.current={x:0,y:0};queue();}}}
      onPointerUp={event=>end(event.pointerId)} onPointerCancel={event=>end(event.pointerId)}
      onLostPointerCapture={event=>end(event.pointerId)}
      onKeyDown={event=>{
        const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Enter',' '];if(!keys.includes(event.key))return;
        event.preventDefault();
        if(event.key==='Home')rotate(0,0);
        else if(event.key==='ArrowLeft')rotate(rotation.current.y-15);
        else if(event.key==='ArrowRight')rotate(rotation.current.y+15);
        else if(event.key==='ArrowUp')rotate(rotation.current.y,rotation.current.x-5);
        else if(event.key==='ArrowDown')rotate(rotation.current.y,rotation.current.x+5);
        else rotate(rotation.current.y+180);
        setSide(Math.cos(rotation.current.y*Math.PI/180)<0?'Verso':'Frente');
      }}>
      <div ref={model} className="card-viewer-model" data-finish={chrome?'chrome':'original'}>
        <div ref={front} className="card-viewer-front" aria-hidden="false"><CardFace card={card} level={level} finish={chrome?'chrome':'original'}/></div>
        <div ref={back} className="card-viewer-back" role="img" aria-label={'Verso de '+card.name} aria-hidden="true" style={{backgroundImage:`url('${chrome?cardBacks.chrome:cardVisualLevel(level)===2?cardBacks.dark:cardBacks.original}')`} as CSSProperties}>{chrome&&<CardPrismaticFoil/>}</div>
        {[-1.5,-.5,.5,1.5].map(depth=><span key={depth} className="card-viewer-core" style={{transform:`translateZ(${depth}px)`}} aria-hidden="true"/>)}
      </div>
    </div>
    <div className="card-viewer-controls">
      <button type="button" onClick={()=>{rotate(rotation.current.y+180);setSide(side==='Frente'?'Verso':'Frente');}}><Rotate3D size={14}/>Virar</button>
      <button type="button" onClick={()=>{rotate(0,0);setSide('Frente');}}><RotateCcw size={14}/>Restaurar</button>
      {cardVisualLevel(level)<3&&<button type="button" aria-pressed={chromePreview} onClick={()=>setChromePreview(!chromePreview)}>Prévia prismática</button>}
    </div>
    <p className="card-viewer-help" id="card-viewer-help">Arraste para girar · Use as setas ou Home<span role="status">{side}{chrome?' · Prismática':''}</span></p>
  </>;
}
