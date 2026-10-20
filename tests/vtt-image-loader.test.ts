import test from 'node:test';
import assert from 'node:assert/strict';
import {createVttImageLoader} from '../src/vtt-image-loader';

test('switching scenes releases old images and retries while preserving shared materials',()=>{
 const Original=globalThis.Image;
 class FakeImage{naturalWidth=0;src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;}
 globalThis.Image=FakeImage as unknown as typeof Image;
 const images=new Map<string,HTMLImageElement>();let changes=0;
 const loader=createVttImageLoader(images,p=>p,()=>changes++,()=>assert.fail('removed scene must not retry'));
 try{
  loader.load('/old.webp');loader.load('/shared.webp');
  const old=images.get('/old.webp')!,late=old.onload!,shared=images.get('/shared.webp')!;
  old.onerror!(new Event('error'));
  loader.retain(['/shared.webp','/new.webp']);loader.load('/new.webp');
  late.call(old,new Event('load'));
  assert.equal(images.has('/old.webp'),false);
  assert.equal(images.get('/shared.webp'),shared);
  assert.equal(images.has('/new.webp'),true);
  assert.equal(changes,1,'late scene response cannot invalidate the active canvas');
  loader.load('/old.webp');assert.notEqual(images.get('/old.webp'),old,'returning to a scene loads its original art again');
 }finally{loader.dispose();globalThis.Image=Original;}
});

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
