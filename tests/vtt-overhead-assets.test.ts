import {test} from 'node:test';
import assert from 'node:assert/strict';
import{randomUUID}from'node:crypto';
import animals from '../shared/vtt-animal-catalog.json';
import commerce from '../shared/vtt-commerce-catalog.json';
import requests from '../data/vtt/overhead-prompts-20261015.json';
import{natureAssets,natureCategories}from'../shared/vtt-nature-assets';
import{createNatureToken}from'../shared/vtt-nature-placement';
import{residentAsset,houseViewActors}from'../shared/vtt-village-assets';
import{houseAssets,houseOccupied,houseWorld}from'../shared/vtt-houses';
import{vttVisualSource,vttVisualThumbnail}from'../shared/vtt-asset-visuals';
import{newScene,newToken,sceneSchema}from'../shared/vtt';
import{movementFacing}from'../shared/vtt-attachments';
import{drawHouseDoor}from'../src/vtt-house-doors';

test('40 distinct overhead animals and 40 furnished shops join the existing scene catalog',()=>{
 assert.equal(animals.length,40);assert.equal(commerce.length,40);assert.equal(houseAssets.length,90);
 assert(natureCategories.includes('Animais'));assert(natureCategories.includes('Comércios'));
 assert.equal(new Set(natureAssets.map(a=>a.id)).size,natureAssets.length);
 assert.equal(new Set(commerce.map(a=>a.width+'x'+a.height)).size>=10,true);
 for(const a of commerce){assert(houseAssets.some(h=>h.id===a.id));assert(a.interior.endsWith('-interior.webp'));assert.equal((a.footprint.doorEnd-a.footprint.doorStart)*a.width>1.2,true);}
});
test('stored legacy URLs resolve to overhead art while their scene identities and geometry remain stable',()=>{
 const s=newScene(randomUUID());
 assert.equal(requests.length,371);
 for(const r of requests)for(const old of r.legacy){assert.equal(vttVisualSource(old),'/'+r.public.replace(/^public\//,''));assert.equal(vttVisualThumbnail(old),'/'+r.thumbnail.replace(/^public\//,''));}
 const old=houseAssets[0],t=createNatureToken(randomUUID(),old.id,s,{x:500,y:500})!;s.tokens=[t];const saved=sceneSchema.parse(JSON.parse(JSON.stringify(s)));
 assert.equal(saved.tokens[0].image,old.image);assert.notEqual(vttVisualSource(old.image),old.image);
 assert.equal(vttVisualSource('/vtt/unknown-custom.webp'),'/vtt/unknown-custom.webp');
});
test('animal tokens retain full-body art, grid dimensions, movement facing and authorization after saving',()=>{
 const s=newScene(randomUUID());s.width=s.height=6000;
 for(const a of animals){const t=createNatureToken(randomUUID(),a.id,s,{x:1500,y:1500})!;
  assert.equal(t.layer,'tokens');assert.equal(t.width,a.width*s.grid.size);assert.equal(t.height,a.height*s.grid.size);assert.equal(residentAsset(t)?.bodyScale,a.bodyScale);assert(t.bleeds);
  assert.equal(movementFacing(t,{x:1500,y:1500},[{x:1500,y:1600}]),0);s.tokens=[t];assert.deepEqual(sceneSchema.parse(JSON.parse(JSON.stringify(s))).tokens[0],t);
  const h=newToken(randomUUID(),s),shop=commerce[0];Object.assign(h,{layer:'map',image:shop.image,width:shop.width*70,height:shop.height*70,x:1500,y:1500});Object.assign(t,houseWorld({x:.5,y:.5},h));
  assert.equal(houseOccupied(h,houseViewActors([t],true,'gm',[])),false);assert.equal(houseOccupied(h,houseViewActors([t],true,'gm',[t.id])),true);
  t.controller='owner';assert.equal(houseOccupied(h,houseViewActors([t],false,'owner',[])),true);assert.equal(houseOccupied(h,houseViewActors([t],false,'visitor',[])),false);
 }
});
test('every door lies on the wall in the horizontal plane, including rotated and flipped shops',()=>{
 const s=newScene(randomUUID());
 for(const a of houseAssets)for(const rotation of [0,90,180])for(const open of [false,true]){
  const h=newToken(randomUUID(),s);Object.assign(h,{layer:'map',image:a.image,width:a.width*70,height:a.height*70,x:1400,y:1400,rotation,flipX:true,houseDoorOpen:open});
  const calls:{type:string;args:number[]}[]=[],record=(type:string)=>(...args:number[])=>calls.push({type,args});
  const c:any={canvas:{},save(){},restore(){},translate:record('translate'),rotate:record('rotate'),scale:record('scale'),fillRect:record('fillRect'),strokeRect:record('strokeRect'),beginPath(){},arc(){},fill(){}};
  drawHouseDoor(c,s,h,true,new Map());
  const hinge=calls.filter(c=>c.type==='translate')[1].args;assert.equal(hinge[0],(a.footprint.doorStart-.5)*h.width);assert.equal(hinge[1],(a.footprint.bottom-.5)*h.height);
  assert.equal(calls.filter(c=>c.type==='rotate')[1].args[0],open?Math.PI/2:0);
  const leaf=calls.filter(c=>c.type==='fillRect')[1].args;assert.equal(leaf[2],(a.footprint.doorEnd-a.footprint.doorStart)*h.width);assert(leaf[3]<=leaf[2]*.1);
 }
});
