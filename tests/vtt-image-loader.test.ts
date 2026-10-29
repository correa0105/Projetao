import test from 'node:test';
import assert from 'node:assert/strict';
import {createVttImageLoader} from '../src/vtt-image-loader';

test('a failed terrain image can recover on reconnection and repaint the saved scene',()=>{
 const Original=globalThis.Image;
 class FakeImage{naturalWidth=0;src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;}
 globalThis.Image=FakeImage as unknown as typeof Image;
 const images=new Map<string,HTMLImageElement>();let changes=0;
 const loader=createVttImageLoader(images,p=>p,()=>changes++,()=>assert.fail('should recover'));
 try{
  loader.load('/ground.webp');const first=images.get('/ground.webp')!;
  first.onerror!(new Event('error'));assert.equal(changes,1);
  loader.load('/ground.webp');assert.equal(images.get('/ground.webp'),first,'only one request may be pending');
  loader.retry();const second=images.get('/ground.webp')!;assert.notEqual(second,first);
  Object.defineProperty(second,'naturalWidth',{value:1024});second.onload!(new Event('load'));
  assert.equal(changes,2);loader.load('/ground.webp');assert.equal(images.get('/ground.webp'),second);
 }finally{loader.dispose();globalThis.Image=Original;}
});

test('disposing a scene image loader cancels retries and ignores late callbacks',()=>{
 const Original=globalThis.Image;
 class FakeImage{naturalWidth=0;src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;}
 globalThis.Image=FakeImage as unknown as typeof Image;
 const images=new Map<string,HTMLImageElement>();let changes=0;
 const loader=createVttImageLoader(images,p=>p,()=>changes++,()=>assert.fail('disposed'));
 try{loader.load('/ground.webp');const image=images.get('/ground.webp')!,late=image.onload!;
  image.onerror!(new Event('error'));loader.dispose();late.call(image,new Event('load'));
  loader.retry();loader.load('/other.webp');assert.equal(images.size,1);assert.equal(changes,1);
 }finally{loader.dispose();globalThis.Image=Original;}
});

test('using an object as a background reloads its original instead of reusing the small display copy',()=>{
 const Original=globalThis.Image;
 class FakeImage{naturalWidth=0;src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;}
 globalThis.Image=FakeImage as unknown as typeof Image;
 const images=new Map<string,HTMLImageElement>();let background=false;
 const loader=createVttImageLoader(images,p=>background?p+'?original=1':p+'?display=1',()=>{},()=>assert.fail('unexpected failure'));
 try{
  loader.load('/object.webp');const object=images.get('/object.webp')!;Object.defineProperty(object,'naturalWidth',{value:512});object.onload!(new Event('load'));
  assert(loader.ready('/object.webp'));background=true;assert(!loader.ready('/object.webp'));
  loader.load('/object.webp');const full=images.get('/object.webp')!;assert.notEqual(full,object);assert.equal(full.src,'/object.webp?original=1');
  Object.defineProperty(full,'naturalWidth',{value:2048});full.onload!(new Event('load'));assert(loader.ready('/object.webp'));
 }finally{loader.dispose();globalThis.Image=Original;}
});
