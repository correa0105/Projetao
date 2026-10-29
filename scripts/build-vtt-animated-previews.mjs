import express from 'express';import{createServer}from'vite';import{chromium}from'@playwright/test';
import{mkdir,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import{resolve}from'node:path';import assert from'node:assert/strict';
const app=express(),vite=await createServer({configFile:false,publicDir:false,appType:'custom',cacheDir:'.local/vtt-library-performance-20261029/vite',server:{middlewareMode:true,watch:null},optimizeDeps:{noDiscovery:true}});
app.get('/__posters',(_req,res)=>res.type('html').send(`<!doctype html><script type="module">
import{animatedAssets}from'/shared/vtt-animated-assets.ts';import{newDocument,newToken}from'/shared/vtt.ts';import{drawAnimatedAsset}from'/src/vtt-animated-assets.ts';import{effectMaterialsReady}from'/src/vtt-effects-materials.ts';import{physicalPropsReady}from'/src/vtt-effects-physical.ts';
import{vehicleIds,vehicleDefinitions,vehicleImage,vehicleCoverImage,vehicleDrawParts}from'/shared/vtt-vehicles.ts';import{navalAtlas,sailMasts,rowing,rowingImage}from'/shared/vtt-naval.ts';import{drawSailingRig}from'/src/vtt-naval-canvas.ts';import{drawVehiclePart}from'/src/vtt-vehicles-canvas.ts';
await Promise.all([effectMaterialsReady,physicalPropsReady]);const scene=newDocument(crypto.randomUUID()).scenes[0],results=[];
let ordinal=0;for(const a of animatedAssets){const img=new Image();if(a.image){img.src=a.image+'?original=1';await img.decode();}const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.translate(128,128);const token=newToken('00000000-0000-4000-8000-'+String(++ordinal).padStart(12,'0'),scene);token.width=token.height=240;token.animatedAsset={id:a.id,speed:1,intensity:.8,playing:false};if(a.id==='windmill'){const fit=240/Math.max(img.naturalWidth,img.naturalHeight);c.drawImage(img,-img.naturalWidth*fit/2,-img.naturalHeight*fit/2,img.naturalWidth*fit,img.naturalHeight*fit);}else drawAnimatedAsset(c,token,a.image?img:undefined,1700,true,true);const px=c.getImageData(0,0,256,256).data;let visible=0;for(let i=3;i<px.length;i+=4)if(px[i]>8)visible++;results.push({id:a.id,visible,data:canvas.toDataURL('image/webp',.78)});}for(const id of vehicleIds){
 const load=async url=>{const img=new Image();img.src=url+'?original=1';await img.decode();return img;};
 const img=await load(vehicleImage(id)),cover=await load(sailMasts[id]?navalAtlas(id):vehicleCoverImage(id)),oar=rowing[id]?await load(rowingImage):undefined;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.scale(256/180,256/180);
 const d=vehicleDefinitions[id],scale=Math.min(164/d.widthFt,164/d.lengthFt),w=d.widthFt*scale,h=d.lengthFt*scale;
 if(sailMasts[id]||rowing[id]){const t={width:w,height:h,rotation:0,image:vehicleImage(id),vehicle:{itemId:id}};c.save();c.translate(90,90);drawVehiclePart(c,t,img,'base',{time:0,animate:false,oar});if(sailMasts[id])drawSailingRig(c,t,cover);c.restore();}
 else for(const part of ['base','cover']){const src=part==='cover'?cover:img;for(const {source:r,target:q}of vehicleDrawParts(id,part))c.drawImage(src,r[0]*src.width,r[1]*src.height,r[2]*src.width,r[3]*src.height,(180-w)/2+q[0]*w,(180-h)/2+q[1]*h,q[2]*w,q[3]*h);}
 const px=c.getImageData(0,0,256,256).data;let visible=0;for(let i=3;i<px.length;i+=4)if(px[i]>8)visible++;results.push({id:'vehicle:'+id,visible,data:canvas.toDataURL('image/webp',.78)});
}window.__posters=results;
</script>`));
app.use(express.static(resolve('public')));app.use(vite.middlewares);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
try{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/__posters');
 if(errors.length)throw Error(errors.join('; '));
 await Promise.race([page.waitForFunction(()=>window.__posters,{},{timeout:90000}),new Promise((_,reject)=>page.once('pageerror',reject))]);
 assert.deepEqual(errors,[]);const rows=await page.evaluate(()=>window.__posters),images={},vehicles={},proof=[];
 await mkdir('public/optimized-images-20261028/vtt-thumbnails',{recursive:true});
 for(const row of rows){assert(row.visible>20,row.id);assert(row.data.startsWith('data:image/webp;base64,'));const bytes=Buffer.from(row.data.split(',')[1],'base64'),sha=createHash('sha256').update(bytes).digest('hex'),file='/optimized-images-20261028/vtt-thumbnails/'+sha+'.webp';await writeFile('public'+file,bytes);if(row.id.startsWith('vehicle:'))vehicles[row.id.slice(8)]=file;else images[row.id]=file;proof.push({id:row.id,file,sha256:sha,bytes:bytes.length,visiblePixels:row.visible});}
 await writeFile('shared/vtt-vehicle-thumbnails.json',JSON.stringify(vehicles,null,2)+'\n');
 await writeFile('shared/vtt-animated-thumbnails.json',JSON.stringify(images,null,2)+'\n');
 await mkdir('.local/vtt-library-performance-20261029',{recursive:true});await writeFile('.local/vtt-library-performance-20261029/animated-posters.json',JSON.stringify({passed:true,images:proof,totalBytes:proof.reduce((s,e)=>s+e.bytes,0)},null,2));
 console.log(JSON.stringify({staticPreviews:rows.length,totalBytes:proof.reduce((s,e)=>s+e.bytes,0),mapAnimationsUnchanged:true}));
}finally{await browser.close();await vite.close();await new Promise(r=>server.close(()=>r()));}
