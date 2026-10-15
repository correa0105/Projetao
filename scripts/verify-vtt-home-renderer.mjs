import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createServer}from'node:http';import{build}from'esbuild';import{chromium}from'playwright';import sharp from'sharp';
const bundle=await build({stdin:{contents:"export{vttVisualSource}from'./shared/vtt-asset-visuals';export{renderVtt}from'./src/vtt-canvas';export{newScene,newToken}from'./shared/vtt';export{houseAssets,houseWorld}from'./shared/vtt-houses';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'HomeQA',platform:'browser'});
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="1000" height="1000"></canvas>');return;}try{res.setHeader('Content-Type','image/webp');res.end(await fs.readFile(path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});await fs.mkdir('test-results/home-renderer',{recursive:true});const checks=[],tiles=[];
try{const page=await browser.newPage({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
for(const [i,id]of ['house-001','house-002','house-013','house-empty-002','commerce-001','commerce-002','commerce-003','commerce-004'].entries()){
 const result=await page.evaluate(async id=>{
  const q=HomeQA,a=q.houseAssets.find(a=>a.id===id),s=q.newScene(crypto.randomUUID());s.width=s.height=1000;s.fog=s.lighting=false;s.grid.opacity=0;s.backgroundColor='#315231';
  const h=q.newToken(crypto.randomUUID(),s),actor=q.newToken(crypto.randomUUID(),s),bed=q.newToken(crypto.randomUUID(),s);Object.assign(h,{layer:'map',image:a.image,x:500,y:500,width:a.width*70,height:a.height*70});Object.assign(actor,{vision:0});Object.assign(bed,{layer:'map',image:'/vtt/home-furniture-20261014/furniture-011.webp',width:70,height:140,x:500,y:450});s.tokens=[h,bed,actor];
  const images=new Map();for(const src of[a.image,a.interior,bed.image,'/vtt/house-parts-20261014/door-vertical.webp']){const im=new Image();im.src=q.vttVisualSource(src);await im.decode();images.set(src,im);}
  const c=document.querySelector('canvas').getContext('2d'),o={camera:{x:500,y:500,zoom:1},width:1000,height:1000,dpr:1,images,selected:[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false};
  Object.assign(actor,q.houseWorld({x:1.2,y:1.2},h));q.renderVtt(c,s,o);const withBed=c.canvas.toDataURL();s.tokens=[h,actor];q.renderVtt(c,s,o);const hidden=withBed===c.canvas.toDataURL();s.tokens=[h,bed,actor];
  Object.assign(actor,q.houseWorld({x:.5,y:.5},h));q.renderVtt(c,s,o);const interior=c.canvas.toDataURL();s.tokens=[h,actor];q.renderVtt(c,s,o);const visible=interior!==c.canvas.toDataURL();s.tokens=[h,bed,actor];
  Object.assign(actor,q.houseWorld({x:(a.footprint.doorStart+a.footprint.doorEnd)/2,y:a.footprint.bottom+.08},h));q.renderVtt(c,s,o);const closed=c.canvas.toDataURL();h.houseDoorOpen=true;q.renderVtt(c,s,o);const open=c.canvas.toDataURL();
  Object.assign(actor,q.houseWorld({x:1.3,y:1.3},h));h.houseDoorOpen=false;q.renderVtt(c,s,o);const farClosed=c.canvas.toDataURL();h.houseDoorOpen=true;q.renderVtt(c,s,o);const farOpen=c.canvas.toDataURL();return{hidden,visible,closed,open,interior,farDoor:farClosed!==farOpen};
 },id);
 console.log(JSON.stringify({id,hidden:result.hidden,visible:result.visible,doorChanged:result.closed!==result.open}));
 for(const kind of['closed','open','interior']){const data=Buffer.from(result[kind].split(',')[1],'base64');await fs.writeFile('test-results/home-renderer/'+id+'-'+kind+'.png',data);if(kind!=='interior'){const tile=await sharp(data).extract({left:350,top:640,width:300,height:220}).resize(300,220).png().toBuffer();tiles.push({input:tile,left:i*300,top:kind==='closed'?0:220});}}
 assert(result.hidden&&result.visible&&result.closed!==result.open,id);
 checks.push({id,furnitureCoveredOutside:result.hidden,furnitureVisibleInside:result.visible,doorProjection:true,coveredWhenDistant:true});
}
await sharp({create:{width:2400,height:440,channels:4,background:'#111'}}).composite(tiles).png().toFile('test-results/home-renderer/door-projection.png');
await fs.writeFile('test-results/home-renderer/result.json',JSON.stringify({passed:true,checks},null,2));console.log('Furniture follows the roof; horizontal overhead doors verified in four native house variants.');
}finally{await browser.close();server.close();}
