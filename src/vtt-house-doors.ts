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
  const f=a.footprint,x=(f.doorStart-.5)*h.width,y=(a.doorVisual.baseY-.5)*h.height,w=(f.doorEnd-f.doorStart)*h.width,height=a.doorVisual.height*h.height;
  const angle=amount*Math.PI*.5,dx=Math.cos(angle)*w,dy=Math.sin(angle)*w,thickness=Math.min(h.width,h.height)*.004;
  c.save();c.translate(h.x,h.y);c.rotate(h.rotation*Math.PI/180);c.scale(h.flipX?-1:1,h.flipY?-1:1);c.globalAlpha=h.hidden?scene.gmOpacity:1;
  c.save();c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=thickness*2;c.lineCap='round';c.beginPath();c.moveTo(x,y+thickness);c.lineTo(x+dx,y+dy+thickness);c.stroke();c.restore();
  // A vertical face keeps its bottom on the threshold while the hinge turns on the ground plane.
  c.save();c.transform(Math.cos(angle),Math.sin(angle),0,1,x,y-height);
  const leaf=images.get('/vtt/house-parts-20261014/door-vertical.webp');
  if(leaf?.complete&&leaf.naturalWidth)c.drawImage(leaf,0,0,w,height);else{c.fillStyle='#745333';c.fillRect(0,0,w,height);}
  c.restore();
  const nx=-Math.sin(angle)*thickness,ny=Math.cos(angle)*thickness;
  c.fillStyle='#594029';c.beginPath();c.moveTo(x,y-height);c.lineTo(x+dx,y+dy-height);c.lineTo(x+dx+nx,y+dy-height+ny);c.lineTo(x+nx,y-height+ny);c.closePath();c.fill();
  c.fillStyle='#32271c';c.beginPath();c.moveTo(x+dx,y+dy-height);c.lineTo(x+dx+nx,y+dy-height+ny);c.lineTo(x+dx+nx,y+dy+ny);c.lineTo(x+dx,y+dy);c.closePath();c.fill();
  c.fillStyle='#24231e';c.fillRect(x-thickness*.45,y-height,thickness*.9,height);c.restore();
}
