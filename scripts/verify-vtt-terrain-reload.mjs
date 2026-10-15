import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {build} from 'esbuild';import {chromium} from 'playwright';import sharp from 'sharp';
const bundle=await build({stdin:{contents:"export{drawTerrain,terrainCacheStats}from'./src/vtt-terrain-canvas';export{newScene}from'./shared/vtt';export{terrainTextures}from'./shared/vtt-terrain';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',globalName:'QA'});
const fixture=process.argv[2]?JSON.parse(await fs.readFile(process.argv[2],'utf8')):null;
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<canvas width="900" height="900"></canvas>');}try{res.setHeader('Content-Type','image/webp');res.end(await fs.readFile(path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});await fs.mkdir('test-results/terrain-reload',{recursive:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(async fixture=>{
  const s=fixture?.scenes.find(s=>s.id===fixture.activeScene)||QA.newScene(crypto.randomUUID());
  if(!fixture){s.width=s.height=1750;s.terrain=QA.terrainTextures.map((t,i)=>({id:crypto.randomUUID(),texture:t.id,layer:'base',shape:'round',erase:false,radius:130,softness:.3,opacity:1,textureScale:280,points:[{x:180+(i%4)*400,y:180+Math.floor(i/4)*300}]}));}
  s.tokens=[];const canvas=document.querySelector('canvas'),c=canvas.getContext('2d'),images=new Map(),options={camera:{x:s.width/2,y:s.height/2,zoom:Math.min(900/s.width,900/s.height)},width:900,height:900,dpr:1,images,gm:true};
  const paint=()=>{c.resetTransform();c.clearRect(0,0,900,900);QA.drawTerrain(c,s,options);return canvas.toDataURL();};
  const empty=paint();let intermediate=0;
  for(const t of QA.terrainTextures.filter(t=>s.terrain.some(stroke=>stroke.texture===t.id))){const img=new Image();images.set(t.image,img);paint();img.src=t.image;await img.decode();paint();intermediate++;}
  const cold=paint(),before=QA.terrainCacheStats(canvas);
  const fresh=document.createElement('canvas');fresh.width=fresh.height=900;QA.drawTerrain(fresh.getContext('2d'),s,options);const warm=fresh.toDataURL();
  return{empty,cold,warm,same:cold===warm,visible:cold!==empty,strokes:s.terrain.length,intermediate,before};
 },fixture);
 await fs.writeFile('test-results/terrain-reload/cold.png',Buffer.from(result.cold.split(',')[1],'base64'));await fs.writeFile('test-results/terrain-reload/warm.png',Buffer.from(result.warm.split(',')[1],'base64'));
 const cold=await sharp(Buffer.from(result.cold.split(',')[1],'base64')).ensureAlpha().raw().toBuffer(),warm=await sharp(Buffer.from(result.warm.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();let maxDifference=0,totalDifference=0;for(let i=0;i<cold.length;i++){const difference=Math.abs(cold[i]-warm[i]);maxDifference=Math.max(maxDifference,difference);totalDifference+=difference;}const meanDifference=totalDifference/cold.length;
 const report={...result,empty:undefined,cold:undefined,warm:undefined,maxDifference,meanDifference,passed:result.visible&&maxDifference<=16&&meanDifference<1.5};await fs.writeFile('test-results/terrain-reload/result.json',JSON.stringify(report,null,2));assert(result.visible,'Paint disappeared');assert(report.passed,'Cold-loaded paint differs materially from fresh rendering');console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
