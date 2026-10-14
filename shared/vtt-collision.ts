import type {Point,VttToken} from './vtt';
// The cell includes weapon/pose padding; collision follows the standing body.
export const tokenGroundRadius=(t:Pick<VttToken,'width'|'height'>)=>Math.min(t.width,t.height)*.22;
export function pointSegmentDistance(p:Point,a:Point,b:Point) {
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function segmentsCross(a:Point,b:Point,c:Point,d:Point) {
  const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
}
export function segmentDistance(a:Point,b:Point,c:Point,d:Point) {
  return segmentsCross(a,b,c,d)?0:Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
export type BarrierBox={left:number;right:number;top:number;bottom:number};
export const pointBoxDistance=(p:Point,r:BarrierBox)=>Math.hypot(Math.max(r.left-p.x,0,p.x-r.right),Math.max(r.top-p.y,0,p.y-r.bottom));
export function sweptCircleHitsBox(from:Point,to:Point,r:BarrierBox,radius:number) {
  const corners=[{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}];
  const before=pointBoxDistance(from,r),after=pointBoxDistance(to,r);
  // Legacy tokens overlapping a wall may retreat, but never cross through it.
  if(before<radius-.001&&after>before+.001) {
    const nearest={x:Math.max(r.left,Math.min(r.right,from.x)),y:Math.max(r.top,Math.min(r.bottom,from.y))};
    if(before>0&&(to.x-from.x)*(from.x-nearest.x)+(to.y-from.y)*(from.y-nearest.y)>=0)return false;
    if(before===0){const sides=[{d:from.x-r.left,exit:to.x<r.left},{d:r.right-from.x,exit:to.x>r.right},{d:from.y-r.top,exit:to.y<r.top},{d:r.bottom-from.y,exit:to.y>r.bottom}];const nearest=Math.min(...sides.map(s=>s.d));if(sides.some(s=>s.d<=nearest+.001&&s.exit))return false;}
  }
  return after<radius-.001||corners.some((p,i)=>segmentDistance(from,to,p,corners[(i+1)%4])<Math.max(radius-.001,.0001));
}
