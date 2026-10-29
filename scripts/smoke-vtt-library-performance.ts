import 'dotenv/config';
import {chromium,expect,type BrowserContext,type Route} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {newToken} from '../shared/vtt';
import {vttProtocolVersion} from '../shared/vtt-protocol';
if(!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))throw Error('Banco descartável obrigatório.');
const origin='http://localhost:3098';process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db'),{migrate}=await import('../server/migrate'),{seed}=await import('../server/seed');await migrate();await seed();
const {createApp}=await import('../server/app');process.env.NODE_ENV='production';const server=createApp().listen(3098,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const options={viewport:{width:1440,height:950},extraHTTPHeaders:{'X-Vtt-Schema-Version':String(vttProtocolVersion)}};
const owner=await browser.newContext(options),other=await browser.newContext(options);const page=await owner.newPage(),blocked:Route[]=[],errors:string[]=[],results:unknown[]=[];
page.on('pageerror',e=>errors.push(e.message));
const responses:{path:string;bytes:number}[]=[];
page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/optimized-images-20261028/vtt-thumbnails/'))responses.push({path,bytes:Number(r.headers()['content-length'])});});
await page.route(url=>/^\/vtt\/(?:materials-|physical-|refined-2124-|temporal-|elemental-|chain-lightning-)/.test(url.pathname),route=>{blocked.push(route);});
async function req(c:BrowserContext,path:string,method='GET',data?:unknown){const r=await c.request.fetch(origin+'/api'+path,{method,headers:{Origin:origin},data});expect(r.ok(),await r.text()).toBe(true);return r.json();}
async function sign(c:BrowserContext,name:string){return(await req(c,'/auth/sign-up/email','POST',{name,email:randomUUID()+'@example.test',password:'Test-'+randomUUID()})).user;}
await mkdir('test-results/vtt-library-performance',{recursive:true});
try{
 const user=await sign(owner,'Mestre das prévias');await sign(other,'Fora da mesa');
 const room=await req(owner,'/vtt','POST',{name:'Prévias leves'}),roomPath='/vtt/rooms/'+room.id;
 const initial=room.document.scenes.find((s:any)=>s.id===room.document.activeScene);initial.fog=false;initial.lighting=false;await req(owner,roomPath,'PUT',{revision:room.revision,document:room.document});
 const raw=Buffer.alloc(768*768*4);let random=19;for(let i=0;i<raw.length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;raw[i]=i%4===3?(Math.floor(i/4)%768<8?0:255):random>>>24;}
 const upload=await sharp(raw,{raw:{width:768,height:768,channels:4}}).png().toBuffer();
 const posted=await owner.request.post(origin+'/api'+roomPath+'/assets?name=Teste%20privado.png',{headers:{Origin:origin,'Content-Type':'image/png'},data:upload});expect(posted.ok(),await posted.text()).toBe(true);const asset=await posted.json();
 const full=await owner.request.get(origin+asset.path+'?original=1'),original=await full.body();
 for(let i=0;i<2;i++){
  const thumb=await owner.request.get(origin+asset.path+'?thumbnail=1',{headers:{Accept:'image/webp'}}),bytes=await thumb.body(),meta=await sharp(bytes).metadata();
  expect(thumb.status()).toBe(200);expect(meta.width).toBe(256);expect(meta.height).toBe(256);expect(meta.hasAlpha).toBe(true);expect(bytes.length).toBeLessThan(original.length*.3);expect(thumb.headers()['cache-control']).toBe('private, no-store');
  expect([403,404]).toContain((await other.request.get(origin+asset.path+'?thumbnail=1')).status());
 }
 expect((await fetch(origin+asset.path+'?thumbnail=1')).status).toBe(401);
 expect(createHash('sha256').update(await(await owner.request.get(origin+asset.path+'?thumbnail=1&original=1')).body()).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
 await owner.addInitScript(()=>{localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
 await page.goto(origin+'/#vtt?room='+room.id);await page.getByRole('button',{name:'Entrar no VTT',exact:true}).click();await expect(page.locator('.vtt-workspace')).toBeVisible({timeout:60000});
 const cdp=await owner.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:220000,uploadThroughput:220000});
 const book=page.getByRole('navigation',{name:'Painéis da mesa'}).getByRole('button',{name:'Biblioteca de assets',exact:true}),menu=page.getByRole('region',{name:'Biblioteca de assets'});
 for(const name of ['Monstros','Criaturas vistas de cima','Cenários','Peças de cenário','Peças animadas','Imagens']){
  await book.click();const start=performance.now(),requestStart=responses.length;
  await menu.getByRole('navigation',{name:'Categorias da biblioteca'}).getByRole('button',{name:new RegExp('^'+name)}).click();
  await menu.locator('img[data-vtt-thumbnail]:visible').first().scrollIntoViewIfNeeded();
  await expect.poll(()=>menu.locator('img[data-vtt-thumbnail]').evaluateAll(imgs=>{
   const visible=imgs.filter(img=>{const b=img.getBoundingClientRect(),root=img.closest('.vtt-panel-content')?.getBoundingClientRect();return img.checkVisibility()&&root&&b.height>0&&b.bottom>root.top&&b.top<root.bottom;});
   return visible.length>0&&visible.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0);
  }),{timeout:6000,message:name+' deve aparecer sem esperar as animações'}).toBe(true);
  const milliseconds=Math.round(performance.now()-start),metrics=await menu.locator('img[data-vtt-thumbnail]').evaluateAll(imgs=>({total:imgs.length,started:imgs.filter(i=>i.hasAttribute('src')).length,maxSide:Math.max(...imgs.map(i=>(i as HTMLImageElement).naturalWidth))}));
  expect(metrics.maxSide).toBeLessThanOrEqual(256);
  if(metrics.total>20)expect(metrics.started).toBeLessThan(metrics.total/2);
  const visibleRequests=responses.slice(requestStart),bytes=visibleRequests.reduce((s,r)=>s+r.bytes,0);results.push({category:name,milliseconds,...metrics,bytes});
  expect(milliseconds).toBeLessThan(6000);
  if(name==='Peças animadas'){expect(blocked.length).toBeGreaterThan(20);await page.screenshot({path:'test-results/vtt-library-performance/animated.png'});}
 }
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await book.click();await menu.getByRole('button',{name:/^Peças animadas/}).click();
 const snapshot=await req(owner,roomPath),count=snapshot.document.scenes.find((s:any)=>s.id===initial.id).tokens.length;
 await menu.getByRole('button',{name:'Adicionar Portal',exact:true}).click();await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
 await expect.poll(async()=>(await req(owner,roomPath)).document.scenes.find((s:any)=>s.id===initial.id).tokens.length).toBe(count+1);
 const saved=(await req(owner,roomPath)).document.scenes.find((s:any)=>s.id===initial.id).tokens.find((t:any)=>t.animatedAsset?.id==='portal-ring');
 expect(saved.image).toBe('/vtt/animated-assets-20261009/portal-ring.webp');expect(saved.animatedAsset.playing).toBe(true);
 await page.setViewportSize({width:390,height:780});await book.click();await menu.getByRole('button',{name:/^Cenários/}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:'test-results/vtt-library-performance/mobile.png'});
 expect(errors).toEqual([]);
 await writeFile('test-results/vtt-library-performance/result.json',JSON.stringify({passed:true,blockedEffectImages:blocked.length,network:{latencyMs:80,downloadBytesPerSecond:220000},categories:results,privateThumbnailAuthorization:true,originalsAndMapAnimationPreserved:true},null,2));
 console.log(JSON.stringify({passed:true,categories:results,privateThumbnailAuthorization:true,blockedEffectsDoNotBlockPreviews:true}));
}catch(error){
 const images=await page.locator('#vtt-library-menu img').evaluateAll(imgs=>imgs.slice(0,12).map(i=>({src:i.getAttribute('src'),complete:(i as HTMLImageElement).complete,width:(i as HTMLImageElement).naturalWidth,rect:i.getBoundingClientRect().toJSON()})));
 await writeFile('test-results/vtt-library-performance/failure.json',JSON.stringify({results,images,responses,errors},null,2));await page.screenshot({path:'test-results/vtt-library-performance/failure.png'});throw error;
}finally{for(const route of blocked)await route.abort().catch(()=>{});await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
