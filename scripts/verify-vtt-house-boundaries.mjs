import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {build} from 'esbuild';import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:"export{renderVtt}from'./src/vtt-canvas';export{drawHouseRoof}from'./src/vtt-house-roof';export{newScene,newToken}from'./shared/vtt';export{houseAssets,houseWorld,houseWindowViews}from'./shared/vtt-houses';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',globalName:'HouseQA'});
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;background:#222a33}</style><canvas width="1000" height="1000"></canvas>');return;}try{res.setHeader('Content-Type','image/webp');res.end(await fs.readFile(path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});await fs.mkdir('test-results/house-vision',{recursive:true});
try{const page=await browser.newPage({viewport:{width:1000,height:1000}});await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});const checks=[];
 for(const index of Array.from({length:50},(_,i)=>i)){
  const check=await page.evaluate(async index=>{
   const q=HouseQA,a=q.houseAssets[index],canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true}),scene=q.newScene(crypto.randomUUID());scene.width=scene.height=1000;scene.fog=scene.lighting=false;scene.grid.opacity=0;scene.backgroundColor='#386b32';
   const house=q.newToken(crypto.randomUUID(),scene),actor=q.newToken(crypto.randomUUID(),scene);Object.assign(house,{layer:'map',image:a.image,width:a.width*70,height:a.height*70,x:500,y:500});Object.assign(actor,{x:500,y:500,vision:0});scene.tokens=[house,actor];
   const images=new Map();for(const p of [a.image,a.interior,'/vtt/house-parts-20261014/door-vertical.webp']){const i=new Image();i.src=p;await i.decode();images.set(p,i);}
   const o={camera:{x:500,y:500,zoom:1},width:1000,height:1000,dpr:1,images,selected:[actor.id],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false};
   const dark=p=>{const d=c.getImageData(Math.round(p.x),Math.round(p.y),1,1).data;return d[0]===9&&d[1]===13&&d[2]===17;};
   q.renderVtt(c,scene,o);await document.fonts.ready;q.renderVtt(c,scene,o);const inside=canvas.toDataURL();q.renderVtt(c,scene,o);const cached=inside===canvas.toDataURL();
   const expected=document.createElement('canvas');expected.width=expected.height=1000;expected.getContext('2d').drawImage(images.get(a.interior),500-house.width/2,500-house.height/2,house.width,house.height);const alpha=expected.getContext('2d').getImageData(0,0,1000,1000).data;
   let exteriorSamples=0,exteriorLeaks=0;const pixels=c.getImageData(0,0,1000,1000).data;
   for(let y=250;y<780;y+=3)for(let x=250;x<780;x+=3){const p=(y*1000+x)*4;if(alpha[p+3]===0){exteriorSamples++;if(pixels[p]!==9||pixels[p+1]!==13||pixels[p+2]!==17)exteriorLeaks++;}}
   let windows=true,noFalseCones=true;
   for(const w of a.windows){const angle=w.facing*Math.PI/180;Object.assign(actor,q.houseWorld({x:w.x-Math.cos(angle)*.05,y:w.y-Math.sin(angle)*.05},house));q.renderVtt(c,scene,o);const outside=q.houseWorld({x:w.x+Math.cos(angle)*.25,y:w.y+Math.sin(angle)*.25},house);windows&&=!dark(outside);}
   if(!a.windows.length)for(const p of [{x:.5,y:a.footprint.top+.05},{x:.29,y:a.footprint.bottom-.05},{x:.72,y:a.footprint.bottom-.05}]){Object.assign(actor,q.houseWorld(p,house));q.renderVtt(c,scene,o);noFalseCones&&=q.houseWindowViews(house,actor,scene).length===0&&dark(q.houseWorld({x:p.x,y:p.y<.5?-.1:1.1},house));}
   const roof=document.createElement('canvas');roof.width=roof.height=1024;const rc=roof.getContext('2d');rc.translate(512,512);q.drawHouseRoof(rc,{...house,width:1024,height:1024},images.get(a.image),images.get(a.interior));const composed=rc.getImageData(0,0,1024,1024).data;
   const source=document.createElement('canvas');source.width=source.height=1024;source.getContext('2d').drawImage(images.get(a.image),0,0,1024,1024);const original=source.getContext('2d').getImageData(0,0,1024,1024).data;let roofPixels=0,missingRoof=0;
   for(let p=3;p<original.length;p+=16)if(original[p]>100){roofPixels++;if(composed[p]<30)missingRoof++;}
   Object.assign(actor,{x:500,y:500});q.renderVtt(c,scene,o);const insideShot=canvas.toDataURL();o.selected=[];Object.assign(actor,q.houseWorld({x:.5,y:.99},house));q.renderVtt(c,scene,o);const roofShot=canvas.toDataURL();
   return{id:a.id,exteriorSamples,exteriorLeaks,cached,windows:a.windows.length,windowsReveal:windows,noFalseCones,roofPixels,missingRoof,insideShot,roofShot};
  },index);
  for(const [kind,shot]of [['inside',check.insideShot],['roof',check.roofShot]])await fs.writeFile('test-results/house-vision/'+check.id+'-'+kind+'.png',Buffer.from(shot.split(',')[1],'base64'));delete check.insideShot;delete check.roofShot;checks.push(check);
 }
 const report={passed:checks.every(c=>c.exteriorLeaks===0&&c.cached&&c.windowsReveal&&c.noFalseCones&&c.missingRoof===0),checks};await fs.writeFile('test-results/house-vision/result.json',JSON.stringify(report,null,2));assert(report.passed,JSON.stringify(checks.filter(c=>c.exteriorLeaks||!c.cached||!c.windowsReveal||!c.noFalseCones||c.missingRoof)));console.log('50 native silhouettes: no exterior leaks or false windows; full roofs retained and real windows verified.');
}finally{await browser.close();server.close();}
