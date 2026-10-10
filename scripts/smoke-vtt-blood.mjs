import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const art = (
  await readFile('data/vtt/character-art/character-tokens-20261008/nana-top-down-v1.png')
).toString('base64');
await writeFile(
  'test-results/blood-preview.html',
  `<!doctype html><style>body{background:#14201d;margin:16px;color:#eddfc5;font:16px Georgia}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;background:#29332c;border:1px solid #756647}canvas{width:100%}figcaption{padding:12px}</style><main></main><script type="module">
import {newScene,newToken} from '/shared/vtt.ts';
import {applyTokenBlood} from '/shared/vtt-blood.ts';
import {drawTokenBlood,drawBloodDecals,clearBloodRenderCache} from '/src/vtt-blood-canvas.ts';
const art=new Image();art.src='data:image/png;base64,${art}';await art.decode();
const scene=newScene(crypto.randomUUID());scene.grid.size=70;scene.tokens=[];
let token={...newToken(crypto.randomUUID(),scene),image:'/api/vtt/assets/'+crypto.randomUUID()+'/top-down',hp:100,maxHp:100,width:190,height:190,x:130,y:140};scene.tokens.push(token);
const steps=[['100 PV',100],['75 PV',75],['50 PV',50],['15 PV',15],['Curado: 75 PV',75],['Curado: 100 PV',100]];
const snapshots=[];
const overlay=t=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=220;const c=canvas.getContext('2d');c.translate(110,110);drawTokenBlood(c,t,art);return canvas;};
const count=canvas=>{const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let mass=0,pixels=0;for(let i=3;i<a.length;i+=4){mass+=a[i];if(a[i])pixels++;}return {mass,pixels};};
for(const [label,hp] of steps){const old=structuredClone(token);token.hp=hp;applyTokenBlood(scene,token,old,[],10000);const figure=document.createElement('figure'),canvas=document.createElement('canvas');canvas.width=360;canvas.height=300;const c=canvas.getContext('2d');c.fillStyle='#374036';c.fillRect(0,0,360,300);c.strokeStyle='#b7bba71c';for(let i=0;i<360;i+=36){c.beginPath();c.moveTo(i,0);c.lineTo(i,300);c.stroke();}for(let i=0;i<300;i+=36){c.beginPath();c.moveTo(0,i);c.lineTo(360,i);c.stroke();}c.save();c.translate(180,145);c.drawImage(art,-95,-95,190,190);drawTokenBlood(c,token,art);c.restore();const caption=document.createElement('figcaption');caption.textContent=label;figure.append(canvas,caption);document.querySelector('main').append(figure);snapshots.push({label,...count(overlay(token)),decals:scene.blood.length});}
window.blood={snapshots,mask(){token.hp=30;token.blood={serial:4,distance:0,wounds:[{seed:31,strength:.7}]};const canvas=overlay(token);const c=canvas.getContext('2d'), pixels=c.getImageData(0,0,220,220).data;const mask=document.createElement('canvas');mask.width=mask.height=220;mask.getContext('2d').drawImage(art,15,15,190,190);const a=mask.getContext('2d').getImageData(0,0,220,220).data;let outside=0;for(let i=3;i<a.length;i+=4)if(!a[i]&&pixels[i]>4)outside++;return outside;},flip(){token.flipX=false;const a=overlay(token).getContext('2d').getImageData(0,0,220,220).data;token.flipX=true;const b=overlay(token).getContext('2d').getImageData(0,0,220,220).data;let mismatch=0;for(let y=0;y<220;y++)for(let x=0;x<220;x++)if(Math.abs(a[(y*220+x)*4+3]-b[(y*220+219-x)*4+3])>2)mismatch++;return mismatch;},privacy(){const canvas=document.createElement('canvas');canvas.width=canvas.height=400;const c=canvas.getContext('2d');scene.blood=scene.blood.map(d=>({...d,private:true}));drawBloodDecals(c,scene,{left:0,top:0,right:400,bottom:400},false,10000);return count(canvas);},benchmark(){clearBloodRenderCache();token.hp=30;token.flipX=false;const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');const tokens=Array.from({length:20},(_,i)=>({...token,id:'token-'+i}));for(const t of tokens)drawTokenBlood(c,t,art);scene.blood=Array.from({length:800},(_,i)=>({id:String(i),source:token.id,x:10+(i%40)*12,y:10+Math.floor(i/40)*12,size:3,angle:0,kind:'trail',seed:i,private:false,at:10000}));const start=performance.now();for(let frame=0;frame<60;frame++){c.clearRect(0,0,512,512);drawBloodDecals(c,scene,{left:0,top:0,right:512,bottom:512},true,10000);c.save();c.translate(256,256);for(const t of tokens)drawTokenBlood(c,t,art);c.restore();}return (performance.now()-start)/60;}};
</script>`,
);
const server = await createServer({ server: { host: '127.0.0.1', port: 3038, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  page = await browser.newPage({ viewport: { width: 1250, height: 950 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:3038/test-results/blood-preview.html');
  await page.waitForFunction(() => window.blood);
  const results = await page.evaluate(() => ({
    snapshots: window.blood.snapshots,
    mask: window.blood.mask(),
    flip: window.blood.flip(),
    privacy: window.blood.privacy(),
    frameMs: window.blood.benchmark(),
  }));
  console.log(JSON.stringify(results));
  await page.screenshot({ path: 'test-results/vtt-blood-quality.png' });
  expect(results.snapshots[0].mass).toBe(0);
  expect(results.snapshots[1].mass).toBeGreaterThan(0);
  expect(results.snapshots[2].mass).toBeGreaterThan(results.snapshots[1].mass);
  expect(results.snapshots[3].mass).toBeGreaterThan(results.snapshots[2].mass);
  expect(results.snapshots[4].mass).toBeLessThan(results.snapshots[3].mass);
  expect(results.snapshots[5].mass).toBe(0);
  expect(results.snapshots[5].decals).toBe(results.snapshots[3].decals);
  expect(results.mask).toBe(0);
  expect(results.flip).toBeLessThan(10);
  expect(results.privacy.mass).toBe(0);
  expect(results.frameMs).toBeLessThan(25);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/vtt-blood-quality.png' });
  await writeFile('test-results/vtt-blood-render.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await server.close();
}
