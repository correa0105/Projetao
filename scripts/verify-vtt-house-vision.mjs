import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {build} from 'esbuild';import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:"export{renderVtt}from'./src/vtt-canvas';export{newScene,newToken}from'./shared/vtt';export{houseAssets,houseWorld}from'./shared/vtt-houses';export{houseDoorsAnimating}from'./src/vtt-house-doors';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',globalName:'HouseQA'});
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;background:#222a33}</style><canvas width="1000" height="1000"></canvas>');return;}try{res.setHeader('Content-Type','image/webp');res.end(await fs.readFile(path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});await fs.mkdir('test-results/house-vision',{recursive:true});
try{const page=await browser.newPage({viewport:{width:1000,height:1000}});await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
 const report=await page.evaluate(async()=>{
  const q=HouseQA,checks=[],canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
  for(const a of q.houseAssets){const scene=q.newScene(crypto.randomUUID());scene.width=scene.height=1000;scene.fog=scene.lighting=false;scene.grid.opacity=0;
   const house=q.newToken(crypto.randomUUID(),scene),actor=q.newToken(crypto.randomUUID(),scene);Object.assign(house,{layer:'map',image:a.image,width:a.width*70,height:a.height*70,x:500,y:500});Object.assign(actor,{x:500,y:500,vision:0});scene.tokens=[house,actor];
   const images=new Map();for(const p of [a.image,a.interior,'/vtt/house-parts-20261014/door-oak.webp']){const i=new Image();i.src=p;await i.decode();images.set(p,i);}
   const o={camera:{x:500,y:500,zoom:1},width:1000,height:1000,dpr:1,images,selected:[actor.id],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false};
   const sample=()=>[...c.getImageData(500,Math.round(500+(a.footprint.top-.5)*house.height-90),1,1).data].slice(0,3);
   q.renderVtt(c,scene,o);await document.fonts.ready;q.renderVtt(c,scene,o);const hidden=sample(),inside=canvas.toDataURL();q.renderVtt(c,scene,o);const cached=canvas.toDataURL();
   Object.assign(actor,q.houseWorld({x:.5,y:a.footprint.top+.05},house));q.renderVtt(c,scene,o);const revealed=sample();
   checks.push({id:a.id,hidden:JSON.stringify(hidden)==='[9,13,17]',cone:JSON.stringify(revealed)!=='[9,13,17]',cached:inside===cached});
  }
  return{checks};
 });await fs.writeFile('test-results/house-vision/result.json',JSON.stringify(report,null,2));assert(report.checks.every(c=>c.hidden&&c.cone&&c.cached),JSON.stringify(report.checks.filter(c=>!c.hidden||!c.cone||!c.cached)));report.passed=true;await fs.writeFile('test-results/house-vision/result.json',JSON.stringify(report,null,2));console.log('25 interiors: exterior hidden, near-window cone and cached redraw passed.');
}finally{await browser.close();server.close();}
