export const houseResizeLabels = ['superior esquerdo','superior','superior direito','direito','inferior direito','inferior','inferior esquerdo','esquerdo'];
export function houseResizePoints(g:{x:number;y:number;width:number;height:number},rotation:number) {
  const positions=[[-.5,-1],[0,-1],[.5,-1],[.5,-.5],[.5,0],[0,0],[-.5,0],[-.5,-.5]];
  const a=rotation*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
  return positions.map(([x,y])=>({x:g.x+x*g.width*cos-y*g.height*sin,y:g.y+x*g.width*sin+y*g.height*cos}));
}
/** Uniform resizing preserves both the image proportions and its floor contact. */
export function houseResizeScale(scale:number,delta:{x:number;y:number},vector:{x:number;y:number},height:number) {
  const v=Math.hypot(vector.x,vector.y)<1?{x:0,y:Math.max(1,height*.5)}:vector;
  const factor=1+(delta.x*v.x+delta.y*v.y)/(v.x*v.x+v.y*v.y);
  return Math.max(.03,Math.min(.8,scale*factor));
}
