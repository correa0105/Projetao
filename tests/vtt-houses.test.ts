import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newScene,newToken,blockingWalls,sceneSchema} from '../shared/vtt';
import {movementBlocked} from '../shared/vtt-movement';
import {houseAssets,houseWorld,houseOccupied,houseWalls,houseDoorObstructed,fitHouseToGrid,housePlacement,houseDoorPoint,housePointVisible,houseWindowViews} from '../shared/vtt-houses';
import {constrainMovement} from '../shared/vtt-movement';
for(const asset of houseAssets)test(asset.name+': paredes, entrada e telhado acompanham giro e escala',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene),actor=newToken(randomUUID(),scene);
  Object.assign(house,{layer:'map',image:asset.image,width:asset.width*70,height:asset.height*70,x:1000,y:1000});
  scene.tokens=[house,actor];
  for(const rotation of [0,45,90,180,-90])for(const flipX of [false,true])for(const flipY of [false,true]){
    Object.assign(house,{rotation,flipX,flipY});
    house.houseDoorOpen=false;
    assert(houseWalls(scene).length>=6);assert.equal(blockingWalls(scene,true).length,houseWalls(scene).length);
    const center=houseWorld({x:.5,y:.5},house),doorOutside=houseWorld({x:.5,y:.97},house),westOutside=houseWorld({x:.02,y:.5},house);
    assert.equal(movementBlocked(scene,doorOutside,center,actor),true);
    house.houseDoorOpen=true;
    assert.equal(blockingWalls(scene,true).length,houseWalls(scene).length-1);
    assert.equal(movementBlocked(scene,doorOutside,center,actor),false);
    assert.equal(movementBlocked(scene,westOutside,center,actor),true);
    const touching=houseWorld({x:asset.footprint.left+.04,y:.5},house);
    assert.equal(movementBlocked(scene,center,touching,actor),true,'body cannot enter wall');
    Object.assign(actor,houseWorld({x:.5,y:asset.footprint.bottom},house));
    assert.equal(houseDoorObstructed(house,[actor]),true);
    Object.assign(actor,doorOutside);assert.equal(houseOccupied(house,[actor]),false);
    Object.assign(actor,center);assert.equal(houseOccupied(house,[actor]),true);
    actor.hidden=true;assert.equal(houseOccupied(house,[actor]),false);actor.hidden=false;
  }
  const restored=sceneSchema.parse(JSON.parse(JSON.stringify(scene)));
  assert(houseWalls(restored).length>=6);
  assert.equal(restored.tokens[0].houseDoorOpen,true);
  scene.tokens=[];assert.equal(blockingWalls(scene,true).length,0);
});
test('fit old small house preserves occupant size and relative interior placement',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene),actor=newToken(randomUUID(),scene);
  Object.assign(house,{image:houseAssets[0].image,layer:'map',width:350,height:350,x:500,y:500});
  Object.assign(actor,{x:520,y:500});scene.tokens=[house,actor];fitHouseToGrid(house,scene);
  assert.equal(house.width,houseAssets[0].width*70);assert.equal(actor.width,70);assert.equal(actor.x,house.x+20*house.width/350);
  const oldX=actor.x;fitHouseToGrid(house,scene);assert.equal(house.width,houseAssets[0].width*70);assert.equal(actor.x,oldX);
});
test('entrances align to a cell and a normal actor can approach walls and enter from grid steps',()=>{
  const s=newScene(randomUUID());
  for(const a of houseAssets){const h=newToken(randomUUID(),s),actor=newToken(randomUUID(),s);Object.assign(h,{layer:'map',image:a.image,width:a.width*70,height:a.height*70,x:800,y:800,houseDoorOpen:true});Object.assign(h,housePlacement(h,s));s.tokens=[h,actor];
    const d=houseDoorPoint(h);assert(Math.abs((d.x-35)%70)<.001);assert(Math.abs(d.y%70)<.001);
    Object.assign(actor,{x:d.x,y:d.y+35});const next=constrainMovement(s,actor,{x:d.x,y:d.y-35});assert.equal(next.y,d.y-35,a.name);assert.equal(movementBlocked(s,actor,next,actor),false);
    const center=houseWorld({x:.5,y:.5},h);Object.assign(actor,center);const at=constrainMovement(s,actor,houseWorld({x:0,y:.5},h));assert(at.x<actor.x);assert.equal(movementBlocked(s,actor,at,actor),false);assert(at.x>houseWorld({x:a.footprint.left,y:.5},h).x);
  }
});
test('inside vision hides exterior until approaching a window, then reveals a cone',()=>{
  const s=newScene(randomUUID()),h=newToken(randomUUID(),s);Object.assign(h,{layer:'map',image:houseAssets[0].image,width:630,height:630,x:700,y:700});s.tokens=[h];
  const center=houseWorld({x:.5,y:.5},h),outside=houseWorld({x:.5,y:-.2},h),near=houseWorld({x:.5,y:.24},h);
  assert.equal(housePointVisible(center,outside,s),false);assert.equal(houseWindowViews(h,center,s).length,0);
  assert.equal(housePointVisible(center,houseDoorPoint(h),s),true);
  assert.equal(housePointVisible(near,outside,s),true);assert.equal(housePointVisible(near,houseWorld({x:-.2,y:.24},h),s),false);
});
test('casas antigas e imagens arbitrárias não ganham barreiras ou interiores',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene);
  Object.assign(house,{layer:'map',image:'/vtt/crypt.svg'});scene.tokens=[house];assert.deepEqual(houseWalls(scene),[]);
  house.image=houseAssets[0].image;house.layer='tokens';assert.deepEqual(houseWalls(scene),[]);
});
