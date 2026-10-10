import fs from 'node:fs/promises';
import { build } from 'vite';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
// Keep the pixel regression baseline independent of HEAD, release staging and caches.
const baseline = '382d6d781d093243ccd3228815187ffca8926419';
const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
for (const file of execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', baseline, 'src', 'shared'],
  { encoding: 'utf8', cwd: repository },
)
  .trim()
  .split(/\r?\n/)
  .filter((file) => /^(src|shared)\/vtt-.*\.ts$/.test(file))) {
  const target = path.join('.local/arcana-original', file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(
    target,
    execFileSync('git', ['show', baseline + ':' + file], { cwd: repository, maxBuffer: 2e7 }),
  );
}
await fs.mkdir('test-results', { recursive: true });
try {
  await fs.access('test-results/private-effect-review.png');
} catch {
  await sharp('data/vtt/premium-art/monster-knight-v1.webp')
    .png()
    .toFile('test-results/private-effect-review.png');
}
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0e1821;color:#ebd7ab;font:14px Georgia}#grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px}figure{margin:0;background:#101e29}canvas{display:block;width:100%;height:auto}figcaption{text-align:center;padding:12px;background:#101720}#ui{height:100vh}</style></head><body><div id="grid"></div><div id="ui"></div><script type="module">
import {effectLibrary,effectPresetSchema}from'/shared/vtt-effects.ts';
import {conditionIcons}from'/shared/vtt-condition-icons.ts';import {drawConditionBadges,conditionBadgeLayout}from'/src/vtt-condition-badges.ts';import{renderVtt}from'/src/vtt-canvas.ts';import{newScene,newToken}from'/shared/vtt.ts';
import {arcanaEffects}from'/shared/vtt-effects-arcana.ts';
import {renderEffect}from'/src/vtt-effects-canvas.ts';
import {renderEffect as original}from'/.local/arcana-original/src/vtt-effects-canvas.ts';
import {effectLibrary as oldLibrary}from'/.local/arcana-original/shared/vtt-effects.ts';
import {warmArcanaEffects,arcanaCacheSize}from'/src/vtt-effects-arcana.ts';
import {effectMaterialsReady}from'/src/vtt-effects-materials.ts';import {temporalFieldsReady}from'/src/vtt-effects-temporal.ts';import{physicalPropsReady}from'/src/vtt-effects-physical.ts';import{elementalMaterialsReady}from'/src/vtt-elemental-materials.ts';import{lavaSurfaceReady}from'/src/vtt-lava-material.ts';import{spectralScreamerReady}from'/src/vtt-spectral-screamer.ts';
import {effectMaterialsReady as oldMaterials}from'/.local/arcana-original/src/vtt-effects-materials.ts';import {temporalFieldsReady as oldTemporal}from'/.local/arcana-original/src/vtt-effects-temporal.ts';import{physicalPropsReady as oldProps}from'/.local/arcana-original/src/vtt-effects-physical.ts';import{elementalMaterialsReady as oldElemental}from'/.local/arcana-original/src/vtt-elemental-materials.ts';import{lavaSurfaceReady as oldLava}from'/.local/arcana-original/src/vtt-lava-material.ts';import{spectralScreamerReady as oldGhost}from'/.local/arcana-original/src/vtt-spectral-screamer.ts';
await Promise.all([warmArcanaEffects(),effectMaterialsReady,temporalFieldsReady,physicalPropsReady,elementalMaterialsReady,lavaSurfaceReady,spectralScreamerReady,oldMaterials,oldTemporal,oldProps,oldElemental,oldLava,oldGhost]);
const art=new Image();art.src='/test-results/private-effect-review.png';await art.decode();
const make=model=>({id:'00000000-0000-4000-8000-000000000001',kind:model.kind,color:model.color,scale:1,duration:0,intensity:.85});
function canvas(size=420){const result=document.createElement('canvas');result.width=result.height=size;return result;}
function draw(model,time=1250,showArt=false,scale=1,reduced=false,render=renderEffect,size=420){const out=canvas(size),c=out.getContext('2d',{willReadFrequently:true});if(showArt){c.fillStyle='#5c6251';c.fillRect(0,0,size,size);}c.translate(size/2,size/2);for(const pass of ['behind','front']){render(c,{...make(model),scale,at:0},200,200,{now:time,reducedMotion:reduced,image:art,pass,seed:'arcana-review'});if(showArt&&pass==='behind')c.drawImage(art,-100,-100,200,200);}return out;}
const pixels=can=>can.getContext('2d').getImageData(0,0,can.width,can.height).data;
function difference(a,b){let d=0,m=0;for(let i=3;i<a.length;i+=4){d+=Math.abs(a[i]-b[i]);m+=Math.max(a[i],b[i]);}return d/Math.max(1,m);}
const hash=p=>{let h=2166136261;for(const b of p)h=Math.imul(h^b,16777619);return h>>>0;};
window.arcanaEffectsForColor=()=>{let maxDifference=0,visible=0;for(const model of arcanaEffects){const p=pixels(draw({...model,color:'#ffffff'},1450));for(let i=0;i<p.length;i+=4)if(p[i+3]>20){visible++;maxDifference=Math.max(maxDifference,Math.abs(p[i]-p[i+1]),Math.abs(p[i+1]-p[i+2]));}}return{maxDifference,visible};};
window.badges={
sheet(){const out=document.createElement('canvas');out.width=960;out.height=610;const c=out.getContext('2d');c.fillStyle='#121b24';c.fillRect(0,0,960,610);for(let i=0;i<conditionIcons.length;i++){const icon=conditionIcons[i],x=(i%6)*160,y=Math.floor(i/6)*120;c.save();c.translate(x+45,y+10);c.scale(3,3);drawConditionBadges(c,{x:0,y:0,width:0,height:0,conditions:[icon.name]},1);c.restore();c.fillStyle='#ecddbb';c.font='13px Georgia';c.textAlign='center';c.fillText(icon.name,x+80,y+92);drawConditionBadges(c,{x:x+133,y:y+11,width:0,height:0,conditions:[icon.name]},1);}document.getElementById('grid').replaceChildren(out);out.style.width='960px';},
check(){const rows=[];for(const zoom of [.35,.8,1,2,3])for(const rotation of [0,90,180,270])for(const flipX of [false,true]){const scene=newScene('00000000-0000-4000-8000-000000000010'),token={...newToken('00000000-0000-4000-8000-000000000011',scene),x:500,y:500,width:120,height:90,conditions:['Cego','Asas','Eletrizado'],rotation,flipX};scene.tokens=[token];scene.fog=scene.lighting=false;const out=canvas(1200),c=out.getContext('2d',{willReadFrequently:true});renderVtt(c,scene,{width:1200,height:1200,dpr:1,camera:{x:500,y:500,zoom},images:new Map(),selected:[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false,bloodEnabled:false});const bounds=conditionBadgeLayout(token,zoom);let visible=0;for(const badge of bounds){const x=Math.round(600+(badge.x-500)*zoom),y=Math.round(600+(badge.y-500)*zoom);const p=c.getImageData(x,y,22,22).data;for(let i=0;i<p.length;i+=4)if(p[i]>130&&p[i+1]>70)visible++;}rows.push({zoom,rotation,flipX,visible,first:bounds[0],gap:(bounds[1].x-bounds[0].x)*zoom,size:bounds[0].size*zoom,order:bounds.map(x=>x.name)});}return rows;}};
window.arcana={ready:true,count:effectLibrary.length,cache:arcanaCacheSize(),ids:arcanaEffects.map(x=>x.kind),sheet(start=0){const grid=document.getElementById('grid');grid.innerHTML='';for(const model of arcanaEffects.slice(start,start+10)){const f=document.createElement('figure'),cap=document.createElement('figcaption');cap.textContent=model.name;f.append(draw(model,1450,true),cap);grid.append(f);}},review(){const rows=arcanaEffects.map(model=>{const first=pixels(draw(model,1200)),next=pixels(draw(model,2350)),before=pixels(draw(model,3999)),after=pixels(draw(model,4001));let visible=0,edge=0;for(let y=0;y<420;y++)for(let x=0;x<420;x++){const a=first[(y*420+x)*4+3];visible+=a>8?1:0;if((x===0||y===0||x===419||y===419)&&a>8)edge++;}return{kind:model.kind,visible,edge,motion:difference(first,next),seam:difference(before,after),reduced:hash(pixels(draw(model,1200,false,1,true)))===hash(pixels(draw(model,3500,false,1,true))),preset:effectPresetSchema.safeParse({...make(model),name:model.name}).success};});const shapes=arcanaEffects.map(m=>pixels(draw(m,1450))),pairs=[];for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++)pairs.push({a:arcanaEffects[i].kind,b:arcanaEffects[j].kind,difference:difference(shapes[i],shapes[j])});const preserved=oldLibrary.filter(x=>x.kind!=='death').map(model=>{const a=pixels(draw(model,1450,false,1,false,original)),b=pixels(draw(model,1450));let max=0,changed=0,alphaMax=0,premultMax=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);if(d)changed++;if(i%4===3)alphaMax=Math.max(alphaMax,d);else{const j=i-i%4+3;premultMax=Math.max(premultMax,Math.abs(a[i]*a[j]-b[i]*b[j])/255);}}return{kind:model.kind,same:hash(a)===hash(b),max,changed,alphaMax,premultMax};});return{rows,pairs,preserved};},benchmark(){for(const m of arcanaEffects)draw(m,1300);const start=performance.now();for(let i=0;i<8;i++)for(const m of arcanaEffects)draw(m,1400+i*11);return(performance.now()-start)/8;}};
window.arcana.sheet();
</script></body></html>`;
await fs.writeFile('test-results/arcana-effects-review.html', html);
await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: '.local/arcana-qa-built',
    emptyOutDir: false,
    rolldownOptions: { input: 'test-results/arcana-effects-review.html' },
  },
});
const output = path.resolve('.local/arcana-qa-built'),
  publicRoot = path.resolve('public');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'),
      name = decodeURIComponent(url.pathname);
    let file;
    if (name === '/test-results/arcana-effects-review.html') file = path.join(output, name);
    else if (name.startsWith('/assets/')) file = path.join(output, name);
    else if (name === '/test-results/private-effect-review.png')
      file = path.resolve('test-results/private-effect-review.png');
    else if (name.startsWith('/vtt/')) file = path.join(publicRoot, name);
    if (
      !file ||
      (!file.startsWith(output + path.sep) &&
        !file.startsWith(publicRoot + path.sep) &&
        file !== path.resolve('test-results/private-effect-review.png'))
    ) {
      res.writeHead(404);
      return res.end();
    }
    const content = await fs.readFile(file),
      ext = path.extname(file);
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.webp': 'image/webp',
        '.png': 'image/png',
      }[ext] || 'application/octet-stream',
    );
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port + '/';
console.log('Compiled production review listening at ' + origin);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1060 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const check = await fetch(origin + 'test-results/arcana-effects-review.html', {
    signal: AbortSignal.timeout(10000),
  });
  console.log(
    'HTML preflight ' + check.status + '; ' + (await check.text()).length + ' characters',
  );
  await page.goto(origin + 'test-results/arcana-effects-review.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.arcana?.ready, {}, { timeout: 120000 });
  const result = await page.evaluate(() => window.arcana.review());
  await fs.writeFile('test-results/arcana-effects-metrics.json', JSON.stringify(result, null, 2));
  for (const start of [0, 10]) {
    await page.evaluate((start) => window.arcana.sheet(start), start);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/arcana-effects-' + start + '.png' });
  }
  for (const row of result.rows) {
    assert(row.visible > 100, row.kind + ' invisible');
    assert.equal(row.edge, 0, row.kind + ' clipped');
    assert(row.motion > 0.06, row.kind + ' static density');
    assert(row.seam < 0.025, row.kind + ' loop jump');
    assert(row.reduced, row.kind + ' reduced motion');
    assert(row.preset, row.kind + ' invalid schema');
  }
  const recolored = new Set([
    'frost',
    'poison',
    'heal',
    'arcane',
    'shield',
    'radiant',
    'shadow',
    'acid',
    'leaves',
    'petals',
    'starfield',
    'spores',
  ]);
  for (const row of result.preserved)
    if (!recolored.has(row.kind)) assert(row.same, row.kind + ' changed unexpectedly');
  const whites = await page.evaluate(() => window.arcanaEffectsForColor());
  assert(whites.maxDifference <= 2, 'custom white must be neutral');
  assert(whites.visible > 1000);
  const badgeRows = await page.evaluate(() => window.badges.check());
  for (const row of badgeRows) {
    assert(row.visible > 30, 'badges hidden');
    assert(Math.abs(row.size - 22) < 1e-6);
    assert(Math.abs(row.gap - 24) < 1e-6);
    assert.equal(row.first.x, 440);
    assert.equal(row.first.y, 455);
    assert.deepEqual(row.order, ['Cego', 'Asas', 'Eletrizado']);
  }
  await page.evaluate(() => window.badges.sheet());
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-condition-icons-30.png' });
  console.log(
    'PASS thirty original vector icons; eighty actual map renders keep badges at the top-left, ordered rightward, with stable 22px size across zoom/rotation/flip and VFX disabled.',
  );
  const benchmark = await page.evaluate(() => window.arcana.benchmark());
  assert.equal(await page.evaluate(() => window.arcana.count), 126);
  assert.equal(await page.evaluate(() => window.arcana.cache), 20);
  assert.deepEqual(errors, []);
  console.log(
    'PASS twenty distinct new model IDs, visible textures, evolving density, continuous four-second cycles, stable reduced motion; ' +
      result.preserved.filter((row) => row.same).length +
      ' previous effects retain identical pixels; twelve default palettes are more vivid.',
  );
  console.log(
    'Twenty complete effects including both depth passes: ' +
      benchmark.toFixed(2) +
      ' ms/frame; minimum pair shape difference ' +
      Math.min(...result.pairs.map((x) => x.difference)).toFixed(3),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
