import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3098';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const {pool} = await import('../server/db'), {migrate} = await import('../server/migrate'), {seed} = await import('../server/seed');
await migrate(); await seed();
const {createApp} = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3098, '127.0.0.1');
await new Promise<void>(r => server.once('listening', r));
const browser = await chromium.launch({channel:'msedge',headless:true});
const contextOptions = {viewport:{width:1440,height:950},reducedMotion:'reduce' as const,extraHTTPHeaders:{'X-Vtt-Schema-Version':String(vttProtocolVersion)}};
const gm = await browser.newContext(contextOptions), player = await browser.newContext(contextOptions), spectator = await browser.newContext(contextOptions);
for(const c of [gm,player,spectator])await c.addInitScript(() => {localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
const page=await gm.newPage(),errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
await mkdir('test-results/vtt-menu',{recursive:true});
const metrics:unknown[]=[];
async function request(c:BrowserContext,path:string,method='GET',data?:unknown){
 const r=await c.request.fetch(origin+'/api'+path,{method,headers:{Origin:origin},data});expect(r.ok(),await r.text()).toBe(true);return r.json();
}
async function sign(c:BrowserContext,name:string){await request(c,'/auth/sign-up/email','POST',{name,email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});}
try{
 await sign(gm,'Mestre da biblioteca');await sign(player,'Jogadora da biblioteca');await sign(spectator,'Espectadora da biblioteca');
 const room=await request(gm,'/vtt','POST',{name:'Biblioteca da mesa'}),path='/vtt/rooms/'+room.id;
 const scene=room.document.scenes.find((s:any)=>s.id===room.document.activeScene);scene.fog=false;scene.lighting=false;
 await request(gm,path,'PUT',{revision:room.revision,document:room.document});
 await request(player,'/vtt/join','POST',{invite:room.invite});await request(spectator,'/vtt/join','POST',{invite:room.invite,role:'spectator'});
 await page.goto(origin+'/#vtt?room='+room.id);await page.getByRole('button',{name:'Entrar no VTT',exact:true}).click();
 await expect(page.locator('.vtt-workspace')).toBeVisible({timeout:60000});
 const launch=page.getByRole('navigation',{name:'Painéis da mesa'}).getByRole('button',{name:'Biblioteca de assets',exact:true});
 await expect(page.locator('.vtt-top .vtt-menu-trigger')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Abrir biblioteca de assets',exact:true})).toHaveCount(0);
 await expect(launch).toHaveCount(1);await expect(page.locator('#vtt-library-menu')).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Ferramentas da mesa'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Painéis da mesa'}).getByRole('button',{name:'Chat',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const width of [1440,1024,800,390,320]){
  await page.setViewportSize({width,height:width<500?780:950});
  const canvasBefore=await page.locator('.vtt-stage').boundingBox();
  await launch.click();
  const menu=page.getByRole('region',{name:'Biblioteca de assets'});
  await expect(menu).toBeVisible();await expect(menu.getByRole('textbox',{name:'Buscar categoria da biblioteca'})).toBeFocused();
  expect(await menu.getByRole('navigation',{name:'Categorias da biblioteca'}).getByRole('button').count()).toBe(8);
  await expect(menu.getByRole('button',{name:/^Terrenos e texturas/})).toHaveCount(0);
  for(const label of ['Chat','Personagens','Combate','Diário','Montarias','Mascotes','Veículos','Armas de cerco','Ferramentas do mapa','Som e voz','Configurações da mesa'])await expect(menu.getByRole('button',{name:new RegExp('^'+label)})).toHaveCount(0);
  expect(await menu.locator('.vtt-tools').count()).toBe(0);
  const box=await menu.boundingBox(),panel=await page.locator('aside.vtt-panel').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(panel!.x);expect(box!.x+box!.width).toBeCloseTo(panel!.x+panel!.width,0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  expect(await menu.evaluate(e=>Boolean(e.closest('aside.vtt-panel')?.querySelector('.vtt-panel-tabs')))).toBe(true);
  if(width>800){const stage=await page.locator('.vtt-stage').boundingBox();expect(stage!.width).toBeCloseTo(canvasBefore!.width,0);expect(stage!.x).toBeCloseTo(canvasBefore!.x,0);}
  await menu.getByRole('textbox',{name:'Buscar categoria da biblioteca'}).fill('cenarios');
  await menu.getByRole('button',{name:/^Cenários/}).click();
  await expect(menu.getByRole('heading',{name:'Cenários',exact:true})).toBeVisible();
  const collections=menu.getByRole('navigation',{name:'Coleções de cenário'});
  await collections.getByRole('button',{name:/Comércios/}).click();
  await expect(menu.locator('.vtt-nature-card').first()).toBeVisible();
  const measured=await page.evaluate(()=>{
   const root=document.querySelector('#vtt-library-menu')!,body=root.querySelector('.vtt-panel-content')!,nav=root.querySelector('.vtt-nature nav')!;
   const box=nav.getBoundingClientRect(),buttons=[...nav.querySelectorAll('button')];
   return{pageOverflow:document.documentElement.scrollWidth-innerWidth,menuOverflow:root.scrollWidth-root.clientWidth,contentOverflow:body.scrollWidth-body.clientWidth,categoryOverflow:nav.scrollWidth-nav.clientWidth,categoriesInside:buttons.every(b=>{const r=b.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;})};
  });
  for(const value of [measured.pageOverflow,measured.menuOverflow,measured.contentOverflow,measured.categoryOverflow])expect(value).toBeLessThanOrEqual(1);
  expect(measured.categoriesInside).toBe(true);metrics.push({width,...measured});
  if(width<=700)expect(await menu.evaluate(root=>{
    const bar=document.querySelector('.vtt-hotbar')?.getBoundingClientRect(),pane=root.getBoundingClientRect();
    if(!bar||bar.right<=pane.left||bar.left>=pane.right)return true;
    const x=(Math.max(bar.left,pane.left)+Math.min(bar.right,pane.right))/2,y=bar.top+8;
    return root.contains(document.elementFromPoint(x,y));
  })).toBe(true);
  await page.screenshot({path:'test-results/vtt-menu/library-scenery-'+width+'.png'});
  await menu.getByRole('button',{name:'Todas as categorias',exact:true}).click();
  await expect(menu.getByRole('textbox',{name:'Buscar categoria da biblioteca'})).toBeFocused();
  await menu.getByRole('textbox',{name:'Buscar categoria da biblioteca'}).fill('pedras');
  await menu.getByRole('button',{name:/^Peças de cenário/}).click();
  const pieces=menu.getByRole('navigation',{name:'Coleções de peças de cenário'});
  await expect(pieces.getByRole('button')).toHaveCount(4);
  expect(await pieces.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  await pieces.getByRole('button',{name:/^Árvores/}).click();
  await menu.locator('.vtt-tree-card').first().scrollIntoViewIfNeeded();
  await expect.poll(()=>menu.locator('.vtt-tree-card img').first().evaluate(i=>(i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path:'test-results/vtt-menu/library-trees-'+width+'.png'});
  await pieces.getByRole('button',{name:/^Pedras/}).click();
  await menu.locator('.vtt-tree-card').first().scrollIntoViewIfNeeded();
  await expect.poll(()=>menu.locator('.vtt-tree-card img').first().evaluate(i=>(i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await pieces.getByRole('button',{name:/^Terrenos e texturas/}).click();
  await expect(menu.getByRole('heading',{name:'Pintar o mapa',exact:true})).toBeVisible();
  await menu.getByRole('button',{name:'Todas as categorias',exact:true}).click();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(launch).toBeFocused();
 }
 await page.setViewportSize({width:1440,height:950});
 const panels=page.getByRole('navigation',{name:'Painéis da mesa'});
 await expect(panels.getByRole('button')).toHaveCount(6);
 await panels.getByRole('button',{name:'Combate',exact:true}).click();await expect(page.locator('aside.vtt-panel').getByRole('heading',{name:'Combate',exact:true})).toBeVisible();
 await panels.getByRole('button',{name:'Fichas',exact:true}).click();await expect(page.getByRole('button',{name:'Personagens',exact:true})).toBeVisible();
 await panels.getByRole('button',{name:'Chat',exact:true}).click();
 await launch.click();let menu=page.getByRole('region',{name:'Biblioteca de assets'});
 await menu.getByRole('button',{name:/^Cenários/}).click();
 await menu.getByRole('navigation',{name:'Coleções de cenário'}).getByRole('button',{name:/Comércios/}).click();
 const before=(await request(gm,path)).document.scenes.find((s:any)=>s.id===scene.id).tokens.length;
 await menu.locator('.vtt-nature-card').filter({hasText:'Taverna'}).first().click();await menu.getByRole('button',{name:'Colocar no mapa',exact:true}).click();
 await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
 await expect.poll(async()=>(await request(gm,path)).document.scenes.find((s:any)=>s.id===scene.id).tokens.length).toBe(before+1);
 await menu.getByRole('button',{name:'Todas as categorias',exact:true}).click();
 await menu.getByRole('textbox',{name:'Buscar categoria da biblioteca'}).fill('');
 await menu.getByRole('button',{name:/^Peças de cenário/}).click();
 const pieces=menu.getByRole('navigation',{name:'Coleções de peças de cenário'});
 for(const collection of ['Árvores','Pedras']){
  await pieces.getByRole('button',{name:new RegExp('^'+collection)}).click();
  await menu.locator('.vtt-tree-card').first().click();
  await menu.getByRole('button',{name:'Colocar no mapa',exact:true}).click();
 }
 await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
 await expect.poll(async()=>(await request(gm,path)).document.scenes.find((s:any)=>s.id===scene.id).tokens.length).toBe(before+3);
 const tokens=(await request(gm,path)).document.scenes.find((s:any)=>s.id===scene.id).tokens;
 expect(tokens.some((t:any)=>t.image.startsWith('/vtt/trees-'))).toBe(true);expect(tokens.some((t:any)=>t.image.startsWith('/vtt/rocks-'))).toBe(true);
 await menu.getByRole('button',{name:'Todas as categorias',exact:true}).click();
 await menu.getByRole('button',{name:/^Criaturas vistas de cima/}).click();
 await expect(menu.locator('.vtt-private-library.premium')).toBeVisible();await expect(menu.locator('.vtt-tree-grid')).toHaveCount(0);
 await menu.getByRole('button',{name:'Todas as categorias',exact:true}).click();
 await page.screenshot({path:'test-results/vtt-menu/library-overview-1440.png'});
 await menu.getByRole('button',{name:'Fechar biblioteca de assets',exact:true}).click();
 const tools=page.getByRole('navigation',{name:'Ferramentas da mesa'});
 await tools.getByRole('button',{name:'Camadas',exact:true}).click();await page.getByRole('group',{name:'Opções de Camadas'}).getByRole('button',{name:'Tokens · jogadores',exact:true}).click();
 await tools.getByRole('button',{name:'Régua (R)',exact:true}).click();await expect(tools.getByRole('button',{name:'Régua (R)',exact:true})).toHaveAttribute('aria-pressed','true');
 await launch.click();await menu.getByRole('textbox',{name:'Buscar categoria da biblioteca'}).fill('nada-encontrado');await expect(menu.getByText('Nenhuma categoria encontrada. Tente outro nome.')).toBeVisible();
 for(const [c,role]of [[player,'player'],[spectator,'spectator']]as const){
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/#vtt?room='+room.id);await p.getByRole('button',{name:'Entrar no VTT',exact:true}).click();
  await expect(p.locator('.vtt-workspace')).toBeVisible({timeout:60000});await p.getByRole('navigation',{name:'Painéis da mesa'}).getByRole('button',{name:'Biblioteca de assets',exact:true}).click();
  const drawer=p.getByRole('region',{name:'Biblioteca de assets'});await expect(drawer.getByRole('button',{name:/^Terrenos e texturas/})).toHaveCount(0);
  await drawer.getByRole('button',{name:/^Peças de cenário/}).click();
  const pieces=drawer.getByRole('navigation',{name:'Coleções de peças de cenário'});
  await expect(pieces.getByRole('button')).toHaveCount(3);await expect(pieces.getByRole('button',{name:/^Terrenos/})).toHaveCount(0);
  await pieces.getByRole('button',{name:/^Árvores/}).click();await drawer.locator('.vtt-tree-card').first().click();
  await expect(drawer.getByRole('button',{name:'Colocar no mapa',exact:true})).toHaveCount(0);
  const toolbar=p.getByRole('navigation',{name:'Ferramentas da mesa'});await expect(toolbar).toBeVisible();await expect(toolbar.getByRole('button',{name:'Barreira de luz',exact:true})).toHaveCount(0);
  if(role==='spectator')await expect(toolbar.getByRole('button',{name:'Selecionar (V)',exact:true})).toHaveCount(0);
  await p.close();
 }
 expect(errors).toEqual([]);
 await writeFile('test-results/vtt-menu/result.json',JSON.stringify({passed:true,libraryOnly:true,rightPanel:true,noHeaderTrigger:true,sceneryUnified:true,treesAndRocksAccessible:true,terrainGmOnly:true,creaturesSeparate:true,metrics,clickPlacementPreserved:true,separateToolbarAndRightPanels:true,playerAndSpectatorPreserved:true},null,2));
 console.log('Biblioteca integrada à aba do painel direito: 5 larguras, botão do topo removido, categorias, cenário por clique e perfis conferidos.');
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
