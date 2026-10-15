import 'dotenv/config';
import {chromium,expect,type BrowserContext} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {vttVisualSource} from '../shared/vtt-asset-visuals';
import {natureAssets} from '../shared/vtt-nature-assets';
import {houseAssets,houseWorld,houseDoorPoint,houseAsset} from '../shared/vtt-houses';
import {newToken} from '../shared/vtt';
import {createNatureToken} from '../shared/vtt-nature-placement';
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
page.on('response',r=>{if(r.status()>=400&&/\/vtt\/((plants|houses|houses-empty|home-furniture|home-furniture-refined|house-parts|village-life|village-life-thumbs)-20261014|overhead-20261015|overhead-thumbs-20261015|human-scale-20261015|human-scale-thumbs-20261015)\//.test(r.url()))missing.push(r.url());});
const headers={Origin:origin,'X-Vtt-Schema-Version':String(vttProtocolVersion)};
async function request(context:BrowserContext,path:string,method='GET',data?:unknown){const r=await context.request.fetch(origin+'/api'+path,{method,data,headers});return {status:r.status(),data:await r.json()};}
async function api(context:BrowserContext,path:string,method='GET',data?:unknown){const r=await request(context,path,method,data);expect(r.status,JSON.stringify(r.data)).toBeLessThan(300);return r.data;}
await mkdir('test-results/vtt-nature',{recursive:true});
try{
  expect(natureAssets.filter(a=>a.category==='Plantas')).toHaveLength(25);expect(houseAssets).toHaveLength(90);expect(natureAssets.filter(a=>a.category==='Mobílias')).toHaveLength(100);
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
  // Prepared lights are configured at placement and retain their animation speed after saving.
  await page.getByRole('button',{name:'Camadas',exact:true}).click();await page.getByRole('button',{name:'Iluminação e barreiras',exact:true}).click();
  await page.getByRole('button',{name:'Fonte de luz',exact:true}).click();
  await page.mouse.click(panBox.x+panBox.width*.35,panBox.y+panBox.height*.35);
  await expect(page.getByRole('region',{name:'Presets de iluminação',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  await expect.poll(async()=>{const l=(await saved()).document.scenes[0].lights[0];return [l?.name,l?.bright,l?.dim,l?.animation,l?.effectSpeed];}).toEqual(['Tocha',20,20,'torch',1]);
  await page.getByLabel('Preset de iluminação',{exact:true}).selectOption('campfire');
  await page.getByRole('button',{name:'Aplicar à luz selecionada',exact:true}).click();
  await page.getByLabel('Animação da luz',{exact:true}).selectOption('arcane');
  await page.getByLabel('Velocidade do efeito de luz',{exact:true}).focus();await page.keyboard.press('End');
  await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  await expect.poll(async()=>{const l=(await saved()).document.scenes[0].lights[0];return [l?.name,l?.bright,l?.dim,l?.animation,l?.effectSpeed];}).toEqual(['Fogueira',30,30,'arcane',3]);
  await page.screenshot({path:'test-results/vtt-nature/lighting-presets.png',fullPage:true});

  // Every additional material is selectable and persists as painted terrain.
  await page.getByRole('button',{name:'Brush do mapa',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Textura: /})).toHaveCount(18);
  expect(await page.locator('.vtt-terrain-textures button').evaluateAll(cards=>cards.every(c=>c.scrollWidth<=c.clientWidth+2))).toBe(true);
  let terrainIndex=0;
  for(const name of ['Terra batida','Lama','Cascalho','Folhas secas','Musgo','Grama seca','Paralelepípedos','Terracota','Mármore','Madeira escura']){
    await page.getByRole('button',{name:'Textura: '+name,exact:true}).click();
    const b=await screen({x:500+(terrainIndex%5)*130,y:650+Math.floor(terrainIndex/5)*160});terrainIndex++;await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(b.x+15,b.y+10,{steps:4});await page.mouse.up();
  }
  await expect.poll(async()=>new Set((await saved()).document.scenes[0].terrain.map((t:any)=>t.texture)).size).toBe(10);
  const paintedRoom=await saved();paintedRoom.document.scenes[0].lighting=false;await api(ctx,root,'PUT',{revision:paintedRoom.revision,document:paintedRoom.document});
  const failedTextures=new Set<string>();
  await page.route('**/vtt/terrain-expansion-20261015/*.webp',async route=>{const url=route.request().url();if(!failedTextures.has(url)){failedTextures.add(url);await route.fulfill({status:503,body:'temporary interruption'});}else await route.continue();});
  await page.reload();await expect(board).toBeVisible();
  await expect.poll(async()=>{const p=await screen({x:760,y:655});return board.evaluate((el,p)=>{const b=el.getBoundingClientRect(),c=el as HTMLCanvasElement,d=c.getContext('2d')!.getImageData(Math.round((p.x-b.x)*c.width/b.width),Math.round((p.y-b.y)*c.height/b.height),1,1).data;return d[0]>80&&d[1]>60&&d[2]<d[0];},p);},{timeout:15000}).toBe(true);
  expect(failedTextures.size).toBeGreaterThan(0);
  await page.unroute('**/vtt/terrain-expansion-20261015/*.webp');
  expect(new Set((await saved()).document.scenes[0].terrain.map((t:any)=>t.texture)).size).toBe(10);
  await page.getByRole('button',{name:'Brush do mapa',exact:true}).click();
  await page.screenshot({path:'test-results/vtt-nature/terrain-18.png',fullPage:true});
  await page.keyboard.press('Escape');
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
  await expect(page.locator('.vtt-nature-detail>img')).toHaveAttribute('src',vttVisualSource(houseAssets[0].interior));
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
  await page.locator('.vtt-nature-card').first().click();await page.getByRole('button',{name:'Interior',exact:true}).click();await expect(page.locator('.vtt-nature-detail>img')).toHaveAttribute('src',vttVisualSource(houseAssets[25].interior));
  await page.locator('.vtt-asset-collections button').filter({hasText:'Mobílias'}).click();await expect(page.locator('.vtt-nature-card')).toHaveCount(100);
  await page.getByLabel('Buscar na biblioteca',{exact:true}).fill('cama de solteiro');await expect(page.locator('.vtt-nature-card')).toHaveCount(1);await page.locator('.vtt-nature-card').click();await page.getByRole('button',{name:'Colocar no mapa',exact:true}).click();await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
  const bed=natureAssets.find(a=>a.id==='furniture-011')!;await expect.poll(async()=>{const s=(await saved()).document.scenes[0],t=s.tokens.find((t:any)=>t.image===bed.image);return t?.height/s.grid.size;}).toBeCloseTo(bed.height);
  await page.getByLabel('Buscar na biblioteca',{exact:true}).fill('');await expect(page.locator('.vtt-nature-card')).toHaveCount(100);await expect(page.getByRole('button',{name:'Gravar tela',exact:true})).toHaveCount(0);
  // New collections use thumbnails; previews and saved tokens retain the complete art.
  for(const category of ['Jardinagem','Moradores','Mercadores','Animais','Comércios']){
    await page.locator('.vtt-asset-collections button').filter({hasText:category}).click();await expect(page.locator('.vtt-nature-card')).toHaveCount(['Animais','Comércios'].includes(category)?40:25);
    for(const card of await page.locator('.vtt-nature-card').all())await card.scrollIntoViewIfNeeded();
    await expect.poll(()=>page.locator('.vtt-nature-card img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
    expect(await page.locator('.vtt-nature-card img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth<=224&&img.getAttribute('src')!.includes('overhead-thumbs')))).toBe(true);
    const asset=natureAssets.find(a=>a.category===category)!;await page.locator('.vtt-nature-card').first().click();
    await expect(page.locator('.vtt-nature-detail>img')).toHaveAttribute('src',vttVisualSource(asset.image));await expect.poll(()=>page.locator('.vtt-nature-detail>img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
    await page.locator('.vtt-nature-detail select').selectOption('1.5');
    const bounds=(await board.boundingBox())!;await page.locator('.vtt-nature-card').first().dragTo(board,{targetPosition:{x:bounds.width*.30,y:bounds.height*.55}});
    await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
    await expect.poll(async()=>{const s=(await saved()).document.scenes[0],t=s.tokens.find((t:any)=>t.image===asset.image);return t?.width/s.grid.size;}).toBe(asset.width*1.5);
    const token=(await saved()).document.scenes[0].tokens.find((t:any)=>t.image===asset.image);
    expect(token.layer).toBe(asset.actor?'tokens':'map');expect(token.bleeds).toBe(!!asset.actor);expect(token.notes).toBe(asset.notes??'');
    if(asset.actor){const pivot=await screen(token);await page.mouse.move(pivot.x,pivot.y);await page.keyboard.down('Shift');await page.mouse.wheel(0,100);await page.keyboard.up('Shift');await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();await expect.poll(async()=>Math.round((await saved()).document.scenes[0].tokens.find((t:any)=>t.id===token.id).rotation)).toBe(15);}
  }
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
  scene.tokens=scene.tokens.filter((t:any)=>!houseAsset(t)||t.id===house.id);
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
  const resident=(await saved()).document.scenes[0].tokens.find((t:any)=>t.image.includes('/resident-'));expect((await request(player,root+'/tokens/'+resident.id,'PATCH',{x:resident.x+70,y:resident.y})).status).toBe(403);
  const forbidden=await request(player,root,'PUT',{revision:room.revision,document:room.document});expect(forbidden.status).toBe(403);
  // Live windows: reach/ownership, persistent state, interaction sounds and silent reload.
  await page.setViewportSize({width:1440,height:1000});
  room=await saved();scene=room.document.scenes[0];scene.fog=scene.lighting=false;scene.terrain=[];scene.walls=[];
  const windowAsset=houseAssets.find(a=>a.id==='house-002')!,windowHouse=newToken(randomUUID(),scene),windowActor=newToken(randomUUID(),scene),window=windowAsset.windows[0];
  Object.assign(windowHouse,{layer:'map',image:windowAsset.image,name:'Casa de teste de janela',width:630,height:630,x:1100,y:1000});
  Object.assign(windowActor,{...houseWorld({x:window.x,y:window.y-.07},windowHouse),controller:guest.id,name:'Visitante da janela'});scene.tokens=[windowHouse,windowActor];
  room=await api(ctx,root,'PUT',{revision:room.revision,document:room.document});
  const windowPath=root+'/houses/'+windowHouse.id+'/windows/0';
  await ctx.addInitScript(()=>{
    localStorage.setItem('alvorada-effects-muted','false');
    (window as any).__housePlayed=[];
    HTMLMediaElement.prototype.play=function(){if(this.src.includes('/audio/vtt/sfx-'))(window as any).__housePlayed.push({src:this.src,volume:this.volume});return Promise.resolve();};
  });
  await page.reload();await expect(board).toBeVisible();await page.waitForTimeout(400);
  expect(await page.evaluate(()=>(window as any).__housePlayed)).toEqual([]);
  const atWindow=await screen(windowActor);await page.mouse.click(atWindow.x,atWindow.y);
  const closeWindow=page.getByRole('button',{name:'Fechar janela 1 — Casa de teste de janela',exact:true});await expect(closeWindow).toBeVisible();await closeWindow.click();
  await expect.poll(async()=>(await saved()).document.scenes[0].tokens.find((t:any)=>t.id===windowHouse.id).houseWindowsClosed).toEqual([0]);
  await expect.poll(()=>page.evaluate(()=>(window as any).__housePlayed.map((a:any)=>a.src.split('/').at(-1)))).toEqual(['sfx-metallatch.ogg']);
  await expect(page.getByRole('button',{name:'Abrir janela 1 — Casa de teste de janela',exact:true})).toBeVisible();
  await api(player,windowPath,'PATCH',{open:true});
  await expect.poll(()=>page.evaluate(()=>(window as any).__housePlayed.map((a:any)=>a.src.split('/').at(-1)))).toEqual(['sfx-metallatch.ogg','sfx-creak1.ogg']);
  await page.getByRole('button',{name:'Configurações e ajuda',exact:true}).click();
  await page.getByLabel('Som dos efeitos e ataques',{exact:true}).uncheck();await api(player,windowPath,'PATCH',{open:false});
  await expect(page.getByRole('button',{name:'Abrir janela 1 — Casa de teste de janela',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__housePlayed.length)).toBe(2);
  await page.getByLabel('Som dos efeitos e ataques',{exact:true}).check();await api(player,windowPath,'PATCH',{open:true});
  await expect.poll(()=>page.evaluate(()=>(window as any).__housePlayed.length)).toBe(3);
  const freshDoor=root+'/houses/'+windowHouse.id+'/door';await api(ctx,freshDoor,'PATCH',{open:true});
  await expect.poll(()=>page.evaluate(()=>(window as any).__housePlayed.map((a:any)=>a.src.split('/').at(-1)))).toContain('sfx-dooropen-1.ogg');
  await api(ctx,freshDoor,'PATCH',{open:false});
  await expect.poll(()=>page.evaluate(()=>(window as any).__housePlayed.map((a:any)=>a.src.split('/').at(-1)))).toContain('sfx-doorclose-1.ogg');
  expect(await page.evaluate(()=>(window as any).__housePlayed.every((a:any)=>a.volume>0&&a.volume<=1))).toBe(true);
  const cuesBefore=(await saved()).document.scenes[0].houseCues.length;await api(player,windowPath,'PATCH',{open:true});expect((await saved()).document.scenes[0].houseCues.length).toBe(cuesBefore);
  const watch=await browser.newContext();await api(watch,'/auth/sign-up/email','POST',{name:'Observador',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});await api(watch,'/vtt/join','POST',{invite:room.invite,role:'spectator'});expect((await request(watch,windowPath,'PATCH',{open:false})).status).toBe(403);await watch.close();
  room=await saved();scene=room.document.scenes[0];Object.assign(scene.tokens.find((t:any)=>t.id===windowActor.id),{x:300,y:300});await api(ctx,root,'PUT',{revision:room.revision,document:room.document});
  expect((await request(player,windowPath,'PATCH',{open:false})).status).toBe(403);
  expect((await request(player,root+'/houses/'+windowHouse.id+'/windows/31','PATCH',{open:false})).status).toBe(404);
  await api(ctx,windowPath,'PATCH',{open:false});await page.reload();await expect(board).toBeVisible();await page.waitForTimeout(500);expect(await page.evaluate(()=>(window as any).__housePlayed)).toEqual([]);
  expect((await saved()).document.scenes[0].tokens.find((t:any)=>t.id===windowHouse.id).houseWindowsClosed).toEqual([0]);
  // GM-only scenery conversion retains the placed cart offset and persists without creature HUD.
  await page.setViewportSize({width:1440,height:1000});
  room=await saved();scene=room.document.scenes[0];scene.fog=scene.lighting=false;scene.terrain=[];
  const horse=createNatureToken(randomUUID(),'animal-002',scene,{x:500,y:500})!;horse.controller=guest.id;
  const wagon=createNatureToken(randomUUID(),'merchant-012',scene,{x:710,y:500})!;wagon.name='Carroça vinculada';wagon.controller=guest.id;wagon.rotation=90;
  const loose=createNatureToken(randomUUID(),'merchant-012',scene,{x:710,y:770})!;loose.name='Outra carroça';
  const cartStart={x:wagon.x,y:wagon.y},horseStart={x:horse.x,y:horse.y,rotation:horse.rotation};
  const relativeRadius=Math.hypot(wagon.x-horse.x,wagon.y-horse.y);
  scene.tokens=[horse,wagon,loose];scene.walls=[];
  room=await api(ctx,root,'PUT',{revision:room.revision,document:room.document});
  expect((await request(player,root+'/tokens/'+wagon.id+'/attachment','POST',{tokenId:horse.id})).status).toBe(403);
  await page.reload();await expect(board).toBeVisible();
  // Context menu can reach map scenery with the normal right-click workflow.
  let cartPoint=await screen(wagon);await page.mouse.click(cartPoint.x,cartPoint.y,{button:'right'});
  await page.getByRole('button',{name:'Configurações do token',exact:true}).click();
  await page.getByLabel('Vincular cenário a um token',{exact:true}).selectOption(horse.id);
  await expect.poll(async()=>{const cart=(await saved()).document.scenes[0].tokens.find((t:any)=>t.id===wagon.id);return [cart?.layer,cart?.sceneryToken,cart?.attachment?.tokenId,cart?.x,cart?.y];}).toEqual(['tokens',true,horse.id,cartStart.x,cartStart.y]);
  room=await saved();expect(room.document.scenes[0].tokens.find((t:any)=>t.id===loose.id).layer).toBe('map');
  for(const tokenId of [null,horse.id])expect((await request(player,root+'/tokens/'+wagon.id+'/attachment','POST',{tokenId})).status).toBe(403);
  await api(player,root+'/tokens/'+horse.id,'PATCH',{x:horseStart.x+70,y:horseStart.y});
  room=await saved();const movedHorse=room.document.scenes[0].tokens.find((t:any)=>t.id===horse.id),movedCart=room.document.scenes[0].tokens.find((t:any)=>t.id===wagon.id);
  const turn=(movedHorse.rotation-horseStart.rotation)*Math.PI/180,dx=cartStart.x-horseStart.x,dy=cartStart.y-horseStart.y;
  expect(movedCart.x).toBeCloseTo(movedHorse.x+dx*Math.cos(turn)-dy*Math.sin(turn));expect(movedCart.y).toBeCloseTo(movedHorse.y+dx*Math.sin(turn)+dy*Math.cos(turn));
  await api(player,root+'/tokens/'+horse.id,'PATCH',{rotation:(movedHorse.rotation+90)%360});
  room=await saved();const rotated=room.document.scenes[0].tokens.find((t:any)=>t.id===wagon.id);
  expect(rotated.attachment.tokenId).toBe(horse.id);expect(Math.hypot(rotated.x-movedHorse.x,rotated.y-movedHorse.y)).toBeCloseTo(relativeRadius);
  await page.reload();await expect(board).toBeVisible();cartPoint=await screen(rotated);await page.mouse.click(cartPoint.x,cartPoint.y,{button:'right'});
  await expect(page.getByRole('group',{name:'Valores do token',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Abrir ficha',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Configurações do token',exact:true}).click();await expect(page.getByLabel('Vincular cenário a um token',{exact:true})).toHaveValue(horse.id);
  await page.screenshot({path:'test-results/vtt-nature/wagon-linked.png',fullPage:true});
  await page.getByLabel('Vincular cenário a um token',{exact:true}).selectOption('');
  await expect.poll(async()=>(await saved()).document.scenes[0].tokens.find((t:any)=>t.id===wagon.id).attachment).toBeNull();
  await page.keyboard.press('Escape');
  const otherPoint=await screen(loose);await expect(async()=>{await page.mouse.click(otherPoint.x,otherPoint.y,{button:'right'});await expect(page.getByRole('button',{name:'Configurações do token',exact:true})).toBeVisible({timeout:200});}).toPass({timeout:3000});await page.getByRole('button',{name:'Configurações do token',exact:true}).click();
  await page.getByRole('button',{name:'Transformar cenário em token',exact:true}).click();
  await expect.poll(async()=>(await saved()).document.scenes[0].tokens.find((t:any)=>t.id===loose.id).sceneryToken).toBe(true);
  await page.keyboard.press('Escape');
  // Test the actual canvas renderer with every finished roof/interior pair.
  const bundle=await build({stdin:{contents:"import{vttVisualSource}from'./shared/vtt-asset-visuals';import{renderVtt}from'./src/vtt-canvas';import{newScene,newToken}from'./shared/vtt';import{houseAssets,houseWorld}from'./shared/vtt-houses';import{houseDoorsAnimating}from'./src/vtt-house-doors';window.houseQA={vttVisualSource,renderVtt,newScene,newToken,houseAssets,houseWorld,houseDoorsAnimating};",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife'});
  const proof=await ctx.newPage();proof.on('pageerror',e=>errors.push(e.message));
  await proof.route(origin+'/__house-proof',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#20262c}canvas{display:block}</style><canvas id="proof" width="1000" height="1000"></canvas>'}));
  await proof.goto(origin+'/__house-proof');await proof.addScriptTag({content:bundle.outputFiles[0].text});
  const rendererChecks=[];
  for(const asset of houseAssets){
    const pictures=await proof.evaluate(async id=>{
      const q=(window as any).houseQA,a=q.houseAssets.find((a:any)=>a.id===id),scene=q.newScene(crypto.randomUUID());scene.fog=scene.lighting=false;scene.grid.opacity=0;scene.width=scene.height=1000;
      const house=q.newToken(crypto.randomUUID(),scene),actor=q.newToken(crypto.randomUUID(),scene);Object.assign(house,{layer:'map',image:a.image,x:500,y:500,width:a.width*70,height:a.height*70});Object.assign(actor,{width:70,height:70,vision:0});scene.tokens=[house,actor];
      const images=new Map<string,HTMLImageElement>();for(const path of [a.image,a.interior,'/vtt/house-parts-20261014/door-vertical.webp']){const img=new Image();img.src=q.vttVisualSource(path);await img.decode();images.set(path,img);}
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
  await writeFile('test-results/vtt-nature/result.json',JSON.stringify({passed:true,windowControls:true,windowPermissions:true,windowPersistence:true,houseAudio:true,houseAudioMute:true,silentReload:true,terrainTextures:18,newTerrainPainted:10,terrainReload:true,terrainNetworkRecovery:true,sceneryConversion:true,sceneryLinkPermissions:true,sceneryRotation:true,lightingPresets:true,lightSpeed:true,physicalObjectScale:true,protocol:vttProtocolVersion,plants:25,houses:90,emptyHouses:25,animals:40,commerces:40,furniture:100,gardening:25,residents:25,merchants:25,thumbnails:true,residentBody:true,residentRotation:true,scaledNewDrag:true,library:true,assetsTab:true,search:true,scale:true,drag:true,gridSnap:true,cameraPan:true,spacePan:true,interiorVision:true,windowCones:true,doorTexture:true,rotationHandle:true,shiftWheel:true,persistentDoor:true,doorPermissions:true,doorObstruction:true,serverMovement:true,playerCannotEdit:true,roofEntryAndExit:true,viewports:3,rendererChecks,errors,missing},null,2));
  console.log('25 plants, 90 houses, 100 household assets and 40 animals: library, drag, scale, server walls, door entry/exit, all roof/interior pairs and three widths passed.');
}catch(error){await page.screenshot({path:'test-results/vtt-nature/failure.png',fullPage:true});throw error;}
finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
