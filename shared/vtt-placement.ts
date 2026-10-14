import {snapPoint,type Point,type VttScene,type VttToken} from './vtt';
/** A token's top/left bounds align to square cells; hexes align by centre. */
export function tokenPlacement(p:Point,t:Pick<VttToken,'width'|'height'>,scene:VttScene,free=false):Point {
  const g=scene.grid,grid=g.type==='square'?{...g,offsetX:g.offsetX+t.width/2,offsetY:g.offsetY+t.height/2}:g;
  const at=free?p:snapPoint(p,grid);
  const axis=(n:number,size:number,limit:number,offset:number)=>{
    const half=Math.min(size/2,limit/2),min=half,max=limit-half;
    if(!free&&g.snap&&g.type==='square') {
      const first=Math.ceil((min-offset)/g.size)*g.size+offset,last=Math.floor((max-offset)/g.size)*g.size+offset;
      if(first<=last)return Math.max(first,Math.min(last,n));
    }
    return Math.max(min,Math.min(max,n));
  };
  return{x:axis(at.x,t.width,scene.width,grid.offsetX),y:axis(at.y,t.height,scene.height,grid.offsetY)};
}
