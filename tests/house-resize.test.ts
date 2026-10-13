import {test} from 'node:test';import assert from 'node:assert/strict';
import {houseResizePoints,houseResizeScale} from '../shared/house-resize';
test('House resize starts without a jump, keeps proportions, respects rotated handles and scale limits',()=>{
 const g={x:400,y:600,width:200,height:300};
 for(const rotation of [0,30,90,180]) {
  const handles=houseResizePoints(g,rotation);assert.equal(handles.length,8);
  for(const point of handles){const v={x:point.x-g.x,y:point.y-g.y};assert.equal(houseResizeScale(.2,{x:0,y:0},v,g.height),.2);}
  const point=handles[2],v={x:point.x-g.x,y:point.y-g.y};
  assert(Math.abs(houseResizeScale(.2,{x:v.x*.5,y:v.y*.5},v,g.height)-.3)<1e-9);
  assert(Math.abs(houseResizeScale(.2,{x:-v.x*.5,y:-v.y*.5},v,g.height)-.1)<1e-9);
 }
 assert.equal(houseResizeScale(.2,{x:1e5,y:-1e5},{x:100,y:-300},300),.8);
 assert.equal(houseResizeScale(.2,{x:-1e5,y:1e5},{x:100,y:-300},300),.03);
});
