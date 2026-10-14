import 'dotenv/config';
import {chromium,expect,type BrowserContext} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {natureAssets} from '../shared/vtt-nature-assets';
import {houseAssets,houseWorld,houseDoorPoint} from '../shared/vtt-houses';
import {newToken} from '../shared/vtt';
import {vttProtocolVersion} from '../shared/vtt-protocol';
if(!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))throw Error('Disposable DB only');
const origin='http://localhost:3074';process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db'),{migrate}=await import('../server/migrate'),{seed}=await import('../server/seed');
await migrate();await seed();
const {createApp}=await import('../server/app'),environment=process.env.NODE_ENV;process.env.NODE_ENV='production';
const server=createApp().listen(3074,'127.0.0.1');process.env.NODE_ENV=environment;
await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),player=await browser.newContext();
await ctx.addInitScript(()=>{localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
const page=await ctx.newPage(),errors:string[]=[],missing:string[]=[];page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&/\/vtt\/(plants|houses|houses-empty|home-furniture|home-furniture-refined|house-parts)-20261014\//.test(r.url()))missing.push(r.url());});
const headers={Origin:origin,'X-Vtt-Schema-Version':String(vttProtocolVersion)};
async function request(context:BrowserContext,path:string,method='GET',data?:unknown){const r=await context.request.fetch(origin+'/api'+path,{method,data,headers});return {status:r.status(),data:await r.json()};}
async function api(context:BrowserContext,path:string,method='GET',data?:unknown){const r=await request(context,path,method,data);expect(r.status,JSON.stringify(r.data)).toBeLessThan(300);return r.data;}
await mkdir('test-results/vtt-nature',{recursive:true});
try{
  expect(natureAssets.filter(a=>a.category==='Plantas')).toHaveLength(25);expect(houseAssets).toHaveLength(50);expect(natureAssets.filter(a=>a.category==='Mobílias')).toHaveLength(100);
  const owner=(await api(ctx,'/auth/sign-up/email','POST',{name:'Mestre dos jardins',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()})).user;
  const guest=(await api(player,'/auth/sign-up/email','POST',{name:'Visitante da casa',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()})).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1',[owner.id]);
  const {createLegacyTestCharacter}=await import('../tests/character-fixtures');await createLegacyTestCharacter(owner.id,'Jardineiro');
  await page.goto(origin+'/#vtt');await page.getByLabel('Nome da mesa',{exact:true}).fill('Jardins e casas');await page.getByRole('button',{name:'Criar mesa',exact:true}).click();
  const board=page.getByLabel('Tabuleiro da mesa',{exact:true});await expect(board).toBeVisible();
  // Camera navigation is independent of ruler/paint/selection and focused buttons.
  const camera=()=>board.evaluate(el=>({x:Number(el.getAttribute('data-camera-x')),y:Number(el.getAttribute('data-camera-y'))}));
  await page.getByRole('button',{name:'Mover mapa (H)',exact:true}).click();const panBox=(await board.boundingBox())!,beforePan=await camera();
  await page.mouse.move(panBox.x+panBox.width*.4,panBox.y+panBox.height*.4);await page.mouse.down();await page.mouse.move(panBox.x+panBox.width*.4+70,panBox.y+panBox.height*.4+40,{steps:8});await page.mouse.up();expect((await camera()).x).not.toBe(beforePan.x);
  await page.getByRole('button',{name:'Régua (R)',exact:true}).click();await page.keyboard.down('Space');const beforeSpace=await camera();await page.mouse.move(panBox.x+panBox.width*.4,panBox.y+panBox.height*.4);await page.mouse.down();await page.mouse.move(panBox.x+panBox.width*.4+50,panBox.y+panBox.height*.4,{steps:6});await page.mouse.up();await page.keyboard.up('Space');expect((await camera()).x).not.toBe(beforeSpace.x);
  const {rows:[created]}=await pool.query('SELECT id FROM vtt_rooms WHERE owner_id=$1',[owner.id]);const root='/vtt/rooms/'+created.id;
  const saved=()=>api(ctx,root);
  await page.getByRole('button',{name:'Biblioteca',exact:true}).click();await page.getByRole('button',{name:'Assets',exact:true}).click();
  await page.locator('.vtt-asset-collections button').filter({hasText:'Plantas'}).click();
  await expect(page.locator('.vtt-nature-card')).toHaveCount(25);
  await page.getByLabel('Buscar na biblioteca',{exact:true}).fill('hortensia');await expect(page.locator('.vtt-nature-card')).toHaveCount(1);
  await page.getByLabel('Buscar na biblioteca',{exact:true}).fill('');
  await page.locator('.vtt-nature-card').filter({hasText:'Samambaia da mata'}).click();await page.locator('.vtt-nature-detail select').selectOption('2');
  await page.getByRole('button',{name:'Colocar no mapa',exact:true}).click();await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  await expect.poll(async()=>{const s=(await saved()).document.scenes[0],a=natureAssets[0],t=s.tokens.find((t:any)=>t.image===a.image);return !!t&&Math.abs(t.width-a.width*s.grid.size*2)<.01;}).toBe(true);
  await page.locator('.vtt-asset-collections button').filter({hasText:/^Casas25$/}).click();await expect(page.locator('.vtt-nature-card')).toHaveCount(25);
  await page.locator('.vtt-nature-card').filter({hasText:'Cabana de palha'}).click();await page.getByRole('button',{name:'Interior',exact:true}).click();
  await expect(page.locator('.vtt-nature-detail>img')).toHaveAttribute('src',houseAssets[0].interior);
  await expect.poll(()=>page.locator('.vtt-nature-detail>img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  const box=(await board.boundingBox())!;await page.locator('.vtt-nature-card').filter({hasText:'Cabana de palha'}).dragTo(board,{targetPosition:{x:box.width*.52,y:box.height*.53}});
  await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  await expect.poll(async()=> (await saved()).document.scenes[0].tokens.filter((t:any)=>t.image===houseAssets[0].image).length).toBe(1);
  const dropped=(await saved()).document.scenes[0];const placed=dropped.tokens.find((t:any)=>t.image===houseAssets[0].image);
  const entrance=houseDoorPoint(placed);
  expect((entrance.x-dropped.grid.offsetX-dropped.grid.size/2)%dropped.grid.size).toBeCloseTo(0);
  expect((entrance.y-dropped.grid.offsetY)%dropped.grid.size).toBeCloseTo(0);
  // Both the visible rotation handle and Shift + wheel work on map assets.
  async function screen(p:{x:number;y:number}){const b=(await board.boundingBox())!;const cam=await board.evaluate(el=>({x:Number(el.getAttribute('data-camera-x')),y:Number(el.getAttribute('data-camera-y')),zoom:Number(el.getAttribute('data-camera-zoom'))}));return{x:b.x+b.width/2+(p.x-cam.x)*cam.zoom,y:b.y+b.height/2+(p.y-cam.y)*cam.zoom,zoom:cam.zoom};}
  const handle=await screen({x:placed.x,y:placed.y-placed.height/2});
  await page.mouse.move(handle.x,handle.y-30);await page.mouse.down();const side=await screen({x:placed.x+placed.height/2+30/handle.zoom,y:placed.y});await page.mouse.move(side.x,side.y,{steps:12});await page.mouse.up();
  await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  await expect.poll(async()=>Math.round((await saved()).document.scenes[0].tokens.find((t:any)=>t.id===placed.id).rotation)).toBe(90);
  const pivot=await screen(placed);await page.mouse.move(pivot.x,pivot.y);await page.keyboard.down('Shift');await page.mouse.wheel(0,100);await page.keyboard.up('Shift');
  await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  await expect.poll(async()=>Math.round((await saved()).document.scenes[0].tokens.find((t:any)=>t.id===placed.id).rotation)).toBe(105);
  await page.getByRole('button',{name:'Abrir porta — Cabana de palha',exact:true}).click();
  await expect.poll(async()=> (await saved()).document.scenes[0].tokens.find((t:any)=>t.id===placed.id).houseDoorOpen).toBe(true);
  await page.getByRole('button',{name:'Fechar porta — Cabana de palha',exact:true}).click();
  await expect.poll(async()=> (await saved()).document.scenes[0].tokens.find((t:any)=>t.id===placed.id).houseDoorOpen).toBe(false);
  await page.locator('.vtt-asset-collections button').filter({hasText:'Casas vazias'}).click();await expect(page.locator('.vtt-nature-card')).toHaveCount(25);
  await page.locator('.vtt-nature-card').first().click();await page.getByRole('button',{name:'Interior',exact:true}).click();await expect(page.locator('.vtt-nature-detail>img')).toHaveAttribute('src',houseAssets[25].interior);
  await page.locator('.vtt-asset-collections button').filter({hasText:'Mobílias'}).click();await expect(page.locator('.vtt-nature-card')).toHaveCount(100);
  await page.getByLabel('Buscar na biblioteca',{exact:true}).fill('cama de solteiro');await expect(page.locator('.vtt-nature-card')).toHaveCount(1);await page.locator('.vtt-nature-card').click();await page.getByRole('button',{name:'Colocar no mapa',exact:true}).click();await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  const bed=natureAssets.find(a=>a.id==='furniture-011')!;await expect.poll(async()=>{const s=(await saved()).document.scenes[0],t=s.tokens.find((t:any)=>t.image===bed.image);return t?.height/s.grid.size;}).toBe(2);
  await page.getByLabel('Buscar na biblioteca',{exact:true}).fill('');await expect(page.locator('.vtt-nature-card')).toHaveCount(100);await expect(page.getByRole('button',{name:'Gravar tela',exact:true})).toHaveCount(0);
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    expect(await page.locator('.vtt-nature-card').evaluateAll(cards=>cards.every(card=>{
      const bounds=card.getBoundingClientRect(),art=card.querySelector('img')!.getBoundingClientRect(),name=card.querySelector('span')!.getBoundingClientRect();
      return name.top>=art.bottom-1&&name.left>=bounds.left&&name.right<=bounds.right&&card.scrollWidth<=card.clientWidth+2;
    }))).toBe(true);
    await page.locator('.vtt-panel-content').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:'test-results/vtt-nature/library-'+width+'.png',fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  }
  await page.getByRole('button',{name:'Cenários',exact:true}).click();
  await expect(page.locator('.vtt-nature-card')).toHaveCount(25);
  let room=await saved();await api(player,'/vtt/join','POST',{invite:room.invite,role:'player'});
  let scene=room.document.scenes[0],house=scene.tokens.find((t:any)=>t.image===houseAssets[0].image);
  scene.fog=scene.lighting=false;const actor=newToken(randomUUID(),scene);actor.controller=guest.id;actor.name='Visitante';actor.vision=0;
  Object.assign(actor,houseWorld({x:.03,y:.5},house));scene.tokens.push(actor);
  room=await api(ctx,root,'PUT',{revision:room.revision,document:room.document});
  expect((await request(player,root+'/houses/'+house.id+'/door','PATCH',{open:true})).status).toBe(403);
  const center=houseWorld({x:.5,y:.5},house),denied=await request(player,root+'/tokens/'+actor.id,'PATCH',center);expect(denied.status).toBe(400);
  room=await saved();scene=room.document.scenes[0];Object.assign(scene.tokens.find((t:any)=>t.id===actor.id),houseWorld({x:.5,y:.98},house));
  room=await api(ctx,root,'PUT',{revision:room.revision,document:room.document});
  expect((await request(player,root+'/tokens/'+actor.id,'PATCH',center)).status).toBe(400);
  // Opening is explicit, remains saved after entry/exit, and cannot close on someone.
  const doorPath=root+'/houses/'+house.id+'/door';
  await api(ctx,doorPath,'PATCH',{open:true});
  await api(player,root+'/tokens/'+actor.id,'PATCH',center);
  expect((await saved()).document.scenes[0].tokens.find((t:any)=>t.id===actor.id).x).toBeCloseTo(center.x);
  expect((await saved()).document.scenes[0].tokens.find((t:any)=>t.id===house.id).houseDoorOpen).toBe(true);
  const innerDoor=houseWorld({x:.5,y:houseAssets[0].footprint.bottom-.07},house);
  await api(player,root+'/tokens/'+actor.id,'PATCH',innerDoor);
  await api(player,doorPath,'PATCH',{open:false});await api(player,doorPath,'PATCH',{open:true});
  const threshold=houseWorld({x:.5,y:houseAssets[0].footprint.bottom},house);
  await api(player,root+'/tokens/'+actor.id,'PATCH',threshold);
  expect((await request(player,doorPath,'PATCH',{open:false})).status).toBe(400);
  const outside=houseWorld({x:.5,y:houseAssets[0].footprint.bottom+.1},house);
  await api(player,root+'/tokens/'+actor.id,'PATCH',outside);
  await api(player,doorPath,'PATCH',{open:false});
  expect((await request(player,root+'/tokens/'+actor.id,'PATCH',center)).status).toBe(400);
  await api(player,doorPath,'PATCH',{open:true});
  const spectator=await browser.newContext();await api(spectator,'/auth/sign-up/email','POST',{name:'Observador',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});await api(spectator,'/vtt/join','POST',{invite:room.invite,role:'spectator'});
  expect((await request(spectator,doorPath,'PATCH',{open:false})).status).toBe(403);await spectator.close();
  const forbidden=await request(player,root,'PUT',{revision:room.revision,document:room.document});expect(forbidden.status).toBe(403);
  // Test the actual canvas renderer with every finished roof/interior pair.
  const bundle=await build({stdin:{contents:"import{renderVtt}from'./src/vtt-canvas';import{newScene,newToken}from'./shared/vtt';import{houseAssets,houseWorld}from'./shared/vtt-houses';import{houseDoorsAnimating}from'./src/vtt-house-doors';window.houseQA={renderVtt,newScene,newToken,houseAssets,houseWorld,houseDoorsAnimating};",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife'});
  const proof=await ctx.newPage();proof.on('pageerror',e=>errors.push(e.message));
  await proof.route(origin+'/__house-proof',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#20262c}canvas{display:block}</style><canvas id="proof" width="1000" height="1000"></canvas>'}));
  await proof.goto(origin+'/__house-proof');await proof.addScriptTag({content:bundle.outputFiles[0].text});
  const rendererChecks=[];
  for(const asset of houseAssets){
    const pictures=await proof.evaluate(async id=>{
      const q=(window as any).houseQA,a=q.houseAssets.find((a:any)=>a.id===id),scene=q.newScene(crypto.randomUUID());scene.fog=scene.lighting=false;scene.grid.opacity=0;scene.width=scene.height=1000;
      const house=q.newToken(crypto.randomUUID(),scene),actor=q.newToken(crypto.randomUUID(),scene);Object.assign(house,{layer:'map',image:a.image,x:500,y:500,width:a.width*70,height:a.height*70});Object.assign(actor,{width:70,height:70,vision:0});scene.tokens=[house,actor];
      const images=new Map<string,HTMLImageElement>();for(const path of [a.image,a.interior,'/vtt/house-parts-20261014/door-vertical.webp']){const img=new Image();img.src=path;await img.decode();images.set(path,img);}
      const canvas=document.getElementById('proof') as HTMLCanvasElement,c=canvas.getContext('2d')!;
      const options={camera:{x:500,y:500,zoom:1},width:1000,height:1000,dpr:1,images,selected:[] as string[],gm:true,preview:false,viewer:null,layer:'tokens',ruler:[],draft:null,showWalls:false,ping:null,visualEffects:false};
      Object.assign(actor,q.houseWorld({x:.5,y:.99},house));q.renderVtt(c,scene,options);const roof=canvas.toDataURL('image/png');
      Object.assign(actor,q.houseWorld({x:.5,y:.5},house));q.renderVtt(c,scene,options);const interior=canvas.toDataURL('image/png');
      Object.assign(actor,q.houseWorld({x:.5,y:.99},house));q.renderVtt(c,scene,options);const exit=canvas.toDataURL('image/png');
      Object.assign(actor,q.houseWorld({x:.5,y:.5},house));options.selected=[actor.id];q.renderVtt(c,scene,options);const inside=canvas.toDataURL('image/png');const corner=[...c.getImageData(10,10,1,1).data];
      Object.assign(actor,q.houseWorld({x:.5,y:a.footprint.top+.05},house));q.renderVtt(c,scene,options);const windowView=canvas.toDataURL('image/png');
      return {roof,interior,exit,inside,windowView,corner};
    },asset.id);
    expect(pictures.roof).not.toBe(pictures.interior);expect(pictures.exit).toBe(pictures.roof);
    expect(pictures.corner.slice(0,3)).toEqual([9,13,17]);expect(pictures.inside).not.toBe(pictures.windowView);
    for(const kind of ['roof','interior'] as const)await writeFile('test-results/vtt-nature/'+asset.id+'-'+kind+'.png',Buffer.from(pictures[kind].split(',')[1],'base64'));
    rendererChecks.push({id:asset.id,entry:true,exit:true});
  }
  expect(errors).toEqual([]);expect(missing).toEqual([]);
  await writeFile('test-results/vtt-nature/result.json',JSON.stringify({passed:true,plants:25,houses:50,emptyHouses:25,furniture:100,library:true,assetsTab:true,search:true,scale:true,drag:true,gridSnap:true,cameraPan:true,spacePan:true,interiorVision:true,windowCones:true,doorTexture:true,rotationHandle:true,shiftWheel:true,persistentDoor:true,doorPermissions:true,doorObstruction:true,serverMovement:true,playerCannotEdit:true,roofEntryAndExit:true,viewports:3,rendererChecks,errors,missing},null,2));
  console.log('25 plants, 50 houses and 100 household assets: library, drag, scale, server walls, door entry/exit, all roof/interior pairs and three widths passed.');
}catch(error){await page.screenshot({path:'test-results/vtt-nature/failure.png',fullPage:true});throw error;}
finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
