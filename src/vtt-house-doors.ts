import {houseAsset,houseWindowOpen} from '../shared/vtt-houses';
import type {VttScene,VttToken} from '../shared/vtt';

function drawHouseShutters(c:CanvasRenderingContext2D,h:VttToken,local:boolean) {
  const a=houseAsset(h)!;c.save();
  if(!local){c.translate(h.x,h.y);c.rotate(h.rotation*Math.PI/180);c.scale(h.flipX?-1:1,h.flipY?-1:1);}
  for(const [index,w] of a.windows.entries())if(!houseWindowOpen(h,index)) {
    c.save();c.translate((w.x-.5)*h.width,(w.y-.5)*h.height);c.rotate((w.facing-90)*Math.PI/180);
    const width=w.width*(Math.abs(Math.sin(w.facing*Math.PI/180))>.5?h.width:h.height),depth=Math.min(h.width,h.height)*.018;
    c.fillStyle='#4a3826';c.fillRect(-width/2,-depth/2,width,depth);c.strokeStyle='#201d18';c.lineWidth=Math.max(.8,depth*.12);c.strokeRect(-width/2,-depth/2,width,depth);
    c.beginPath();for(const x of [-.25,0,.25]){c.moveTo(x*width,-depth/2);c.lineTo(x*width,depth/2);}c.stroke();
    c.fillStyle='#a28d65';c.fillRect(-width*.12,-depth*.11,width*.24,depth*.22);c.restore();
  }c.restore();
}
type Motion={target:number;from:number;at:number};
const states=new WeakMap<object,{scene:string;doors:Map<string,Motion>}>();
const duration=380;
const progress=(v:Motion,now:number)=>{const p=Math.min(1,(now-v.at)/duration);return v.from+(v.target-v.from)*(1-(1-p)**3);};
export function houseDoorsAnimating(canvas:object,scene:string) {
  const cache=states.get(canvas);return cache?.scene===scene&&[...cache.doors.values()].some(v=>performance.now()-v.at<duration&&v.from!==v.target);
}
/** A door is a leaf in the same horizontal plane as the overhead walls. */
export function drawHouseDoor(c:CanvasRenderingContext2D,scene:VttScene,h:VttToken,reduced:boolean,images:Map<string,HTMLImageElement>,local=false) {
  const a=houseAsset(h);if(!a)return;
  drawHouseShutters(c,h,local);
  let cache=states.get(c.canvas);if(cache?.scene!==scene.id){cache={scene:scene.id,doors:new Map()};states.set(c.canvas,cache);}
  const target=h.houseDoorOpen?1:0,now=performance.now();let state=cache.doors.get(h.id);
  if(!state)state={target,from:target,at:now-duration};
  if(state.target!==target)state={target,from:progress(state,now),at:now};
  cache.doors.set(h.id,state);const amount=reduced?target:progress(state,now);
  const f=a.footprint,x=(f.doorStart-.5)*h.width,y=(f.bottom-.5)*h.height,w=(f.doorEnd-f.doorStart)*h.width;
  const thickness=Math.min(w*.095,Math.min(h.width,h.height)*.025),angle=amount*Math.PI*.5;
  c.save();if(!local){c.translate(h.x,h.y);c.rotate(h.rotation*Math.PI/180);c.scale(h.flipX?-1:1,h.flipY?-1:1);c.globalAlpha=h.hidden?scene.gmOpacity:1;}
  c.translate(x,y);c.rotate(angle);
  c.fillStyle='rgba(0,0,0,.32)';c.fillRect(-thickness*.12,-thickness*.32,w+thickness*.24,thickness);
  // The legacy URL stays the map key; the image loader resolves it to the new top-edge art.
  const leaf=images.get('/vtt/house-parts-20261014/door-vertical.webp');
  if(leaf?.complete&&leaf.naturalWidth)c.drawImage(leaf,0,-thickness/2,w,thickness);
  else {c.fillStyle='#795735';c.fillRect(0,-thickness/2,w,thickness);c.strokeStyle='#403426';c.lineWidth=thickness*.14;c.strokeRect(0,-thickness/2,w,thickness);}
  c.fillStyle='#302b23';c.beginPath();c.arc(thickness*.22,0,thickness*.22,0,Math.PI*2);c.fill();
  c.restore();
}
