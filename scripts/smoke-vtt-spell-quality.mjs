import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/vtt-spell-quality.html',
  `<!doctype html><html><head><style>
body{margin:0;background:#101c23;color:#dccfb7;font:12px sans-serif}#grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:12px}figure{margin:0;background:#14252f;border:1px solid #354957;border-radius:5px}canvas{width:100%;height:auto}figcaption{text-align:center;padding:8px}
</style></head><body><div id="grid"></div><script type="module">
import {newDocument,newToken} from '/shared/vtt.ts';import {spellProfiles} from '/shared/vtt-spells.ts';import {drawSpellEffects} from '/src/vtt-spell-effects.ts';import {effectMaterialsReady,nativeMaterialCount} from '/src/vtt-effects-materials.ts';
await effectMaterialsReady;if(nativeMaterialCount()!==3)throw Error('Material load');
const scene=newDocument(crypto.randomUUID()).scenes[0];scene.width=scene.height=900;scene.grid={...scene.grid,size:35,scale:5};scene.lighting=scene.fog=false;
const actor={...newToken(crypto.randomUUID(),scene),x:330,y:450,width:100,height:100},target={...newToken(crypto.randomUUID(),scene),x:520,y:450,width:100,height:100};scene.tokens=[actor,target];
function paint(profile,now=1950,reduced=false,canvas){canvas??=document.createElement('canvas');canvas.width=canvas.height=360;const c=canvas.getContext('2d');c.clearRect(0,0,360,360);c.save();const maxSize=Math.max(60,profile.size||0),zoom=Math.max(.28,Math.min(.7,220/(maxSize*7)));c.scale(zoom,zoom);const center=profile.origin.startsWith('caster')?actor:target;c.translate(180/zoom-center.x,180/zoom-center.y);const e={id:profile.id,sceneId:scene.id,actorId:actor.id,spellId:profile.id,name:profile.name,slot:profile.level,variant:0,targets:[target.id],points:[{x:target.x,y:target.y,angle:-.2}],profile,started:1000,expires:null,concentration:profile.concentration,persistent:true};for(const pass of ['behind','front'])drawSpellEffects(c,scene,[e],pass,{left:center.x-180/zoom,top:center.y-180/zoom,right:center.x+180/zoom,bottom:center.y+180/zoom},now,reduced);c.restore();const pixels=c.getImageData(0,0,360,360).data;let h=2166136261,n=0,partial=0;for(let i=0;i<pixels.length;i++){h=Math.imul(h^pixels[i],16777619);if(i%4===3&&pixels[i]){n++;if(pixels[i]<230)partial++;}}return {hash:h>>>0,visible:n,partial};}
window.spellQA={profiles:spellProfiles,measure:()=>spellProfiles.map(p=>({id:p.id,name:p.name,family:p.visual.family,first:paint(p),next:paint(p,2350),reduced:paint(p,1950,true),reducedNext:paint(p,2350,true)})),sheet(start=0,count=42){const grid=document.getElementById('grid');grid.innerHTML='';for(const p of spellProfiles.slice(start,start+count)){const fig=document.createElement('figure'),can=document.createElement('canvas'),caption=document.createElement('figcaption');caption.textContent=p.name+' · '+p.visual.family;fig.append(can,caption);grid.append(fig);paint(p,1950,false,can);}},focused(){const grid=document.getElementById('grid');grid.innerHTML='';for(const name of ['Fireball','Cone of Cold','Lightning Bolt','Healing Word','Shield','Entangle','Wall of Fire','Spirit Guardians','Fog Cloud','Magic Missile','Prismatic Wall','Meteor Swarm']){const p=spellProfiles.find(p=>p.name===name);if(!p)throw Error(name);const fig=document.createElement('figure'),can=document.createElement('canvas'),cap=document.createElement('figcaption');cap.textContent=p.name;fig.append(can,cap);grid.append(fig);paint(p,1950,false,can);}}};
</script></body></html>`,
);
const server = await createServer({ server: { host: '127.0.0.1', port: 3040, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:3040/test-results/vtt-spell-quality.html');
  await page.waitForFunction(() => window.spellQA?.profiles.length === 339);
  const data = await page.evaluate(() => window.spellQA.measure());
  for (const row of data) {
    expect(row.first.visible, row.name).toBeGreaterThan(20);
    expect(row.first.partial, row.name + ' transparent').toBeGreaterThan(row.first.visible * 0.5);
    expect(row.reduced.hash, row.name + ' reduced').toBe(row.reducedNext.hash);
    expect(row.first.hash, row.name + ' animation').not.toBe(row.next.hash);
  }
  await writeFile('test-results/vtt-spell-quality.json', JSON.stringify(data, null, 2));
  for (let start = 0; start < 339; start += 42) {
    await page.evaluate((start) => window.spellQA.sheet(start), start);
    await page
      .locator('#grid')
      .screenshot({ path: 'test-results/vtt-spell-quality-' + start + '.png' });
  }
  await page.evaluate(() => window.spellQA.focused());
  await page.locator('#grid').screenshot({ path: 'test-results/vtt-spell-quality-focused.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS339 spells visible, animated, alpha and reduced motion; 9 review sheets and12 representative spells.',
  );
} finally {
  await browser.close();
  await server.close();
}
