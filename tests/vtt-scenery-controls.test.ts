import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {newScene,newToken} from '../shared/vtt';import {tokenPlacement} from '../shared/vtt-placement';import {treeAssets} from '../shared/vtt-tree-assets';
import {treeTrunk} from '../shared/vtt-tree-trunks';import {movementBlocked} from '../shared/vtt-movement';import {rotationFromDrag,tokenRotationHandle,tokenRotationHandleAt} from '../shared/vtt-token-resize';
test('square placement aligns bounds, offsets, edges, free placement and hex centres',()=>{
  const s=newScene(randomUUID());s.grid.offsetX=17;s.grid.offsetY=-23;
  for(const size of [35,70,140,350,700])for(const p of [{x:452,y:365},{x:0,y:0},{x:15999,y:15999}]){
    const t={width:size,height:size},at=tokenPlacement(p,t,s);
    assert(Math.abs((at.x-size/2-s.grid.offsetX)%70)<.0001);assert(Math.abs((at.y-size/2-s.grid.offsetY)%70)<.0001);
    assert(at.x>=size/2&&at.x<=s.width-size/2);assert.deepEqual(tokenPlacement(at,t,s),at);
  }
  s.grid.snap=false;assert.deepEqual(tokenPlacement({x:123,y:456},{width:70,height:70},s),{x:123,y:456});
  s.grid.snap=true;assert.deepEqual(tokenPlacement({x:123,y:456},{width:70,height:70},s,true),{x:123,y:456});
  s.grid.type='hex-flat';assert.deepEqual(tokenPlacement({x:300,y:300},{width:70,height:70},s),tokenPlacement({x:300,y:300},{width:140,height:140},s));
});
test('tree trunks block body and swept movement but allow walking beneath the canopy',()=>{
  const s=newScene(randomUUID()),tree=newToken(randomUUID(),s),actor=newToken(randomUUID(),s);s.tokens=[tree,actor];
  for(const a of treeAssets)for(const rotation of [0,45,90])for(const flipX of [false,true]){
    Object.assign(tree,{layer:'map',image:a.image,width:420,height:420,x:700,y:700,rotation,flipX});
    const trunk=treeTrunk(tree)!;const left={x:trunk.x-150,y:trunk.y},right={x:trunk.x+150,y:trunk.y};
    assert.equal(movementBlocked(s,left,right,actor),true,a.id);
    assert.equal(movementBlocked(s,left,{x:trunk.x-trunk.radius-8,y:trunk.y},actor),true,a.id);
    assert.equal(movementBlocked(s,{x:left.x,y:left.y-100},{x:right.x,y:right.y-100},actor),false,a.id);
    assert.equal(movementBlocked(s,trunk,left,actor),false,'old overlap can escape');
  }
  tree.layer='tokens';assert.equal(treeTrunk(tree),null);
});
test('rotation handle follows zoom and rotation; Shift snaps to 15 degrees',()=>{
  const t={x:400,y:300,width:200,height:100,rotation:0};
  for(const zoom of [.2,1,3]){const h=tokenRotationHandle(t,zoom);assert.equal(tokenRotationHandleAt(t,h,zoom),true);assert.equal(rotationFromDrag(t,h,{x:500,y:300}),90);}
  assert.equal(rotationFromDrag(t,{x:400,y:200},{x:450,y:230},true)%15,0);
});
