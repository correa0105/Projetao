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
 await sign(gm,'Mestre do menu');await sign(player,'Jogadora do menu');await sign(spectator,'Espectadora do menu');
 const room=await request(gm,'/vtt','POST',{name:'Menu da mesa'}),path='/vtt/rooms/'+room.id;
 const scene=room.document.scenes.find((s:any)=>s.id===room.document.activeScene);scene.fog=false;scene.lighting=false;
 await request(gm,path,'PUT',{revision:room.revision,document:room.document});
 await request(player,'/vtt/join','POST',{invite:room.invite});await request(spectator,'/vtt/join','POST',{invite:room.invite,role:'spectator'});
 await page.goto(origin+'/#vtt?room='+room.id);await page.getByRole('button',{name:'Entrar no VTT',exact:true}).click();
 await expect(page.locator('.vtt-workspace')).toBeVisible({timeout:60000});
 const launch=page.getByRole('button',{name:'Menu da mesa',exact:true});
 await expect(launch).toHaveCount(1);await expect(page.locator('#vtt-menu')).toHaveCount(0);
 for(const width of [1440,1024,800,390,320]){
  await page.setViewportSize({width,height:width<500?780:950});
  await launch.click();
  const menu=page.getByRole('complementary',{name:'Menu da mesa'});
  await expect(menu).toBeVisible();await expect(menu.getByRole('textbox',{name:'Buscar opção do menu'})).toBeFocused();
  expect(await menu.getByRole('navigation',{name:'Todas as opções da mesa'}).getByRole('button').count()).toBeGreaterThan(20);
  expect(await page.locator('.vtt-panel-tabs').count()).toBe(0);
  const first=await menu.boundingBox();expect(first!.x).toBeLessThanOrEqual(2);
  expect(first!.x+first!.width).toBeLessThanOrEqual(width);
  await menu.getByRole('textbox',{name:'Buscar opção do menu'}).fill('cenarios');
  await menu.getByRole('button',{name:/^Cenários/}).click();
  await expect(menu.getByRole('heading',{name:'Cenários',exact:true})).toBeVisible();
  const collections=menu.getByRole('navigation',{name:'Coleções de cenário'});
  await collections.getByRole('button',{name:/Comércios/}).click();
  await expect(menu.locator('.vtt-nature-card').first()).toBeVisible();
  const measured=await page.evaluate(()=>{
   const root=document.querySelector('#vtt-menu')!,body=root.querySelector('.vtt-panel-content')!,nav=root.querySelector('.vtt-nature nav')!;
   const box=nav.getBoundingClientRect(),buttons=[...nav.querySelectorAll('button')];
   return {pageOverflow:document.documentElement.scrollWidth-innerWidth,menuOverflow:root.scrollWidth-root.clientWidth,contentOverflow:body.scrollWidth-body.clientWidth,categoryOverflow:nav.scrollWidth-nav.clientWidth,categoriesInside:buttons.every(b=>{const r=b.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;})};
  });
  expect(measured.pageOverflow).toBeLessThanOrEqual(1);expect(measured.menuOverflow).toBeLessThanOrEqual(1);
  expect(measured.contentOverflow).toBeLessThanOrEqual(1);expect(measured.categoryOverflow).toBeLessThanOrEqual(1);expect(measured.categoriesInside).toBe(true);
  metrics.push({width,...measured});
  await page.screenshot({path:`test-results/vtt-menu/scenery-${width}.png`});
  await menu.getByRole('button',{name:'Todas as opções',exact:true}).click();
  await expect(menu.getByRole('textbox',{name:'Buscar opção do menu'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(launch).toBeFocused();
 }
 await page.setViewportSize({width:1440,height:950});await launch.click();
 let menu=page.getByRole('complementary',{name:'Menu da mesa'});
 await menu.getByRole('button',{name:/^Cenários/}).click();
 await menu.getByRole('navigation',{name:'Coleções de cenário'}).getByRole('button',{name:/Comércios/}).click();
 const before=(await request(gm,path)).document.scenes.find((s:any)=>s.id===scene.id).tokens.length;
 await menu.locator('.vtt-nature-card').filter({hasText:'Taverna'}).first().click();
 await menu.getByRole('button',{name:'Colocar no mapa',exact:true}).click();
 await page.getByRole('button',{name:'Salvar mesa',exact:true}).click();
 await expect.poll(async()=>(await request(gm,path)).document.scenes.find((s:any)=>s.id===scene.id).tokens.length).toBe(before+1);
 await menu.getByRole('button',{name:'Todas as opções',exact:true}).click();
 await menu.getByRole('button',{name:/^Ferramentas do mapa/}).click();
 await menu.getByRole('button',{name:'Camadas',exact:true}).click();
 await page.getByRole('group',{name:'Opções de Camadas'}).getByRole('button',{name:'Tokens · jogadores',exact:true}).click();
 await menu.getByRole('button',{name:'Régua (R)',exact:true}).click();
 await expect(menu.getByRole('button',{name:'Régua (R)',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({width:390,height:780});
  await menu.getByRole('button',{name:'Efeitos do mestre',exact:true}).click();
  const effects=page.getByRole('region',{name:'Efeitos salvos do mestre'});
  await expect(effects).toBeVisible();
  const effectsBox=await effects.boundingBox();expect(effectsBox!.x).toBeGreaterThanOrEqual(0);expect(effectsBox!.x+effectsBox!.width).toBeLessThanOrEqual(390);
  await effects.getByRole('button',{name:'Fechar efeitos',exact:true}).click();
  await menu.locator('.vtt-tools').evaluate(e=>{e.scrollTop=e.scrollHeight;});
  const finalTool=await menu.getByRole('button',{name:'Efeitos do mestre',exact:true}).boundingBox(),siteMenu=await page.locator('.journey-dock').boundingBox();
  if(siteMenu)expect(finalTool!.y+finalTool!.height).toBeLessThanOrEqual(siteMenu.y-6);
  await page.screenshot({path:'test-results/vtt-menu/tools-390.png'});
  await page.setViewportSize({width:1440,height:950});
 await menu.getByRole('button',{name:'Todas as opções',exact:true}).click();
 await menu.getByRole('textbox',{name:'Buscar opção do menu'}).fill('nada-encontrado');
 await expect(menu.getByText('Nenhuma opção encontrada. Tente outro nome.')).toBeVisible();
 await menu.getByRole('textbox',{name:'Buscar opção do menu'}).fill('');
 await page.screenshot({path:'test-results/vtt-menu/overview-1440.png'});
 for(const [c,role]of [[player,'player'],[spectator,'spectator']]as const){
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/#vtt?room='+room.id);await p.getByRole('button',{name:'Entrar no VTT',exact:true}).click();
  await expect(p.locator('.vtt-workspace')).toBeVisible({timeout:60000});await p.getByRole('button',{name:'Menu da mesa',exact:true}).click();
  const panel=p.getByRole('complementary',{name:'Menu da mesa'});
  await expect(panel.getByRole('button',{name:/^Pintar terreno/})).toHaveCount(0);
  await panel.getByRole('button',{name:/^Ferramentas do mapa/}).click();
  await expect(panel.getByRole('button',{name:'Barreira de luz',exact:true})).toHaveCount(0);
  if(role==='spectator'){await expect(panel.getByRole('button',{name:'Selecionar (V)',exact:true})).toHaveCount(0);}
  await p.close();
 }
 expect(errors).toEqual([]);
 await writeFile('test-results/vtt-menu/result.json',JSON.stringify({passed:true,metrics,clickPlacementPreserved:true,toolsAndLayerSelection:true,playerAndSpectatorPreserved:true},null,2));
 console.log('Menu único à esquerda: 5 larguras sem rolagem horizontal, busca, teclado, cenários por clique e permissões conferidos.');
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
