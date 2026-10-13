import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:"export {drawTerrain,terrainCacheStats} from './src/vtt-terrain-canvas';export {terrainTextures} from './shared/vtt-terrain';export {terrainStrokeSchema} from './shared/vtt';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'QA',platform:'browser'});
const browser=await chromium.launch({channel:'msedge',headless:true});
await fs.mkdir('test-results/terrain-seams',{recursive:true});
await fs.writeFile('test-results/terrain-seams/result.json',JSON.stringify({passed:false}));
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});await page.setContent('<style>body{margin:0;background:#171e25}canvas{display:block;width:1280px;height:800px}</style><canvas width="1280" height="800"></canvas>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const art=[...JSON.parse(await fs.readFile('data/vtt/terrain-v4-reviewed-20261013.json')), ...JSON.parse(await fs.readFile('data/vtt/terrain-v3-reviewed-20261013.json')),JSON.parse(await fs.readFile('data/vtt/terrain-water-reviewed-20261013.json'))];
 const inputs=await Promise.all(art.map(async a=>[a.image,'data:image/webp;base64,'+(await fs.readFile('public'+a.image)).toString('base64')]));
 const report=await page.evaluate(async inputs=>{
  const images=new Map();for(const [path,url] of inputs){const im=new Image();im.src=url;await im.decode();images.set(path,im)}
  const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
  const stroke=(texture,patch={})=>({id:'00000000-0000-4000-8000-000000000001',texture,erase:false,radius:3000,softness:0,opacity:1,textureScale:360,shape:'square',layer:'base',points:[{x:2500,y:2500}],...patch});
  const scene={id:'seams',width:5000,height:5000,tokens:[],terrainLayers:[{id:'base',visible:true,opacity:1}],terrain:[]};
  const options={images,camera:{x:2000.37,y:2100.21,zoom:.683},dpr:1,gm:false,preview:false};
  const draw=(s,o=options)=>{c.resetTransform();c.clearRect(0,0,canvas.width,canvas.height);QA.drawTerrain(c,s,o);return c.getImageData(0,0,canvas.width,canvas.height).data;};
  const tests=[];
  for(const texture of QA.terrainTextures.filter(t=>t.id!=='water'))for(const [zoom,dpr] of [[.553,1],[.683,1],[.97,1],[1,1],[1.37,1],[.683,2]]) {
    const p=draw({...scene,terrain:[stroke(texture.id)]},{...options,camera:{...options.camera,zoom},dpr});
    let min=255;for(let i=3;i<p.length;i+=4)min=Math.min(min,p[i]);tests.push({texture:texture.id,zoom,dpr,minAlpha:min});
  }
  const partial={...scene,terrainLayers:[{id:'base',visible:true,opacity:.41},{id:'top',visible:true,opacity:.57}],terrain:[stroke('sand'),stroke('earth',{id:'00000000-0000-4000-8000-000000000002',layer:'top',opacity:.63})]};
  const p=draw(partial),expected=Math.round((.41+(1-.41)*.57*.63)*255);let minimum=255,maximum=0;
  for(let i=3;i<p.length;i+=4){minimum=Math.min(minimum,p[i]);maximum=Math.max(maximum,p[i]);}
  // Real coast: continuous sand under overlapping sea brush strokes. Their union
  // has one shoreline, never a ring of foam around every individual dab.
  const coast={...scene,id:'coast',width:1280,height:800,terrain:[stroke('sand',{radius:1200,points:[{x:640,y:400}]}),stroke('water',{id:'00000000-0000-4000-8000-000000000003',shape:'round',radius:420,softness:.12,textureScale:560,points:[{x:90,y:130},{x:370,y:150},{x:650,y:75},{x:970,y:135},{x:1280,y:185}]})]};
  const o={...options,camera:{x:640,y:400,zoom:1}};
  const start=performance.now();draw(coast,o);const coldMs=performance.now()-start,warm=QA.terrainCacheStats(canvas);
  const t=performance.now();for(let i=0;i<40;i++)draw(coast,{...o,camera:{...o.camera,x:640+Math.sin(i)*.7,y:400+Math.cos(i)*.7}});
  const navigationMs=(performance.now()-t)/40,after=QA.terrainCacheStats(canvas);
  draw(coast,o);const sea=c.getImageData(0,0,1280,800).data;let foamPixels=0;
  for(let y=350;y<650;y++)for(let x=5;x<1275;x++){const i=(y*1280+x)*4;if(sea[i]>175&&sea[i+1]>185&&sea[i+2]>155)foamPixels++;}
  // Painting opaque ground over the water must also remove its shoreline.
  const hidden={...coast,terrainLayers:[{id:'base',visible:false,opacity:1}]};draw(hidden,o);const hiddenStats=QA.terrainCacheStats(canvas);let hiddenAlpha=0;for(const a of c.getImageData(0,0,1280,800).data.filter((_,i)=>i%4===3))hiddenAlpha=Math.max(hiddenAlpha,a);
  const erased={...coast,terrain:[...coast.terrain,stroke('sand',{id:'00000000-0000-4000-8000-000000000004',radius:1200,points:[{x:640,y:400}]})]};
  const e=draw(erased,o),s=draw({...erased,terrain:[erased.terrain[0]]},o);let groundDifference=0;for(let i=0;i<e.length;i++)groundDifference=Math.max(groundDifference,Math.abs(e[i]-s[i]));
  draw(coast,o);return{tests,partial:{expected,minimum,maximum},coldMs,navigationMs,warm,after,foamPixels,hiddenAlpha,groundDifference,waterAccepted:QA.terrainStrokeSchema.safeParse(stroke('water',{radius:500})).success};
 },inputs);
 assert(report.tests.every(t=>t.minAlpha===255),'No transparent cache seams with grid disabled');
 assert(Math.abs(report.partial.minimum-report.partial.expected)<=2);assert(report.partial.maximum-report.partial.minimum<=1,'No doubled translucent borders');
 assert(report.waterAccepted);assert(report.foamPixels>1000);assert.equal(report.hiddenAlpha,0);assert(report.groundDifference<=1);
 assert(report.warm.shoreTilesBuilt>0);assert.equal(report.warm.shoreTilesBuilt,report.after.shoreTilesBuilt);assert.equal(report.warm.strokesDrawn,report.after.strokesDrawn);
 assert(report.navigationMs<30);assert(report.after.cacheBytes<=96*1024*1024);assert(report.after.maskBytes<=24*1024*1024);
 await page.locator('canvas').screenshot({path:'test-results/terrain-seams/water-coast.png'});
 await fs.writeFile('test-results/terrain-seams/result.json',JSON.stringify({passed:true,...report},null,2));console.log(JSON.stringify({passed:true,seamCases:report.tests.length,partial:report.partial,foamPixels:report.foamPixels,navigationMs:report.navigationMs,coldMs:report.coldMs}));
}finally{await browser.close()}
