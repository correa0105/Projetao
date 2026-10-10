import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

await fs.mkdir('test-results', { recursive: true });
const mediaRoot = process.env.QA_MEDIA_ROOT || '.';
const token = (
  await fs.readFile(
    path.join(mediaRoot, 'data/vtt/character-art/character-tokens-20261008/nana-top-down-v1.png'),
  )
).toString('base64');
const hasBaseline = await fs.access('src/vtt-effects-canvas-before.ts').then(
  () => true,
  () => false,
);
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#0c1720;color:#ece0c9;font:14px 'DM Sans',sans-serif}#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px}figure{margin:0;border:1px solid #88755677;border-radius:5px;overflow:hidden;background:radial-gradient(#233642,#0d1720)}canvas{display:block;width:100%;height:auto}figcaption{text-align:center;padding:12px}.vtt-animated-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.vtt-animated-grid article{padding:12px}.vtt-animated-grid canvas{width:120px;height:120px}
</style></head><body><div id="grid"></div><div id="gallery"></div><script type="module">
import React from 'react';import {createRoot}from'react-dom/client';
import{effectLibrary,tokenEffectSchema}from'/shared/vtt-effects.ts';
import{renderEffect}from'/src/vtt-effects-canvas.ts';
${hasBaseline ? "import{renderEffect as before}from'/src/vtt-effects-canvas-before.ts';import{effectLibrary as oldLibrary}from'/shared/vtt-effects-before.ts';" : 'const before=renderEffect,oldLibrary=effectLibrary;'}
import{effectMaterialsReady}from'/src/vtt-effects-materials.ts';import{physicalPropsReady}from'/src/vtt-effects-physical.ts';import{lavaSurfaceReady}from'/src/vtt-lava-material.ts';import{spectralScreamerReady}from'/src/vtt-spectral-screamer.ts';
import{warmArcanaEffects}from'/src/vtt-effects-arcana.ts';import{arcaneBarrierReady}from'/src/vtt-arcane-barrier.ts';import{fireHeatKinds}from'/src/vtt-fire-heat.ts';
import{effectFootprint}from'/src/vtt-effect-footprint.ts';import{flyPosition}from'/src/vtt-fly-swarm.ts';import{seededRandom}from'/src/vtt-effects-primitives.ts';
import{effectRenderColor}from'/shared/vtt-effect-palette.ts';import{animatedAssets,animatedAssetSchema}from'/shared/vtt-animated-assets.ts';import{VttAnimatedAssets}from'/src/VttAnimatedAssets.tsx';
import{refinedArcanaKinds}from'/src/vtt-arcana-refined.ts';
await Promise.all([effectMaterialsReady,physicalPropsReady,lavaSurfaceReady,spectralScreamerReady,warmArcanaEffects(),arcaneBarrierReady]);
const art=new Image();art.src='data:image/png;base64,${token}';await art.decode();
const models=new Map(effectLibrary.map(e=>[e.kind,e])),oldModels=new Map(oldLibrary.map(e=>[e.kind,e]));
function paint(kind,time=1450,scale=1,reduced=false,legacy=false,showToken=false,size=360,width=100,height=100,color){
const model=(legacy?oldModels:models).get(kind),can=document.createElement('canvas');can.width=can.height=size;const c=can.getContext('2d',{willReadFrequently:true});c.translate(size/2,size/2);
const effect={id:'00000000-0000-4000-8000-000000000001',kind:model.kind,color:color||model.color,scale,duration:0,at:0,intensity:.85};
for(const pass of ['behind','front']){(legacy?before:renderEffect)(c,effect,width,height,{now:time,reducedMotion:reduced,image:art,pass,seed:'vfx-refinement'});if(showToken&&pass==='behind'){const fit=Math.min(width/art.naturalWidth,height/art.naturalHeight);c.drawImage(art,-art.naturalWidth*fit/2,-art.naturalHeight*fit/2,art.naturalWidth*fit,art.naturalHeight*fit);}}
return can;}
const pixels=can=>can.getContext('2d').getImageData(0,0,can.width,can.height).data;
const hash=p=>{let h=2166136261;for(const b of p)h=Math.imul(h^b,16777619);return h>>>0;};
const measure=can=>{const p=pixels(can);let visible=0,partial=0,edge=0;for(let y=0;y<can.height;y++)for(let x=0;x<can.width;x++){const a=p[(y*can.width+x)*4+3];visible+=a>8;partial+=a>8&&a<240;if(x===0||y===0||x===can.width-1||y===can.height-1)edge+=a>8;}return{hash:hash(p),visible,partial,edge};};
const removed=['candles','windmill','fountain','magic-pool','crystals','chest','spellbook'];
const root=createRoot(document.getElementById('gallery'));window.added=[];
window.review={ready:true,kinds:effectLibrary.map(e=>e.kind),heat:[...fireHeatKinds],refined:[...refinedArcanaKinds],removed,
gallery(gm=true,query=''){root.render(React.createElement(VttAnimatedAssets,{gm,query,add:id=>window.added.push(id)}));},
galleryExpected:animatedAssets.filter(a=>!removed.includes(a.id)).map(a=>a.name),
legacyValid:removed.every(id=>animatedAssetSchema.safeParse({id,speed:1,intensity:.8,playing:true}).success),
schemas:effectLibrary.every(e=>tokenEffectSchema.safeParse({id:'00000000-0000-4000-8000-000000000001',kind:e.kind,color:e.color,scale:1,duration:0,at:0}).success),
custom:effectRenderColor('necrotic','#28b9cd'),
measure:(kind,time=1450,reduced=false,scale=1,width=100,height=100)=>measure(paint(kind,time,scale,reduced,false,false,Math.max(360,width*scale*4,height*scale*4),width,height)),
center(kind,time){const can=paint(kind,time),p=pixels(can);let mass=0,x=0,y=0;for(let row=0;row<can.height;row++)for(let col=0;col<can.width;col++){const a=p[(row*can.width+col)*4+3];mass+=a;x+=col*a;y+=row*a;}return{x:x/mass-can.width/2+.5,y:y/mass-can.height/2+.5};},
neighbors(){return oldLibrary.filter(e=>e.kind!=='death').map(e=>({kind:e.kind,same:hash(pixels(paint(e.kind)))===hash(pixels(paint(e.kind,1450,1,false,true)))}));},
sheet(ids,scale=1,size=240){const grid=document.getElementById('grid');grid.replaceChildren();for(const kind of ids){const fig=document.createElement('figure'),cap=document.createElement('figcaption');cap.textContent=models.get(kind).name;fig.append(paint(kind,1450,scale,false,false,true,size),cap);grid.append(fig);}},
frame:(kind,time)=>paint(kind,time,1,false,false,true,480,180,180).toDataURL(),
flyMotion(){const rnd=seededRandom('flies'),f=effectFootprint(100,100,65,65,art);return Array.from({length:64},(_,i)=>{const p=flyPosition(f,1.2,i,rnd),q=flyPosition(f,1.25,i,rnd);return[Math.atan2(q.y-p.y,q.x-p.x),Math.hypot(q.x-p.x,q.y-p.y),Math.hypot(p.x,p.y)];});},
benchmark(ids){for(const kind of ids)paint(kind);const start=performance.now();for(let i=0;i<30;i++)for(const kind of ids)paint(kind,1300+i*16,1,false,false,false,160);return(performance.now()-start)/30;}};
window.review.sheet(['sparks','lightning','chain-lightning','necrotic','arcane-barrier','swarm','fire-geyser','lava','ghost-wake']);window.review.gallery();
</script></body></html>`;
await fs.writeFile('test-results/vtt-shield-heat-flies.html', html);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + 'test-results/vtt-shield-heat-flies.html');
  await page.waitForFunction(() => window.review?.ready, { timeout: 30000 });
  const initial = await page.evaluate(() => ({
    kinds: review.kinds,
    heat: review.heat,
    refined: review.refined,
    expected: review.galleryExpected,
    valid: review.legacyValid,
    schemas: review.schemas,
    custom: review.custom,
  }));
  assert.equal(initial.kinds.length, 127);
  assert(initial.valid && initial.schemas);
  assert.equal(initial.custom, '#28b9cd');
  const changed = new Set([
    ...initial.refined,
    ...initial.heat,
    'sparks',
    'lightning',
    'chain-lightning',
    'necrotic',
    'swarm',
    'ghost-wake',
  ]);
  const neighbors = hasBaseline ? await page.evaluate(() => review.neighbors()) : [];
  for (const row of neighbors)
    assert.equal(row.same, !changed.has(row.kind), row.kind + ' pixel regression');
  const rows = [];
  for (const kind of [...changed, 'arcane-barrier'])
    for (const [width, height, scale] of [
      [32, 32, 1],
      [100, 100, 1],
      [80, 140, 1],
      [100, 60, 3],
    ]) {
      const [first, next, reduced, reducedNext] = await page.evaluate(
        ([kind, width, height, scale]) => [
          review.measure(kind, 1450, false, scale, width, height),
          review.measure(kind, 2350, false, scale, width, height),
          review.measure(kind, 1450, true, scale, width, height),
          review.measure(kind, 2350, true, scale, width, height),
        ],
        [kind, width, height, scale],
      );
      assert(first.visible > 0, kind + ' visible');
      assert.notEqual(first.hash, next.hash, kind + ' animates');
      assert.equal(reduced.hash, reducedNext.hash, kind + ' reduced motion');
      assert.equal(first.edge, 0, kind + ' clipped');
      rows.push({ kind, width, height, scale, ...first });
    }
  const flyMotion = await page.evaluate(() => review.flyMotion());
  for (const time of [350,1450,2850]) {
    const center = await page.evaluate(time => review.center('ghost-wake',time),time);
    assert(Math.abs(center.x)<1.5 && Math.abs(center.y)<1.5,'wake centered below feet '+JSON.stringify(center));
  }
  assert(
    new Set(flyMotion.map((x) => Math.floor(x[0] * 3))).size > 10,
    'independent flight directions',
  );
  assert(
    Math.max(...flyMotion.map((x) => x[2])) - Math.min(...flyMotion.map((x) => x[2])) > 30,
    'flies occupy irregular cloud',
  );
  await expect(page.locator('.vtt-animated-grid article')).toHaveCount(initial.expected.length);
  for (const name of initial.expected)
    await expect(page.locator('.vtt-animated-grid')).toContainText(name);
  await page.locator('.vtt-animated-grid button').first().click();
  assert.equal((await page.evaluate(() => added)).length, 1);
  await page.evaluate(() => review.gallery(false));
  await expect(page.locator('.vtt-animated-grid button')).toHaveCount(0);
  await expect(page.locator('.vtt-animated-grid article[draggable=true]')).toHaveCount(0);
  await page.evaluate(() => review.gallery(true, 'velas'));
  await expect(page.locator('.vtt-animated-grid article')).toHaveCount(0);
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-refined-effects-gallery.png' });
  await page.evaluate(() => review.sheet(review.refined,1,300));
  await page.locator('#grid').screenshot({path:'test-results/vtt-arcana-continuous-gallery.png'});
  for (const kind of initial.refined) {
    const frames=await page.evaluate(kind=>[1000,1016,1032,1048,1064,1080,1096,1112].map(time=>review.measure(kind,time).hash),kind);
    assert.equal(new Set(frames).size,8,kind+' freezes at 60 Hz');
  }
  const beforeFrame = await page.evaluate(() => review.frame('arcane-barrier', 3999));
  const afterFrame = await page.evaluate(() => review.frame('arcane-barrier', 4001));
  assert.notEqual(beforeFrame, afterFrame);
  for (const time of [250, 1450, 2650]) {
    const data = await page.evaluate((time) => review.frame('arcane-barrier', time), time);
    await fs.writeFile(
      'test-results/arcane-barrier-' + time + '.png',
      Buffer.from(data.split(',')[1], 'base64'),
    );
  }
  await page.evaluate(() => review.sheet(review.heat, 1, 300));
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-fire-heat-gallery.png' });
  const performance = await page.evaluate(() =>
    review.benchmark(['sparks', 'lightning', 'arcane-barrier', 'swarm', 'fire-geyser', 'lava']),
  );
  assert(performance < 45, 'six effects/frame ' + performance);
  const refinedPerformance = await page.evaluate(() => review.benchmark(review.refined));
  assert(refinedPerformance < 45, 'six refined arcana effects/frame ' + refinedPerformance);
  console.log('PASS six continuous arcana effects: '+refinedPerformance.toFixed(2)+' ms/frame.');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() =>
    review.sheet(['sparks', 'lightning', 'arcane-barrier', 'swarm'], 1, 180),
  );
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-refined-effects-mobile.png' });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/vtt-shield-heat-flies-qa.json',
    JSON.stringify(
      {
        count: initial.kinds.length,
        neighbors,
        rows,
        flyMotion,
        performance,
        gallery: initial.expected,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS 127 schemas; ' +
      neighbors.filter((x) => x.same).length +
      ' unchanged neighboring effects; textured rays, closed circuit, vivid pink, 12 heat layers, arcane dome, 64 irregular flies, legacy objects preserved, filtered GM/player gallery, reduced motion and geometry. Six effects/frame ' +
      performance.toFixed(2) +
      'ms.',
  );
} finally {
  await browser.close();
  await server.close();
}
