import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
await writeFile('test-results/windmill-controls.html', `<!doctype html><html><body style="background:#344536;margin:0"><div id="controls"></div><canvas id="canvas" width="600" height="600"></canvas><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import {createRoot} from '/node_modules/.vite/deps/react-dom_client.js';
import {VttAnimatedAssetControls} from '/src/VttAnimatedAssetControls.tsx';
import {drawAnimatedAsset} from '/src/vtt-animated-assets.ts';
import {animatedAssets} from '/shared/vtt-animated-assets.ts';
const image=new Image();image.src='/vtt/animated-assets-20261009/windmill-overhead-v4.png';await image.decode();
const rotor=new Image();rotor.src='/vtt/animated-assets-20261009/windmill.webp';await rotor.decode();
const token={id:'windmill-test',name:'Moinho',width:300,height:300,animatedAsset:{id:'windmill',playing:true,speed:1,intensity:.8}};
const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');let effects=true;
const root=createRoot(document.getElementById('controls'));
function draw(time=1000,reduced=false){ctx.clearRect(0,0,600,600);ctx.save();ctx.translate(300,300);drawAnimatedAsset(ctx,token,image,time,reduced,effects);ctx.restore();let h=2166136261,n=0;const px=ctx.getImageData(0,0,600,600).data;for(let i=0;i<px.length;i++){h=Math.imul(h^px[i],16777619);if(i%4===3&&px[i])n++;}return {hash:h>>>0,pixels:n};}
function render(){root.render(React.createElement(VttAnimatedAssetControls,{token,gridSize:100,edit:patch=>{Object.assign(token,patch);render();draw();},effectsEnabled:effects,enableEffects:()=>{effects=true;}}));}
render();draw();await new Promise(r=>setTimeout(r,500));draw();window.qa={token,draw,assets:animatedAssets};
</script></body></html>`);
const server=await createServer({server:{host:'127.0.0.1',port:3041,strictPort:true}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1100,height:760}});
try {
  await page.goto('http://127.0.0.1:3041/test-results/windmill-controls.html');
  await page.waitForFunction(()=>window.qa);
  const frames=await page.evaluate(()=>({a:qa.draw(1000),b:qa.draw(2000),r:qa.draw(1000,true),r2:qa.draw(2000,true),count:qa.assets.length,banner:qa.assets.some(a=>a.id==='banner')}));
  expect(frames.a.pixels).toBeGreaterThan(10000);expect(frames.a.hash).not.toBe(frames.b.hash);expect(frames.r.hash).toBe(frames.r2.hash);expect(frames.count).toBe(16);expect(frames.banner).toBe(false);
  await page.getByRole('button',{name:'Aumentar asset'}).click();expect(await page.evaluate(()=>qa.token.width)).toBe(375);
  await page.getByRole('button',{name:'Diminuir asset'}).click();expect(await page.evaluate(()=>qa.token.width)).toBe(300);
  await page.getByRole('spinbutton',{name:'Tamanho do asset em quadrados'}).fill('5');expect(await page.evaluate(()=>qa.token.width)).toBe(500);
  await page.getByRole('button',{name:'Pausar',exact:true}).click();expect(await page.evaluate(()=>qa.token.animatedAsset.playing)).toBe(false);
  const paused=await page.evaluate(()=>[qa.draw(1000).hash,qa.draw(2000).hash]);expect(paused[0]).toBe(paused[1]);
  await page.getByRole('button',{name:'Animar',exact:true}).click();expect(await page.evaluate(()=>qa.token.animatedAsset.playing)).toBe(true);
  await page.getByRole('spinbutton',{name:'Tamanho do asset em quadrados'}).fill('3');await page.evaluate(()=>qa.draw(2000));
  await page.screenshot({path:'test-results/windmill-overhead-controls.png'});
  console.log(JSON.stringify({frames,resize:'3 → 3.75 → 3 → 5 squares',pauseResume:'passed'}));
} finally {await browser.close();await server.close();}
