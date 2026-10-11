import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
await fs.mkdir('test-results', { recursive: true });
const manifest = JSON.parse(await fs.readFile('data/vtt/living-effects-20261010.json', 'utf8'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
assert.equal(hash(await fs.readFile(manifest.source)), manifest.source_sha256);
assert.equal(manifest.assets.length, 40);
assert.equal(manifest.sounds.length, 20);
assert.equal(new Set(manifest.sounds.map((s) => s.sha256)).size, 20);
for (const asset of [...manifest.assets, ...manifest.sounds]) {
  const bytes = await fs.readFile('public' + asset.path);
  assert.equal(bytes.length, asset.bytes);
  assert.equal(hash(bytes), asset.sha256);
  if (asset.path.endsWith('.webp')) {
    const info = await sharp(bytes).metadata();
    assert.equal(info.width, 912);
    assert.equal(info.height, 912);
    assert(info.hasAlpha, asset.kind + ' lacks transparent background');
  } else {
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.readUInt16LE(22), 2);
    assert.equal(bytes.readUInt32LE(24), 22050);
    assert(Math.abs((bytes.length - 44) / 88200 - asset.duration) < 0.001);
    let peak = 0,
      energy = 0,
      stereo = 0;
    for (let i = 44; i < bytes.length; i += 4) {
      const left = bytes.readInt16LE(i),
        right = bytes.readInt16LE(i + 2);
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      energy += left * left;
      stereo += Math.abs(left - right);
    }
    assert(peak <= 21300 && peak > 21000, asset.kind + ' cue clips or is silent');
    assert(Math.sqrt(energy / ((bytes.length - 44) / 4)) > 500);
    assert(stereo > 0);
    assert.equal(bytes.readInt16LE(44), 0);
    assert(Math.abs(bytes.readInt16LE(bytes.length - 4)) < 60, asset.kind + ' abrupt sound ending');
  }
}
const html = `<style>body{margin:0;background:#111b21;color:#e3d6b9;font:14px Georgia}#grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:10px}figure{margin:0;background:#596352}canvas{width:100%;display:block}figcaption{padding:12px;text-align:center;background:#111b21}</style><div id="grid"></div><script type="module">
import{livingEffects}from'/shared/vtt-effects-living.ts';import{effectLibrary}from'/shared/vtt-effects.ts';import{effectLibrary as oldLibrary}from'/.local/living-original/shared/vtt-effects.ts';import{renderEffect}from'/src/vtt-effects-canvas.ts';import{renderEffect as oldRender}from'/.local/living-original/src/vtt-effects-canvas.ts';import{warmLivingEffects,livingCacheSize}from'/src/vtt-effects-living.ts';
import{effectMaterialsReady}from'/src/vtt-effects-materials.ts';import{temporalFieldsReady}from'/src/vtt-effects-temporal.ts';import{physicalPropsReady}from'/src/vtt-effects-physical.ts';import{elementalMaterialsReady}from'/src/vtt-elemental-materials.ts';import{lavaSurfaceReady}from'/src/vtt-lava-material.ts';import{spectralScreamerReady}from'/src/vtt-spectral-screamer.ts';import{warmArcanaEffects}from'/src/vtt-effects-arcana.ts';
import{effectMaterialsReady as a}from'/.local/living-original/src/vtt-effects-materials.ts';import{temporalFieldsReady as b}from'/.local/living-original/src/vtt-effects-temporal.ts';import{physicalPropsReady as d}from'/.local/living-original/src/vtt-effects-physical.ts';import{elementalMaterialsReady as e}from'/.local/living-original/src/vtt-elemental-materials.ts';import{lavaSurfaceReady as f}from'/.local/living-original/src/vtt-lava-material.ts';import{spectralScreamerReady as g}from'/.local/living-original/src/vtt-spectral-screamer.ts';import{warmArcanaEffects as h}from'/.local/living-original/src/vtt-effects-arcana.ts';
await Promise.all([warmLivingEffects(),effectMaterialsReady,temporalFieldsReady,physicalPropsReady,elementalMaterialsReady,lavaSurfaceReady,spectralScreamerReady,warmArcanaEffects(),a,b,d,e,f,g,h()]);
const art=new Image();art.src='/test-results/private-effect-review.png';await art.decode();
window.draw=(model,time=1250,showArt=false,scale=1,reduced=false,render=renderEffect,intensity=1)=>{const can=document.createElement('canvas');can.width=can.height=420;const c=can.getContext('2d',{willReadFrequently:true});if(showArt){c.fillStyle='#596352';c.fillRect(0,0,420,420);}c.translate(210,210);for(const pass of['behind','front']){render(c,{id:'00000000-0000-4000-8000-000000000001',kind:model.kind,color:model.color,scale,duration:0,at:0,intensity},200,200,{now:time,reducedMotion:reduced,image:art,pass,seed:'living-review'});if(showArt&&pass==='behind')c.drawImage(art,-100,-100,200,200);}return can;};
const pixels=can=>can.getContext('2d').getImageData(0,0,420,420).data,diff=(a,b)=>{let delta=0,total=0;for(let i=3;i<a.length;i+=4){delta+=Math.abs(a[i]-b[i]);total+=Math.max(a[i],b[i]);}return delta/Math.max(1,total);};
window.show=(offset=0)=>{const grid=document.querySelector('#grid');grid.replaceChildren();for(const m of livingEffects.slice(offset,offset+10)){const fig=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=m.name;fig.append(draw(m,1450,true),caption);grid.append(fig);}};
window.review=()=>{const shapes=livingEffects.map(m=>pixels(draw(m))),pairs=[];for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)pairs.push(diff(shapes[i],shapes[j]));const rows=livingEffects.map(m=>{const first=pixels(draw(m)),next=pixels(draw(m,2450)),low=pixels(draw(m,1250,false,1,false,renderEffect,.35)),zero=pixels(draw(m,1250,false,1,false,renderEffect,0)),white=pixels(draw({...m,color:'#ffffff'}));let visible=0,edge=0,total=0,lowTotal=0,zeroTotal=0,colorError=0;for(let y=0;y<420;y++)for(let x=0;x<420;x++){const i=(y*420+x)*4;visible+=first[i+3]>8;total+=first[i+3];lowTotal+=low[i+3];zeroTotal+=zero[i+3];if(x===0||y===0||x===419||y===419)edge+=first[i+3]>8;if(white[i+3]>40)colorError=Math.max(colorError,Math.abs(white[i]-white[i+1]),Math.abs(white[i+1]-white[i+2]));}const reducedA=pixels(draw(m,1250,false,1,true)),reducedB=pixels(draw(m,2450,false,1,true));return{kind:m.kind,visible,edge,movement:diff(first,next),seam:diff(pixels(draw(m,4999)),pixels(draw(m,5001))),reduced:reducedA.every((v,i)=>v===reducedB[i]),intensity:lowTotal/total,zeroTotal,colorError};});const preserved=oldLibrary.filter(m=>m.kind!=='death').map(m=>{const old=pixels(draw(m,1450,false,1,false,oldRender)),next=pixels(draw(m,1450));let max=0;for(let i=0;i<old.length;i++)max=Math.max(max,Math.abs(old[i]-next[i]));return{kind:m.kind,max};});return{rows,pairs,preserved,count:effectLibrary.length,cache:livingCacheSize()};};
window.benchmark=()=>{const start=performance.now();for(let j=0;j<5;j++)for(const m of livingEffects)draw(m,1400+j*23);return(performance.now()-start)/5;};window.show();window.ready=true;
</script>`;
await fs.writeFile('test-results/living-effects-review.html', html);
const server = await createServer({
  optimizeDeps: { entries: ['test-results/living-effects-review.html'] },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + 'test-results/living-effects-review.html');
  await page.waitForFunction(() => window.ready, {}, { timeout: 60000 });
  for (const offset of [0, 10]) {
    await page.evaluate((n) => show(n), offset);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/living-effects-' + offset + '.png' });
  }
  const result = await page.evaluate(() => review());
  await fs.writeFile('test-results/living-effects-metrics.json', JSON.stringify(result, null, 2));
  assert.equal(result.count, 147);
  assert.equal(result.cache, 20);
  for (const m of result.rows) {
    assert(m.visible > 650, m.kind + ' invisible');
    assert.equal(m.edge, 0, m.kind + ' clipped');
    assert(m.movement > 0.05, m.kind + ' static');
    assert(m.seam < 0.035, m.kind + ' loop seam');
    assert(m.reduced, m.kind + ' ignores reduced motion');
    assert(m.intensity > 0.2 && m.intensity < 0.45, m.kind + ' intensity ignored');
    assert.equal(m.zeroTotal, 0);
    assert(m.colorError < 15, m.kind + ' recolor ignores chosen color');
  }
  assert(Math.min(...result.pairs) > 0.07, 'two new effects repeat geometry');
  for (const m of result.preserved) assert(m.max <= 3, m.kind + ' previous renderer changed');
  assert.deepEqual(errors, []);
  const frameMs = await page.evaluate(() => benchmark());
  assert(frameMs < 160, '20-effect frame cost too high: ' + frameMs);
  result.frameMs = frameMs;
  result.mediaChecked = 60;
  await fs.writeFile('test-results/living-effects-metrics.json', JSON.stringify(result, null, 2));
  console.log(
    'PASS 20 original effects: visible, unique shapes, fluid loops, color/intensity/reduced motion, bounded cache; ' +
      result.preserved.length +
      ' previous renderers preserved; ' +
      frameMs.toFixed(1) +
      ' ms for all twenty.',
  );
} finally {
  await browser.close();
  await server.close();
}
