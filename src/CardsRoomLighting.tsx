import {useEffect,useRef} from 'react';
import {cardTableScenes} from './card-table-projection';

// Subtle local light diffusion and dust supplement the painted light/shadows.
// Coordinates use the original scene and exactly the same center/cover crop.
const lights={
  wide:{candles:[{x:85,y:465,r:42},{x:1455,y:120,r:30}],dust:{x:625,y:300,rx:85,ry:170}},
  tall:{candles:[{x:56,y:741,r:42},{x:844,y:120,r:32}],dust:{x:355,y:510,rx:90,ry:200}},
};
export function CardsRoomLighting() {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const element=canvas.current,room=element?.closest<HTMLElement>('.cards-room');
    const context=element?.getContext('2d',{alpha:true});
    if(!element||!room||!context)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let width=0,height=0,scale=1,left=0,top=0,kind:'wide'|'tall'='wide',frame=0,last=0;
    const started=performance.now();
    const paint=(now:number)=>{
      context.clearRect(0,0,width,height);
      const time=reduced.matches?0:(now-started)/1000,profile=lights[kind];
      for(const [i,light] of profile.candles.entries()){
        const x=left+light.x*scale,y=top+light.y*scale;
        const shimmer=1+.06*Math.sin(time*3.1+i)+.025*Math.sin(time*7.7+i*2);
        const radius=light.r*scale*shimmer;
        const glow=context.createRadialGradient(x,y,0,x,y,radius);
        glow.addColorStop(0,`rgba(220,162,92,${.065*shimmer})`);
        glow.addColorStop(.28,`rgba(183,126,64,${.035*shimmer})`);
        glow.addColorStop(1,'rgba(166,116,62,0)');
        context.fillStyle=glow;context.fillRect(x-radius,y-radius,radius*2,radius*2);
      }
      if(reduced.matches)return;
      const zone=profile.dust;
      for(let i=0;i<28;i++){
        const phase=i*2.399963,radial=Math.sqrt((i+.5)/28);
        const x=zone.x+Math.cos(phase)*zone.rx*radial+Math.sin(time*.17+phase)*9;
        const y=zone.y+Math.sin(phase)*zone.ry*radial+Math.cos(time*.12+phase)*14;
        const alpha=(.08+.08*Math.sin(time*.35+phase)**2)*(1-radial*.5);
        context.fillStyle=`rgba(181,189,196,${alpha})`;
        context.beginPath();context.arc(left+x*scale,top+y*scale,(.55+i%3*.16)*scale,0,Math.PI*2);context.fill();
      }
    };
    const loop=(now:number)=>{
      if(document.hidden||reduced.matches){frame=0;return;}
      if(now-last>=33){paint(now);last=now;}
      frame=requestAnimationFrame(loop);
    };
    const update=()=>{
      if(frame)cancelAnimationFrame(frame);frame=0;
      width=room.clientWidth;height=room.clientHeight;kind=width<=900?'tall':'wide';
      const source=cardTableScenes[kind],ratio=Math.min(devicePixelRatio||1,2);
      element.width=Math.round(width*ratio);element.height=Math.round(height*ratio);
      context.setTransform(ratio,0,0,ratio,0,0);
      scale=Math.max(width/source.width,height/source.height);
      left=(width-source.width*scale)/2;top=(height-source.height*scale)/2;
      element.dataset.motion=reduced.matches?'still':'animated';
      paint(performance.now());
      if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(loop);
    };
    const observer=new ResizeObserver(update);observer.observe(room);
    reduced.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();
    return()=>{if(frame)cancelAnimationFrame(frame);observer.disconnect();reduced.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
  },[]);
  return <canvas ref={canvas} className="cards-room-lighting" aria-hidden="true"/>;
}
