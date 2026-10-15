import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newScene,newToken,blockingWalls,sceneSchema} from '../shared/vtt';
import {movementBlocked} from '../shared/vtt-movement';
import {houseAssets,houseWorld,houseOccupied,houseWalls,houseDoorObstructed,fitHouseToGrid,housePlacement,houseDoorPoint,housePointVisible,houseWindowViews,houseWindowPolygon,houseRoofOccluded,visibleHouseDoors} from '../shared/vtt-houses';
import {constrainMovement} from '../shared/vtt-movement';
for(const asset of houseAssets)test(asset.name+': paredes, entrada e telhado acompanham giro e escala',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene),actor=newToken(randomUUID(),scene);
  Object.assign(house,{layer:'map',image:asset.image,width:asset.width*70,height:asset.height*70,x:1000,y:1000});
  scene.tokens=[house,actor];
  for(const rotation of [0,45,90,180,-90])for(const flipX of [false,true])for(const flipY of [false,true]){
    Object.assign(house,{rotation,flipX,flipY});
    house.houseDoorOpen=false;
    assert(houseWalls(scene).length>=6);assert.equal(blockingWalls(scene,true).length,houseWalls(scene).length);
    const center=houseWorld({x:.5,y:.5},house),doorOutside=houseWorld({x:(asset.footprint.doorStart+asset.footprint.doorEnd)/2,y:.97},house),westOutside=houseWorld({x:.02,y:.5},house);
    assert.equal(movementBlocked(scene,doorOutside,center,actor),true);
    house.houseDoorOpen=true;
    assert.equal(blockingWalls(scene,true).length,houseWalls(scene).length-1);
    assert.equal(movementBlocked(scene,doorOutside,houseWorld({x:(asset.footprint.doorStart+asset.footprint.doorEnd)/2,y:.6},house),actor),false);
    assert.equal(movementBlocked(scene,westOutside,center,actor),true);
    const touching=houseWorld({x:asset.footprint.left+1/house.width,y:.5},house);
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
  const oldX=actor.x;fitHouseToGrid(house,scene);assert.equal(house.width,houseAssets[0].width*70);assert(Math.abs(actor.x-oldX)<1e-7);
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
  const s=newScene(randomUUID()),h=newToken(randomUUID(),s),asset=houseAssets.find(a=>a.id==='house-012')!;Object.assign(h,{layer:'map',image:asset.image,width:630,height:630,x:700,y:700});s.tokens=[h];
  const center=houseWorld({x:.5,y:.5},h),outside=houseWorld({x:.3,y:-.2},h),near=houseWorld({x:.3,y:asset.footprint.top+.05},h);
  assert.equal(housePointVisible(center,outside,s),false);assert.equal(houseWindowViews(h,center,s).length,0);
  assert.equal(housePointVisible(center,houseDoorPoint(h),s),true);
  assert.equal(housePointVisible(near,outside,s),true);assert.equal(housePointVisible(near,houseWorld({x:-.2,y:.24},h),s),false);
});
test('windowless houses have no cones at furniture, chimney or the doorway, including rotation and flips',()=>{
  const s=newScene(randomUUID()),h=newToken(randomUUID(),s);s.tokens=[h];
  for(const a of houseAssets.filter(a=>a.windows.length===0))for(const rotation of [0,90,45])for(const flipX of [false,true]){
    Object.assign(h,{layer:'map',image:a.image,width:630,height:630,x:700,y:700,rotation,flipX});
    for(const p of [{x:.5,y:a.footprint.top+.04},{x:.29,y:a.footprint.bottom-.04},{x:.72,y:a.footprint.bottom-.04}]){
      const origin=houseWorld(p,h);assert.deepEqual(houseWindowViews(h,origin,s),[]);
      assert.equal(housePointVisible(origin,houseWorld({x:p.x,y:p.y<.5?-.2:1.2},h),s),false,a.id);
    }
    assert.equal(houseWalls(s).filter(w=>w.kind==='window').length,0);
  }
});
test('all audited windows split their own wall and widen only while approaching that opening',()=>{
  const s=newScene(randomUUID()),h=newToken(randomUUID(),s);s.tokens=[h];
  for(const a of houseAssets){Object.assign(h,{layer:'map',image:a.image,width:630,height:630,x:700,y:700,rotation:45,flipX:true});
    assert.equal(houseWalls(s).filter(w=>w.kind==='window').length,a.windows.length,a.id);
    for(const w of a.windows){const angle=w.facing*Math.PI/180;
      const near=houseWorld({x:w.x-Math.cos(angle)*.04,y:w.y-Math.sin(angle)*.04},h);
      const farther=houseWorld({x:w.x-Math.cos(angle)*.1,y:w.y-Math.sin(angle)*.1},h);
      const origin=houseWorld(w,h),views=houseWindowViews(h,near,s),v=views.find(v=>Math.hypot(v.origin.x-origin.x,v.origin.y-origin.y)<.001)!;
      const away=houseWindowViews(h,farther,s).find(v=>Math.hypot(v.origin.x-origin.x,v.origin.y-origin.y)<.001)!;
      assert(v&&away&&v.angle>away.angle,a.id);
    }
  }
});
test('casas antigas e imagens arbitrárias não ganham barreiras ou interiores',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene);
  Object.assign(house,{layer:'map',image:'/vtt/crypt.svg'});scene.tokens=[house];assert.deepEqual(houseWalls(scene),[]);
  house.image=houseAssets[0].image;house.layer='tokens';assert.deepEqual(houseWalls(scene),[]);
});

test('window view starts across the entire aperture, widens gradually and stops at exterior walls',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s),a=houseAssets.find(a=>a.id==='house-012')!;Object.assign(h,{layer:'map',image:a.image,width:630,height:630,x:1000,y:1000});s.tokens=[h];
 const w=a.windows[0],near=houseWorld({x:w.x,y:w.y+.04},h),far=houseWorld({x:w.x,y:w.y+.16},h),v=houseWindowViews(h,near,s)[0],f=houseWindowViews(h,far,s)[0];assert(v.angle>f.angle);assert(v.radius>f.radius);assert(v.opacity>=f.opacity);
 const poly=houseWindowPolygon(v,s),mouth=poly.filter(p=>Math.abs((p.x-v.aperture.x)*v.normal.x+(p.y-v.aperture.y)*v.normal.y)<.001);assert(mouth.length>=2);assert(Math.hypot(mouth[0].x-mouth[1].x,mouth[0].y-mouth[1].y)>=v.width*.98);
 const target={x:v.origin.x,y:v.origin.y-300};assert(housePointVisible(near,target,s));s.walls.push({id:randomUUID(),a:{x:v.origin.x-500,y:v.origin.y-150},b:{x:v.origin.x+500,y:v.origin.y-150},kind:'wall',open:false});assert(!housePointVisible(near,target,s));assert(houseWindowPolygon(v,s).every(p=>p.y>=v.origin.y-150-.001));
});
test('distant roofs stay opaque; overlap with the body or its grid cell reveals eaves',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s),actor=newToken(randomUUID(),s);Object.assign(h,{layer:'map',image:houseAssets[0].image,width:630,height:630,x:700,y:700});s.tokens=[h,actor];
 for(const rotation of [0,45,90])for(const flipX of [false,true]){Object.assign(h,{rotation,flipX});Object.assign(actor,houseWorld({x:.5,y:1.2},h));assert(!houseRoofOccluded(h,[actor],s));Object.assign(actor,houseWorld({x:.5,y:.90},h));assert(houseRoofOccluded(h,[actor],s));actor.hidden=true;assert(!houseRoofOccluded(h,[actor],s));actor.hidden=false;}
 Object.assign(h,{rotation:0,flipX:false});const roofEdge=houseWorld({x:.5,y:houseAssets[0].roofBounds.bottom},h);s.grid.offsetY=roofEdge.y-20;Object.assign(actor,{x:roofEdge.x,y:roofEdge.y+35});assert(houseRoofOccluded(h,[actor],s),'Same occupied grid cell');s.grid.type='hex-flat';assert(!houseRoofOccluded(h,[actor],s),'No body overlap');
});
test('inside a house only that house has an operable door icon',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s),other=newToken(randomUUID(),s),actor=newToken(randomUUID(),s);Object.assign(h,{layer:'map',image:houseAssets[0].image,width:630,height:630,x:700,y:700});Object.assign(other,{...h,id:other.id,x:1700});Object.assign(actor,houseWorld({x:.5,y:.75},h),{controller:'player'});s.tokens=[h,other,actor];assert.deepEqual(visibleHouseDoors(s,true,'gm',[actor.id]).map(t=>t.id),[h.id]);assert.deepEqual(visibleHouseDoors(s,false,'player',[]).map(t=>t.id),[h.id]);Object.assign(actor,{x:300,y:300});assert.equal(visibleHouseDoors(s,true,'gm',[actor.id]).length,2);
});
