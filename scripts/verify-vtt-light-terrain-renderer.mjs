import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
const folder='test-results/light-terrain';await fs.mkdir(folder,{recursive:true});
const bundle=await build({stdin:{contents:"export{renderVtt}from'./src/vtt-canvas';export{newScene,newToken,lightSchema}from'./shared/vtt';export{terrainTextures}from'./shared/vtt-terrain';export{lightPresetValues}from'./shared/vtt-lighting';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'QA',platform:'browser'});
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<canvas width="600" height="600"></canvas>');}try{res.setHeader('Content-Type','image/webp');res.end(await fs.readFile(path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
 const lights=await page.evaluate(()=>{
  const s=QA.newScene(crypto.randomUUID());s.width=s.height=600;s.grid.size=50;s.grid.opacity=0;s.backgroundColor='#919191';s.lighting=true;s.fog=false;s.ambient=0;
  s.walls=[{id:crypto.randomUUID(),a:{x:320,y:0},b:{x:320,y:600},kind:'wall',open:false}];
  const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
  const o={camera:{x:300,y:300,zoom:1},width:600,height:600,dpr:1,images:new Map(),selected:[],gm:true,preview:true,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:true};
  const realNow=Date.now;let now=10000;Date.now=()=>now;
  o.viewer=Object.assign(QA.newToken(crypto.randomUUID(),s),{x:220,y:300,vision:0});
  const paint=()=>{QA.renderVtt(c,s,o);return c.getImageData(0,0,600,600).data;},checks=[];
  try{for(const animation of ['torch','campfire','candle','pulse','arcane']){
   const l=QA.lightSchema.parse({id:crypto.randomUUID(),x:220,y:300,...QA.lightPresetValues('torch'),animation});s.lights=[l];
   now=10000;const a=paint();now=10600;const b=paint();let changed=0,leaks=0;
   for(let y=0;y<600;y++)for(let x=0;x<600;x++){const i=(y*600+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){changed++;if(x>322)leaks++;}}
   l.effectSpeed=.25;now=11400;const slow=paint();l.effectSpeed=3;const fast=paint();let speedChanges=0;for(let i=0;i<slow.length;i++)if(slow[i]!==fast[i])speedChanges++;
   const blocked=[...b.slice((300*600+450)*4,(300*600+450)*4+3)];
   checks.push({animation,changed,leaks,speedChanges,blocked});
  }
  s.lights[0].animation='none';now=20000;const steady=paint();now=22000;const steady2=paint();checks.push({animation:'none',unchanged:steady.every((v,i)=>v===steady2[i])});
  return checks;
  }finally{Date.now=realNow;}
 });
 for(const check of lights){if(check.animation==='none')assert(check.unchanged);else{assert(check.changed>100,JSON.stringify(check));assert.equal(check.leaks,0);assert(check.speedChanges>100);assert(check.blocked.every(v=>v<30));}}
 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await page.evaluate(()=>{const s=QA.newScene(crypto.randomUUID());s.width=s.height=600;s.lighting=true;s.fog=false;s.backgroundColor='#919191';s.lights=[QA.lightSchema.parse({id:crypto.randomUUID(),x:300,y:300,...QA.lightPresetValues('torch')})];const c=document.querySelector('canvas').getContext('2d'),o={camera:{x:300,y:300,zoom:1},width:600,height:600,dpr:1,images:new Map(),selected:[],gm:true,preview:true,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null};o.viewer=Object.assign(QA.newToken(crypto.randomUUID(),s),{x:300,y:300,vision:0});const old=Date.now;try{Date.now=()=>10000;QA.renderVtt(c,s,o);const a=c.getImageData(0,0,600,600).data;Date.now=()=>22000;QA.renderVtt(c,s,o);const b=c.getImageData(0,0,600,600).data;return a.every((v,i)=>v===b[i]);}finally{Date.now=old;}});assert(reduced);
 const materials=await page.evaluate(async()=>{
  const s=QA.newScene(crypto.randomUUID());s.width=s.height=600;s.grid.opacity=0;s.lighting=s.fog=false;const canvas=document.querySelector('canvas'),c=canvas.getContext('2d'),images=new Map(),rows=[];
  for(const t of QA.terrainTextures){const img=new Image();img.src=t.image;await img.decode();images.set(t.image,img);}
  const o={camera:{x:300,y:300,zoom:1},width:600,height:600,dpr:1,images,selected:[],gm:true,preview:false,viewer:null,layer:'map',ruler:[],draft:null,showWalls:false,ping:null};
  for(const texture of QA.terrainTextures){s.terrain=[{id:crypto.randomUUID(),texture:texture.id,points:[{x:300,y:300}],radius:290,softness:0,opacity:1,textureScale:150,shape:'square',erase:false,layer:'base'}];QA.renderVtt(c,s,o);rows.push({id:texture.id,png:canvas.toDataURL()});}
  return rows;
 });
 assert.equal(materials.length,18);const hashes=new Set();
 for(const row of materials){const bytes=Buffer.from(row.png.split(',')[1],'base64');hashes.add(createHash('sha256').update(bytes).digest('hex'));await fs.writeFile(folder+'/'+row.id+'.png',bytes);}assert.equal(hashes.size,18);
 const manifest=JSON.parse(await fs.readFile('data/vtt/terrain-expansion-20261015/manifest.json','utf8'));
 for(const material of manifest){const png=await fs.readFile(material.source);assert.equal(createHash('sha256').update(png).digest('hex'),material.sha256);const img=await sharp(await fs.readFile('public'+material.image)).metadata();assert.equal(img.width,1024);assert.equal(img.height,1024);assert.equal((await sharp(png).stats()).isOpaque,true);}
 await fs.writeFile(folder+'/result.json',JSON.stringify({passed:true,lights,reducedMotion:reduced,textures:18,newTextures:10,uniqueRendered:18,nativeOriginals:10},null,2));
 console.log('5 animated lights, effect speed, wall clipping, reduced motion and 18 rendered terrain materials passed.');
}finally{await browser.close();server.close();}
