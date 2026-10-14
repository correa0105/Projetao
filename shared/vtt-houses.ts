import catalog from './vtt-houses-catalog.json';
import type {Point,VttScene,VttToken,VttWall} from './vtt';
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
    return [[lt,rt],[rt,rb],[rb,end],[start,lb],[lb,lt],[start,end]].map(([p,q],i)=>({id:house.id+':house-wall:'+i,a:houseWorld(p,house),b:houseWorld(q,house),kind:i===5?'door' as const:'wall' as const,open:i===5}));
  });
}
export const houseInteriorImages=(scene:VttScene)=>scene.tokens.flatMap(t=>{const a=houseAsset(t);return a?[a.interior]:[];});
