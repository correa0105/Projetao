import type {VttToken} from '../shared/vtt';
import {houseAsset} from '../shared/vtt-houses';

const roofs=new WeakMap<HTMLImageElement,HTMLCanvasElement>();
/** Keep the entire roof aligned with the native floor; only its eaves are translucent. */
export function drawHouseRoof(c:CanvasRenderingContext2D,h:VttToken,roof:HTMLImageElement,floor:HTMLImageElement,fade=true,beneath?:()=>void,phase:'all'|'base'|'roof'='all') {
  if(!fade){if(phase!=='roof')beneath?.();if(phase!=='base')c.drawImage(roof,-h.width/2,-h.height/2,h.width,h.height);return;}
  let surface=roofs.get(roof);
  if(!surface){
    const f=houseAsset(h)!.footprint,w=roof.naturalWidth,height=roof.naturalHeight;
    surface=document.createElement('canvas');surface.width=w;surface.height=height;
    const r=surface.getContext('2d')!;r.drawImage(roof,0,0);
    const mask=document.createElement('canvas');mask.width=w;mask.height=height;
    const m=mask.getContext('2d')!;m.fillStyle='rgba(255,255,255,.32)';m.fillRect(0,0,w,height);
    m.fillStyle='#fff';m.shadowColor='#fff';m.shadowBlur=Math.min(w,height)*.022;
    m.fillRect((f.left+.025)*w,(f.top+.025)*height,(f.right-f.left-.05)*w,(f.bottom-f.top-.05)*height);
    // Chimneys belong to the exterior roof; an interior fireplace must never show through it.
    m.shadowBlur=0;m.fillRect(0,0,w,(f.top+.025)*height);
    r.globalCompositeOperation='destination-in';r.drawImage(mask,0,0);roofs.set(roof,surface);
  }
  const f=houseAsset(h)!.footprint;
  if(phase!=='roof'){
  // Reveal the front and side wall bases, not furniture or a second interior chimney.
  c.save();c.beginPath();
  c.rect((f.left-.065-.5)*h.width,(f.top-.5)*h.height,h.width*.105,(f.bottom-f.top+.07)*h.height);
  c.rect((f.right-.04-.5)*h.width,(f.top-.5)*h.height,h.width*.105,(f.bottom-f.top+.07)*h.height);
  c.rect(-h.width/2,(f.bottom-.05-.5)*h.height,h.width,h.height*.12);c.clip();
  c.drawImage(floor,-h.width/2,-h.height/2,h.width,h.height);c.restore();
  beneath?.();
  }
  if(phase!=='base')c.drawImage(surface,-h.width/2,-h.height/2,h.width,h.height);
}
