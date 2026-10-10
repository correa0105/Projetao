import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const revision = '4a685db557588d44c6f6ed57f65180d3993b5ce6';
const directory = 'test-results/spectral-baseline';
await fs.mkdir(directory, { recursive: true });
for (const name of ['vtt-effects-rebuilt-atmosphere', 'vtt-effects-rebuilt', 'vtt-effects-elemental', 'vtt-effects-overhead']) {
  const previous = execFileSync('git', ['show', revision + ':src/' + name + '.ts'], { encoding: 'utf8' })
    .replaceAll("from './", "from '../../src/")
    .replaceAll("from '../shared/", "from '../../shared/")
    .replaceAll("from '../../src/vtt-effects-rebuilt-atmosphere'", "from './vtt-effects-rebuilt-atmosphere'")
    .replaceAll("from '../../src/vtt-effects-rebuilt'", "from './vtt-effects-rebuilt'")
    .replaceAll("from '../../src/vtt-effects-elemental'", "from './vtt-effects-elemental'");
  await fs.writeFile(directory + '/' + name + '.ts', previous);
}
await fs.copyFile('data/vtt/premium-art/monster-knight-v1.webp', 'test-results/spectral-knight.webp');
if (process.env.VTT_EFFECT_REVIEW_TOKEN) await fs.copyFile(process.env.VTT_EFFECT_REVIEW_TOKEN, 'test-results/spectral-private-token.png');
const file = 'test-results/spectral-water-review.html';
await fs.writeFile(file, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#101a20;color:#dfcca6;font:14px Georgia}.gallery{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:12px}.card{width:164px;border:1px solid #8e754e;border-radius:4px;background:radial-gradient(#21323a,#101a20);text-align:center;padding-bottom:12px}.card canvas{width:152px;height:112px}.maps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px}.maps figure{margin:0;border:1px solid #57666b}.maps canvas{display:block;width:100%;height:auto}.maps figcaption{text-align:center;padding:8px}#sequence{display:flex;flex-wrap:wrap;gap:8px;padding:12px;justify-content:center}#sequence canvas{width:152px;height:112px;background:#18242b}
</style></head><body><div id="gallery" class="gallery"></div><div id="maps" class="maps"></div><div id="sequence"></div><script type="module" src="/test-results/spectral-water-review.tsx"></script></body></html>`);
await fs.writeFile('test-results/spectral-water-review.tsx', `import React from 'react';
import {createRoot} from 'react-dom/client';
import {VttEffectPreview} from '/src/VttEffectPreview.tsx';
import {renderEffect} from '/src/vtt-effects-canvas.ts';
import {effectLibrary} from '/shared/vtt-effects.ts';
import {drawOverheadEffect as next} from '/src/vtt-effects-overhead.ts';
import {drawOverheadEffect as previous} from '/test-results/spectral-baseline/vtt-effects-overhead.ts';
import {drawElementalEffect} from '/src/vtt-effects-elemental.ts';
import {drawRebuiltAtmosphere} from '/src/vtt-effects-rebuilt-atmosphere.ts';
import {effectFootprint} from '/src/vtt-effect-footprint.ts';
import {seededRandom} from '/src/vtt-effects-primitives.ts';
import {effectMaterialsReady} from '/src/vtt-effects-materials.ts';
import {elementalMaterialsReady,elementalMaterial} from '/src/vtt-elemental-materials.ts';
import {temporalFieldsReady} from '/src/vtt-effects-temporal.ts';
import {physicalPropsReady} from '/src/vtt-effects-physical.ts';
import {lavaSurfaceReady} from '/src/vtt-lava-material.ts';
import {spectralPilgrimReady} from '/src/vtt-spectral-pilgrim.ts';
import {spectralScreamerReady,spectralScreamerLoaded} from '/src/vtt-spectral-screamer.ts';
const kinds=['water-geyser','ghost-wake','spirit-procession','wind-shear'];
const make=kind=>({...effectLibrary.find(e=>e.kind===kind),scale:1,opacity:1,at:0,duration:0,intensity:.85});
function Card({kind}){const [active,setActive]=React.useState(false);return <div className="card" tabIndex={0} onMouseEnter={()=>setActive(true)} onMouseLeave={()=>setActive(false)} onFocus={()=>setActive(true)} onBlur={()=>setActive(false)}><VttEffectPreview preset={make(kind)} animated={active}/>{make(kind).name}</div>;}
createRoot(document.getElementById('gallery')).render(<>{kinds.map(kind=><Card key={kind} kind={kind}/>)}</>);
await Promise.all([effectMaterialsReady,elementalMaterialsReady,temporalFieldsReady,physicalPropsReady,lavaSurfaceReady,spectralPilgrimReady,spectralScreamerReady]);
const art=new Image();art.src='/test-results/spectral-knight.webp';await art.decode();
const privateArt=new Image();privateArt.src='${process.env.VTT_EFFECT_REVIEW_TOKEN ? '/test-results/spectral-private-token.png' : '/test-results/spectral-knight.webp'}';await privateArt.decode();
// CPU comparison canvases avoid platform GPU rounding differences between
// identical draws. The actual React gallery and map canvases keep normal GPU
// rendering, including the animation and frame-budget checks.
function canvas(size=600){const surface=document.createElement('canvas');surface.width=surface.height=size;surface.getContext('2d',{willReadFrequently:true});return surface;}
function direct(kind,t,old=false,pass){const surface=canvas(),c=surface.getContext('2d');c.translate(300,300);const f=effectFootprint(200,200,100,100,art);for(const p of pass?[pass]:['behind','front'])(old?previous:next)(c,make(kind),f,t,seededRandom(kind),p,1);return surface;}
function render(kind,t,options={}){const thumb=options.thumb,size=thumb?152:420,height=thumb?112:420,surface=document.createElement('canvas');surface.width=size;surface.height=height;const c=surface.getContext('2d'),image=options.private?privateArt:art,width=thumb?68:180,tokenHeight=thumb?72:180;
if(options.background!==false){c.fillStyle=thumb?'#18242c':'#8b795c';c.fillRect(0,0,size,height);}c.save();c.translate(size/2,thumb?54:210);c.rotate(options.rotation||0);const opts={now:t*1000,reducedMotion:options.reduced||false,seed:'gallery',image,flipX:options.flipX,flipY:options.flipY};if(options.pass!=='front')renderEffect(c,make(kind),width,tokenHeight,{...opts,pass:'behind'});
if(options.token!==false){c.save();c.scale(options.flipX?-1:1,options.flipY?-1:1);const fit=Math.min(width/image.naturalWidth,tokenHeight/image.naturalHeight);c.drawImage(image,-image.naturalWidth*fit/2,-image.naturalHeight*fit/2,image.naturalWidth*fit,image.naturalHeight*fit);c.restore();}
if(options.pass!=='behind')renderEffect(c,make(kind),width,tokenHeight,{...opts,pass:'front'});c.restore();return surface;}
function metrics(surface){const p=surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data;let mass=0,x=0,y=0,edge=0;for(let py=0;py<surface.height;py++)for(let px=0;px<surface.width;px++){const a=p[(py*surface.width+px)*4+3];mass+=a;x+=a*(px-surface.width/2);y+=a*(py-surface.height/2);if(px===0||py===0||px===surface.width-1||py===surface.height-1)edge+=a;}return{mass,x:x/Math.max(1,mass),y:y/Math.max(1,mass),edge};}
function difference(a,b){const first=a.getContext('2d').getImageData(0,0,a.width,a.height).data,second=b.getContext('2d').getImageData(0,0,b.width,b.height).data;let diff=0,mass=0;for(let i=0;i<first.length;i+=4)for(let k=0;k<4;k++){const x=k===3?first[i+3]:first[i+k]*first[i+3]/255,y=k===3?second[i+3]:second[i+k]*second[i+3]/255;diff+=Math.abs(x-y);mass+=Math.max(x,y);}return diff/Math.max(1,mass);}
function display(t=1.25){const maps=document.getElementById('maps');maps.innerHTML='';for(const kind of kinds){const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=make(kind).name;figure.append(render(kind,t,{private:true}),caption);maps.append(figure);}}
window.review={display,render,screamerReady:spectralScreamerLoaded,
preserved(){const unchanged=effectLibrary.filter(e=>e.kind!=='death'&&!kinds.includes(e.kind));const changed=[];for(const e of unchanged)for(const t of [.4,1.25,3.2]){direct(e.kind,t,true);direct(e.kind,t);if(direct(e.kind,t,true).toDataURL()!==direct(e.kind,t).toDataURL())changed.push({kind:e.kind,t});}return{count:unchanged.length,changed};},
water(){const equal=[],front=[];for(const t of [.4,1.25,3.2]){const approved=canvas(),c=approved.getContext('2d'),f=effectFootprint(200,200,100,100,art);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.translate(300,300);c.scale(f.plane.rx/80,f.plane.ry/80);elementalMaterial(c,'water',t*.8,0,0,250,245,0,.92);equal.push(approved.toDataURL()===direct('water-geyser',t,false,'behind').toDataURL());front.push(metrics(direct('water-geyser',t,false,'front')).mass);}return{equal,front};},
wake(){return [false,true].flatMap(privateToken=>[false,true].flatMap(flipY=>[0,Math.PI/2,Math.PI,Math.PI*1.5].map(rotation=>{const value=metrics(render('ghost-wake',1.25,{token:false,background:false,private:privateToken,rotation,flipY,pass:'behind'}));const rear=(flipY?1:-1)*(value.x*(-Math.sin(rotation))+value.y*Math.cos(rotation));return{privateToken,flipY,rotation,rear,front:metrics(render('ghost-wake',1.25,{token:false,background:false,pass:'front'})).mass};})));},
oneGhost(){return [.4,1.25,3.2,7.6,10.9].map(t=>{const surface=canvas(),c=surface.getContext('2d'),native=c.drawImage.bind(c);let rows=0,behind=0,front=0;let phase=false;c.drawImage=(image,...args)=>{if(image instanceof HTMLImageElement&&image.src.includes('screaming-wraith')){rows++;if(phase)front++;else behind++;}return native(image,...args);};for(const p of [false,true]){phase=p;drawRebuiltAtmosphere(c,make('spirit-procession'),effectFootprint(200,200,100,100,art),t,seededRandom('review'),p,1);}return{t,rows,behind,front};});},
motion(){return Object.fromEntries(kinds.map(kind=>[kind,{evolution:difference(render(kind,.7,{token:false,background:false}),render(kind,2.7,{token:false,background:false})),step:difference(render(kind,1.25,{token:false,background:false}),render(kind,1.25+1/60,{token:false,background:false})),reduced:render(kind,1.2,{token:false,background:false,reduced:true}).toDataURL()===render(kind,6.2,{token:false,background:false,reduced:true}).toDataURL()}]));},
bounds(){return kinds.flatMap(kind=>[.4,1.25,3.2,7.6,10.9].map(t=>({kind,t,...metrics(render(kind,t,{token:false,background:false,thumb:true}))})));},
sequence(kind){const grid=document.getElementById('sequence');grid.innerHTML='';for(const t of [.4,1.25,3.2,5.6,7.6,10.9])grid.append(render(kind,t,{thumb:true}));},
benchmark(){const start=performance.now();for(let i=0;i<80;i++)for(const kind of kinds)render(kind,1+i/30,{token:false,background:false});return(performance.now()-start)/80;},
animate(){const start=performance.now();function frame(){display((performance.now()-start)/1000+.4);if(performance.now()-start<6900)requestAnimationFrame(frame);}frame();}};
display();
`);
const server = await createServer({
  cacheDir: 'node_modules/.vite-spectral-water-review',
  optimizeDeps: { entries: [file] },
  server: { host: '127.0.0.1', port: 0 },
});
server.middlewares.use('/api/vtt/premium-art/monster-knight', async (_request, response) => {
  response.setHeader('Content-Type', 'image/webp');
  response.end(await fs.readFile('data/vtt/premium-art/monster-knight-v1.webp'));
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 960, height: 840 }, recordVideo: { dir: 'test-results/spectral-water-video', size: { width: 960, height: 840 } } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
const knight = await fs.readFile('data/vtt/premium-art/monster-knight-v1.webp');
await page.route('**/api/vtt/premium-art/monster-knight', route => route.fulfill({ status: 200, contentType: 'image/webp', body: knight }));
try {
  await page.goto(server.resolvedUrls.local[0] + file);
  await page.waitForFunction(() => window.review?.screamerReady());
  const results = await page.evaluate(() => ({
    preserved: review.preserved(), water: review.water(), wake: review.wake(),
    oneGhost: review.oneGhost(), motion: review.motion(), bounds: review.bounds(), benchmark: review.benchmark(),
  }));
  await fs.writeFile('test-results/spectral-water-qa.json', JSON.stringify({ revision, ...results, errors }, null, 2));
  await page.screenshot({ path: 'test-results/spectral-water-desktop.png', fullPage: true });
  for (const kind of ['spirit-procession', 'wind-shear', 'water-geyser', 'ghost-wake']) {
    await page.evaluate(kind => review.sequence(kind), kind);
    await page.locator('#sequence').screenshot({ path: 'test-results/' + kind + '-sequence.png' });
  }
  assert.equal(results.preserved.count, 101);
  assert.deepEqual(results.preserved.changed, [], 'Another effect changed');
  assert(results.water.equal.every(Boolean), 'Approved water base changed');
  assert(results.water.front.every(mass => mass === 0), 'Rigid geyser foreground remained');
  assert(results.wake.every(value => value.rear > 25 && value.front === 0), 'Wake must leave the rear under rotation and mirroring');
  assert(results.oneGhost.every(value => value.rows === 32 && (value.behind === 0 || value.front === 0)), 'More than one illustrated ghost, or duplicate depth pass');
  assert(Object.values(results.motion).every(value => value.evolution > .035 && value.reduced), 'Frozen animation or reduced-motion instability');
  assert(results.motion['wind-shear'].step < .18 && results.motion['spirit-procession'].step < .18, 'Abrupt motion');
  assert(results.benchmark < 32, 'Four effects exceeded the frame submission budget');
  assert(results.bounds.filter(value => value.kind !== 'ghost-wake').every(value => value.edge < 500), 'A rebuilt thumbnail clips visibly');
  await page.setViewportSize({ width: 390, height: 760 });
  await page.screenshot({ path: 'test-results/spectral-water-mobile.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.setViewportSize({ width: 960, height: 840 });
  await page.locator('.card').nth(2).hover();
  await page.evaluate(() => review.animate());
  await page.waitForTimeout(7000);
  await context.close();
  assert.deepEqual(errors, []);
  console.log('PASS four revised VFX, exact approved water base, rear wake under rotations and mirrors, one native wraith, 101 other effects unchanged, actual gallery/mobile, animation, reduced motion and performance.', JSON.stringify(results));
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
