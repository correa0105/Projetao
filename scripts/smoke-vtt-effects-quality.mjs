import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const tokenArt = (await readFile('data/vtt/premium-art/monster-knight-v1.webp')).toString('base64');
await writeFile(
  'test-results/vtt-effects-quality.html',
  `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#0b141d;color:#eee4d5;font:14px Georgia}#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:14px}figure{margin:0;background:#14232c;border:1px solid #38505a;border-radius:6px;overflow:hidden}figcaption{padding:10px;text-align:center}canvas.sample{display:block;width:100%;height:auto}#demo{position:relative;height:100dvh}.vtt-stage{position:absolute!important;inset:0}#ui{position:relative;height:100%}
</style></head><body><div id="grid"></div><div id="demo" class="vtt-workspace"><div id="ui" class="vtt-stage"></div></div>
<script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {effectLibrary} from '/shared/vtt-effects.ts';import {renderEffect} from '/src/vtt-effects-canvas.ts';
import {drawDeath} from '/src/vtt-death.ts';import {clearEffectTextureCache,effectTextureCacheSize,plume} from '/src/vtt-effects-primitives.ts';
import {VttEffects} from '/src/VttEffects.tsx';import '/src/styles.css';import '/src/theme.css';import '/src/vtt.css';
const image=new Image();image.src='data:image/webp;base64,${tokenArt}';await image.decode();
const sizes=[[32,32],[74,115],[130,65],[160,160]];
const id='55555555-5555-4555-8555-555555555555';
const make=(kind)=>({...effectLibrary.find(e=>e.kind===kind),id,scale:1,duration:0,at:1000});
const render=(canvas,kind,size,now,reduced,token=true)=>{
 const c=canvas.getContext('2d'),[width,height]=sizes[size];c.clearRect(0,0,canvas.width,canvas.height);c.save();c.translate(canvas.width/2,canvas.height/2);
 const effect=make(kind),options={now,reducedMotion:reduced,seed:'test',overhead:true,image};
 if(kind==='death')drawDeath(c,{id,layer:'tokens',width,height,deathAt:1000},options);else renderEffect(c,effect,width,height,{...options,pass:'behind'});
 if(token){c.save();if(kind==='death')c.filter='brightness(.42) sepia(1) saturate(4) hue-rotate(320deg)';const f=Math.min(width/image.naturalWidth,height/image.naturalHeight);c.drawImage(image,-image.naturalWidth*f/2,-image.naturalHeight*f/2,image.naturalWidth*f,image.naturalHeight*f);c.restore();}
 if(kind!=='death')renderEffect(c,effect,width,height,{...options,pass:'front'});c.restore();return c;
};
const hash=(pixels)=>{let h=2166136261,count=0;for(let i=0;i<pixels.length;i++){h=Math.imul(h^pixels[i],16777619);if(i%4===3&&pixels[i]>0)count++;}return {hash:h>>>0,count};};
const pending=new Set(),nativeRequest=requestAnimationFrame.bind(window),nativeCancel=cancelAnimationFrame.bind(window);
window.requestAnimationFrame=fn=>{let key=nativeRequest(t=>{pending.delete(key);fn(t);});pending.add(key);return key;};
window.cancelAnimationFrame=key=>{pending.delete(key);nativeCancel(key);};
window.fxTest={kinds:effectLibrary.map(e=>e.kind),
 sheet(size){const grid=document.getElementById('grid');grid.innerHTML='';for(const effect of effectLibrary){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=effect.name;canvas.width=290;canvas.height=236;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);render(canvas,effect.kind,size,2850,false);}return effectLibrary.length;},
 focused(now){const grid=document.getElementById('grid');grid.innerHTML='';for(const kind of ['poison','heal','frost','lightning']){const effect=effectLibrary.find(e=>e.kind===kind),figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=effect.name;canvas.width=canvas.height=360;canvas.className='sample';figure.append(canvas,caption);grid.append(figure);render(canvas,kind,3,now,false);} },
 measure(kind,size,now,reduced){const canvas=document.createElement('canvas');canvas.width=canvas.height=420;const c=render(canvas,kind,size,now,reduced,false);return hash(c.getImageData(0,0,420,420).data);},
 finiteExpired(){const c=document.createElement('canvas').getContext('2d');return renderEffect(c,{...make('fire'),duration:1},90,90,{now:2000,reducedMotion:false});},
 cache(){clearEffectTextureCache();for(let i=0;i<30;i++)plume('#'+(i*7219).toString(16).padStart(6,'0'),'smoke');const size=effectTextureCacheSize();clearEffectTextureCache();return {size,after:effectTextureCacheSize()};},
 benchmark(){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.translate(128,128);const kinds=effectLibrary.filter(e=>e.kind!=='death');for(const e of kinds){renderEffect(c,make(e.kind),90,90,{now:3000,reducedMotion:false,overhead:true,image});}const start=performance.now();for(let frame=0;frame<30;frame++){c.clearRect(-128,-128,256,256);for(const e of kinds)for(const pass of ['behind','front'])renderEffect(c,make(e.kind),90,90,{now:3000+frame*32,reducedMotion:false,pass,overhead:true,image});}return (performance.now()-start)/30;},
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
  await page.waitForFunction(() => window.fxTest?.kinds.length === 16);
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
  const frameMs = await page.evaluate(() => window.fxTest.benchmark());
  expect(
    frameMs,
    '15 simultaneous effects should remain within a practical frame budget',
  ).toBeLessThan(65);
  await writeFile(
    'test-results/vtt-effects-performance.json',
    JSON.stringify({ simultaneous: 15, passes: 2, frameMs }, null, 2),
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
  await page.locator('#grid').evaluate((e) => (e.style.display = 'none'));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
    const menu = page.getByRole('region', { name: 'Efeitos salvos do mestre' });
    const library = menu.getByRole('region', { name: 'Biblioteca de efeitos', exact: true });
    await expect(library.locator('.vtt-effect-card')).toHaveCount(16);
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await library.getByRole('button', { name: 'Natureza', exact: true }).click();
    await expect(library.locator('.vtt-effect-card')).toHaveCount(2);
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
    '16 efeitos Canvas: pixels/animação/repouso em3 proporções, expiração/cache24/cleanup e biblioteca1440/768/390/320 aprovados.',
  );
} finally {
  await browser.close();
  await server.close();
}
