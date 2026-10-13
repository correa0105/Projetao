import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// Native renderer benchmark, with no database, accounts or production changes.
const baseline=process.env.VFX_BASELINE_JS ? await readFile(process.env.VFX_BASELINE_JS,'utf8') : null;
const bundle=await build({stdin:{contents:"export {renderVtt} from './src/vtt-canvas';export {newScene,newToken} from './shared/vtt';export {effectMaterialsReady} from './src/vtt-effects-materials';export {physicalPropsReady} from './src/vtt-effects-physical';export {renderCacheStats} from './src/vtt-render-cache';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',globalName:'VttAfter'});
const publicRoot=path.resolve('public');
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas></canvas>');return;}
  const file=path.resolve(publicRoot,'.'+url.pathname);
  if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
  try { const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data); }
  catch{res.writeHead(404).end();}
});
server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
await mkdir('test-results/render-performance',{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:'+server.address().port);
  if(baseline)await page.addScriptTag({content:baseline});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const report=await page.evaluate(async(hasBaseline)=>{
    await Promise.all([VttAfter.effectMaterialsReady,VttAfter.physicalPropsReady,...(hasBaseline?[VttBefore.effectMaterialsReady,VttBefore.physicalPropsReady]:[])]);
    let clock=1800000000000;Date.now=()=>clock;
    const scene=VttAfter.newScene(crypto.randomUUID());scene.width=scene.height=16000;scene.ambient=.16;scene.lighting=true;scene.fog=false;scene.grid.type='none';
    for(let i=0;i<40;i++)scene.walls.push({id:'wall'+i,a:{x:180+(i%8)*130,y:120+Math.floor(i/8)*100},b:{x:225+(i%8)*130,y:150+Math.floor(i/8)*100},kind:'wall',open:false});
    for(let i=0;i<6;i++)scene.lights.push({id:'light'+i,name:'Luz',x:200+i*140,y:400,bright:15,dim:15,color:i%2?'#eec99f':'#abccee',rotation:0,angle:360,enabled:true});
    const options={camera:{x:600,y:400,zoom:1},width:1200,height:800,dpr:1,images:new Map(),selected:[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,userId:'owner',visualEffects:true};
    const canvas=()=>{const e=document.createElement('canvas');e.width=1200;e.height=800;return e;};
    const old=canvas(),fresh=canvas(),c=fresh.getContext('2d'),b=old.getContext('2d');
    // Readbacks can switch a Chromium canvas from GPU to CPU rasterization. Use
    // separate CPU readback surfaces for pixel QA; timed canvases stay native.
    const qaBefore=canvas().getContext('2d',{willReadFrequently:true}),qaAfter=canvas().getContext('2d',{willReadFrequently:true});
    const draw=(engine,ctx)=>engine.renderVtt(ctx,scene,options);
    const time=(fn,n=8)=>{const start=performance.now();for(let i=0;i<n;i++){clock=1800000000000+i*17;fn();}return(performance.now()-start)/n;};
    const quality=[];
    const compare=label=>{
      if(!hasBaseline)return;clock=1800000000500;draw(VttBefore,qaBefore);draw(VttAfter,qaAfter);
      const a=qaBefore.getImageData(0,0,1200,800).data,z=qaAfter.getImageData(0,0,1200,800).data;
      let sum=0,max=0,different=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-z[i]);sum+=d;max=Math.max(max,d);if(d)different++;}
      quality.push({label,mean:sum/a.length,max,different});
    };
    compare('GM lighting');
    draw(VttAfter,c);const warm=VttAfter.renderCacheStats(fresh);
    const lightAfterMs=time(()=>draw(VttAfter,c)),lightBeforeMs=hasBaseline?time(()=>draw(VttBefore,b)):null;
    const steady=VttAfter.renderCacheStats(fresh);
    const changes=[()=>scene.lights[0].x+=20,()=>scene.lights[0].color='#aacaee',()=>scene.walls[0].open=true,()=>options.camera.x+=20,()=>scene.grid.scale=10,()=>scene.grid.unit='m'];
    const invalidations=[];
    for(const change of changes){const prior=VttAfter.renderCacheStats(fresh).lightingBuilds;change();compare('geometry change '+invalidations.length);draw(VttAfter,c);invalidations.push(VttAfter.renderCacheStats(fresh).lightingBuilds-prior);}
    const actor=VttAfter.newToken(crypto.randomUUID(),scene);actor.x=600;actor.y=400;actor.controller='owner';actor.vision=60;scene.tokens=[actor];options.gm=false;
    compare('player vision');actor.x+=30;compare('moved viewer');actor.vision=20;compare('changed vision');
    scene.fog=true;scene.fogMode='manual';scene.reveals=[{x:600,y:400,radius:150}];scene.fogAreas=[{id:'fog',reveal:true,points:[{x:100,y:100},{x:300,y:100},{x:300,y:300},{x:100,y:300}]}];
    compare('manual fog');scene.reveals[0].x+=40;compare('edited fog');
    scene.fog=false;scene.lighting=false;options.gm=true;scene.tokens=[];
    for(let i=0;i<24;i++){
      const t=VttAfter.newToken(crypto.randomUUID(),scene);t.x=i<4?220+i*210:8000+(i-4)*150;t.y=i<4?400:8000;t.width=t.height=75+(i%4)*20;
      t.effects=[{id:'fire'+i,kind:i%2?'blue-fire':'fire',color:i%2?'#658fea':'#f69b3b',scale:1,duration:0,at:1800000000000-5000,name:'Fogo'}];scene.tokens.push(t);
    }
    compare('native fire and color depth');
    for(let i=0;i<3;i++){draw(VttAfter,c);if(hasBaseline)draw(VttBefore,b);}
    const effectsAfterMs=time(()=>draw(VttAfter,c),12),effectsBeforeMs=hasBaseline?time(()=>draw(VttBefore,b),12):null;
    // Small-large-small alternation retains the exact original crop and pixels.
    scene.tokens=scene.tokens.slice(0,4);
    for(const zoom of [.7,1.3,.7]){options.camera.zoom=zoom;compare('mixed sizes zoom '+zoom);}
    document.body.append(fresh);return {lightBeforeMs,lightAfterMs,effectsBeforeMs,effectsAfterMs,warm,steady,invalidations,quality};
  },!!baseline);
  await writeFile('test-results/render-performance/result.json',JSON.stringify({passed:false,...report},null,2));
  assert.equal(report.steady.allocations,report.warm.allocations);
  assert.equal(report.steady.lightingBuilds,report.warm.lightingBuilds);
  assert(report.invalidations.every(n=>n===1));
  for(const item of report.quality){assert(item.mean<.1,JSON.stringify(item));assert(item.max<=8,JSON.stringify(item));}
  if(baseline){assert(report.lightAfterMs<report.lightBeforeMs/2);assert(report.effectsAfterMs<report.effectsBeforeMs/2);}
  await page.screenshot({path:'test-results/render-performance/native-effects.png'});
  await writeFile('test-results/render-performance/result.json',JSON.stringify({passed:true,...report},null,2));
  console.log(JSON.stringify({passed:true,...report}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
