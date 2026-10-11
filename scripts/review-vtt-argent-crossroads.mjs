import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

await fs.mkdir('test-results', { recursive: true });
const baseline = '.local/argent-baseline';
if (!(await fs.stat(baseline + '/src/vtt-effects-canvas.ts').catch(() => null))) {
  await fs.mkdir(baseline, { recursive: true });
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  execFileSync(
    'git',
    [
      '-C',
      gitRoot,
      'archive',
      'dc4af6c',
      'src',
      'shared',
      '-o',
      path.resolve('.local/argent-baseline.tar'),
    ],
    {
      windowsHide: true,
    },
  );
  execFileSync('tar', ['-xf', '.local/argent-baseline.tar', '-C', baseline], { windowsHide: true });
}
if (!(await fs.stat('test-results/private-effect-review.png').catch(() => null)))
  await fs.copyFile(
    'data/vtt/character-art/character-tokens-20261008/nana-top-down-v1.png',
    'test-results/private-effect-review.png',
  );
const html = `<style>body{margin:0;background:#101b24;color:#dfd6bd;font:13px Georgia}#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px}figure{margin:0;border:1px solid #957b5144;background:radial-gradient(#223442,#101b24)}figure canvas{display:block;width:100%}figcaption{text-align:center;padding:10px}#preview{padding:12px}#preview button{background:radial-gradient(#1c2d38,#0d1720);border:1px solid #b5965b;border-radius:5px;color:#ded6bd;padding:0 0 12px}#preview canvas{display:block;width:152px;height:112px}</style><div id="grid"></div><div id="preview"></div><script type="module">
import React from'react';import{createRoot}from'react-dom/client';import{VttEffectPreview}from'/src/VttEffectPreview.tsx';import{renderEffect}from'/src/vtt-effects-canvas.ts';import{renderEffect as before}from'/.local/argent-baseline/src/vtt-effects-canvas.ts';import{effectLibrary}from'/shared/vtt-effects.ts';import{ARGENT_CROSSROADS_PERIOD}from'/src/vtt-argent-crossroads.ts';
async function warm(prefix){const files={'vtt-effects-materials':'effectMaterialsReady','vtt-effects-temporal':'temporalFieldsReady','vtt-effects-physical':'physicalPropsReady','vtt-elemental-materials':'elementalMaterialsReady','vtt-lava-material':'lavaSurfaceReady','vtt-spectral-screamer':'spectralScreamerReady','vtt-arcane-barrier':'arcaneBarrierReady'};await Promise.all(Object.entries(files).map(async([file,key])=>(await import(/* @vite-ignore */prefix+file+'.ts'))[key]));await(await import(/* @vite-ignore */prefix+'vtt-effects-arcana.ts')).warmArcanaEffects();await(await import(/* @vite-ignore */prefix+'vtt-effects-living.ts')).warmLivingEffects();}
await Promise.all([warm('/src/'),warm('/.local/argent-baseline/src/')]);
const art=new Image();art.src='/test-results/private-effect-review.png';await art.decode();
const model=effectLibrary.find(e=>e.kind==='argent-crossroads'),e={...model,id:'00000000-0000-4000-8000-000000000001',scale:1,duration:0,at:0,intensity:1};
window.frame=(t,show=false,color=e.color,intensity=1,reduced=false,w=100,h=100,render=renderEffect,kind=e.kind,pass,scale=1,overhead=true)=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d',{willReadFrequently:true});c.translate(210,210);for(const layer of(pass?[pass]:['behind','front'])){render(c,{...e,kind,color,intensity,scale},w,h,{now:t*1000,reducedMotion:reduced,image:art,pass:layer,overhead});if(show&&layer==='behind'){const fit=Math.min(w/art.naturalWidth,h/art.naturalHeight);c.drawImage(art,-art.naturalWidth*fit/2,-art.naturalHeight*fit/2,art.naturalWidth*fit,art.naturalHeight*fit);}}return can;};
window.data=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
window.delta=(a,b)=>{let diff=0,mass=0;for(let i=0;i<a.length;i+=4){for(let j=0;j<3;j++)diff+=Math.abs(a[i+j]*a[i+3]-b[i+j]*b[i+3])/255;mass+=Math.max(a[i+3],b[i+3])*3;}return diff/Math.max(1,mass);};
window.measure=c=>{const p=data(c);let mass=0,bright=0,dark=0,visible=0,minX=420,maxX=0,minY=420,maxY=0;for(let y=0;y<420;y++)for(let x=0;x<420;x++){const i=(y*420+x)*4,a=p[i+3];mass+=a;if(a>15){visible++;minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);const v=Math.max(p[i],p[i+1],p[i+2]);bright+=v>220;dark+=v<100;}}return{mass,bright,dark,visible,minX,minY,maxX,maxY};};
window.metrics=()=>{const samples=Array.from({length:16},(_,i)=>.25+i*.5);const rows=samples.map(t=>({t,...measure(frame(t)),behind:measure(frame(t,false,e.color,1,false,100,100,renderEffect,e.kind,'behind')).mass,front:measure(frame(t,false,e.color,1,false,100,100,renderEffect,e.kind,'front')).mass}));const white=data(frame(1.25,false,'#ffffff'));let whiteError=0;for(let i=0;i<white.length;i+=4)if(white[i+3]>30)whiteError=Math.max(whiteError,Math.abs(white[i]-white[i+1]),Math.abs(white[i+1]-white[i+2]));const a=data(frame(1.25,false,e.color,1,true)),b=data(frame(4.25,false,e.color,1,true));const original=data(frame(1.25,false,e.color,1,false,100,100,before));return{rows,period:ARGENT_CROSSROADS_PERIOD,seam:delta(data(frame(7.998)),data(frame(8.002))),step:delta(data(frame(1.25)),data(frame(1.2667))),motion:delta(data(frame(1.25)),data(frame(2.25))),rebuild:delta(data(frame(1.25)),original),reduced:a.every((v,i)=>v===b[i]),intensity:measure(frame(1.25,false,e.color,.35)).mass/measure(frame(1.25)).mass,zero:measure(frame(1.25,false,e.color,0)).mass,whiteError,rect:measure(frame(1.25,false,e.color,1,false,130,70)),small:measure(frame(1.25,false,e.color,1,false,100,100,renderEffect,e.kind,undefined,.5)),large:measure(frame(1.25,false,e.color,1,false,100,100,renderEffect,e.kind,undefined,1.5)),legacy:measure(frame(1.25,false,e.color,1,false,100,100,renderEffect,e.kind,undefined,1,false)),custom:delta(data(frame(1.25,false,'#f196c5')),data(frame(1.25)))};};
window.neighbors=()=>effectLibrary.filter(e=>!['argent-crossroads','death'].includes(e.kind)).map(m=>{const a=data(frame(1.4,false,m.color,1,false,100,100,renderEffect,m.kind)),b=data(frame(1.4,false,m.color,1,false,100,100,before,m.kind));let max=0;for(let i=0;i<a.length;i+=4){max=Math.max(max,Math.abs(a[i+3]-b[i+3]));for(let j=0;j<3;j++)max=Math.max(max,Math.abs(a[i+j]*a[i+3]-b[i+j]*b[i+3])/255);}return{kind:m.kind,max};});
window.show=()=>{const grid=document.querySelector('#grid');for(const t of[.25,1.25,2.25,3.25,4.25,5.25,6.25,7.25]){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=t.toFixed(2)+' s';fig.append(frame(t,true),caption);grid.append(fig);}};
window.benchmark=()=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d');c.translate(210,210);const start=performance.now();for(let i=0;i<120;i++){c.clearRect(-210,-210,420,420);for(const pass of['behind','front'])renderEffect(c,e,160,160,{now:1250+i*16.7,reducedMotion:false,image:art,pass});}return(performance.now()-start)/120;};
function Preview(){const[animated,set]=React.useState(false);return React.createElement('button',{onMouseEnter:()=>set(true),onMouseLeave:()=>set(false),onFocus:()=>set(true),onBlur:()=>set(false)},React.createElement(VttEffectPreview,{preset:e,animated}),React.createElement('div',{},'Encruzilhada de prata'));}createRoot(document.querySelector('#preview')).render(React.createElement(Preview));window.show();window.ready=true;
</script>`;
await fs.writeFile('test-results/argent-crossroads.html', html);
const server = await createServer({
  cacheDir: '.local/vite-argent',
  optimizeDeps: {
    entries: ['test-results/argent-crossroads.html'],
    include: ['react', 'react-dom/client', 'react/jsx-runtime'],
  },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/vtt/premium-art/monster-knight', (r) =>
    r.fulfill({ path: 'test-results/private-effect-review.png', contentType: 'image/png' }),
  );
  await page.goto(server.resolvedUrls.local[0] + 'test-results/argent-crossroads.html');
  await page.waitForFunction(() => window.ready, {}, { timeout: 60000 });
  const metrics = await page.evaluate(() => window.metrics());
  await page.locator('#grid').screenshot({ path: 'test-results/argent-crossroads-sequence.png' });
  await page
    .locator('#preview button')
    .screenshot({ path: 'test-results/argent-crossroads-card.png' });
  await fs.writeFile(
    'test-results/argent-crossroads-metrics.json',
    JSON.stringify(metrics, null, 2),
  );
  assert(
    metrics.rows.every(
      (r) => r.visible > 900 && r.bright > 50 && r.dark > 15 && r.behind > 10000 && r.front > 10000,
    ),
    'silver faces, highlights or layers missing',
  );
  assert(
    metrics.rows.every((r) => r.minX > 0 && r.minY > 0 && r.maxX < 419 && r.maxY < 419),
    'effect clipped',
  );
  assert(
    metrics.rebuild > 0.4 && metrics.motion > 0.1 && metrics.step > 0.001 && metrics.step < 0.15,
    'rebuild or smooth movement missing',
  );
  assert(metrics.seam < 0.04, 'loop seam visible');
  assert(metrics.reduced);
  assert.equal(metrics.zero, 0);
  assert.equal(metrics.whiteError, 0);
  // Per-facet transparency accumulates at overlaps; lowering intensity must
  // still substantially dim the whole weave, including its emission.
  assert(metrics.intensity > 0.3 && metrics.intensity < 0.6);
  assert(metrics.custom > 0.04);
  assert(metrics.legacy.visible > 900, 'alternate renderer still uses the old effect');
  assert(
    metrics.large.maxX - metrics.large.minX > (metrics.small.maxX - metrics.small.minX) * 2.7,
    'saved scale ignored',
  );
  assert(
    metrics.rect.visible > 700 &&
      metrics.rect.maxX - metrics.rect.minX < metrics.rows[2].maxX - metrics.rows[2].minX,
    'the weave does not fit the art inside a rectangular token',
  );
  metrics.neighbors = await page.evaluate(() => window.neighbors());
  assert.equal(metrics.neighbors.length, 145);
  assert(
    metrics.neighbors.every((r) => r.max <= 3),
    'neighbor changed: ' + JSON.stringify(metrics.neighbors.filter((r) => r.max > 3)),
  );
  metrics.ms = await page.evaluate(() => window.benchmark());
  assert(metrics.ms < 16.7, 'frame budget exceeded');
  const cardEdges = await page.locator('#preview canvas').evaluate((c) => {
    const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (
          (x === 0 || y === 0 || x === c.width - 1 || y === c.height - 1) &&
          p[(y * c.width + x) * 4 + 3] > 4
        )
          count++;
    return count;
  });
  assert.equal(cardEdges, 0, 'actual gallery clips the streams');
  const still = await page.locator('#preview canvas').evaluate((c) => c.toDataURL());
  await page.locator('#preview button').hover();
  await page.waitForTimeout(350);
  assert.notEqual(
    still,
    await page.locator('#preview canvas').evaluate((c) => c.toDataURL()),
    'actual preview does not animate',
  );
  await page
    .locator('#preview button')
    .screenshot({ path: 'test-results/argent-crossroads-animated-card.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('#preview button')
    .screenshot({ path: 'test-results/argent-crossroads-mobile-card.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const frozen = await page.locator('#preview canvas').evaluate((c) => c.toDataURL());
  await page.waitForTimeout(250);
  assert.equal(
    frozen,
    await page.locator('#preview canvas').evaluate((c) => c.toDataURL()),
    'reduced preview still animates',
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/argent-crossroads-metrics.json',
    JSON.stringify(metrics, null, 2),
  );
  console.log(
    'PASS rebuilt silver streams, chrome/depth, movement/loop, scale/intensity/colors, actual gallery desktop/mobile, reduced motion; 145 neighbors unchanged; ' +
      metrics.ms.toFixed(2) +
      ' ms/frame.',
  );
} finally {
  await browser.close();
  await server.close();
}
