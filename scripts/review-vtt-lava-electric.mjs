import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
await fs.mkdir('test-results',{recursive:true});
await fs.copyFile('data/vtt/premium-art/monster-knight-v1.webp','test-results/lava-review-knight.webp');
const baseline=execFileSync('git',['show','15b6b2e:src/vtt-effects-elemental.ts'],{encoding:'utf8'}).replaceAll("from './","from '../src/").replace("from '../src/vtt-elemental-materials'", "from './lava-baseline-materials'");
await fs.writeFile('test-results/lava-baseline-elemental.ts',baseline);
await fs.writeFile('test-results/lava-baseline-materials.ts',execFileSync('git',['show','15b6b2e:src/vtt-elemental-materials.ts'],{encoding:'utf8'}));
const file='test-results/lava-electric-review.html';
await fs.writeFile(file,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#101a20;color:#dfcca6;font:16px Georgia}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px}figure{margin:0;border:1px solid #706b5b;background:#18242c}canvas{width:100%;height:auto;display:block}figcaption{text-align:center;padding:8px}#thumbs{display:flex;gap:12px;justify-content:center;padding:12px}#thumbs canvas{width:154px;height:154px;border:1px solid #665744;background:#18242c}</style></head><body><div class="grid" id="grid"></div><div id="thumbs"></div><script type="module">
import {renderEffect} from '/src/vtt-effects-canvas.ts';
import {effectLibrary} from '/shared/vtt-effects.ts';
import {effectFootprint} from '/src/vtt-effect-footprint.ts';
import {seededRandom} from '/src/vtt-effects-primitives.ts';
import {drawElementalEffect as current} from '/src/vtt-effects-elemental.ts';
import {drawElementalEffect as previous} from '/test-results/lava-baseline-elemental.ts';
import {elementalMaterialsReady} from '/src/vtt-elemental-materials.ts';
import {elementalMaterialsReady as baselineReady} from '/test-results/lava-baseline-materials.ts';
import {lavaSurfaceReady,lavaMaterial,lavaMaterialStatus} from '/src/vtt-lava-material.ts';
import {temporalFieldsReady} from '/src/vtt-effects-temporal.ts';
import {physicalPropsReady} from '/src/vtt-effects-physical.ts';
await Promise.all([elementalMaterialsReady,baselineReady,lavaSurfaceReady,temporalFieldsReady,physicalPropsReady]);
const art=new Image();art.src='/test-results/lava-review-knight.webp';await art.decode();
const kinds=['lava','chain-lightning'];
const make=(kind,scale=1)=>({id:kind,kind,color:effectLibrary.find(x=>x.kind===kind).color,scale,opacity:1,at:0,duration:0,intensity:.85});
function render(kind,t,withArt=true,scale=1,reduced=false){const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d');if(withArt){c.fillStyle='#887657';c.fillRect(0,0,420,420);}c.save();c.translate(210,210);const opts={now:t*1000,reducedMotion:reduced,image:art};renderEffect(c,make(kind,scale),170,170,{...opts,pass:'behind'});if(withArt)c.drawImage(art,-85,-85,170,170);renderEffect(c,make(kind,scale),170,170,{...opts,pass:'front'});c.restore();return can;}
function display(t=1.2){const grid=document.getElementById('grid'),thumbs=document.getElementById('thumbs');grid.innerHTML='';thumbs.innerHTML='';for(const kind of kinds){const fig=document.createElement('figure'),cap=document.createElement('figcaption');cap.textContent=effectLibrary.find(x=>x.kind===kind).name;fig.append(render(kind,t),cap);grid.append(fig);thumbs.append(render(kind,t,false));const c=thumbs.lastChild.getContext('2d');c.drawImage(art,125,125,170,170);}}
function metric(can){const p=can.getContext('2d').getImageData(0,0,420,420).data;let mass=0,minX=420,minY=420,maxX=0,maxY=0;for(let y=0;y<420;y++)for(let x=0;x<420;x++){const a=p[(y*420+x)*4+3];mass+=a;if(a>30){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}return{mass,width:maxX-minX,height:maxY-minY,edge: minX===0||minY===0||maxX===419||maxY===419};}
function direct(old,kind,t){const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d');c.translate(210,210);for(const front of [false,true])(old?previous:current)(c,make(kind),effectFootprint(170,170,100,100,art),t,seededRandom(kind),front,1);return can;}
window.review={render,display,status:lavaMaterialStatus,metric(kind,t){return metric(render(kind,t,false));},size(){return{old:metric(direct(true,'chain-lightning',1.2)),next:metric(direct(false,'chain-lightning',1.2))};},preserved(){return ['bless','sonic','acid-splash','water-geyser','tidal-wave','sand-veil','dimensional-rift','prism-pulse'].every(kind=>[.4,1.2,3.2].every(t=>direct(true,kind,t).toDataURL()===direct(false,kind,t).toDataURL()));},diff(a,b){const data=[a,b].map(t=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d');c.translate(210,210);lavaMaterial(c,t,300);return c.getImageData(0,0,420,420).data;});let change=0,mass=0;for(let i=0;i<data[0].length;i+=4)for(let k=0;k<4;k++){const a=k===3?data[0][i+3]:data[0][i+k]*data[0][i+3]/255,b=k===3?data[1][i+3]:data[1][i+k]*data[1][i+3]/255;change+=Math.abs(a-b);mass+=Math.max(a,b);}return change/Math.max(1,mass);},reduced(kind){return render(kind,2,false,1,true).toDataURL()===render(kind,5,false,1,true).toDataURL();},benchmark(){const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d');c.translate(210,210);const start=performance.now();for(let n=0;n<80;n++){c.clearRect(-210,-210,420,420);for(let i=0;i<6;i++)for(const pass of ['behind','front'])renderEffect(c,make(i%2?'chain-lightning':'lava'),130,130,{now:1000+n*33+i*123,image:art,reducedMotion:false,pass});}return(performance.now()-start)/80;},animate(){const start=performance.now();function next(){display((performance.now()-start)/1000+.3);if(performance.now()-start<6700)requestAnimationFrame(next);}next();}};display();
</script></body></html>`);
const server=await createServer({cacheDir:'node_modules/.vite-lava-electric-review',optimizeDeps:{entries:[file]},server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:960,height:650},recordVideo:{dir:'test-results/lava-electric-video',size:{width:960,height:650}}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(server.resolvedUrls.local[0]+file);await page.waitForFunction(()=>window.review);
 const result=await page.evaluate(()=>({status:review.status(),size:review.size(),preserved:review.preserved(),evolution:review.diff(.3,2.1),seam:review.diff(.001,6.401),reduced:['lava','chain-lightning'].every(k=>review.reduced(k)),benchmark:review.benchmark(),bounds:['lava','chain-lightning'].map(k=>review.metric(k,1.2))}));
 assert(result.status.ready&&result.status.gpu,'Native lava GPU flow unavailable');assert.equal(result.status.tiles,1);assert(result.preserved,'Another elemental effect changed');assert(result.evolution>.01&&result.seam<.02,'Lava flow must evolve and loop smoothly');assert(result.reduced,'Reduced motion changed');assert(result.size.next.width>result.size.old.width*1.2&&result.size.next.mass>result.size.old.mass*1.7,'Electric discharge did not enlarge');assert(result.bounds.every(x=>!x.edge));assert(result.benchmark<32,'Six effects exceeded the rendering budget');
 await page.screenshot({path:'test-results/lava-electric-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:700});await page.screenshot({path:'test-results/lava-electric-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:960,height:650});await page.evaluate(()=>review.animate());await page.waitForTimeout(6800);assert.deepEqual(errors,[]);
 await fs.writeFile('test-results/lava-electric-qa.json',JSON.stringify({...result,errors},null,2));console.log('PASS original flowing Lava, larger approved electrical links, eight other effects preserved, reduced motion/loop/bounds/mobile and six-effect performance.',JSON.stringify(result));
}finally{await context.close();await browser.close();await server.close();}
