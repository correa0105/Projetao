import fs from 'node:fs/promises';
import sharp from 'sharp';
import {INITIAL_RULEBOOK} from '../shared/rulebook.ts';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
await fs.mkdir('test-results', { recursive: true });
const html =
  '<div id="root"></div><script type="module" src="/test-results/lore-smoke.tsx"></script>';
const jsx = "import React from 'react';import{createRoot}from'react-dom/client';import{LoreLibrary}from'/src/LoreLibrary.tsx';import{Rulebook}from'/src/Rulebook.tsx';import{SiteMusicProvider}from'/src/SiteMusic.tsx';import{PageHeader}from'/src/PageHeader.tsx';import'/src/styles.css';import'/src/alvorada.css';import'/src/journey.css';import'/src/theme.css';import'/src/page-consistency.css';import'/src/page-header.css';const view=new URLSearchParams(location.search).get('view');const root=createRoot(document.getElementById('root'));window.__disposeSmoke=()=>root.unmount();root.render(<SiteMusicProvider><div className=\"app-shell\" data-page={view==='rules'?'rules':'lore'}><div className=\"main-shell\"><PageHeader title={view==='rules'?'Regras da mesa':'Crônicas & lore'} children={null}/><main className=\"main-content\"><div className=\"page-header-spacer\" aria-hidden=\"true\"/>{view==='rules'?<Rulebook active={true}/>:<LoreLibrary/>}</main></div></div></SiteMusicProvider>);";
const currentJsx = process.argv.includes('--baseline')
  ? jsx.replace("from'/src/LoreLibrary.tsx'", "from'/.local/living-original/src/LoreLibrary.tsx'")
  : jsx;
await fs.writeFile('test-results/lore-smoke.html', html);
await fs.writeFile('test-results/lore-smoke.tsx', currentJsx);
const server = await createServer({
  cacheDir: '.local/vite-lore-smoke',
  optimizeDeps: {
    entries: ['test-results/lore-smoke.html'],
    include: [
      'react',
      'react-dom/client',
      'react/jsx-runtime',
      'better-auth/react',
      'lucide-react',
    ],
  },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const eraIds = Array.from({ length: 6 }, (_, i) => `dcf66218-0b9f-4ab1-8558-7e1916f8810${i}`);
const timeline = {
  revision: 1,
  can_edit: true,
  document: {
    title: 'Linha temporal',
    eras: eraIds.map((id, i) => ({
      id,
      year: ['Indefinido', '10 mil anos', '9.320 anos', '7.320 anos', '3.320 anos', 'Mil anos'][i],
      title: i === 5 ? 'Alvorada Cinzenta' : '',
      description: 'Registro da era',
      revealed: i === 5,
      folder_ids: [],
    })),
  },
};
const hall = {
  revision: 1,
  can_edit: false,
  document: {
    title: 'Hall da Fama',
    intro: 'Nomes gravados na história',
    weights: { level: 10, achievement: 10, mission: 10, title: 10 },
  },
  entries: [1, 2, 3].map((i) => ({
    id: 'hero-' + i,
    user_id: 'user-' + i,
    rank: i,
    name: ['Lyra dos Ventos', 'Thorin Guardião da Aurora', 'Nana'][i - 1],
    owner_name: 'Aventureiro ' + i,
    class: 'Guerreiro',
    race: 'Humano',
    level: 15 - i,
    score: 400 - i * 35,
    missions: 30 - i,
    achievements: 20 - i,
    titles: 9 - i,
    prestige: 200 - i,
    rating: 4.9 - i * 0.1,
    rating_count: 5,
    portrait: '/character-silhouette-v2.png',
    parts: { level: 40, titles: 30, missions: 20, achievements: 30 },
  })),
};
const results = [],
  errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/rulebook' ? {document:INITIAL_RULEBOOK,revision:1,can_edit:true} : path === '/api/lore-timeline'
        ? timeline
        : path === '/api/lore'
          ? {
              can_edit: true,
              regions: [
                {
                  id: 'reino-do-norte',
                  name: 'Reino do Norte',
                  description: 'Arquivos preservados',
                },
              ],
              folders: [],
              pages: [],
            }
          : path === '/api/hall'
            ? hall
            : {};
    await route.fulfill({ json: data });
  });
  await page.addInitScript(()=>{window.__smokeFrames=[];const draw=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(...args){if(this.canvas.classList.contains('lore-smoke'))window.__smokeFrames.push(performance.now());return draw.apply(this,args);};});
  const url=server.resolvedUrls.local[0]+'test-results/lore-smoke.html?view=lore';
  await page.setViewportSize({width:1898,height:1000});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(url);await page.locator('.lore-era').last().waitFor();await page.waitForFunction(()=>document.querySelector('.lore-smoke')?.dataset.renderer==='webgl');await page.evaluate(()=>document.fonts.ready);
  const first=await page.screenshot();const frameStart=await page.evaluate(()=>window.__smokeFrames.length);await page.waitForTimeout(2800);const second=await page.screenshot();const frames=await page.evaluate(()=>window.__smokeFrames.length)-frameStart;
  const left=await sharp(first).extract({left:0,top:110,width:200,height:780}).raw().toBuffer(),right=await sharp(second).extract({left:0,top:110,width:200,height:780}).raw().toBuffer();let changed=0,totalDelta=0,lo=255,hi=0;for(let i=0;i<left.length;i++){const d=Math.abs(left[i]-right[i]);if(d>=2)changed++;totalDelta+=d;lo=Math.min(lo,left[i]);hi=Math.max(hi,left[i]);}
  assert(frames>=8&&frames<=60,'Bounded animation frame rate: '+frames);assert(changed/left.length>.01,'The smoke must evolve');assert(totalDelta/left.length<8,'Movement must remain slow');assert(hi-lo>=8,'Detailed volumes must remain visible');await fs.writeFile('test-results/lore-smoke-1898.png',first);await fs.writeFile('test-results/lore-smoke-morph.png',second);
  const layouts=[];await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [1898,1440,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);const canvas=page.locator('.lore-smoke'),container=page.locator('.lore-library');
    assert.equal(await canvas.getAttribute('aria-hidden'),'true');assert.equal(await canvas.evaluate(e=>getComputedStyle(e).pointerEvents),'none');assert.notEqual(await canvas.evaluate(e=>getComputedStyle(e).clipPath),'none');
    const before=await container.screenshot();await canvas.evaluate(e=>e.style.visibility='hidden');const without=await container.screenshot();if(Buffer.compare(before,without)!==0){await fs.writeFile('test-results/lore-smoke-protected-'+width+'.png',before);await fs.writeFile('test-results/lore-smoke-without-'+width+'.png',without);const a=await sharp(before).raw().toBuffer({resolveWithObject:true}),b=await sharp(without).raw().toBuffer();let n=0,x0=9999,y0=9999,x1=0,y1=0;for(let i=0;i<a.data.length;i+=a.info.channels)if(a.data[i]!==b[i]||a.data[i+1]!==b[i+1]||a.data[i+2]!==b[i+2]){n++;const p=i/a.info.channels,x=p%a.info.width,y=Math.floor(p/a.info.width);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}console.log(JSON.stringify({width,changed:n,box:{x0,y0,x1,y1},rect:await container.boundingBox()}));}
    const protectedA=await sharp(before).raw().toBuffer(),protectedB=await sharp(without).raw().toBuffer();let protectedMaxDelta=0;for(let i=0;i<protectedA.length;i++)protectedMaxDelta=Math.max(protectedMaxDelta,Math.abs(protectedA[i]-protectedB[i]));assert(protectedMaxDelta<=1,'Reading surface remains unchanged apart from one-level compositor rounding at '+width);await canvas.evaluate(e=>e.style.visibility='visible');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const region=await container.boundingBox();assert(region.width<=1380);await page.screenshot({path:'test-results/lore-smoke-'+width+'.png'});layouts.push({width,containerProtected:true,pointerTransparent:true});
  }
  const stopped=await page.evaluate(()=>window.__smokeFrames.length);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__smokeFrames.length),stopped,'Reduced motion stops the loop');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(200);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hiddenFrames=await page.evaluate(()=>window.__smokeFrames.length);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__smokeFrames.length),hiddenFrames,'Hidden tabs stop the loop');await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(180);assert.notEqual(await page.locator('.lore-smoke').evaluate(e=>getComputedStyle(e).clipPath),'none');await page.screenshot({path:'test-results/lore-smoke-bottom.png'});
  await page.evaluate(()=>window.__disposeSmoke());const disposed=await page.evaluate(()=>window.__smokeFrames.length);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__smokeFrames.length),disposed);assert.equal(await page.locator('.lore-smoke').count(),0);
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'&&this.classList.contains('lore-smoke')?null:get.call(this,type,...args);};});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);await page.waitForFunction(()=>document.querySelector('.lore-smoke')?.dataset.renderer==='fallback');assert.equal(await page.locator('.lore-smoke').evaluate(e=>getComputedStyle(e).animationName),'none');await page.screenshot({path:'test-results/lore-smoke-fallback.png'});
  assert.deepEqual(errors,[]);const report={passed:true,renderer:'webgl',layouts,framesIn2point8Seconds:frames,changedFraction:changed/left.length,meanTemporalDelta:totalDelta/left.length,tonalRange:hi-lo,slowMorph:true,reducedMotion:true,hiddenPause:true,scrollMask:true,dispose:true,fallback:true,errors};await fs.writeFile('test-results/lore-smoke-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await server.close();
}
