import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newScene,newToken,sceneSchema} from '../shared/vtt';
import {createNatureToken} from '../shared/vtt-nature-placement';
import {villageAssets,residentAsset,houseViewActors} from '../shared/vtt-village-assets';
import {houseAssets,houseOccupied,houseWorld} from '../shared/vtt-houses';
import {movementFacing} from '../shared/vtt-attachments';
import {movementBlocked} from '../shared/vtt-movement';
test('75 distinct village assets preserve natural grid dimensions and token behavior after saving',()=>{
 const s=newScene(randomUUID());s.width=s.height=6000;
 assert.equal(villageAssets.length,75);assert.equal(new Set(villageAssets.map(a=>a.image)).size,75);
 for(const a of villageAssets){const t=createNatureToken(randomUUID(),a.id,s,{x:1015,y:1115})!;s.tokens=[t];
  assert.equal(t.width,a.width*s.grid.size);assert.equal(t.height,a.height*s.grid.size);
  assert.equal((t.x-t.width/2-s.grid.offsetX)%s.grid.size,0);assert.equal((t.y-t.height/2-s.grid.offsetY)%s.grid.size,0);
  const actor='actor' in a&&a.actor;assert.equal(t.layer,actor?'tokens':'map');assert.equal(t.bleeds,!!actor);assert.equal(t.vision,actor?60:0);assert.equal(!!residentAsset(t),!!actor);
  assert.deepEqual(sceneSchema.parse(JSON.parse(JSON.stringify(s))).tokens[0],t);
 }
});
test('scaled placement remains within a small map and rejects invalid payloads',()=>{
 const s=newScene(randomUUID());s.width=s.height=350;
 for(const a of villageAssets)for(const scale of [.5,1,2,3]){const t=createNatureToken(randomUUID(),a.id,s,{x:-100,y:900},scale)!;
  assert(t.x>=t.width/2&&t.x<=s.width-t.width/2);assert(t.y>=t.height/2&&t.y<=s.height-t.height/2);
 }
 for(const scale of [NaN,Infinity,-1,0,.1,4])assert.equal(createNatureToken(randomUUID(),'resident-001',s,{x:10,y:10},scale),null);
 assert.equal(createNatureToken(randomUUID(),'invalid',s,{x:10,y:10}),null);
});
test('idle residents keep their house covered; only an authorized viewpoint reveals it',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s),r=createNatureToken(randomUUID(),'resident-001',s,{x:500,y:500})!;
 Object.assign(h,{layer:'map',image:houseAssets[0].image,width:houseAssets[0].width*70,height:houseAssets[0].height*70,x:500,y:500});Object.assign(r,houseWorld({x:.5,y:.5},h));
 assert.equal(houseOccupied(h,houseViewActors([r],true,'gm',[])),false);
 assert.equal(houseOccupied(h,houseViewActors([r],true,'gm',[r.id])),true);
 assert.equal(houseOccupied(h,houseViewActors([r],false,'player',[r.id])),false);
 r.controller='player';assert.equal(houseOccupied(h,houseViewActors([r],false,'player',[])),true);
 assert.equal(houseOccupied(h,houseViewActors([r],false,'other',[])),false);
 assert.equal(houseOccupied(h,houseViewActors([r],false,'',[],r.id)),true);
 const old=newToken(randomUUID(),s);Object.assign(old,houseWorld({x:.5,y:.5},h));assert.equal(houseOccupied(h,houseViewActors([old],true,'gm',[])),true);
});
test('all resident bodies face the final travel leg and honor vertical flips',()=>{
 const s=newScene(randomUUID());for(const a of villageAssets.filter(a=>a.category==='Moradores')){const r=createNatureToken(randomUUID(),a.id,s,{x:100,y:100})!;
  for(const [end,rotation] of [[{x:150,y:100},270],[{x:100,y:150},0],[{x:50,y:100},90],[{x:100,y:50},180]] as const)assert.equal(movementFacing(r,{x:100,y:100},[end]),rotation);
  assert.equal(movementFacing(r,{x:50,y:50},[{x:100,y:50},{x:100,y:100}]),0);r.flipY=true;assert.equal(movementFacing(r,{x:100,y:100},[{x:100,y:150}]),180);
 }
});
test('a resident of one grid cell passes an open doorway and cannot cross house walls',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s),r=createNatureToken(randomUUID(),'resident-001',s,{x:500,y:500})!;
 const a=houseAssets[0];Object.assign(h,{layer:'map',image:a.image,width:a.width*70,height:a.height*70,x:500,y:500,houseDoorOpen:true});s.tokens=[h,r];
 const outside=houseWorld({x:(a.footprint.doorStart+a.footprint.doorEnd)/2,y:.98},h),inside=houseWorld({x:(a.footprint.doorStart+a.footprint.doorEnd)/2,y:.6},h);
 assert.equal(movementBlocked(s,outside,inside,r),false);h.houseDoorOpen=false;assert.equal(movementBlocked(s,outside,inside,r),true);
 assert.equal(movementBlocked(s,houseWorld({x:.02,y:.5},h),houseWorld({x:.5,y:.5},h),r),true);
});
