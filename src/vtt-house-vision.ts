import {houseAsset,houseContains,houseWindowViews,houseWorld} from '../shared/vtt-houses';
import {sightPolygon,type VttScene} from '../shared/vtt';
import {renderBuffer} from './vtt-render-cache';
import type {RenderOptions} from './vtt-canvas';
export function drawHouseVision(c:CanvasRenderingContext2D,scene:VttScene,o:RenderOptions) {
  const all=o.preview?(o.viewer?[o.viewer]:[]):o.gm?scene.tokens.filter(t=>t.layer==='tokens'&&o.selected.includes(t.id)):scene.tokens.filter(t=>t.layer==='tokens'&&t.controller===o.userId&&!t.hidden);
  const actors=all.filter(t=>scene.tokens.some(h=>houseAsset(h)&&houseContains(h,t)));
  if(!actors.length||actors.length!==all.length)return;
  const key=JSON.stringify([scene.id,c.canvas.width,c.canvas.height,o.camera,o.dpr,actors.map(a=>[a.x,a.y]),scene.tokens.filter(h=>houseAsset(h)).map(h=>[h.x,h.y,h.width,h.height,h.rotation,h.flipX,h.flipY,h.houseDoorOpen]),scene.walls]);
  const mask=renderBuffer(c.canvas,'house-vision',false);
  if(mask.dataset.visionKey===key){c.save();c.resetTransform();c.drawImage(mask,0,0);c.restore();return;}
  const m=mask.getContext('2d')!,zoom=o.camera.zoom*o.dpr;m.reset();
  m.fillStyle='#090d11';m.fillRect(0,0,mask.width,mask.height);m.setTransform(zoom,0,0,zoom,mask.width/2-o.camera.x*zoom,mask.height/2-o.camera.y*zoom);m.globalCompositeOperation='destination-out';
  const polygon=(points:{x:number;y:number}[])=>{m.beginPath();points.forEach((p,i)=>i?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y));m.closePath();m.fill();};
  for(const actor of actors){const h=scene.tokens.find(h=>houseAsset(h)&&houseContains(h,actor))!,f=houseAsset(h)!.footprint;
    polygon([{x:f.left-.035,y:f.top-.035},{x:f.right+.035,y:f.top-.035},{x:f.right+.035,y:f.bottom+.06},{x:f.left-.035,y:f.bottom+.06}].map(p=>houseWorld(p,h)));
    for(const v of houseWindowViews(h,actor,scene)){
      const a=v.facing*Math.PI/180,origin={x:v.origin.x+Math.cos(a)*3,y:v.origin.y+Math.sin(a)*3};
      polygon(sightPolygon(origin,v.radius,scene,v.facing,v.angle));
    }
  }
  mask.dataset.visionKey=key;c.save();c.resetTransform();c.drawImage(mask,0,0);c.restore();
}
