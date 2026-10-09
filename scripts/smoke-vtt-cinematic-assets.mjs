import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
if (process.env.VTT_EFFECT_REVIEW_TOKEN)
  await writeFile(
    'test-results/private-effect-review.png',
    await readFile(process.env.VTT_EFFECT_REVIEW_TOKEN),
  );
await writeFile(
  'test-results/vtt-cinematic-assets.html',
  String.raw`<!doctype html><html><head><style>body{margin:0;background:#101820;color:#e8d6b4;font:14px sans-serif}#grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px}figure{margin:0;background:#877652;border:1px solid #39434b;border-radius:5px}canvas{width:100%;height:auto}figcaption{padding:9px;text-align:center;background:#101b22}</style></head><body><div id="grid"></div><script type="module">
import {newDocument,newToken} from '/shared/vtt.ts';
import {effectLibrary} from '/shared/vtt-effects.ts';
import {drawOverheadEffect} from '/src/vtt-effects-overhead.ts';
import {effectFootprint} from '/src/vtt-effect-footprint.ts';
import {seededRandom} from '/src/vtt-effects-primitives.ts';
import {effectMaterialsReady} from '/src/vtt-effects-materials.ts';
import {physicalPropsReady} from '/src/vtt-effects-physical.ts';
import {animatedAssets} from '/shared/vtt-animated-assets.ts';
import {drawAnimatedAsset} from '/src/vtt-animated-assets.ts';
import {nativeFlowCount,nativeFlowCacheSize,nativeArcCacheSize} from '/src/vtt-effects-native-flow.ts';
await Promise.all([effectMaterialsReady,physicalPropsReady]);
const art=new Image();art.src='` +
    (process.env.VTT_EFFECT_REVIEW_TOKEN
      ? '/test-results/private-effect-review.png'
      : '/vtt/monsters/monster-bandit.webp') +
    String.raw`';await art.decode();
const images=new Map();for(const a of animatedAssets){if(a.image){const img=new Image();img.src=a.image;await img.decode();images.set(a.id,img);}}
const scene=newDocument(crypto.randomUUID()).scenes[0];
const token=newToken(crypto.randomUUID(),scene);token.width=token.height=200;
function canvas(){const can=document.createElement('canvas');can.width=can.height=420;return can;}
function metric(can){const px=can.getContext('2d').getImageData(0,0,420,420).data;let h=2166136261,n=0;for(let i=0;i<px.length;i++){h=Math.imul(h^px[i],16777619);if(i%4===3&&px[i]>8)n++;}return{hash:h>>>0,visible:n};}
function drawEffect(model,time=1.1,showArt=false,can=canvas(),intensity=.85){
const c=can.getContext('2d');c.clearRect(0,0,420,420);
if(showArt){c.fillStyle='#8c7a59';c.fillRect(0,0,420,420);c.strokeStyle='#b5a58a33';for(let k=0;k<420;k+=70){c.beginPath();c.moveTo(k,0);c.lineTo(k,420);c.moveTo(0,k);c.lineTo(420,k);c.stroke();}}
c.save();c.translate(210,210);const effect={id:model.kind,kind:model.kind,color:model.color,scale:1,opacity:1,started:0,duration:0,intensity};
const f=effectFootprint(200,200,100,100,art),rnd=seededRandom(model.kind);
drawOverheadEffect(c,effect,f,time,rnd,'behind',1);
if(showArt)c.drawImage(art,-100,-100,200,200);
drawOverheadEffect(c,effect,f,time,rnd,'front',1);c.restore();return metric(can);
}
function drawAsset(a,time=1100,reduced=false,enabled=true,can=canvas()){
 const c=can.getContext('2d');c.clearRect(0,0,420,420);c.save();c.translate(210,210);drawAnimatedAsset(c,{...token,id:a.id,animatedAsset:{id:a.id,speed:1,intensity:.8,playing:true}},images.get(a.id),time,reduced,enabled);c.restore();return metric(can);
}
function sheet(rows,kind){const grid=document.getElementById('grid');grid.innerHTML='';for(const row of rows){const can=canvas(),fig=document.createElement('figure'),cap=document.createElement('figcaption');cap.textContent=row.name;fig.append(can,cap);grid.append(fig);if(kind==='effect')drawEffect(row,1.1,true,can);else {const c=can.getContext('2d');c.fillStyle='#8c7a59';c.fillRect(0,0,420,420);const temp=canvas();drawAsset(row,1600,false,true,temp);c.drawImage(temp,0,0);}}}
window.assetQA={measure(){return{native:nativeFlowCount(),effects:effectLibrary.filter(e=>e.kind!=='death').map(e=>({id:e.kind,first:drawEffect(e),next:drawEffect(e,1.7)})),assets:animatedAssets.map(a=>({id:a.id,first:drawAsset(a),next:drawAsset(a,2300),reduced:drawAsset(a,1100,true),reducedNext:drawAsset(a,2300,true),off:drawAsset(a,1100,false,false),offNext:drawAsset(a,2300,false,false)})),cache:nativeFlowCacheSize()};},
sheet(start,count){sheet(effectLibrary.slice(start,start+count),'effect');},assets(){sheet(animatedAssets,'asset');},
focused(){sheet(effectLibrary.filter(e=>['vines','leaves','thorn-cage','fear','spectral-chains','soul-flames','fire','ember-comet','fire-surge'].includes(e.kind)),'effect');},
petrify(){const model=effectLibrary.find(e=>e.kind==='petrify');return{low:drawEffect(model,4,false,undefined,.25),high:drawEffect(model,4,false,undefined,1)};}};
</script></body></html>`,
);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 1900, height: 1100 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(server.resolvedUrls.local[0] + 'test-results/vtt-cinematic-assets.html');
  await page.waitForFunction(() => window.assetQA);
  // Warm any independently decoded prop layers before measuring stable states.
  await page.evaluate(() => window.assetQA.assets());
  await page.waitForLoadState('networkidle');
  const data = await page.evaluate(() => window.assetQA.measure());
  expect(data.native).toBe(9);
  expect(data.cache).toBeLessThanOrEqual(32);
  expect(
    await page.evaluate(() =>
      import('/src/vtt-effects-native-flow.ts').then((m) => m.nativeArcCacheSize()),
    ),
  ).toBeLessThanOrEqual(16);
  for (const row of data.effects) {
    expect(row.first.visible, row.id).toBeGreaterThan(20);
    expect(row.first.hash, row.id + ' moves').not.toBe(row.next.hash);
  }
  for (const row of data.assets) {
    expect(row.first.visible, row.id).toBeGreaterThan(20);
    expect(row.first.hash, row.id + ' moves').not.toBe(row.next.hash);
    expect(row.reduced.hash, row.id + ' reduced').toBe(row.reducedNext.hash);
    expect(row.off.hash, row.id + ' disabled').toBe(row.offNext.hash);
  }
  const stone = await page.evaluate(() => window.assetQA.petrify());
  expect(stone.high.visible).toBeGreaterThan(stone.low.visible);
  await writeFile('test-results/vtt-cinematic-assets.json', JSON.stringify(data, null, 2));
  for (let start = 66; start < 106; start += 20) {
    await page.evaluate((start) => window.assetQA.sheet(start, 20), start);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/vtt-cinematic-effects-' + start + '.png' });
  }
  await page.evaluate(() => window.assetQA.focused());
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-cinematic-refinements.png' });
  await page.evaluate(() => window.assetQA.assets());
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-cinematic-environments.png' });
  expect(errors).toEqual([]);
  console.log(
    `PASS ${data.effects.length} animated token effects, ${data.assets.length} animated assets and reduced/disabled stable views; petrification and native-art coverage; 4 visual review sheets.`,
  );
} finally {
  await browser.close();
  await server.close();
}
