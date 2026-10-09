import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const tokenArt = (await readFile('data/vtt/premium-art/monster-knight-v1.webp')).toString('base64');
const characterArt = (
  await readFile('data/vtt/character-art/character-tokens-20261008/nana-top-down-v1.png')
).toString('base64');
await writeFile(
  'test-results/vtt-effects-quality.html',
  `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#0b141d;color:#eee4d5;font:14px Georgia}#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:14px}figure{margin:0;background:#14232c;border:1px solid #38505a;border-radius:6px;overflow:hidden}figcaption{padding:10px;text-align:center}canvas.sample{display:block;width:100%;height:auto}#demo{position:relative;height:100dvh}.vtt-stage{position:absolute!important;inset:0}#ui{position:relative;height:100%}
</style></head><body><div id="grid"></div><div id="demo" class="vtt-workspace"><div id="ui" class="vtt-stage"></div></div>
<script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {effectLibrary} from '/shared/vtt-effects.ts';import {renderEffect,drawTokenEffects} from '/src/vtt-effects-canvas.ts';
import {drawDeath} from '/src/vtt-death.ts';import {clearMaterialCache,materialCacheSize,materialBakeCount,materialSprite} from '/src/vtt-effects-materials.ts';import {clearEffectTextureCache,effectTextureCacheSize,plume} from '/src/vtt-effects-primitives.ts';
import {VttEffects} from '/src/VttEffects.tsx';import '/src/styles.css';import '/src/theme.css';import '/src/vtt.css';
const image=new Image();image.src='data:image/webp;base64,${tokenArt}';await image.decode();
const characterImage=new Image();characterImage.src='data:image/png;base64,${characterArt}';await characterImage.decode();
const sizes=[[32,32],[74,115],[130,65],[160,160]];
const id='55555555-5555-4555-8555-555555555555';
const make=(kind)=>({...effectLibrary.find(e=>e.kind===kind),id,scale:1,duration:0,at:1000});
const render=(canvas,kind,size,now,reduced,token=true,art=image)=>{
 const c=canvas.getContext('2d'),[width,height]=sizes[size];c.clearRect(0,0,canvas.width,canvas.height);c.save();c.translate(canvas.width/2,canvas.height/2);
 const effect=make(kind),options={now,reducedMotion:reduced,seed:'test',overhead:true,image:art};
 if(kind==='death')drawDeath(c,{id,layer:'tokens',width,height,deathAt:1000},options);else renderEffect(c,effect,width,height,{...options,pass:'behind'});
 if(token){c.save();if(kind==='death')c.filter='brightness(.42) sepia(1) saturate(4) hue-rotate(320deg)';const f=Math.min(width/art.naturalWidth,height/art.naturalHeight);c.drawImage(art,-art.naturalWidth*f/2,-art.naturalHeight*f/2,art.naturalWidth*f,art.naturalHeight*f);c.restore();}
 if(kind!=='death')renderEffect(c,effect,width,height,{...options,pass:'front'});c.restore();return c;
};
const hash=(pixels)=>{let h=2166136261,count=0;for(let i=0;i<pixels.length;i++){h=Math.imul(h^pixels[i],16777619);if(i%4===3&&pixels[i]>0)count++;}return {hash:h>>>0,count};};
const pending=new Set(),nativeRequest=requestAnimationFrame.bind(window),nativeCancel=cancelAnimationFrame.bind(window);
window.requestAnimationFrame=fn=>{let key=nativeRequest(t=>{pending.delete(key);fn(t);});pending.add(key);return key;};
window.cancelAnimationFrame=key=>{pending.delete(key);nativeCancel(key);};
window.fxTest={kinds:effectLibrary.map(e=>e.kind),
 characterParity(kind,scale=1){const previous=Date.now;Date.now=()=>2850;try{return ['/api/vtt/premium-art/monster-knight','/api/vtt/assets/11111111-1111-4111-8111-111111111111/top-down','/custom/character.png'].map(path=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=500;const c=canvas.getContext('2d');c.translate(250,250);const token={id:'test',image:path,layer:'tokens',width:100,height:100,flipX:false,flipY:false,effects:[{...make(kind),scale}]};for(const pass of ['behind','front'])drawTokenEffects(c,token,pass,characterImage);return hash(c.getImageData(0,0,500,500).data);});}finally{Date.now=previous;}},
 newModels(){const grid=document.getElementById('grid');grid.innerHTML='';for(const effect of effectLibrary.slice(36)){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=effect.name;canvas.width=290;canvas.height=236;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);render(canvas,effect.kind,3,2850,false,true,characterImage);}},
 characterFrost(){const grid=document.getElementById('grid');grid.innerHTML='';for(const scale of [.5,1,2,3]){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent='nana · Gelo · '+scale;canvas.width=canvas.height=440;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);const c=canvas.getContext('2d');c.translate(220,220);const token={id:'test',image:'/api/vtt/assets/11111111-1111-4111-8111-111111111111/top-down',layer:'tokens',width:100,height:100,flipX:false,flipY:false,effects:[{...make('frost'),scale}]};const old=Date.now;Date.now=()=>2850;try{drawTokenEffects(c,token,'behind',characterImage);c.drawImage(characterImage,-50,-50,100,100);drawTokenEffects(c,token,'front',characterImage);}finally{Date.now=old;}}},
 sheet(size){const grid=document.getElementById('grid');grid.innerHTML='';for(const effect of effectLibrary){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=effect.name;canvas.width=290;canvas.height=236;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);render(canvas,effect.kind,size,2850,false);}return effectLibrary.length;},
 focused(now){const grid=document.getElementById('grid');grid.innerHTML='';for(const kind of ['poison','heal','frost','lightning']){const effect=effectLibrary.find(e=>e.kind===kind),figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=effect.name;canvas.width=canvas.height=360;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);render(canvas,kind,3,now,false);} },
 measure(kind,size,now,reduced){const canvas=document.createElement('canvas');canvas.width=canvas.height=420;const c=render(canvas,kind,size,now,reduced,false);return hash(c.getImageData(0,0,420,420).data);},
 finiteExpired(){const c=document.createElement('canvas').getContext('2d');return renderEffect(c,{...make('fire'),duration:1},90,90,{now:2000,reducedMotion:false});},
 cache(){clearEffectTextureCache();for(let i=0;i<30;i++)plume('#'+(i*7219).toString(16).padStart(6,'0'),'smoke');const size=effectTextureCacheSize();clearEffectTextureCache();return {size,after:effectTextureCacheSize()};},
 benchmark(offset=0){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.translate(128,128);const kinds=effectLibrary.filter(e=>e.kind!=='death').slice(offset,offset+15);for(const e of kinds){renderEffect(c,make(e.kind),90,90,{now:3000,reducedMotion:false,overhead:true,image});}const start=performance.now();for(let frame=0;frame<30;frame++){c.clearRect(-128,-128,256,256);for(const e of kinds)for(const pass of ['behind','front'])renderEffect(c,make(e.kind),90,90,{now:3000+frame*32,reducedMotion:false,pass,overhead:true,image});}return (performance.now()-start)/30;},
 materials(){clearMaterialCache();const canvas=document.createElement('canvas');canvas.width=canvas.height=200;const c=canvas.getContext('2d');c.translate(100,100);materialSprite(c,'#92b65f','vapor',0,0,160,0,.5,1);const pixels=c.getImageData(0,0,200,200).data;let edge=0,visible=0,partial=0;for(let y=0;y<200;y++)for(let x=0;x<200;x++){const a=pixels[(y*200+x)*4+3];if(x===0||y===0||x===199||y===199)edge+=a;if(a>0)visible++;if(a>0&&a<230)partial++;}for(let i=0;i<30;i++)materialSprite(c,'#'+(i*7219).toString(16).padStart(6,'0'),'vapor',0,0,100,0,.5,1);const size=materialCacheSize();clearMaterialCache();return {edge,visible,partial,size,after:materialCacheSize()};},
 geometry(width,height,scale){const canvas=document.createElement('canvas');canvas.width=canvas.height=600;const c=canvas.getContext('2d');c.translate(300,300);renderEffect(c,{...make('heal'),scale},width,height,{now:2850,reducedMotion:false,overhead:true,image,pass:'behind'});const pixels=c.getImageData(0,0,600,600).data;let minX=600,minY=600,maxX=0,maxY=0;for(let y=0;y<600;y++)for(let x=0;x<600;x++)if(pixels[(y*600+x)*4+3]>10){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return {width:maxX-minX,height:maxY-minY,cx:(maxX+minX)/2,cy:(maxY+minY)/2};},
 warm(){clearMaterialCache();this.benchmark();const before=materialBakeCount();this.benchmark();return {before,after:materialBakeCount(),size:materialCacheSize()};},
 corrections(){const grid=document.getElementById('grid');grid.innerHTML='';for(const kind of ['earth','frost','lightning','sparks'])for(const scale of [.5,1,2,3]){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=kind+' · '+scale;canvas.width=canvas.height=400;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);const c=canvas.getContext('2d');c.translate(200,200);const options={now:2850,reducedMotion:false,seed:'test',overhead:true,image};renderEffect(c,{...make(kind),scale},100,100,{...options,pass:'behind'});const fit=100/Math.max(image.naturalWidth,image.naturalHeight);c.drawImage(image,-image.naturalWidth*fit/2,-image.naturalHeight*fit/2,image.naturalWidth*fit,image.naturalHeight*fit);renderEffect(c,{...make(kind),scale},100,100,{...options,pass:'front'});} },
 pending:()=>pending.size};
function Demo(){const [presets,setPresets]=React.useState([]);return React.createElement(VttEffects,{presets,tokens:[{id,name:'Cavaleiro',layer:'tokens',effects:[],deathAt:null,deathAutomatic:false}],busy:false,save:async p=>setPresets(v=>[...v,p]),remove:async id=>setPresets(v=>v.filter(p=>p.id!==id)),apply:async()=>{},clear:async()=>{},preview:()=>{},editDeath:async()=>{}});}
createRoot(document.getElementById('ui')).render(React.createElement(Demo));window.fxTest.sheet(1);
</script></body></html>`,
);
const server = await createServer({ server: { host: '127.0.0.1', port: 3039, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 1280, height: 1180 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/api/vtt/premium-art/monster-knight', (route) =>
  route.fulfill({ contentType: 'image/webp', body: Buffer.from(tokenArt, 'base64') }),
);
try {
  await page.goto('http://127.0.0.1:3039/test-results/vtt-effects-quality.html');
  await page.waitForFunction(() => window.fxTest?.kinds.length === 66);
  const parity = await page.evaluate(() =>
    window.fxTest.kinds
      .filter((k) => k !== 'death')
      .flatMap((kind) =>
        [0.5, 1, 2, 3].map((scale) => ({
          kind,
          scale,
          frames: window.fxTest.characterParity(kind, scale),
        })),
      ),
  );
  for (const row of parity) {
    expect(row.frames[1], row.kind + ' character/monster parity').toEqual(row.frames[0]);
    expect(row.frames[2], row.kind + ' custom token parity').toEqual(row.frames[0]);
  }
  await writeFile(
    'test-results/vtt-effects-character-parity.json',
    JSON.stringify(parity, null, 2),
  );
  const renderMetadata = await page.evaluate(() => {
    const result = [];
    for (const kind of window.fxTest.kinds)
      for (let size = 0; size < 3; size++) {
        const first = window.fxTest.measure(kind, size, 2850, false),
          next = window.fxTest.measure(kind, size, 3350, false),
          reduced = window.fxTest.measure(kind, size, 2850, true),
          reducedNext = window.fxTest.measure(kind, size, 3350, true);
        result.push({
          kind,
          size,
          visible: first.count,
          animated: first.hash !== next.hash,
          static: reduced.hash === reducedNext.hash,
        });
      }
    return result;
  });
  for (const row of renderMetadata) {
    expect(row.visible, row.kind + ' visible ' + row.size).toBeGreaterThan(20);
    expect(row.static, row.kind + ' reduced').toBe(true);
    if (row.kind !== 'death') expect(row.animated, row.kind + ' animated ' + row.size).toBe(true);
  }
  await writeFile(
    'test-results/vtt-effects-render-metadata.json',
    JSON.stringify(renderMetadata, null, 2),
  );
  expect(await page.evaluate(() => window.fxTest.finiteExpired())).toBe(false);
  expect(await page.evaluate(() => window.fxTest.cache())).toEqual({ size: 24, after: 0 });
  const materials = await page.evaluate(() => window.fxTest.materials());
  expect(materials.edge).toBe(0);
  expect(materials.visible).toBeGreaterThan(2000);
  expect(materials.partial).toBeGreaterThan(materials.visible * 0.8);
  expect(materials.size).toBe(24);
  expect(materials.after).toBe(0);
  for (const [width, height] of [
    [100, 100],
    [80, 150],
    [220, 90],
  ]) {
    const small = await page.evaluate(
      ([w, h]) => window.fxTest.geometry(w, h, 0.5),
      [width, height],
    );
    const large = await page.evaluate(
      ([w, h]) => window.fxTest.geometry(w, h, 1.5),
      [width, height],
    );
    expect(Math.abs(large.width - large.height), 'floor circle in map coordinates').toBeLessThan(5);
    expect(Math.abs(large.cx - 300), 'center x').toBeLessThan(3);
    expect(Math.abs(large.cy - 300), 'center y').toBeLessThan(3);
    expect(large.width, 'saved scale expands effect').toBeGreaterThan(small.width * 2.5);
  }
  const warm = await page.evaluate(() => window.fxTest.warm());
  expect(warm.before).toBeGreaterThan(0);
  expect(warm.after, 'no frame-time atlas rebakes after warmup').toBe(warm.before);
  expect(warm.size).toBeLessThanOrEqual(24);
  const frameMs = await page.evaluate(() => window.fxTest.benchmark());
  const additionalFrameMs = await page.evaluate(() => {
    window.fxTest.benchmark(35);
    return window.fxTest.benchmark(35);
  });
  expect(additionalFrameMs, '15 new simultaneous effects').toBeLessThan(25);
  expect(
    frameMs,
    '15 simultaneous effects should remain within a practical frame budget',
  ).toBeLessThan(25);
  await writeFile(
    'test-results/vtt-effects-performance.json',
    JSON.stringify(
      { simultaneous: 15, passes: 2, frameMs, additionalFrameMs, warm, materials },
      null,
      2,
    ),
  );
  for (let size = 0; size < 3; size++) {
    await page.evaluate((size) => window.fxTest.sheet(size), size);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/vtt-effects-quality-size-' + size + '.png' });
  }
  for (const now of [2850, 3350]) {
    await page.evaluate((now) => window.fxTest.focused(now), now);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/vtt-effects-overhead-focused-' + now + '.png' });
  }
  await page.evaluate(() => window.fxTest.corrections());
  await page
    .locator('#grid')
    .screenshot({ path: 'test-results/vtt-effects-scale-corrections.png' });
  await page.locator('#grid').evaluate((e) => (e.style.display = 'none'));
  await page.locator('#grid').evaluate((e) => (e.style.display = 'grid'));
  await page.evaluate(() => window.fxTest.newModels());
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-effects-30-new-models.png' });
  await page.evaluate(() => window.fxTest.characterFrost());
  await page
    .locator('#grid')
    .screenshot({ path: 'test-results/vtt-effects-character-frost-scales.png' });
  await page.locator('#grid').evaluate((e) => (e.style.display = 'none'));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
    const menu = page.getByRole('region', { name: 'Efeitos salvos do mestre' });
    const library = menu.getByRole('region', { name: 'Biblioteca de efeitos', exact: true });
    await expect(library.locator('.vtt-effect-card')).toHaveCount(66);
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await library.getByLabel('Buscar efeito').fill('laminas');
    await expect(library.locator('.vtt-effect-card')).toHaveCount(1);
    await library.getByLabel('Buscar efeito').fill('');
    await library.getByRole('button', { name: 'Natureza', exact: true }).click();
    await expect(library.locator('.vtt-effect-card')).toHaveCount(11);
    await library.getByRole('button', { name: 'Todos', exact: true }).click();
    await library.getByRole('button', { name: 'Criar efeito · Relâmpagos', exact: true }).click();
    await expect(menu.getByLabel('Nome do efeito', { exact: true })).toBeFocused();
    await expect(menu.getByLabel('Modelo do efeito')).toHaveValue('lightning');
    await expect.poll(() => page.evaluate(() => window.fxTest.pending())).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/vtt-effects-library-editor-' + width + '.png' });
    expect(
      await menu
        .locator('.vtt-effects-editor-preview')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const checkbox = await menu.getByLabel('Efeito infinito').boundingBox();
    expect(checkbox.width).toBeLessThanOrEqual(17);
    expect(checkbox.height).toBeLessThanOrEqual(17);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => page.evaluate(() => window.fxTest.pending())).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await menu.getByRole('button', { name: 'Salvar efeito', exact: true }).click();
    await expect(menu.locator('.vtt-effects-row')).toHaveCount(1);
    await menu.getByRole('button', { name: 'Remover efeito Relâmpagos', exact: true }).click();
    await expect(menu.locator('.vtt-effects-row')).toHaveCount(0);
    await menu.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.fxTest.pending())).toBe(0);
  }
  expect(errors).toEqual([]);
  console.log(
    '66 efeitos Canvas: pixels/animação/repouso em3 proporções, expiração/cache24/cleanup e biblioteca1440/768/390/320 aprovados.',
  );
} finally {
  await browser.close();
  await server.close();
}
