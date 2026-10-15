import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createServer}from'node:http';import{build}from'esbuild';import{chromium}from'playwright';
const bundle=await build({stdin:{contents:"export{renderVtt}from'./src/vtt-canvas';export{newScene,newToken}from'./shared/vtt';export{houseAssets,houseWorld,houseWindowViews}from'./shared/vtt-houses';export{vttVisualSource}from'./shared/vtt-asset-visuals';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',globalName:'QA'});
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0}</style><canvas width="1100" height="1000"></canvas>');return;}try{res.end(await fs.readFile(path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true}),folder='test-results/windows-plants';await fs.mkdir(folder,{recursive:true});
try{const page=await browser.newPage({viewport:{width:1100,height:1000}});await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(async()=>{
  const q=QA,canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true}),s=q.newScene(crypto.randomUUID());s.width=1100;s.height=1000;s.fog=s.lighting=false;s.grid.opacity=0;s.backgroundColor='#425037';
  const a=q.houseAssets.find(a=>a.id==='house-002'),h=q.newToken(crypto.randomUUID(),s),actor=q.newToken(crypto.randomUUID(),s);Object.assign(h,{layer:'map',image:a.image,width:700,height:700,x:550,y:400});
  const plant=q.newToken(crypto.randomUUID(),s),tree=q.newToken(crypto.randomUUID(),s);Object.assign(plant,{layer:'map',image:'/vtt/plants-20261014/plant-016.webp',x:340,y:695,width:180,height:180,level:50});Object.assign(tree,{layer:'map',image:'/vtt/trees-20261013/oak-ancient.png',x:770,y:650,width:260,height:260,level:99});
  const images=new Map();for(const src of [a.image,a.interior,plant.image,tree.image,'/vtt/house-parts-20261014/door-vertical.webp']){const im=new Image();im.src=q.vttVisualSource(src);await im.decode();images.set(src,im);}
  const o={camera:{x:550,y:500,zoom:1},width:1100,height:1000,dpr:1,images,selected:[],gm:true,preview:false,viewer:null,layer:'map',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false};
  const render=()=>{q.renderVtt(c,s,o);return c.getImageData(0,0,1100,1000).data;};const capture=()=>canvas.toDataURL();s.tokens=[h];const baseline=render();s.tokens=[h,plant,tree];const planted=render(),roofPlants=capture();
  const roof=document.createElement('canvas');roof.width=1100;roof.height=1000;const rc=roof.getContext('2d');rc.drawImage(images.get(a.image),200,50,700,700);const mask=rc.getImageData(0,0,1100,1000).data;
  let leaks=0,exteriorChanges=0;for(let i=0;i<mask.length;i+=4)if(planted[i]!==baseline[i]||planted[i+1]!==baseline[i+1]||planted[i+2]!==baseline[i+2]){if(mask[i+3]===255)leaks++;else exteriorChanges++;}
  Object.assign(actor,{width:70,height:70,vision:80,...q.houseWorld({x:a.windows[0].x+.06,y:a.windows[0].y-.06},h)});s.tokens=[h,plant,tree,actor];o.selected=[actor.id];o.layer='tokens';render();const open=capture(),withPlants=c.getImageData(0,0,1100,1000).data;
  s.tokens=[h,actor];render();const noPlants=c.getImageData(0,0,1100,1000).data;s.tokens=[h,plant,tree,actor];render();
  const f=a.footprint;let insideLeaks=0,wallChanges=0;
  for(let y=0;y<1000;y++)for(let x=0;x<1100;x++){const i=(y*1100+x)*4;if(withPlants[i]===noPlants[i]&&withPlants[i+1]===noPlants[i+1]&&withPlants[i+2]===noPlants[i+2])continue;
    if(x>200+(f.left+.026)*700&&x<200+(f.right-.026)*700&&y>50+(f.top+.026)*700&&y<50+(f.bottom-.026)*700)insideLeaks++;
    else if(y>50+(f.bottom-.025)*700&&y<50+(f.bottom+.025)*700)wallChanges++;
  }
  const view=q.houseWindowViews(h,actor,s).find(v=>v.index===0),sample={x:view.aperture.x+view.normal.x*12,y:view.aperture.y+view.normal.y*12};
  const rgb=()=>Array.from(c.getImageData(Math.round(sample.x),Math.round(sample.y),1,1).data).slice(0,3);const openPixel=rgb();h.houseWindowsClosed=[0,1];render();const closed=capture(),closedPixel=rgb();
  h.houseWindowsClosed=[];s.lighting=true;s.fog=true;s.fogMode='vision';s.ambient=1;o.gm=false;o.userId='player';actor.controller='player';render();const lightOpen=rgb();h.houseWindowsClosed=[0,1];render();const lightClosed=rgb();
  return {leaks,insideLeaks,wallChanges,exteriorChanges,openPixel,closedPixel,lightOpen,lightClosed,roofPlants,open,closed};
 });assert.equal(result.leaks,0,'Plants may not cover opaque roof pixels');assert.equal(result.insideLeaks,0,'Outdoor plants may not enter a room');assert(result.wallChanges>20,'Foliage must remain in front of the exterior wall');assert(result.exteriorChanges>1000);assert.notDeepEqual(result.openPixel,[9,13,17]);assert.deepEqual(result.closedPixel,[9,13,17]);assert.notDeepEqual(result.lightOpen,[9,13,17]);assert.deepEqual(result.lightClosed,[9,13,17]);
 for(const key of ['roofPlants','open','closed'])await fs.writeFile(folder+'/'+key+'.png',Buffer.from(result[key].split(',')[1],'base64'));
 const report={passed:true,...result};for(const key of ['roofPlants','open','closed'])delete report[key];await fs.writeFile(folder+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
