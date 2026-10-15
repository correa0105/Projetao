import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {newScene,newToken,sceneSchema,visiblePoint} from '../shared/vtt';
import {houseAssets,houseWorld,houseWindowViews,houseWindowPolygon,housePointVisible,houseWindowOpen,canReachHouseWindow} from '../shared/vtt-houses';
import {HouseCueTracker,houseCuePath} from '../shared/vtt-house-cues';
test('all windows anchor their full aperture when approached sideways, including flipped and rotated houses',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s);s.tokens=[h];let checked=0;
 for(const a of houseAssets)for(const rotation of [0,45,90,180])for(const flipX of [false,true])for(const flipY of [false,true]){
  Object.assign(h,{layer:'map',image:a.image,width:a.width*70,height:a.height*70,x:4000,y:4000,rotation,flipX,flipY});
  for(const [index,w] of a.windows.entries())for(const side of [-.07,.07]){
   const angle=w.facing*Math.PI/180,p=houseWorld({x:w.x-Math.cos(angle)*.06-Math.sin(angle)*side,y:w.y-Math.sin(angle)*.06+Math.cos(angle)*side},h);
   const view=houseWindowViews(h,p,s).find(v=>v.index===index);if(!view)continue;
   const points=houseWindowPolygon(view,s),mouth=points.filter(p=>Math.abs((p.x-view.aperture.x)*view.normal.x+(p.y-view.aperture.y)*view.normal.y)<.001);
   assert(mouth.length>=2,a.id);assert(Math.abs(Math.hypot(mouth[0].x-mouth[1].x,mouth[0].y-mouth[1].y)-view.width)<.01,a.id);
   const out={x:view.aperture.x+view.normal.x*100,y:view.aperture.y+view.normal.y*100};assert(housePointVisible(p,out,s));assert(visiblePoint(p,out,s,1000));checked++;
  }
 }assert(checked>100);
});
test('closing a window persists, hides the exterior and never opens a walking passage',()=>{
 const s=newScene(randomUUID()),h=newToken(randomUUID(),s),actor=newToken(randomUUID(),s),a=houseAssets.find(a=>a.windows.length)!;Object.assign(h,{layer:'map',image:a.image,width:630,height:630,x:700,y:700});s.tokens=[h,actor];const w=a.windows[0],r=w.facing*Math.PI/180;
 Object.assign(actor,houseWorld({x:w.x-Math.cos(r)*.06,y:w.y-Math.sin(r)*.06},h),{controller:'player'});assert(canReachHouseWindow(h,0,s,'player'));assert(!canReachHouseWindow(h,0,s,'other'));
 assert(houseWindowOpen(h,0));h.houseWindowsClosed=[0];assert(!houseWindowOpen(h,0));assert.equal(houseWindowViews(h,actor,s).filter(v=>v.index===0).length,0);assert.deepEqual(sceneSchema.parse(JSON.parse(JSON.stringify(s))).tokens[0].houseWindowsClosed,[0]);
 const out=houseWorld({x:w.x+Math.cos(r)*.3,y:w.y+Math.sin(r)*.3},h);assert(!housePointVisible(actor,out,s));
});
test('house cues play once after live changes; initial state, reload, scene changes and old history stay silent',()=>{
 const s=newScene(randomUUID()),tracker=new HouseCueTracker(),now=Date.now(),cue=(kind:any,at=now)=>({id:randomUUID(),houseId:randomUUID(),kind,at});s.houseCues=[cue('door-open')];assert.deepEqual(tracker.consume('room',s,now),[]);
 s.houseCues.push(cue('window-close'));assert.equal(tracker.consume('room',s,now)[0].kind,'window-close');assert.deepEqual(tracker.consume('room',s,now),[]);assert.deepEqual(new HouseCueTracker().consume('room',s,now),[]);
 s.houseCues.push(cue('door-close',now-11000));assert.deepEqual(tracker.consume('room',s,now),[]);assert.deepEqual(tracker.consume('other',s,now),[]);
 assert.equal(new Set(['door-open','door-close','window-open','window-close'].map(k=>houseCuePath(k as any))).size,4);
});
