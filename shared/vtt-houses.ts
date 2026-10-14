import catalog from './vtt-houses-catalog.json';
import type {Point,VttScene,VttToken,VttWall} from './vtt';
import {pointBoxDistance,sweptCircleHitsBox,tokenGroundRadius,type BarrierBox} from './vtt-collision';
import {snapPoint} from './vtt';
export const houseAssets=catalog;
const byImage=new Map(houseAssets.map(a=>[a.image,a]));
export const houseAsset=(token:VttToken)=>token.layer==='map'?byImage.get(token.image):undefined;
export function houseWorld(p:Point,t:VttToken):Point {
  const angle=t.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const x=(p.x-.5)*t.width*(t.flipX?-1:1),y=(p.y-.5)*t.height*(t.flipY?-1:1);
  return{x:t.x+x*c-y*s,y:t.y+x*s+y*c};
}
export function houseContains(house:VttToken,p:Point) {
  const a=houseAsset(house);if(!a)return false;
  const angle=-house.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),dx=p.x-house.x,dy=p.y-house.y;
  const x=(dx*c-dy*s)*(house.flipX?-1:1)/house.width+.5,y=(dx*s+dy*c)*(house.flipY?-1:1)/house.height+.5;
  return x>a.footprint.left&&x<a.footprint.right&&y>a.footprint.top&&y<a.footprint.bottom;
}
/** The roof is revealed from scene positions, so reload and undo recover the same view. */
export const houseOccupied=(house:VttToken,actors:VttToken[])=>actors.some(t=>t.layer==='tokens'&&!t.hidden&&houseContains(house,t));
export function houseWalls(scene:VttScene):VttWall[] {
  return scene.tokens.flatMap(house=>{
    const a=houseAsset(house);if(!a)return[];
    const f=a.footprint,lt={x:f.left,y:f.top},rt={x:f.right,y:f.top},lb={x:f.left,y:f.bottom},rb={x:f.right,y:f.bottom};
    const start={x:f.doorStart,y:f.bottom},end={x:f.doorEnd,y:f.bottom};
    const result:VttWall[]=[];
    for(const [i,[p,q]] of [[lt,rt],[rt,rb],[rb,end],[start,lb],[lb,lt],[start,end]].entries()){
      if(i===5){result.push({id:house.id+':house-wall:door',a:houseWorld(p,house),b:houseWorld(q,house),kind:'door',open:house.houseDoorOpen===true});continue;}
      const horizontal=p.y===q.y,lo=horizontal?Math.min(p.x,q.x):Math.min(p.y,q.y),hi=horizontal?Math.max(p.x,q.x):Math.max(p.y,q.y);
      const windows=a.windows.filter(w=>horizontal&&Math.abs(w.y-p.y)<.001&&w.x>lo&&w.x<hi).sort((a,b)=>a.x-b.x);
      let at=lo;
      const push=(from:number,to:number,kind:'wall'|'window')=>{if(to<=from)return;const point=(v:number)=>horizontal?{x:v,y:p.y}:{x:p.x,y:v};result.push({id:house.id+':house-wall:'+result.length,a:houseWorld(point(from),house),b:houseWorld(point(to),house),kind,open:false});};
      for(const w of windows){const left=Math.max(at,w.x-w.width/2),right=Math.min(hi,w.x+w.width/2);push(at,left,'wall');push(left,right,'window');at=right;}
      push(at,hi,'wall');
    }
    return result;
  });
}
export const houseInteriorImages=(scene:VttScene)=>scene.tokens.flatMap(t=>{const a=houseAsset(t);return a?[a.interior]:[];});
export const houseDoorPoint=(house:VttToken)=>{const f=houseAsset(house)!.footprint;return houseWorld({x:(f.doorStart+f.doorEnd)/2,y:f.bottom},house);};
export function housePlacement(h:VttToken,scene:VttScene,free=false):Point {
  if(free||!scene.grid.snap||scene.grid.type!=='square')return{x:h.x,y:h.y};
  const door=houseDoorPoint(h),grid=scene.grid,at=snapPoint(door,{...grid,offsetX:grid.offsetX+grid.size/2});
  return{x:h.x+at.x-door.x,y:h.y+at.y-door.y};
}
export function houseDoorwaySnap(scene:VttScene,actor:VttToken,to:Point):Point {
  if(!scene.grid.snap||scene.grid.type!=='square')return to;
  for(const h of scene.tokens){const a=houseAsset(h);if(!a||!h.houseDoorOpen)continue;
    const p=localPoint(h,to),from=localPoint(h,actor),f=a.footprint,b=(f.bottom-.5)*h.height,x=((f.doorStart+f.doorEnd)/2-.5)*h.width;
    if(Math.abs(p.y-b)>scene.grid.size*1.1||Math.abs(from.y-b)>scene.grid.size*2||Math.abs(p.x-x)>scene.grid.size*.6)continue;
    return houseWorld({x:x/h.width+.5,y:p.y/h.height+.5},h);
  }
  return to;
}
function localPoint(h:VttToken,p:Point):Point {
  const a=-h.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-h.x,y=p.y-h.y;
  return{x:(x*c-y*s)*(h.flipX?-1:1),y:(x*s+y*c)*(h.flipY?-1:1)};
}
export function houseBarrierBoxes(h:VttToken):BarrierBox[] {
  const a=houseAsset(h);if(!a)return[];
  const f=a.footprint,l=(f.left-.5)*h.width,r=(f.right-.5)*h.width,t=(f.top-.5)*h.height,b=(f.bottom-.5)*h.height,
    start=(f.doorStart-.5)*h.width,end=(f.doorEnd-.5)*h.width,half=Math.min(h.width,h.height)*.025;
  return [
    {left:l-half,right:r+half,top:t-half,bottom:t+half},
    {left:l-half,right:l+half,top:t,bottom:b},
    {left:r-half,right:r+half,top:t,bottom:b},
    {left:l-half,right:start,top:b-half,bottom:b+half},
    {left:end,right:r+half,top:b-half,bottom:b+half},
    ...(!h.houseDoorOpen?[{left:start,right:end,top:b-half,bottom:b+half}]:[]),
  ];
}
export function houseMovementBlocked(scene:VttScene,from:Point,to:Point,radius:number) {
  return scene.tokens.some(h=>houseAsset(h)&&houseBarrierBoxes(h).some(box=>sweptCircleHitsBox(localPoint(h,from),localPoint(h,to),box,radius)));
}
export function houseDoorObstructed(house:VttToken,actors:VttToken[]) {
  const box=houseBarrierBoxes({...house,houseDoorOpen:false}).at(-1)!;
  return actors.some(t=>t.layer==='tokens'&&pointBoxDistance(localPoint(house,t),box)<tokenGroundRadius(t));
}
export function canReachHouseDoor(house:VttToken,scene:VttScene,userId:string) {
  const p=houseDoorPoint(house);
  return !house.hidden&&scene.tokens.some(t=>t.layer==='tokens'&&t.controller===userId&&!t.locked&&!t.hidden&&Math.hypot(t.x-p.x,t.y-p.y)<=scene.grid.size*1.5+Math.min(t.width,t.height)/2);
}
/** New pieces are twice the old scale; existing layouts change only by explicit fit. */
export function fitHouseToGrid(house:VttToken,scene:VttScene) {
  const asset=houseAsset(house);if(!asset)return;
  const width=asset.width*scene.grid.size,height=asset.height*scene.grid.size,ratioX=width/house.width,ratioY=height/house.height;
  const before={...house};
  house.width=Math.min(8000,width);house.height=Math.min(8000,height);
  house.x=Math.max(house.width/2,house.x);house.y=Math.max(house.height/2,house.y);
  scene.width=Math.min(16000,Math.max(scene.width,house.x+house.width/2));scene.height=Math.min(16000,Math.max(scene.height,house.y+house.height/2));
  Object.assign(house,housePlacement(house,scene));
  for(const t of scene.tokens)if(t.layer==='tokens'&&houseContains(before,t)) {
    t.x=house.x+(t.x-before.x)*ratioX;t.y=house.y+(t.y-before.y)*ratioY;
    if(t.attachment){t.attachment.offsetX*=ratioX;t.attachment.offsetY*=ratioY;}
  }
}
export function houseWindowViews(house:VttToken,actor:Point,scene:VttScene) {
  const a=houseAsset(house);if(!a||!houseContains(house,actor))return[];
  return a.windows.flatMap(w=>{
    const origin=houseWorld(w,house),distance=Math.hypot(actor.x-origin.x,actor.y-origin.y),reach=scene.grid.size*1.5;
    if(distance>reach)return[];
    const direction=houseWorld({x:w.x+Math.cos(w.facing*Math.PI/180)*.1,y:w.y+Math.sin(w.facing*Math.PI/180)*.1},house),facing=Math.atan2(direction.y-origin.y,direction.x-origin.x)*180/Math.PI;
    return[{origin,facing,angle:35+(1-distance/reach)*55,radius:scene.grid.size*10}];
  });
}
export function housePointVisible(origin:Point,target:Point,scene:VttScene) {
  const room=scene.tokens.find(h=>houseAsset(h)&&houseContains(h,origin));if(!room||houseContains(room,target))return true;
  // Interior occupants can see the wall surface and operate the doorway itself.
  const p=localPoint(room,target),f=houseAsset(room)!.footprint,u=p.x/room.width+.5,v=p.y/room.height+.5;
  if(u>=f.left-.025&&u<=f.right+.025&&v>=f.top-.025&&v<=f.bottom+.025)return true;
  return houseWindowViews(room,origin,scene).some(v=>{
    const dx=target.x-v.origin.x,dy=target.y-v.origin.y,angle=Math.atan2(dy,dx)*180/Math.PI,difference=((angle-v.facing+540)%360)-180;
    return Math.hypot(dx,dy)<=v.radius&&Math.abs(difference)<=v.angle/2;
  });
}
