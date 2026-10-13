import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import sharp from 'sharp';
import {chromium} from 'playwright';

// Native texture, layered brush and asset integration QA, without a database.
const previous=JSON.parse(await readFile('data/vtt/terrain-v3-reviewed-20261013.json'));
const updated=JSON.parse(await readFile('data/vtt/terrain-v4-reviewed-20261013.json'));
const art=previous.map(a=>updated.find(n=>n.id===a.id)||a);art.splice(1,0,updated.find(a=>a.id==='rocky-grass'));
const floor=updated.find(a=>a.id==='woodland-floor');
assert((await sharp('public'+floor.image).metadata()).hasAlpha);
assert.equal(createHash('sha256').update(await readFile('public'+floor.image)).digest('hex'),floor.sha256);
assert.equal(art.length,7);
for(const a of art){
  const data=await readFile('public'+a.image),meta=await sharp(data).metadata();
  assert.equal(meta.width,1024);assert.equal(meta.height,1024);
  assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256);
  assert.equal(meta.hasAlpha,false);
}
const bundle=await build({stdin:{contents:"export {renderVtt} from './src/vtt-canvas';export {newScene,newToken} from './shared/vtt';export {terrainTextures,woodlandFloorImage} from './shared/vtt-terrain';export {drawTerrain} from './src/vtt-terrain-canvas';export {terrainCacheStats} from './src/vtt-terrain-canvas';export {effectMaterialsReady} from './src/vtt-effects-materials';export {physicalPropsReady} from './src/vtt-effects-physical';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',globalName:'QA'});
const root=path.resolve('public');
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;background:#171d20;color:#dbc697;font:14px Arial}#textures{display:grid;grid-template-columns:repeat(3,480px);gap:8px}h3{margin:12px}canvas{display:block}</style><section id="textures"></section><section id="map"></section>');return;}
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try {const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':'image/png');res.end(data);}catch{res.writeHead(404).end();}
});
server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('test-results/terrain-art',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1456,height:1200},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
  const report=await page.evaluate(async()=>{
    await Promise.all([QA.effectMaterialsReady,QA.physicalPropsReady]);
    const paths=[QA.woodlandFloorImage,...QA.terrainTextures.map(t=>t.image),'/vtt/scenery-v2-20261012/terrain-grass.webp','/vtt/trees-20261013/oak-young.png','/vtt/trees-20261013/pine-highland.png','/vtt/trees-20261013/oak-ancient.png','/vtt/rocks-20261013/granito-grande.png'];
    const images=new Map(await Promise.all(paths.map(async src=>{const image=new Image();image.src=src;await image.decode();return [src,image];})));
    const stroke=(texture,points,radius,layer='base')=>({id:crypto.randomUUID(),texture,radius,softness:.5,opacity:1,textureScale:360,shape:'round',layer,erase:false,points});
    const options=(w,h)=>({camera:{x:w/2,y:h/2,zoom:1},width:w,height:h,dpr:1,images,selected:[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,userId:'qa',visualEffects:true});
    for(const t of QA.terrainTextures){
      const card=document.createElement('article'),heading=document.createElement('h3');heading.textContent=t.name;card.append(heading);
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;card.append(canvas);document.querySelector('#textures').append(card);
      const scene=QA.newScene(crypto.randomUUID());scene.width=480;scene.height=320;scene.fog=false;scene.lighting=false;scene.grid.type='none';
      scene.terrain=[stroke(t.id,[{x:0,y:160},{x:480,y:160}],300)];QA.renderVtt(canvas.getContext('2d'),scene,options(480,320));
    }
    const scene=QA.newScene(crypto.randomUUID());scene.width=1280;scene.height=800;scene.fog=false;scene.lighting=false;scene.grid.type='square';scene.grid.size=75;scene.grid.opacity=.15;
    scene.terrainLayers=[{id:'base',name:'Grama',visible:true,opacity:1},{id:'path',name:'Caminho',visible:true,opacity:1}];
    scene.terrain=[stroke('grass',[{x:0,y:200},{x:1280,y:200}],500),stroke('grass',[{x:0,y:600},{x:1280,y:600}],500),stroke('earth',[{x:-40,y:740},{x:260,y:620},{x:400,y:450},{x:780,y:360},{x:1040,y:90},{x:1320,y:50}],60,'path'),stroke('stone',[{x:970,y:600},{x:1180,y:720}],120,'path')];
    for(const [i,src] of ['/vtt/trees-20261013/oak-young.png','/vtt/trees-20261013/pine-highland.png','/vtt/trees-20261013/oak-ancient.png','/vtt/rocks-20261013/granito-grande.png'].entries()){
      const token=QA.newToken(crypto.randomUUID(),scene);token.layer='map';token.name='';token.image=src;token.imageFit='contain';token.raw=true;token.width=token.height=i===3?150:225;token.x=[150,730,1090,960][i];token.y=[160,140,410,700][i];scene.tokens.push(token);
    }
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;document.querySelector('#map').append(canvas);const c=canvas.getContext('2d'),o=options(1280,800);
    QA.renderVtt(c,scene,o);const warm=QA.terrainCacheStats(canvas);
    const start=performance.now();for(let i=0;i<30;i++)QA.renderVtt(c,scene,{...o,camera:{...o.camera,x:640+i*.2}});
    const ms=(performance.now()-start)/30,after=QA.terrainCacheStats(canvas);
    QA.renderVtt(c,scene,{...o,terrainDraft:stroke('sand',[{x:530,y:600},{x:800,y:650}],60,'path')});
    return {groundCached:warm.groundTilesBuilt===after.groundTilesBuilt, textures:QA.terrainTextures.map(t=>({id:t.id,image:t.image,width:images.get(t.image).naturalWidth})),warm,after,navigationMs:ms};
  });
  assert.deepEqual(report.textures.map(t=>t.id),art.map(t=>t.id));
  assert(report.textures.every(t=>t.width===1024));assert.equal(report.warm.strokesDrawn,report.after.strokesDrawn);
  assert(report.navigationMs<45);assert(report.groundCached);assert(report.warm.groundTilesBuilt>0);assert.deepEqual(errors,[]);
  await page.locator('#textures').screenshot({path:'test-results/terrain-art/materials.png'});
  await page.locator('#map').screenshot({path:'test-results/terrain-art/forest-map.png'});
  await writeFile('test-results/terrain-art/result.json',JSON.stringify({passed:true,...report,errors},null,2));
  console.log(JSON.stringify({passed:true,textures:7,navigationMs:report.navigationMs}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
