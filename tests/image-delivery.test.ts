import {test} from 'node:test';import assert from 'node:assert/strict';
import express from 'express';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,dirname,resolve,basename} from 'node:path';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {optimizedPublicImages} from '../server/optimized-public-images';
import {sendImagePreview} from '../server/image-preview';
import {staticAssetCacheControl} from '../server/static-asset-cache';
import {imageDeliverySide} from '../shared/image-delivery-policy';

test('pranchas de corda e projéteis conservam o espaço de pixels dos recortes',()=>{
 assert.equal(imageDeliverySide('/vtt/siege-materials-20261027/projectiles-v1.png'),null);
 assert.equal(imageDeliverySide('/vtt/siege-materials-20261029/rope-v2.png'),null);
});

async function fixture(){const raw=Buffer.alloc(512*512*4);let seed=17;for(let p=0;p<512*512;p++){for(let c=0;c<3;c++){seed=(seed*1664525+1013904223)>>>0;raw[p*4+c]=seed>>>24;}raw[p*4+3]=(p%512<24||Math.floor(p/512)<24)?0:255;}return sharp(raw,{raw:{width:512,height:512,channels:4}}).png().toBuffer();}
test('entrega leve negocia WebP, mantém originais/backgrounds, geometria, alfa e cache por formato',async()=>{
 const root=await mkdtemp(join(tmpdir(),'alvorada-image-delivery-')),original=await fixture(),webp=await sharp(original).webp({quality:84,alphaQuality:100}).toBuffer();
 const file='/optimized-images-20261028/'+createHash('sha256').update(webp).digest('hex')+'.webp';
 await mkdir(join(root,'optimized-images-20261028'));await mkdir(join(root,'icons-20261028'));
 await writeFile(join(root,file),webp);await writeFile(join(root,'icons-20261028/medal.png'),original);await writeFile(join(root,'character-camp-v2.png'),original);
 await writeFile(join(root,'optimized-images-20261028/manifest.json'),JSON.stringify({images:{'/icons-20261028/medal.png':{file},'/character-camp-v2.png':{file}}}));
 const app=express();app.use(optimizedPublicImages(root));app.use(express.static(root,{setHeaders(res,p){const cache=staticAssetCacheControl(root,p);if(cache)res.setHeader('Cache-Control',cache);}}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as {port:number}).port;
 try{
  const response=await fetch(url+'/icons-20261028/medal.png',{headers:{Accept:'image/webp,image/*'}}),bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(response.headers.get('content-type'),'image/webp');assert.match(response.headers.get('vary')!,/Accept/);assert.match(response.headers.get('cache-control')!,/immutable/);assert(bytes.length<original.length);assert.deepEqual(bytes,webp);
  const meta=await sharp(bytes).metadata();assert.equal(meta.width,512);assert.equal(meta.height,512);assert(meta.hasAlpha);
  for(const [path,accept] of [['/icons-20261028/medal.png','*/*'],['/icons-20261028/medal.png?original=1','image/webp'],['/icons-20261028/medal.png','image/webp;q=0,image/png'],['/character-camp-v2.png','image/webp']]){
   const raw=await fetch(url+path,{headers:{Accept:accept}});assert.match(raw.headers.get('content-type')!,/image\/png/);assert.deepEqual(Buffer.from(await raw.arrayBuffer()),original,path);
  }
 }finally{await new Promise<void>(r=>server.close(()=>r()));assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(basename(root),/^alvorada-image-delivery-/);await rm(root,{recursive:true,force:true});}
});
test('prévia privada conserva autorização e cache privado mesmo após aquecer a conversão',async()=>{
 const original=await fixture(),before=createHash('sha256').update(original).digest('hex'),app=express();
 app.get('/private',async(req,res)=>{if(req.get('X-User')!=='owner'){res.status(403).end();return;}res.set('Cache-Control','private, no-store').vary('Cookie').type('png');await sendImagePreview(req,res,original);});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/private';
 try{
  for(let i=0;i<2;i++){
   const response=await fetch(url,{headers:{'X-User':'owner',Accept:'image/webp'}}),bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary')!,/Cookie/);assert.match(response.headers.get('vary')!,/Accept/);assert(bytes.length<original.length);assert.equal((await sharp(bytes).metadata()).width,512);
   assert.equal((await fetch(url,{headers:{Accept:'image/webp'}})).status,403);
  }
  const raw=await fetch(url+'?original=1',{headers:{'X-User':'owner',Accept:'image/webp'}});assert.deepEqual(Buffer.from(await raw.arrayBuffer()),original);assert.equal(createHash('sha256').update(original).digest('hex'),before);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test('miniatura privada tem cache separado, preserva alfa/autorização e mantém o download original',async()=>{
 const original=await fixture(),app=express();
 app.get('/private',async(req,res)=>{if(req.get('X-User')!=='owner'){res.status(403).end();return;}res.set('Cache-Control','private, no-store').vary('Cookie').type('png');await sendImagePreview(req,res,original);});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/private';
 try{
  const headers={'X-User':'owner',Accept:'image/webp'};
  await fetch(url,{headers});
  const replies=await Promise.all(Array.from({length:6},()=>fetch(url+'?thumbnail=1',{headers})));
  for(const r of replies){const b=Buffer.from(await r.arrayBuffer()),m=await sharp(b).metadata();assert.equal(m.width,128);assert.equal(m.height,128);assert(m.hasAlpha);assert(b.length<original.length*.3);assert.equal(r.headers.get('cache-control'),'private, no-store');}
  const display=await fetch(url+'?display=1',{headers});assert.equal((await sharp(Buffer.from(await display.arrayBuffer())).metadata()).width,512);
  assert.equal((await fetch(url+'?display=1',{headers:{Accept:'image/webp'}})).status,403);
  const full=Buffer.from(await(await fetch(url,{headers})).arrayBuffer());assert.equal((await sharp(full).metadata()).width,512);
  assert.deepEqual(Buffer.from(await(await fetch(url+'?thumbnail=1&original=1',{headers})).arrayBuffer()),original);
  assert.equal((await fetch(url+'?thumbnail=1',{headers:{Accept:'image/webp'}})).status,403);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
