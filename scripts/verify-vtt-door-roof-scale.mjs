import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {build} from 'esbuild';import {chromium} from 'playwright';import sharp from 'sharp';
const folder='test-results/human-scale';await fs.mkdir(folder,{recursive:true});
const bundle=await build({stdin:{contents:"export{vttVisualSource}from'./shared/vtt-asset-visuals';export{renderVtt}from'./src/vtt-canvas';export{newScene,newToken}from'./shared/vtt';export{houseAssets,houseWorld}from'./shared/vtt-houses';export{createNatureToken}from'./shared/vtt-nature-placement';export{natureAssets}from'./shared/vtt-nature-assets';export{objectSpriteBounds}from'./src/vtt-object-sprites';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'ScaleQA',platform:'browser'});
const humanRoute='/api/vtt/assets/00000000-0000-4000-8000-000000000001/top-down';
let humanFile='.local/human-player-reference.png';try{await fs.access(humanFile);}catch{humanFile='data/vtt/overhead-20261015/resident-001.png';}
const server=createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas></canvas>');return;}try{res.setHeader('Content-Type',(req.url.endsWith('.png')||req.url===humanRoute)?'image/png':'image/webp');res.end(await fs.readFile(req.url===humanRoute?humanFile:path.resolve('public','.'+req.url)));}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle.outputFiles[0].text});
 const checks=await page.evaluate(async()=>{
  const q=ScaleQA,canvas=document.querySelector('canvas');canvas.width=canvas.height=1000;const c=canvas.getContext('2d'),checks=[];
  for(const id of ['house-002','house-013','commerce-002','commerce-024'])for(const rotation of [0,90,180,270])for(const flipX of [false,true]){
   const a=q.houseAssets.find(a=>a.id===id),s=q.newScene(crypto.randomUUID());s.width=s.height=1000;s.lighting=s.fog=false;s.grid.opacity=0;
   const h=q.newToken(crypto.randomUUID(),s),actor=q.newToken(crypto.randomUUID(),s);Object.assign(h,{layer:'map',image:a.image,x:500,y:500,width:a.width*35,height:a.height*35,rotation,flipX});s.tokens=[h];
   const images=new Map();for(const src of[a.image,a.interior,'/vtt/house-parts-20261014/door-vertical.webp']){const im=new Image();im.src=q.vttVisualSource(src);await im.decode();images.set(src,im);}
   const o={camera:{x:500,y:500,zoom:1},width:1000,height:1000,dpr:1,images,selected:[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false};
   const paint=open=>{h.houseDoorOpen=open;q.renderVtt(c,s,o);return c.getImageData(0,0,1000,1000).data;};
   const closed=paint(false),open=paint(true),roof=document.createElement('canvas');roof.width=roof.height=1000;const rc=roof.getContext('2d');rc.translate(500,500);rc.rotate(rotation*Math.PI/180);rc.scale(flipX?-1:1,1);rc.drawImage(images.get(a.image),-h.width/2,-h.height/2,h.width,h.height);const mask=rc.getImageData(0,0,1000,1000).data;
   let leak=0,diff=0;for(let i=0;i<mask.length;i+=4)if(closed[i]!==open[i]||closed[i+1]!==open[i+1]||closed[i+2]!==open[i+2]){diff++;if(mask[i+3]===255)leak++;}
   Object.assign(actor,{...q.houseWorld({x:.5,y:.5},h),width:25,height:25,vision:0});s.tokens=[h,actor];o.selected=[actor.id];const insideClosed=paint(false),insideOpen=paint(true);let inside=0;for(let i=0;i<insideClosed.length;i++)if(insideClosed[i]!==insideOpen[i])inside++;
   Object.assign(actor,q.houseWorld({x:a.footprint.left+.04,y:a.footprint.bottom+.025},h));const fadedClosed=paint(false),fadedOpen=paint(true);let faded=0;for(let i=0;i<fadedClosed.length;i++)if(fadedClosed[i]!==fadedOpen[i])faded++;
   checks.push({id,rotation,flipX,opaqueRoofLeaks:leak,exposedDoorPixels:diff,interiorDoor:inside>0,fadedDoor:faded>0});
  }return checks;
 });
 for(const check of checks){assert.equal(check.opaqueRoofLeaks,0,JSON.stringify(check));assert(check.interiorDoor&&check.fadedDoor,JSON.stringify(check));}
 const proofs=[];
 for(const id of ['house-016','house-017','commerce-001','commerce-002','commerce-003','commerce-023','commerce-024']){
  const result=await page.evaluate(async id=>{
   const q=ScaleQA,a=q.houseAssets.find(a=>a.id===id),s=q.newScene(crypto.randomUUID());s.grid.size=60;s.grid.opacity=.18;s.lighting=s.fog=false;s.width=Math.max(280,a.width*60+100);s.height=Math.max(280,a.height*60+100);
   const canvas=document.querySelector('canvas');canvas.width=s.width;canvas.height=s.height;const c=canvas.getContext('2d'),h=q.newToken(crypto.randomUUID(),s),actor=q.newToken(crypto.randomUUID(),s);
   Object.assign(h,{layer:'map',image:a.image,x:s.width/2,y:s.height/2,width:a.width*60,height:a.height*60});Object.assign(actor,{name:'Humano · 1 quadrado',image:'/api/vtt/assets/00000000-0000-4000-8000-000000000001/top-down',width:60,height:60,vision:0,...q.houseWorld({x:.5,y:.55},h)});s.tokens=[h,actor];
   const images=new Map();for(const src of[a.image,a.interior,'/vtt/house-parts-20261014/door-vertical.webp',actor.image]){const im=new Image();im.src=q.vttVisualSource(src);await im.decode();images.set(src,im);}
   q.renderVtt(c,s,{camera:{x:s.width/2,y:s.height/2,zoom:1},width:s.width,height:s.height,dpr:1,images,selected:[actor.id],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false});c.save();c.setTransform(1,0,0,1,0,0);c.font='16px Arial';c.textAlign='center';c.fillStyle='#e5cf9e';c.fillText(a.name+' · '+a.width+' × '+a.height+' quadrados',s.width/2,25);c.restore();
   return {png:canvas.toDataURL(),width:s.width,height:s.height};
  },id);await fs.writeFile(folder+'/'+id+'.png',Buffer.from(result.png.split(',')[1],'base64'));proofs.push({id,...result,png:undefined});
 }
 const beds=await page.evaluate(async()=>{
  const q=ScaleQA,s=q.newScene(crypto.randomUUID());s.width=700;s.height=450;s.grid.size=100;s.grid.opacity=.2;s.lighting=s.fog=false;const canvas=document.querySelector('canvas');canvas.width=700;canvas.height=450;const c=canvas.getContext('2d');
  const single=q.createNatureToken(crypto.randomUUID(),'furniture-011',s,{x:260,y:220}),double=q.createNatureToken(crypto.randomUUID(),'furniture-012',s,{x:460,y:220}),actor=q.newToken(crypto.randomUUID(),s);Object.assign(actor,{x:100,y:230,width:100,height:100,image:'/api/vtt/assets/00000000-0000-4000-8000-000000000001/top-down',name:'Humano · 1 quadrado',vision:0});s.tokens=[single,double,actor];const images=new Map();for(const src of s.tokens.map(t=>t.image)){const im=new Image();im.src=q.vttVisualSource(src);await im.decode();images.set(src,im);}
  q.renderVtt(c,s,{camera:{x:350,y:225,zoom:1},width:700,height:450,dpr:1,images,selected:[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false});c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#e5cf9e';c.textAlign='center';c.font='15px Arial';c.fillText('Solteiro · 0,95 × 2,10 m',single.x,single.y+single.height/2+32);c.fillText('Casal · 1,60 × 2,10 m',double.x,double.y+double.height/2+32);c.restore();return {png:canvas.toDataURL(),single:{width:single.width,height:single.height},double:{width:double.width,height:double.height}};
 });assert.equal(beds.single.height,beds.double.height);assert(beds.double.width>beds.single.width*1.6);await fs.writeFile(folder+'/camas-e-humano.png',Buffer.from(beds.png.split(',')[1],'base64'));
 const left=await fs.readFile(folder+'/commerce-002.png'),right=await fs.readFile(folder+'/commerce-003.png'),lm=await sharp(left).metadata(),rm=await sharp(right).metadata();await fs.writeFile(folder+'/taverna-boticario-mesma-escala.png',await sharp({create:{width:lm.width+rm.width,height:Math.max(lm.height,rm.height),channels:4,background:'#0e151d'}}).composite([{input:left,left:0,top:0},{input:right,left:lm.width,top:0}]).png().toBuffer());
 await fs.writeFile(folder+'/door-roof-result.json',JSON.stringify({passed:true,checks,proofs,beds:{single:beds.single,double:beds.double}},null,2));console.log(checks.length+' rotated/flipped roofs cover doors; interior/faded doors and human-scale proofs passed.');
}finally{await browser.close();server.close();}
