import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newScene,newToken,sceneSchema,lightSchema,sceneLights} from '../shared/vtt';
import {createNatureToken} from '../shared/vtt-nature-placement';
import {natureAssets} from '../shared/vtt-nature-assets';
import {lightPresets,lightPresetValues,lightAnimationState,sceneHasAnimatedLights} from '../shared/vtt-lighting';

test('single and double beds share a real length while the double is wider than the human square',()=>{
 const s=newScene(randomUUID()),single=createNatureToken(randomUUID(),'furniture-011',s,{x:500,y:500})!,double=createNatureToken(randomUUID(),'furniture-012',s,{x:700,y:500})!;
 assert.equal(single.height,double.height);assert(Math.abs(single.height/s.grid.size-1.4)<1e-10);
 assert(Math.abs(single.width/s.grid.size-.95/1.5)<1e-10);assert(Math.abs(double.width/s.grid.size-1.6/1.5)<1e-10);
 assert.equal(single.assetScaleVersion,2);assert(double.width>single.width*1.6);
 for(const id of ['furniture-001','furniture-068','garden-006','merchant-015'])assert(natureAssets.find(a=>a.id===id)!.width<1,id+' must fit beside a human');
});
test('only untouched legacy defaults are calibrated, exactly once, preserving custom furniture and actors',()=>{
 const s=newScene(randomUUID()),bed=newToken(randomUUID(),s),custom=newToken(randomUUID(),s),actor=newToken(randomUUID(),s);
 const image=natureAssets.find(a=>a.id==='furniture-011')!.image;
 Object.assign(bed,{layer:'map',image,x:500,y:600,width:s.grid.size,height:s.grid.size*2,rotation:90,notes:'Manter'});
 Object.assign(custom,{layer:'map',image,x:800,y:600,width:s.grid.size*1.5,height:s.grid.size*3});
 Object.assign(actor,{image,width:s.grid.size,height:s.grid.size*2});s.tokens=[bed,custom,actor];
 const parsed=sceneSchema.parse(s);assert(Math.abs(parsed.tokens[0].height-s.grid.size*1.4)<1e-10);
 assert.equal(parsed.tokens[0].x,bed.x);assert.equal(parsed.tokens[0].rotation,90);assert.equal(parsed.tokens[0].notes,'Manter');
 assert.equal(parsed.tokens[1].width,custom.width);assert.equal(parsed.tokens[1].height,custom.height);assert.deepEqual(parsed.tokens[2],actor);
 assert.deepEqual(sceneSchema.parse(JSON.parse(JSON.stringify(parsed))),parsed);
 parsed.tokens[0].width=s.grid.size;parsed.tokens[0].height=s.grid.size*2;assert.equal(sceneSchema.parse(parsed).tokens[0].height,s.grid.size*2,'A later manual edit must remain manual');
});
test('torch and other presets have configured ranges, units, colour and valid persistent animations',()=>{
 assert.equal(lightPresets.length,6);
 const torch=lightPresetValues('torch');assert.equal(torch.bright,20);assert.equal(torch.dim,20);assert.equal(torch.animation,'torch');assert.equal(torch.effectSpeed,1);
 assert.equal(lightPresetValues('torch','m').bright,6.1);
 const s=newScene(randomUUID());for(const preset of lightPresets)s.lights.push(lightSchema.parse({id:randomUUID(),x:400,y:500,...lightPresetValues(preset.id)}));
 assert.deepEqual(sceneSchema.parse(JSON.parse(JSON.stringify(s))).lights,s.lights);assert(sceneHasAnimatedLights(s));
 assert.throws(()=>lightSchema.parse({...s.lights[0],effectSpeed:0}));assert.throws(()=>lightSchema.parse({...s.lights[0],effectSpeed:9}));
 s.lights.forEach(l=>l.enabled=false);assert.equal(sceneHasAnimatedLights(s),false);
 const token=newToken(randomUUID(),s);token.light=20;token.lightAnimation='torch';token.lightEffectSpeed=2;s.tokens=[token];assert.equal(sceneLights(s)[0].effectSpeed,2);assert(sceneHasAnimatedLights(s));
});
test('light animations are continuous, repeatable, speed-scaled and freeze for reduced motion',()=>{
 for(const animation of ['torch','campfire','candle','pulse','arcane'] as const){
 const source={id:'same-light',animation,effectSpeed:1};const a=lightAnimationState(source,250),b=lightAnimationState(source,1250);
 assert.notDeepEqual(a,b);assert.deepEqual(lightAnimationState({...source,effectSpeed:2},500),lightAnimationState(source,1000));
 assert.deepEqual(lightAnimationState(source,9000,true),{intensity:1,core:1,warmth:0});
 for(let t=0;t<2000;t+=30){const state=lightAnimationState(source,t);assert(state.intensity>.7&&state.intensity<=1);assert(state.core>.8&&state.core<=1.02);}
 }
});
