import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { newScene,activateScene } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { verifyProfileAndWorld } from './smoke-profile-world';
assertDisposable();
function assertDisposable(){if(!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))throw Error('Banco descartável obrigatório.');}
const testHost=process.env.VTT_PERSONAL_TEST_HOST||'localhost';
const origin='http://'+testHost+':3097';process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db'),{migrate}=await import('../server/migrate'),{seed}=await import('../server/seed');
await migrate();await seed();process.env.NODE_ENV='production';
let closeServer:()=>Promise<void>;
if(process.env.VTT_PERSONAL_APP_ENTRY){
  const child=spawn(process.execPath,[resolve(process.env.VTT_PERSONAL_APP_ENTRY)],{env:{...process.env,PORT:'3097'},stdio:'inherit',windowsHide:true});
  await expect.poll(()=>fetch(origin+'/api/health').then(r=>r.ok).catch(()=>false),{timeout:30000}).toBe(true);
  closeServer=()=>new Promise<void>(r=>{child.once('exit',()=>r());child.kill();});
}else{
  const {createApp}=await import('../server/app');const server=createApp().listen(3097,testHost==='localhost'?'127.0.0.1':'0.0.0.0');await new Promise<void>(r=>server.once('listening',r));
  closeServer=()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());});
}
const browser=await chromium.launch({channel:'msedge',headless:true}),owner=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),guest=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
for(const context of [owner,guest])await context.addInitScript(()=>{localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
const page=await owner.newPage(),joined=await guest.newPage(),errors:string[]=[],out='test-results/vtt-personal';await mkdir(out,{recursive:true});
for(const p of [page,joined])p.on('pageerror',e=>errors.push(e.message));
const headers={Origin:origin,'X-Vtt-Schema-Version':String(vttProtocolVersion)};
async function request(path:string,data?:unknown,method=data?'POST':'GET'){
  const r=await owner.request.fetch(origin+'/api'+path,{method,headers,data});expect(r.ok(),await r.text()).toBe(true);return r.json();
}
try{
  const signup=await request('/auth/sign-up/email',{name:'Mestre básico',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});
  if(process.env.SITE_VISUAL_ONLY==='1') {
    await verifyProfileAndWorld(page,origin,signup.user.id,out);
    expect(errors).toEqual([]);
  } else {
  await page.goto(origin+'/#vtt');await expect(page.getByLabel('Tabuleiro da mesa',{exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Brush do mapa',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copiar link fixo do meu VTT',exact:true})).toBeVisible();
  const listing=await request('/vtt'),personal=listing.personal,link=origin+'/#vtt?table='+personal.public_id,root='/vtt/rooms/'+personal.room_id;
  expect((await request('/me')).administrador).toBe(0);
  await page.evaluate(()=>document.addEventListener('copy',()=>{(window as unknown as {copiedLink?:string}).copiedLink=(document.activeElement as HTMLTextAreaElement)?.value;}));
  await page.getByRole('button',{name:'Copiar link fixo do meu VTT',exact:true}).click();
  if(await page.evaluate(()=>window.isSecureContext))expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(link);
  else expect(await page.evaluate(()=>(window as unknown as {copiedLink?:string}).copiedLink)).toBe(link);
  await page.getByRole('button',{name:'Configurações e ajuda',exact:true}).click();
  await expect(page.getByLabel('Link da mesa',{exact:true})).toHaveValue(link);
  await expect(page.getByText(/0 \/ 100 MB usados para imagens externas/)).toBeVisible();
  await page.screenshot({path:out+'/owner-desktop.png'});
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Copiar link fixo do meu VTT',exact:true})).toBeInViewport();await page.screenshot({path:out+'/owner-mobile.png'});await page.setViewportSize({width:1440,height:960});
  const state=await request(root),first=newScene(randomUUID(),'Mapa atual do mestre');state.document.scenes.push(first);activateScene(state.document,first.id);
  await request(root,{revision:state.revision,document:state.document},'PUT');
  const guestEmail=randomUUID()+'@example.test',guestPassword='Test-'+randomUUID();
  const guestSignup=await guest.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Jogador básico',email:guestEmail,password:guestPassword}});
  expect(guestSignup.ok(),await guestSignup.text()).toBe(true);await guest.clearCookies();
  await joined.goto(link);await joined.getByRole('button',{name:'Iniciar aventura',exact:true}).click();
  await expect(joined.locator('.login-form')).toBeVisible({timeout:30000});
  await joined.locator('input[name="email"]').fill(guestEmail);await joined.locator('input[name="password"]').fill(guestPassword);
  await joined.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(joined.getByLabel('Tabuleiro da mesa',{exact:true})).toBeVisible({timeout:30000});
  await expect(joined.locator('.vtt-workspace')).toContainText(first.name,{timeout:15000});
  await expect(joined.getByRole('button',{name:'Brush do mapa',exact:true})).toHaveCount(0);
  const current=await request(root),second=newScene(randomUUID(),'Segundo mapa ao vivo');current.document.scenes.push(second);activateScene(current.document,second.id);
  await request(root,{revision:current.revision,document:current.document},'PUT');
  await expect(joined.locator('.vtt-workspace')).toContainText(second.name,{timeout:15000});
  const next=await request('/vtt',{name:'Outra sala ativa do mestre'});
  await expect(joined.locator('.vtt-brand strong')).toHaveText(next.document.name,{timeout:15000});
  expect((await request('/vtt')).personal.public_id).toBe(personal.public_id);
  await joined.getByLabel('Participação na mesa',{exact:true}).selectOption('spectator');
  await expect(joined.getByLabel('Participação na mesa',{exact:true})).toHaveValue('spectator');
  const spectatorRoom=await request('/vtt',{name:'Mapa para assistir'});
  await expect(joined.locator('.vtt-brand strong')).toHaveText(spectatorRoom.document.name,{timeout:15000});
  await expect(joined.getByLabel('Participação na mesa',{exact:true})).toHaveValue('spectator');
  // Mission creation shows the same address; no table selector or new-table-per-mission flow.
  await page.goto(origin+'/#missions');
  await page.getByRole('button',{name:'Abrir Missões',exact:true}).click();
  await page.getByRole('button',{name:'Registrar missão',exact:true}).click();
  await expect(page.getByLabel('Link fixo do VTT',{exact:true})).toHaveValue(link);
  await page.locator('input[name="title"]').fill('Missão com a mesa pessoal');
  await page.locator('textarea[name="description"]').fill('Os jogadores devem seguir o mesmo link da conta do mestre.');
  await page.locator('input[name="location"]').fill('Taverna do Norte');
  await page.locator('input[name="starts_at"]').fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
  await page.getByRole('button',{name:'Publicar no mural',exact:true}).click();
  await expect(page.locator('.board-post-form')).toHaveCount(0);
  const posts=await request('/board'),post=posts.find((p:any)=>p.title==='Missão com a mesa pessoal');expect(post.vtt_personal_id).toBe(personal.public_id);
  await page.locator(`[data-post-id="${post.id}"]`).click();
  await expect(page.getByRole('link',{name:'Entrar na mesa',exact:false})).toHaveAttribute('href','#vtt?table='+personal.public_id);
  for(const width of [1440,390]){await page.setViewportSize({width,height:960});await page.screenshot({path:out+'/mission-'+width+'.png'});}
  await joined.setViewportSize({width:390,height:844});await joined.screenshot({path:out+'/player-mobile.png'});
  await verifyProfileAndWorld(page,origin,signup.user.id,out);
  expect(errors).toEqual([]);
  await writeFile(out+'/result.json',JSON.stringify({passed:true,basicOwner:signup.user.id,permanentLink:true,missionLink:true,loginKeepsLink:true,sceneFollowing:true,roomFollowing:true,desktopMobile:true,errors},null,2));
  console.log('PASS conta básica prepara VTT, link fixo/clipboard, missão, login, mapa/sala ativos e celular.');
  }
}catch(error){await page.screenshot({path:out+'/failure-owner.png'});await joined.screenshot({path:out+'/failure-player.png'});await writeFile(out+'/result.json',JSON.stringify({passed:false,error:String(error),errors},null,2));throw error;}
finally{await browser.close();await closeServer();await pool.end();}
