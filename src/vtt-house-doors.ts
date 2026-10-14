import {houseAsset} from '../shared/vtt-houses';
import type {VttScene,VttToken} from '../shared/vtt';
type Motion={target:number;from:number;at:number};
const states=new WeakMap<object,{scene:string;doors:Map<string,Motion>}>();
const duration=380;
const progress=(v:Motion,now:number)=>{const p=Math.min(1,(now-v.at)/duration);return v.from+(v.target-v.from)*(1-(1-p)**3);};
export function houseDoorsAnimating(canvas:object,scene:string) {
  const cache=states.get(canvas);return cache?.scene===scene&&[...cache.doors.values()].some(v=>performance.now()-v.at<duration&&v.from!==v.target);
}
export function drawHouseDoor(c:CanvasRenderingContext2D,scene:VttScene,h:VttToken,reduced:boolean,images:Map<string,HTMLImageElement>) {
  const a=houseAsset(h);if(!a)return;
  let cache=states.get(c.canvas);if(cache?.scene!==scene.id){cache={scene:scene.id,doors:new Map()};states.set(c.canvas,cache);}
  const target=h.houseDoorOpen?1:0,now=performance.now();let state=cache.doors.get(h.id);
  if(!state)state={target,from:target,at:now-duration};
  if(state.target!==target)state={target,from:progress(state,now),at:now};
  cache.doors.set(h.id,state);const amount=reduced?target:progress(state,now);
  const f=a.footprint,x=(f.doorStart-.5)*h.width,y=(f.bottom-.5)*h.height,w=(f.doorEnd-f.doorStart)*h.width,thickness=Math.min(h.width,h.height)*.05;
  c.save();c.translate(h.x,h.y);c.rotate(h.rotation*Math.PI/180);c.scale(h.flipX?-1:1,h.flipY?-1:1);
  c.globalAlpha=h.hidden?scene.gmOpacity:1;
  // The existing art supplies the threshold and jambs. The leaf opens outward.
  c.translate(x,y);c.rotate(amount*Math.PI*.5);
  const leaf=images.get('/vtt/house-parts-20261014/door-oak.webp');
  if(leaf?.complete&&leaf.naturalWidth)c.drawImage(leaf,0,-thickness*.40,w,thickness*.80);
  else {c.fillStyle='#735335';c.fillRect(0,-thickness*.4,w,thickness*.8);}
  c.restore();
}
