import 'dotenv/config';
import {chromium,expect,type BrowserContext,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {effectLibrary} from '../shared/vtt-effects';
import {vttProtocolVersion} from '../shared/vtt-protocol';
if(!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))throw Error('Banco descartável obrigatório.');
const origin='http://localhost:3098',proof='.local/vtt-effect-menus-20261029';
process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db'),{migrate}=await import('../server/migrate'),{seed}=await import('../server/seed');await migrate();await seed();
const {createApp}=await import('../server/app');process.env.NODE_ENV='production';const server=createApp().listen(3098,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
await mkdir(proof,{recursive:true});
const profile=resolve(proof,'browser-'+randomUUID()),errors:string[]=[],runs:unknown[]=[];
const options={channel:'msedge',headless:true,viewport:{width:1440,height:950},extraHTTPHeaders:{'X-Vtt-Schema-Version':String(vttProtocolVersion)}};
let context:BrowserContext|undefined,page:Page|undefined;
async function req(path:string,method='GET',data?:unknown){const r=await context!.request.fetch(origin+'/api'+path,{method,headers:{Origin:origin},data});expect(r.ok(),await r.text()).toBe(true);return r.json();}
const previewPath='/optimized-images-20261028/vtt-effect-previews/';
async function inspectMenus(page:Page){
 await page.evaluate(()=>{(window as any).__menuTasks=[];});
 const start=performance.now(),tool=page.getByRole('navigation',{name:'Ferramentas da mesa'});
 await tool.getByRole('button',{name:'Efeitos do mestre',exact:true}).click();
 const effects=page.getByRole('region',{name:'Efeitos salvos do mestre'});await expect(effects).toBeVisible();
 await expect(effects.locator('.vtt-effect-card')).toHaveCount(effectLibrary.length);await expect(effects.locator('canvas')).toHaveCount(0);
 await expect.poll(()=>effects.locator('img').evaluateAll(imgs=>{
  const visible=imgs.filter(i=>{const b=i.getBoundingClientRect(),r=i.closest('.vtt-effects-menu')!.getBoundingClientRect();return i.checkVisibility()&&b.bottom>r.top&&b.top<r.bottom;});
  return visible.length>0&&visible.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0);
 }),{timeout:6000}).toBe(true);
 const effectMs=Math.round(performance.now()-start),images=await effects.locator('img').evaluateAll(imgs=>({total:imgs.length,started:imgs.filter(i=>i.hasAttribute('src')).length}));
 expect(images.started).toBeLessThan(30);expect(effectMs).toBeLessThan(6000);
 await page.screenshot({path:proof+'/effects.png'});
 await effects.getByRole('button',{name:'Fechar efeitos',exact:true}).click();
 const climateStart=performance.now();await tool.getByRole('button',{name:'Efeitos do mapa',exact:true}).click();
 const climate=page.getByRole('dialog',{name:'Efeitos do mapa',exact:true});await expect(climate).toBeVisible();
 await expect(climate.locator('canvas')).toHaveCount(0);
 await climate.getByRole('button',{name:'Fantasia',exact:true}).click();await climate.getByRole('button',{name:'Tela inteira',exact:true}).click();
 await expect(climate.locator('.vtt-screen-preview')).toHaveCount(2);
 await expect.poll(()=>climate.locator('.vtt-screen-preview').evaluateAll(imgs=>imgs.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth===128)),{timeout:6000}).toBe(true);
 await expect(climate.locator('canvas')).toHaveCount(0);const climateMs=Math.round(performance.now()-climateStart);expect(climateMs).toBeLessThan(6000);
 await page.screenshot({path:proof+'/climate.png'});
 const tasks=await page.evaluate(()=>(window as any).__menuTasks as number[]),maxTask=Math.round(Math.max(0,...tasks));expect(maxTask).toBeLessThan(1000);
 await climate.getByRole('button',{name:'Fechar efeitos do mapa',exact:true}).click();
 return {effectMs,climateMs,maxTask,...images};
}
try{
 context=await chromium.launchPersistentContext(profile,options);
 await req('/auth/sign-up/email','POST',{name:'Mestre dos menus',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});
 const room=await req('/vtt','POST',{name:'Cache de efeitos'}),roomPath='/vtt/rooms/'+room.id;
 const scene=room.document.scenes.find((s:any)=>s.id===room.document.activeScene);scene.fog=false;scene.lighting=false;await req(roomPath,'PUT',{revision:room.revision,document:room.document});
 const initialAtmosphere=JSON.stringify(scene.atmosphere),cookies=await context.cookies();
 for(const warm of [false,true]){
  if(warm){await context.close();context=await chromium.launchPersistentContext(profile,options);await context.addCookies(cookies);}
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const native:string[]=[],cacheHits:string[]=[];page.on('request',r=>{const p=new URL(r.url()).pathname;if(/^\/vtt\/(?:materials-|physical-|refined-2124-|temporal-|elemental-|chain-lightning-|radiant-|screen-effects-)/.test(p))native.push(p);});
  await page.addInitScript(()=>{(window as any).__menuTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())(window as any).__menuTasks.push(e.duration);}).observe({entryTypes:['longtask']});localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');cdp.on('Network.responseReceived',(e:any)=>{if(e.response.url.includes(previewPath)&&e.response.fromDiskCache)cacheHits.push(e.response.url);});
  await page.goto(origin+'/#vtt?room='+room.id,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Entrar no VTT',exact:true}).click();await expect(page.locator('.vtt-workspace')).toBeVisible({timeout:60000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  runs.push({warm,...await inspectMenus(page),diskCacheHits:cacheHits.length});expect(native).toEqual([]);
  if(warm)expect(cacheHits.length).toBeGreaterThan(2);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  if(warm){
   const tool=page.getByRole('navigation',{name:'Ferramentas da mesa'});await tool.getByRole('button',{name:'Efeitos do mestre',exact:true}).click();
   const menu=page.getByRole('region',{name:'Efeitos salvos do mestre'}),fire=effectLibrary.find(e=>e.kind==='fire')!;
   await menu.getByRole('button',{name:'Criar efeito · '+fire.name,exact:true}).hover();await expect(menu.locator('canvas')).toHaveCount(1);
   await expect.poll(()=>menu.locator('canvas').evaluate(c=>(c as HTMLCanvasElement).width*(c as HTMLCanvasElement).height)).toBeLessThanOrEqual(152*112);
   await menu.getByRole('button',{name:'Fechar efeitos',exact:true}).hover();await expect(menu.locator('canvas')).toHaveCount(0);
   await menu.getByRole('button',{name:'Fechar efeitos',exact:true}).click();await expect.poll(()=>native.length).toBeGreaterThan(0);
   await page.screenshot({path:proof+'/warm.png'});
  }
  expect(JSON.stringify((await req(roomPath)).document.scenes.find((s:any)=>s.id===scene.id).atmosphere)).toBe(initialAtmosphere);
 }
 expect(errors).toEqual([]);await writeFile(proof+'/result.json',JSON.stringify({passed:true,runs,cacheSurvivesBrowserRestart:true,noNativeDownloadsOnMenuOpen:true,canvasOnlyOnHover:true,atmosphereUnchanged:true},null,2));
 console.log(JSON.stringify({passed:true,runs,cacheSurvivesBrowserRestart:true,noNativeDownloadsOnMenuOpen:true,canvasOnlyOnHover:true}));
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:proof+'/failure.png'});throw error;
}finally{await context?.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
