import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
await fs.mkdir('test-results', { recursive: true });
if (!(await fs.stat('.local/membrane-baseline/src/vtt-effects-canvas.ts').catch(() => null))) {
  await fs.mkdir('.local/membrane-baseline', { recursive: true });
  execFileSync(
    'git',
    ['archive', '033e860', 'src', 'shared', '-o', '.local/membrane-baseline.tar'],
    { windowsHide: true },
  );
  execFileSync('tar', ['-xf', '.local/membrane-baseline.tar', '-C', '.local/membrane-baseline'], {
    windowsHide: true,
  });
}
if (!(await fs.stat('test-results/private-effect-review.png').catch(() => null)))
  await fs.copyFile(
    'data/vtt/character-art/character-tokens-20261008/nana-top-down-v1.png',
    'test-results/private-effect-review.png',
  );
const html = `<style>body{margin:0;background:#101b24;color:#dccbaa;font:13px Georgia}#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px}figure{margin:0;border:1px solid #9c845544;background:radial-gradient(#223442,#101b24)}figure canvas{display:block;width:100%}figcaption{text-align:center;padding:10px}#preview button{background:#101b24;border:1px solid #9c8455;color:#dccbaa}#preview canvas{width:152px;height:112px}</style><div id="grid"></div><div id="preview"></div><script type="module">
import React from'react';import{createRoot}from'react-dom/client';import{VttEffectPreview}from'/src/VttEffectPreview.tsx';import{renderEffect,drawTokenEffects}from'/src/vtt-effects-canvas.ts';import{renderEffect as before}from'/.local/membrane-baseline/src/vtt-effects-canvas.ts';import{effectLibrary}from'/shared/vtt-effects.ts';import{sceneOrientedEffect}from'/src/vtt-effect-orientation.ts';import{drawArcaneBarrier,arcaneBarrierShape,ARCANE_BARRIER_PERIOD}from'/src/vtt-arcane-membrane.ts';
import{colorDepthKinds}from'/src/vtt-effect-color-depth.ts';
async function warm(prefix){const files={'vtt-effects-materials':'effectMaterialsReady','vtt-effects-temporal':'temporalFieldsReady','vtt-effects-physical':'physicalPropsReady','vtt-elemental-materials':'elementalMaterialsReady','vtt-lava-material':'lavaSurfaceReady','vtt-spectral-screamer':'spectralScreamerReady','vtt-arcane-barrier':'arcaneBarrierReady'};await Promise.all(Object.entries(files).map(async([file,key])=>(await import(/* @vite-ignore */prefix+file+'.ts'))[key]));await(await import(/* @vite-ignore */prefix+'vtt-effects-arcana.ts')).warmArcanaEffects();await(await import(/* @vite-ignore */prefix+'vtt-effects-living.ts')).warmLivingEffects();}
await Promise.all([warm('/src/'),warm('/.local/membrane-baseline/src/')]);
const art=new Image();art.src='/test-results/private-effect-review.png';await art.decode();
const model=effectLibrary.find(e=>e.kind==='arcane-barrier');
const e={id:'00000000-0000-4000-8000-000000000001',kind:model.kind,color:model.color,scale:1,duration:0,at:0,intensity:1};
window.frame=(t,show=false,color=e.color,intensity=1,reduced=false,w=160,h=160,render=renderEffect,kind='arcane-barrier',gpu=true)=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d',gpu?{}:{willReadFrequently:true});c.translate(210,210);for(const pass of['behind','front']){render(c,{...e,kind,color,intensity},w,h,{now:t*1000,reducedMotion:reduced,image:art,pass});if(show&&pass==='behind')c.drawImage(art,-w/2,-h/2,w,h);}return can;};
window.raw=t=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d',{willReadFrequently:true});c.translate(210,210);drawArcaneBarrier(c,e,{plane:{rx:80,ry:80}},t,'behind');return can;};
window.data=c=>c.getContext('2d').getImageData(0,0,420,420).data;
window.delta=(a,b)=>{let sum=0,total=0;for(let i=3;i<a.length;i+=4){sum+=Math.abs(a[i]-b[i]);total+=Math.max(a[i],b[i]);}return sum/Math.max(1,total);};
window.metrics=()=>{const rows=Array.from({length:14},(_,i)=>{const t=.25+i*5.6/14,p=data(raw(t));let radius=0,visible=0,mass=0;for(let y=0;y<420;y++)for(let x=0;x<420;x++){const a=p[(y*420+x)*4+3];if(a>28)radius=Math.max(radius,Math.hypot(x-209.5,y-209.5));visible+=a>8;mass+=a;}return{t,radius,visible,mass};});const aperture=t=>{const s=arcaneBarrierShape(t),hole=s.apertures[0],x=Math.round(210+Math.cos(hole.angle)*s.radius*hole.center*168),y=Math.round(210+Math.sin(hole.angle)*s.radius*hole.center*168);return data(raw(t))[(y*420+x)*4+3];};const low=data(frame(1.4,false,e.color,.35)),normal=data(frame(1.4)),zero=data(frame(1.4,false,e.color,0)),white=data(frame(1.4,false,'#ffffff'));let lowSum=0,sum=0,zeroSum=0,whiteError=0,edge=0;for(let i=3;i<normal.length;i+=4){sum+=normal[i];lowSum+=low[i];zeroSum+=zero[i];if(white[i]>40)whiteError=Math.max(whiteError,Math.abs(white[i-3]-white[i-2]),Math.abs(white[i-2]-white[i-1]));}for(let y=0;y<420;y++)for(let x=0;x<420;x++)if(x===0||y===0||x===419||y===419)edge+=normal[(y*420+x)*4+3]>8;const a=data(frame(1.4,false,e.color,1,true)),b=data(frame(3.4,false,e.color,1,true));return{rows,openAlpha:aperture(1.4),closedAlpha:aperture(4.2),seam:delta(data(raw(5.599)),data(raw(5.601))),step:delta(data(raw(5.592)),data(raw(5.608))),reduced:a.every((v,i)=>v===b[i]),intensity:lowSum/sum,zeroSum,whiteError,edge};};
window.neighbors=()=>effectLibrary.filter(e=>!colorDepthKinds.has(e.kind)&&!['arcane-barrier','death','aether-drops','opal-cascade','starlit-fall'].includes(e.kind)).map(m=>{const a=data(frame(1.4,false,m.color,1,false,100,100,renderEffect,m.kind,false)),b=data(frame(1.4,false,m.color,1,false,100,100,before,m.kind,false));let max=0;for(let i=0;i<a.length;i+=4){max=Math.max(max,Math.abs(a[i+3]-b[i+3]));for(let j=0;j<3;j++)max=Math.max(max,Math.abs(a[i+j]*a[i+3]-b[i+j]*b[i+3])/255);}return{kind:m.kind,max};});
window.colorDepth=()=>effectLibrary.filter(e=>colorDepthKinds.has(e.kind)).map(m=>{let alphaMax=0,alphaDiff=0,alphaMass=0,difference=0,pixels=0,brightness=0,oldBrightness=0,light=0,oldLight=0,lost=0,added=0;for(const t of[.8,1.4,2.7]){const a=data(frame(t,false,m.color,1,false,100,100,renderEffect,m.kind)),b=data(frame(t,false,m.color,1,false,100,100,before,m.kind));for(let i=0;i<a.length;i+=4){alphaMax=Math.max(alphaMax,Math.abs(a[i+3]-b[i+3]));alphaDiff+=Math.abs(a[i+3]-b[i+3]);alphaMass+=b[i+3];lost+=b[i+3]>4&&a[i+3]===0;added+=b[i+3]===0&&a[i+3]>4;light+=Math.max(a[i],a[i+1],a[i+2])*a[i+3];oldLight+=Math.max(b[i],b[i+1],b[i+2])*b[i+3];if(a[i+3]>10&&b[i+3]>10){pixels++;for(let j=0;j<3;j++)difference+=Math.abs(a[i+j]-b[i+j]);brightness+=Math.max(a[i],a[i+1],a[i+2]);oldBrightness+=Math.max(b[i],b[i+1],b[i+2]);}}}const a=data(frame(.8,false,m.color,1,true,100,100,renderEffect,m.kind)),b=data(frame(2.7,false,m.color,1,true,100,100,renderEffect,m.kind));return{kind:m.kind,alphaMax,alphaDiff:alphaDiff/Math.max(1,alphaMass),difference:difference/Math.max(1,pixels*3),brightness:brightness/Math.max(1,oldBrightness),light:light/Math.max(1,oldLight),lost,added,reduced:a.every((v,i)=>v===b[i])};});
window.showColors=()=>{const grid=document.querySelector('#grid');grid.replaceChildren();for(const m of effectLibrary.filter(e=>colorDepthKinds.has(e.kind))){for(const render of[before,renderEffect]){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=m.name+(render===before?' — antes':' — agora');fig.append(frame(1.4,true,m.color,1,false,100,100,render,m.kind),caption);grid.append(fig);}}};
window.orientation=()=>{const nativeNow=Date.now;Date.now=()=>1400;try{const paint=(kind,rotation,flipX,flipY)=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d');c.translate(210,210);c.rotate(rotation*Math.PI/180);const token={id:'gravity-qa',layer:'tokens',width:130,height:70,rotation,flipX,flipY,effects:[{...e,kind}]};for(const pass of['behind','front'])drawTokenEffects(c,token,pass,art);return data(can);};return effectLibrary.filter(e=>sceneOrientedEffect(e.kind)).map(m=>{const a=paint(m.kind,0,false,false);let max=0;for(const rotation of[45,90,180,270])for(const flips of[[false,false],[true,false],[false,true],[true,true]]){const b=paint(m.kind,rotation,...flips);for(let i=0;i<a.length;i+=4){max=Math.max(max,Math.abs(a[i+3]-b[i+3]));for(let j=0;j<3;j++)max=Math.max(max,Math.abs(a[i+j]*a[i+3]-b[i+j]*b[i+3])/255);}}return{kind:m.kind,max};});}finally{Date.now=nativeNow;}};
window.show=()=>{const grid=document.querySelector('#grid');grid.replaceChildren();for(let i=0;i<8;i++){const t=.35+i*.7,fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=t.toFixed(2)+' s';fig.append(frame(t,true),caption);grid.append(fig);}};
window.benchmark=()=>{const start=performance.now();for(let i=0;i<60;i++)frame(1+i*.016);return(performance.now()-start)/60;};
window.benchmarkColors=()=>{const results=[];for(const kind of['inferno','runes','static-corona','toxic-spiral','water-tornado']){const model=effectLibrary.find(e=>e.kind===kind);const start=performance.now();for(let i=0;i<30;i++)frame(1+i*.016,false,model.color,1,false,160,160,renderEffect,kind);results.push({kind,ms:(performance.now()-start)/30});}return results;};
function Preview(){const[animated,set]=React.useState(false);return React.createElement('button',{onMouseEnter:()=>set(true),onMouseLeave:()=>set(false)},React.createElement(VttEffectPreview,{preset:e,animated}),React.createElement('div',{},'Barreira arcana'));}createRoot(document.querySelector('#preview')).render(React.createElement(Preview));window.show();window.ready=true;
</script>`;
await fs.writeFile('test-results/breathing-barrier.html', html);
const server = await createServer({
  cacheDir: '.local/vite-breathing-barrier',
  optimizeDeps: {
    entries: ['test-results/breathing-barrier.html'],
    include: ['react', 'react-dom/client', 'react/jsx-runtime'],
  },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/vtt/premium-art/monster-knight', (r) =>
    r.fulfill({ path: 'test-results/private-effect-review.png', contentType: 'image/png' }),
  );
  await page.addInitScript(() => {
    window.compiled = [];
    const native = WebGLRenderingContext.prototype.compileShader;
    WebGLRenderingContext.prototype.compileShader = function (s) {
      native.call(this, s);
      window.compiled.push(this.getShaderParameter(s, this.COMPILE_STATUS));
    };
  });
  await page.goto(server.resolvedUrls.local[0] + 'test-results/breathing-barrier.html');
  await page.waitForFunction(() => window.ready);
  const m = await page.evaluate(() => metrics());
  assert(m.rows.every((r) => r.visible > 4000));
  assert(
    Math.max(...m.rows.map((r) => r.radius)) - Math.min(...m.rows.map((r) => r.radius)) > 12,
    'bubble does not grow and shrink',
  );
  assert(m.openAlpha < 5, 'aperture fails to reveal the background');
  assert(m.closedAlpha > 12, 'aperture never heals');
  assert(m.seam < 0.035 || m.seam < m.step * 0.5, 'loop has a discontinuity');
  assert(m.reduced);
  assert(m.intensity > 0.3 && m.intensity < 0.55);
  assert.equal(m.zeroSum, 0);
  assert.equal(m.whiteError, 0);
  assert.equal(m.edge, 0);
  m.neighbors = await page.evaluate(() => neighbors());
  assert.equal(m.neighbors.length, 114);
  await fs.writeFile(
    'test-results/unchanged-effects-metrics.json',
    JSON.stringify(m.neighbors, null, 2),
  );
  const shaders = await page.evaluate(() => compiled);
  assert(shaders.length >= 2 && shaders.every(Boolean));
  m.orientation = await page.evaluate(() => orientation());
  assert.equal(m.orientation.length, 11);
  assert(
    m.orientation.every((e) => e.max <= 3),
    'precipitation rotates or flips with the actor: ' + JSON.stringify(m.orientation),
  );
  m.colors = await page.evaluate(() => colorDepth());
  await fs.writeFile('test-results/color-depth-metrics.json', JSON.stringify(m.colors, null, 2));
  await page.evaluate(() => showColors());
  await page.locator('#grid').screenshot({ path: 'test-results/color-depth-comparison.png' });
  await page.evaluate(() => show());
  assert.equal(m.colors.length, 28);
  assert(
    m.neighbors.every((e) => e.max <= 3),
    'an adjacent effect changed: ' + JSON.stringify(m.neighbors.filter((e) => e.max > 3)),
  );
  assert(
    m.colors.every((e) => e.lost === 0 && e.added === 0 && e.reduced),
    'material pass changes contours or motion: ' +
      JSON.stringify(m.colors.filter((e) => e.lost || e.added || !e.reduced)),
  );
  assert(
    m.colors.every((e) => e.light > 1.08),
    'material remains dull: ' + JSON.stringify(m.colors.filter((e) => e.light <= 1.08)),
  );
  assert(
    m.colors.every((e) => e.difference > 1),
    'effect color unchanged',
  );
  await page.locator('#grid').screenshot({ path: 'test-results/breathing-barrier-sequence.png' });
  await page.evaluate(() => showColors());
  await page.locator('#grid').screenshot({ path: 'test-results/color-depth-comparison.png' });
  await page
    .locator('#preview button')
    .screenshot({ path: 'test-results/breathing-barrier-card.png' });
  const before = await page.locator('#preview canvas').evaluate((c) => c.toDataURL());
  await page.locator('#preview button').hover();
  await page.waitForTimeout(220);
  assert.notEqual(
    before,
    await page.locator('#preview canvas').evaluate((c) => c.toDataURL()),
    'preview does not animate',
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .locator('#preview button')
    .screenshot({ path: 'test-results/breathing-barrier-card-mobile.png' });
  m.frameMs = await page.evaluate(() => benchmark());
  m.colorPerformance = await page.evaluate(() => benchmarkColors());
  assert(
    m.colorPerformance.every((e) => e.ms < 16),
    'color pass exceeds a frame: ' + JSON.stringify(m.colorPerformance),
  );
  assert(m.frameMs < 16, 'single barrier costs an entire frame: ' + m.frameMs);
  assert.deepEqual(errors, []);
  await fs.writeFile('test-results/breathing-barrier-metrics.json', JSON.stringify(m, null, 2));
  console.log(
    'PASS organic membrane, 28 material refinements with contours/animation preserved, 114 unchanged neighbors, 11 precipitation effects keep direction across four rotations/all flips; ' +
      m.frameMs.toFixed(2) +
      ' ms/frame.',
  );
} finally {
  await browser.close();
  await server.close();
}
