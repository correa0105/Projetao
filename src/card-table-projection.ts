export type TablePoint = {x:number;y:number};
type TableSize = {width:number;height:number};
export type TableKind = 'wide'|'tall';
export const cardTableCardSize = {width:170,height:243};
export const cardTableLayouts = {
  wide: {width:1400,height:490,matTop:90,matHeight:400,slotY:168.5,deckX:1120,deckY:50},
  tall: {width:1400,height:490,matTop:90,matHeight:400,slotY:168.5,deckX:1040,deckY:50},
} as const;
// Actual stitched mat corners, clockwise from the far-left corner, in native
// image pixels. The same 3.5:1 mat metric in both views avoids flattening cards
// by treating this shallow reading mat as an almost-square physical surface.
export const cardTableScenes = {
  wide: {width:1672,height:941,points:[{x:412.027,y:578.715},{x:1312.949,y:579.525},{x:1453.727,y:691.742},{x:259.318,y:690.716}]},
  tall: {width:1024,height:1536,points:[{x:280.359,y:800.120},{x:859.167,y:799.638},{x:969.786,y:975.598},{x:145.600,y:976.408}]},
} as const;

// Three persistent equipment positions share the desk's real projective plane.
export function cardTablePlacement(kind:TableKind,index:number) {
  return {x:405+210*index,y:cardTableLayouts[kind].slotY};
}
export function cardTableCardCorners(kind:TableKind,index:number) {
  const p=cardTablePlacement(kind,index);
  const {width:w,height:h}=cardTableCardSize;
  return [[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>({x:p.x+x,y:p.y+y}));
}
// CSS matrix3d is column-major; retain its homogeneous denominator.
export function cardTableMatrix(points:readonly TablePoint[],size:TableSize) {
  const [p0,p1,p2,p3]=points;
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
  const det=dx1*dy2-dx2*dy1;
  if(Math.abs(det)<1e-9)throw new Error('Plano da mesa inválido.');
  const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
  const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x;
  const d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y;
  const {width:w,height:t}=size;
  return [a/w,d/w,0,g/w,b/t,e/t,0,h/t,0,0,1,0,p0.x,p0.y,0,1];
}
export function projectTablePoint(matrix:readonly number[],x:number,y:number):TablePoint {
  const denominator=matrix[3]*x+matrix[7]*y+matrix[15];
  return {x:(matrix[0]*x+matrix[4]*y+matrix[12])/denominator,y:(matrix[1]*x+matrix[5]*y+matrix[13])/denominator};
}
export function cardTableNativeMatrix(kind:TableKind) {
  const scene=cardTableScenes[kind],size=cardTableLayouts[kind];
  const mat=cardTableMatrix(scene.points,{width:size.width,height:size.matHeight});
  // Include the wooden strip behind the mat so the host deck remains inside
  // the transformed element's hit-test area, without inventing a second plane.
  const points=[[0,-size.matTop],[size.width,-size.matTop],[size.width,size.matHeight],[0,size.matHeight]].map(([x,y])=>projectTablePoint(mat,x,y));
  return cardTableMatrix(points,size);
}
export function cardTableDeckCorners(kind:TableKind) {
  const size=cardTableLayouts[kind],card=cardTableCardSize;
  return [[-6,0],[card.width,0],[card.width,card.height+42],[-6,card.height+42]].map(([x,y])=>({x:size.deckX+x,y:size.deckY+y}));
}
export function cardTableProjection(width:number,height:number) {
  const kind:TableKind=width<=900?'tall':'wide',scene=cardTableScenes[kind],size=cardTableLayouts[kind];
  const scale=Math.max(width/scene.width,height/scene.height);
  const left=(width-scene.width*scale)/2,top=(height-scene.height*scale)/2;
  const native=cardTableNativeMatrix(kind);
  const {width:w,height:h}=size,margin=10;
  const full=cardTableMatrix([[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>{
    const p=projectTablePoint(native,x,y);return {x:p.x*scale+left,y:p.y*scale+top};
  }),size);
  const center={x:w/2,y:size.slotY+cardTableCardSize.height/2};
  const scaled=(point:TablePoint,factor:number)=>({x:center.x+(point.x-center.x)*factor,y:center.y+(point.y-center.y)*factor});
  const active=[...[0,1,2].flatMap(i=>cardTableCardCorners(kind,i)),...cardTableDeckCorners(kind)];
  const corners=(factor:number)=>{
    return [[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>{
      const p=scaled({x,y},factor);return projectTablePoint(full,p.x,p.y);
    });
  };
  // Crop the scenery freely; only shrink when an interactive piece would leave
  // the viewport. Fitting the whole mat needlessly shrank cards on small screens.
  const fits=(factor:number)=>active.every(point=>{
    const p=scaled(point,factor),v=projectTablePoint(full,p.x,p.y);
    return v.x>=margin&&v.x<=width-margin&&v.y>=margin&&v.y<=height-margin;
  });
  let factor=1;
  if(!fits(1)){
    let low=.1,high=1;
    for(let i=0;i<20;i++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
    factor=low;
  }
  const points=corners(factor),matrix=cardTableMatrix(points,size);
  const firstCardTop=Math.min(...active.map(p=>projectTablePoint(matrix,p.x,p.y).y));
  return {kind,size,points,matrix,css:`matrix3d(${matrix.join(',')})`,scale,left,top,factor,dialogueLimit:firstCardTop-18};
}
