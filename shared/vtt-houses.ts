import catalog from './vtt-houses-catalog.json';
import commerce from './vtt-commerce-catalog.json';
import type {Point,VttScene,VttToken,VttWall} from './vtt';
import {pointBoxDistance,sweptCircleHitsBox,tokenGroundRadius,type BarrierBox} from './vtt-collision';
import {snapPoint,sightPolygon,blockingWalls,intersection} from './vtt';
export const houseAssets=[...catalog,...commerce];
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
      const coordinate=(w:Point)=>horizontal?w.x:w.y;
      const windows=a.windows.filter(w=>Math.abs((horizontal?w.y:w.x)-(horizontal?p.y:p.x))<.001&&coordinate(w)>lo&&coordinate(w)<hi).sort((a,b)=>coordinate(a)-coordinate(b));
      let at=lo;
      const push=(from:number,to:number,kind:'wall'|'window')=>{if(to<=from)return;const point=(v:number)=>horizontal?{x:v,y:p.y}:{x:p.x,y:v};result.push({id:house.id+':house-wall:'+result.length,a:houseWorld(point(from),house),b:houseWorld(point(to),house),kind,open:false});};
      for(const w of windows){const left=Math.max(at,coordinate(w)-w.width/2),right=Math.min(hi,coordinate(w)+w.width/2);push(at,left,'wall');push(left,right,houseWindowOpen(house,a.windows.indexOf(w))?'window':'wall');at=right;}
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
export const houseWindowOpen=(house:VttToken,index:number)=>!house.houseWindowsClosed?.includes(index);
export function canReachHouseWindow(house:VttToken,index:number,scene:VttScene,userId:string) {
  const w=houseAsset(house)?.windows[index];if(!w||house.hidden)return false;
  const p=houseWorld(w,house);
  return scene.tokens.some(t=>t.layer==='tokens'&&t.controller===userId&&!t.hidden&&!t.locked&&Math.hypot(t.x-p.x,t.y-p.y)<=scene.grid.size*1.5+Math.min(t.width,t.height)/2);
}
export function visibleHouseWindows(scene:VttScene,gm:boolean,userId:string,selected:string[]) {
  const actors=scene.tokens.filter(t=>t.layer==='tokens'&&!t.hidden&&(gm?selected.includes(t.id):t.controller===userId));
  return scene.tokens.filter(h=>houseAsset(h)&&!h.hidden).flatMap(h=>houseAsset(h)!.windows.flatMap((w,index)=>{
    const p=houseWorld(w,h),near=actors.some(t=>Math.hypot(t.x-p.x,t.y-p.y)<=scene.grid.size*2);
    return (gm?near:canReachHouseWindow(h,index,scene,userId))?[{house:h,index,point:houseWorld({x:w.viewX,y:w.viewY},h)}]:[];
  }));
}
export function houseWindowViews(house:VttToken,actor:Point,scene:VttScene) {
  const a=houseAsset(house);if(!a||!houseContains(house,actor))return[];
  return a.windows.flatMap((w,index)=>{
    if(!houseWindowOpen(house,index))return[];
    const origin=houseWorld(w,house),distance=Math.hypot(actor.x-origin.x,actor.y-origin.y),reach=scene.grid.size*2;
    if(distance>=reach)return[];
    const direction=houseWorld({x:w.x+Math.cos(w.facing*Math.PI/180)*.1,y:w.y+Math.sin(w.facing*Math.PI/180)*.1},house);
    const facing=Math.atan2(direction.y-origin.y,direction.x-origin.x)*180/Math.PI,normal={x:Math.cos(facing*Math.PI/180),y:Math.sin(facing*Math.PI/180)};
    // Anchor both edges at the native exterior sill, even when approaching from the side.
    const aperture=houseWorld({x:w.viewX,y:w.viewY},house),width=w.width*(Math.abs(Math.sin(w.facing*Math.PI/180))>.5?house.width:house.height);
    const progress=Math.max(0,1-distance/reach),proximity=progress*progress*(3-2*progress),fade=Math.min(1,progress/.35);
    const angle=24+116*proximity,depth=width/(2*Math.tan(angle*Math.PI/360));
    const eye={x:aperture.x-normal.x*depth,y:aperture.y-normal.y*depth};
    if(blockingWalls(scene).some(w=>!w.id.startsWith(house.id+':house-wall:')&&intersection(actor,origin,w.a,w.b)))return[];
    return[{houseId:house.id,index,origin,aperture,eye,normal,facing,beamFacing:facing,angle,width,radius:scene.grid.size*(8+8*proximity)+depth,opacity:fade*fade*(3-2*fade)}];
  });
}
/** Cast outside the window, never through the inner wall or from a displaced actor cone. */
export function houseWindowPolygon(view:ReturnType<typeof houseWindowViews>[number],scene:VttScene):Point[] {
  const outside={...scene,tokens:scene.tokens.filter(t=>t.id!==view.houseId)};
  const points=sightPolygon(view.eye,view.radius,outside,view.beamFacing,view.angle),output:Point[]=[];
  const side=(p:Point)=>(p.x-view.aperture.x)*view.normal.x+(p.y-view.aperture.y)*view.normal.y;
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length],a=side(p),b=side(q);
    if(a>=0)output.push(p);
    if((a>=0)!==(b>=0)){const t=a/(a-b);output.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
  }
  return output;
}
export function housePointVisible(origin:Point,target:Point,scene:VttScene) {
  const room=scene.tokens.find(h=>houseAsset(h)&&houseContains(h,origin));if(!room||houseContains(room,target))return true;
  const p=localPoint(room,target),f=houseAsset(room)!.footprint,u=p.x/room.width+.5,v=p.y/room.height+.5;
  if(u>=f.left-1e-8&&u<=f.right+1e-8&&v>=f.top-1e-8&&v<=f.bottom+1e-8)return true;
  return houseWindowViews(room,origin,scene).some(view=>{
    const dx=target.x-view.eye.x,dy=target.y-view.eye.y,angle=Math.atan2(dy,dx)*180/Math.PI,difference=((angle-view.beamFacing+540)%360)-180;
    return view.opacity>0&&Math.hypot(dx,dy)<=view.radius&&Math.abs(difference)<=view.angle/2+1e-6&&
      (target.x-view.aperture.x)*view.normal.x+(target.y-view.aperture.y)*view.normal.y>=-1e-6&&
      !blockingWalls(scene).some(w=>!w.id.startsWith(room.id+':house-wall:')&&intersection(view.eye,target,w.a,w.b));
  });
}
/** Fade only when the standing body or one of its occupied grid cells overlaps the roof. */
export function houseRoofOccluded(house:VttToken,actors:VttToken[],scene:VttScene) {
  const a=houseAsset(house);if(!a)return false;
  const b=a.roofBounds,box={left:(b.left-.5)*house.width,right:(b.right-.5)*house.width,top:(b.top-.5)*house.height,bottom:(b.bottom-.5)*house.height};
  const corners=[{x:b.left,y:b.top},{x:b.right,y:b.top},{x:b.right,y:b.bottom},{x:b.left,y:b.bottom}].map(p=>houseWorld(p,house));
  const angle=house.rotation*Math.PI/180,axes=[{x:1,y:0},{x:0,y:1},{x:Math.cos(angle),y:Math.sin(angle)},{x:-Math.sin(angle),y:Math.cos(angle)}];
  const intersects=(cell:Point[])=>axes.every(axis=>{const project=(p:Point)=>p.x*axis.x+p.y*axis.y,u=corners.map(project),v=cell.map(project);return Math.max(...u)>Math.min(...v)+.001&&Math.max(...v)>Math.min(...u)+.001;});
  return actors.some(actor=>{
    if(actor.layer!=='tokens'||actor.hidden)return false;
    const radius=tokenGroundRadius(actor),p=localPoint(house,actor),distance=pointBoxDistance(p,box);
    if(distance<=radius)return true;
    const g=scene.grid;if(g.type!=='square'||distance>radius+g.size*Math.SQRT2)return false;
    const minX=Math.floor((actor.x-radius-g.offsetX)/g.size),maxX=Math.floor((actor.x+radius-g.offsetX)/g.size),minY=Math.floor((actor.y-radius-g.offsetY)/g.size),maxY=Math.floor((actor.y+radius-g.offsetY)/g.size);
    for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
      const left=g.offsetX+x*g.size,top=g.offsetY+y*g.size;
      if(pointBoxDistance(actor,{left,right:left+g.size,top,bottom:top+g.size})>radius)continue;
      if(intersects([{x:left,y:top},{x:left+g.size,y:top},{x:left+g.size,y:top+g.size},{x:left,y:top+g.size}]))return true;
    }
    return false;
  });
}
export function visibleHouseDoors(scene:VttScene,gm:boolean,userId:string,selected:string[]) {
  const actors=scene.tokens.filter(t=>t.layer==='tokens'&&!t.hidden&&(gm?selected.includes(t.id):t.controller===userId)),houses=scene.tokens.filter(t=>houseAsset(t)&&!t.hidden);
  const occupied=houses.filter(h=>actors.some(t=>houseContains(h,t)));
  return (occupied.length?occupied:houses).filter(h=>gm||canReachHouseDoor(h,scene,userId));
}
