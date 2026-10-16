import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {build} from 'esbuild';import {chromium} from 'playwright';
const bundle=await build({entryPoints:['src/vtt-terrain-canvas.ts'],bundle:true,write:false,format:'iife',globalName:'TerrainAfter',platform:'browser'});

const texture=JSON.parse(await fs.readFile('data/vtt/terrain-v4-reviewed-20261013.json')).find(t=>t.id==='grass').image;
const data='data:image/webp;base64,'+(await fs.readFile('public'+texture)).toString('base64');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
await fs.mkdir('test-results/terrain-cache',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.setContent('<canvas width="1280" height="800"></canvas>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const report=await page.evaluate(async({data,texture})=>{
   const img=new Image();img.src=data;await img.decode();const images=new Map([[texture,img]]);
   const make=i=>({id:String(i),texture:'grass',erase:i%19===18,radius:60,softness:.5,opacity:.8,textureScale:280,shape:'round',layer:'base',points:Array.from({length:70},(_,j)=>({x:150+(i%10)*160+j*3,y:180+Math.floor(i/10)*160+Math.sin(j*.2)*35}))});
   const scene={id:'zoom-proof',width:2200,height:2200,terrain:Array.from({length:100},(_,i)=>make(i)),terrainLayers:[{id:'base',visible:true,opacity:1}],tokens:[]};
   const options={camera:{x:1100,y:1100,zoom:.3},width:1280,height:800,dpr:1,images,gm:true};
   const run=engine=>{
     const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;const c=canvas.getContext('2d');
     engine.drawTerrain(c,scene,options);const warm=engine.terrainCacheStats(canvas),times=[];
     for(const zoom of [.45,.65,.9,1.05,1.4,2.1,1.4,.9,.65,.45]){const t=performance.now();engine.drawTerrain(c,scene,{...options,camera:{x:1100,y:1100,zoom}});times.push(performance.now()-t);}
     return{warm,after:engine.terrainCacheStats(canvas),times,mean:times.reduce((a,b)=>a+b,0)/times.length,max:Math.max(...times),canvas};
   };
   const fresh=run(TerrainAfter);
   const c=fresh.canvas.getContext('2d');const signature=()=>{c.clearRect(0,0,1280,800);TerrainAfter.drawTerrain(c,scene,options);return fresh.canvas.toDataURL();};
   const original=signature();const appended={...make(123),id:'new',erase:true,radius:200,points:[{x:1100,y:1100}]};scene.terrain=[...scene.terrain,appended];const edited=signature();scene.terrain=scene.terrain.slice(0,-1);const undone=signature();
   const saved=structuredClone(scene);scene.terrainLayers=[{...scene.terrainLayers[0],visible:false}];const hidden=signature();scene.terrainLayers=saved.terrainLayers;const shown=signature();
   return{after:{mean:fresh.mean,max:fresh.max,strokes:fresh.after.strokesDrawn-fresh.warm.strokesDrawn,memory:fresh.after.cacheBytes},edited:edited!==original,undo:undone===original,layerToggle:hidden!==shown&&shown===original,image:original};
 },{data,texture});
 await fs.writeFile('test-results/terrain-cache/map.png',Buffer.from(report.image.split(',')[1],'base64'));delete report.image;
 assert.equal(report.after.strokes,0);assert(report.after.mean<80);assert(report.after.max<80);assert(report.edited&&report.undo&&report.layerToggle);
 report.passed=true;await fs.writeFile('test-results/terrain-cache/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
