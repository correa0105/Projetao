import express from 'express';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const dir='public/optimized-images-20261028/vtt-effect-previews';
const app=express(),vite=await createServer({configFile:false,publicDir:false,appType:'custom',cacheDir:'.local/vtt-effect-menus-20261029/vite',server:{middlewareMode:true,watch:null},optimizeDeps:{noDiscovery:true}});
app.get('/__effects',(_req,res)=>res.type('html').send(`<!doctype html><script type="module">
import {effectLibrary} from '/shared/vtt-effects.ts';
import {renderEffect} from '/src/vtt-effects-canvas.ts';import {drawDeath} from '/src/vtt-death.ts';
import {effectMaterialsReady} from '/src/vtt-effects-materials.ts';import {physicalPropsReady} from '/src/vtt-effects-physical.ts';
import {lavaSurfaceReady} from '/src/vtt-lava-material.ts';import {spectralScreamerReady} from '/src/vtt-spectral-screamer.ts';
import {warmArcanaEffects} from '/src/vtt-effects-arcana.ts';import {warmLivingEffects} from '/src/vtt-effects-living.ts';
import {effectPreviewToken} from '/src/vtt-effect-preview-token.ts';
import {screenAtlas} from '/src/vtt-screen-materials.ts';import {paintScreenPreview} from '/src/vtt-screen-preview-renderer.ts';
await Promise.all([effectMaterialsReady,physicalPropsReady,lavaSurfaceReady,spectralScreamerReady,warmArcanaEffects(),warmLivingEffects()]);
const image=effectPreviewToken();await image.decode();
const rows=[];
for(const e of effectLibrary){
 const canvas=document.createElement('canvas');canvas.width=152;canvas.height=112;const c=canvas.getContext('2d');
 c.translate(76,54);const effect={id:'library-'+e.kind,...e,scale:1,duration:0,at:0};
 const options={now:1250,reducedMotion:false,seed:'gallery',overhead:true,image};
 if(e.kind==='death')drawDeath(c,{id:effect.id,layer:'tokens',deathAt:1,width:68,height:72},options);
 else renderEffect(c,effect,68,72,{...options,pass:'behind'});
 if(e.kind!=='death')renderEffect(c,effect,68,72,{...options,pass:'front'});
 rows.push({kind:e.kind,color:e.color,data:canvas.toDataURL('image/png')});
}
await screenAtlas().decode();
for(const preset of ['cave-in','embers']){const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;paintScreenPreview(canvas.getContext('2d'),preset);rows.push({kind:'screen:'+preset,data:canvas.toDataURL('image/png')});}
window.__effectPosters=rows;
</script>`));
app.use(express.static(resolve('public')));app.use(vite.middlewares);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
try{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/__effects');await page.waitForFunction(()=>window.__effectPosters,{},{timeout:90000});assert.deepEqual(errors,[]);
 const rows=await page.evaluate(()=>window.__effectPosters),effects={},screen={},proof=[];
 await mkdir(dir,{recursive:true});
 for(const row of rows){
  const bytes=await sharp(Buffer.from(row.data.split(',')[1],'base64')).resize({width:128,height:128,fit:'inside'}).webp({quality:60,alphaQuality:100,effort:3}).toBuffer();
  const pixels=await sharp(bytes).ensureAlpha().raw().toBuffer();let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>8)visible++;assert(visible>20,row.kind);
  const sha256=createHash('sha256').update(bytes).digest('hex'),path='/optimized-images-20261028/vtt-effect-previews/'+sha256+'.webp';await writeFile('public'+path,bytes);
  if(row.kind.startsWith('screen:'))screen[row.kind.slice(7)]=path;else effects[row.kind]={image:path,color:row.color};
  proof.push({kind:row.kind,file:path,sha256,bytes:bytes.length});
 }
 await writeFile('shared/vtt-effect-previews.json',JSON.stringify(effects,null,2)+'\n');await writeFile('shared/vtt-screen-previews.json',JSON.stringify(screen,null,2)+'\n');
 await mkdir('.local/vtt-effect-menus-20261029',{recursive:true});const result={passed:true,images:proof,bytes:proof.reduce((s,e)=>s+e.bytes,0),privateArtworkIncluded:false,withoutTokenOverlay:true};
 await writeFile('.local/vtt-effect-menus-20261029/posters.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,images:proof.length}));
}finally{await browser.close();await vite.close();await new Promise(r=>server.close(()=>r()));}
