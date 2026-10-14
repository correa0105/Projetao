import {houseAsset,houseContains,houseWindowViews,houseWindowPolygon,houseWorld} from '../shared/vtt-houses';
import {type VttScene} from '../shared/vtt';
import {renderBuffer} from './vtt-render-cache';
import type {RenderOptions} from './vtt-canvas';
export function drawHouseVision(c:CanvasRenderingContext2D,scene:VttScene,o:RenderOptions) {
  const all=o.preview?(o.viewer?[o.viewer]:[]):o.gm?scene.tokens.filter(t=>t.layer==='tokens'&&o.selected.includes(t.id)):scene.tokens.filter(t=>t.layer==='tokens'&&t.controller===o.userId&&!t.hidden);
  const actors=all.filter(t=>scene.tokens.some(h=>houseAsset(h)&&houseContains(h,t)));
  if(!actors.length||actors.length!==all.length)return;
  const key=JSON.stringify([scene.id,c.canvas.width,c.canvas.height,o.camera,o.dpr,scene.grid,actors.map(a=>[a.x,a.y]),scene.tokens.filter(h=>houseAsset(h)).map(h=>[h.image,h.x,h.y,h.width,h.height,h.rotation,h.flipX,h.flipY,h.houseDoorOpen,o.images.get(houseAsset(h)!.interior)?.naturalWidth]),scene.walls]);
  const mask=renderBuffer(c.canvas,'house-vision',false);
  if(mask.dataset.visionKey===key){c.save();c.resetTransform();c.drawImage(mask,0,0);c.restore();return;}
  const m=mask.getContext('2d')!,zoom=o.camera.zoom*o.dpr;m.reset();
  m.fillStyle='#090d11';m.fillRect(0,0,mask.width,mask.height);m.setTransform(zoom,0,0,zoom,mask.width/2-o.camera.x*zoom,mask.height/2-o.camera.y*zoom);m.globalCompositeOperation='destination-out';
  const polygon=(points:{x:number;y:number}[])=>{m.beginPath();points.forEach((p,i)=>i?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y));m.closePath();m.fill();};
  for(const actor of actors){const h=scene.tokens.find(h=>houseAsset(h)&&houseContains(h,actor))!,f=houseAsset(h)!.footprint;
    const floor=o.images.get(houseAsset(h)!.interior);
    if(floor?.complete&&floor.naturalWidth){
      // The native alpha follows walls, bays and the threshold without exposing exterior grass.
      m.save();m.translate(h.x,h.y);m.rotate(h.rotation*Math.PI/180);m.scale(h.flipX?-1:1,h.flipY?-1:1);
      m.drawImage(floor,-h.width/2,-h.height/2,h.width,h.height);m.restore();
    }else polygon([{x:f.left,y:f.top},{x:f.right,y:f.top},{x:f.right,y:f.bottom},{x:f.left,y:f.bottom}].map(p=>houseWorld(p,h)));
    for(const v of houseWindowViews(h,actor,scene)){
      m.globalAlpha=v.opacity;polygon(houseWindowPolygon(v,scene));m.globalAlpha=1;
    }
  }
  mask.dataset.visionKey=key;c.save();c.resetTransform();c.drawImage(mask,0,0);c.restore();
}
