export type TablePoint = {x:number;y:number};
type TableSize = {width:number;height:number};
export type TableKind = 'wide'|'tall';
export const cardTableCardSize = {width:170,height:243};
export const cardTableLayouts = {
  wide: {width:1200,height:760,slotY:338,deckX:990,deckY:65},
  tall: {width:1200,height:760,slotY:338,deckX:990,deckY:65},
} as const;
export const cardTableScenes = {
  wide: {width:1672,height:941,points:[{x:566.1038555827948,y:567.4542010251839},{x:1264.5616224648986,y:567.4542010251839},{x:1420,y:689},{x:316,y:689}]},
  tall: {width:1024,height:1536,points:[{x:304.9825378346915,y:782.4330616996508},{x:818.6321303841677,y:782.4330616996508},{x:930,y:970},{x:135,y:970}]},
} as const;

// Three persistent equipment positions share the desk's real projective plane.
export function cardTablePlacement(kind:TableKind,index:number) {
  return {x:305+210*index,y:cardTableLayouts[kind].slotY};
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
export function cardTableProjection(width:number,height:number) {
  const kind:TableKind=width<=900?'tall':'wide',scene=cardTableScenes[kind],size=cardTableLayouts[kind];
  const scale=Math.max(width/scene.width,height/scene.height);
  const left=(width-scene.width*scale)/2,top=(height-scene.height*scale)/2;
  const full=cardTableMatrix(scene.points.map(point=>({x:point.x*scale+left,y:point.y*scale+top})),size);
  const {width:w,height:h}=size,margin=10;
  const corners=(factor:number)=>{
    const x=w*(1-factor)/2,y=h*(1-factor)/2;
    return [[x,y],[w-x,y],[w-x,h-y],[x,h-y]].map(([a,b])=>projectTablePoint(full,a,b));
  };
  const fits=(factor:number)=>corners(factor).every(p=>p.x>=margin&&p.x<=width-margin&&p.y>=margin&&p.y<=height-margin);
  let factor=1;
  if(!fits(1)){
    let low=.1,high=1;
    for(let i=0;i<20;i++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
    factor=low;
  }
  const points=corners(factor),matrix=cardTableMatrix(points,size);
  return {kind,size,points,matrix,css:`matrix3d(${matrix.join(',')})`,scale,left,top,factor};
}
