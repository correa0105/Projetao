import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Disposable DB required');
const origin='http://localhost:3081';
process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db');
const {migrate}=await import('../server/migrate');
const {seed}=await import('../server/seed');
const {createLegacyTestCharacter}=await import('../tests/character-fixtures');
await migrate(); await seed();
const {auth}=await import('../server/auth');
const {createApp}=await import('../server/app');
process.env.NODE_ENV='production';
const server=createApp().listen(3081,'127.0.0.1');
await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const owner=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}), stranger=await browser.newContext();
const errors:string[]=[],checks:string[]=[];
const page=await owner.newPage(); page.on('pageerror',e=>errors.push(e.message));
await owner.addInitScript(()=>{localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
async function signup(context:typeof owner,name:string){
  const r=await auth.api.signUpEmail({body:{name,email:randomUUID()+'@example.test',password:'Testing-'+randomUUID()},returnHeaders:true});
  for(const cookie of r.headers.getSetCookie()){const first=cookie.split(';')[0],at=first.indexOf('=');await context.addCookies([{name:first.slice(0,at),value:first.slice(at+1),url:origin,httpOnly:true,sameSite:'Lax'}]);}
  return r.response.user;
}
async function api(context:typeof owner,path:string,method='GET',data?:unknown){const r=await context.request.fetch(origin+'/api'+path,{method,headers:{Origin:origin},data});expect(r.ok(),await r.text()).toBe(true);return r.json();}
async function shot(name:string,width=1440){await page.setViewportSize({width,height:960});await page.waitForTimeout(140);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+' overflow').toBe(true);await page.screenshot({path:`test-results/community-immersive/${name}-${width}.png`,fullPage:true});}
async function panel(name:string){await expect(page.getByRole('complementary',{name,exact:true})).toBeVisible();}
await mkdir('test-results/community-immersive',{recursive:true});
try {
  const user=await signup(owner,'Companhia de teste'), guest=await signup(stranger,'Visitante de teste');
  const c=await createLegacyTestCharacter(user.id,'Alaric'), g=await createLegacyTestCharacter(guest.id,'Mira');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1',[user.id]);
  const settings=await api(owner,'/community/settings');
  await api(owner,'/community/settings','PUT',{document:{...settings.document,founding_po:1},revision:settings.revision});
  await pool.query('UPDATE characters SET gold_cp=10000 WHERE id=$1',[c.id]);
  // Real heartbeat availability is independent of account age, cohort and admin status.
  await pool.query('INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true');
  expect((await api(stranger,'/character-art')).available).toBe(true);
  await page.goto(origin+'/#guild');
  await expect(page.getByRole('button',{name:'Fundar uma guilda',exact:true})).toBeEnabled();
  await shot('directory'); await shot('directory',390); await shot('directory',320);
  await page.setViewportSize({width:1440,height:960});
  await page.getByRole('button',{name:'Fundar uma guilda',exact:true}).click();
  await page.getByLabel('Nome da guilda',{exact:true}).fill('Vigias da Alvorada');
  await page.getByRole('button',{name:'Fundar guilda',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Fundar uma guilda',exact:true})).toHaveCount(0);
  await expect(page.locator('.guild-scene-identity h1')).toHaveText('Vigias da Alvorada');
  const guild= new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('id')!; expect(guild).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole('dialog',{name:'Fundar uma guilda',exact:true})).toHaveCount(0);
  expect(await page.locator('.guild-is-detail').evaluate(el=>{const r=el.getBoundingClientRect();return r.x===0&&r.y===0&&r.width===innerWidth&&Math.abs(r.height-innerHeight)<2;})).toBe(true);
  await expect(page.locator('.scene-panel')).toHaveCount(0);
  await page.getByRole('button',{name:'Informações da guilda',exact:true}).click(); await panel('Sobre a companhia');
  await page.keyboard.press('Escape'); await expect(page.locator('.scene-panel')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Informações da guilda',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Salas',exact:true}).click(); await panel('Explore a sede');
  await page.getByRole('button',{name:'Ferraria',exact:true}).click(); await expect(page.locator('.scene-panel')).toHaveCount(0);
  await expect(page.locator('.guild-room')).toHaveAttribute('aria-label','Ferraria');
  await page.getByRole('button',{name:'Personalizar sede',exact:true}).click();await panel('Personalizar sede');
  await page.getByRole('button',{name:'Adicionar peça',exact:true}).click();
  await expect(page.locator('.guild-furniture.selected')).toHaveCount(1);
  await page.getByRole('button',{name:'Fechar Personalizar sede',exact:true}).click();
  await expect(page.locator('.scene-panel')).toHaveCount(0); await expect(page.locator('.guild-furniture.selected')).toHaveCount(1);
  await page.getByRole('button',{name:/Edição em andamento/}).click();
  await page.getByRole('button',{name:'Salvar sede',exact:true}).click();
  await expect(page.getByText('Sede salva.',{exact:true})).toBeVisible();
  const saved=(await api(owner,'/guilds/'+guild)).document.placements;expect(saved).toHaveLength(6);
  await expect(page.locator('.scene-panel')).toHaveCount(0);
  await page.reload();await expect(page.locator('.guild-furniture')).toHaveCount(1); // The initial room is Salão principal; the piece belongs to Ferraria.
  for(const width of [1440,1024,768,390,320]){await shot('headquarters',width);await page.getByRole('button',{name:'Salas',exact:true}).click();await panel('Explore a sede');await shot('rooms',width);await page.keyboard.press('Escape');}
  expect((await api(owner,'/guilds/'+guild)).document.placements).toEqual(saved);
  checks.push('full viewport, room menus, focus restoration, draft collapse, saved decoration, five widths');
  const guestPage=await stranger.newPage();await guestPage.goto(origin+'/#guild?id='+guild);
  await expect(guestPage.getByRole('heading',{name:'Vigias da Alvorada',exact:true})).toBeVisible();
  await expect(guestPage.getByRole('button',{name:'Personalizar sede',exact:true})).toHaveCount(0);
  await expect(guestPage.getByRole('button',{name:'Salas',exact:true})).toBeVisible();
  await page.setViewportSize({width:1440,height:960});await page.goto(origin+'/#hall');
  await expect(page.locator('.hall-menu-trigger')).toBeVisible();
  await expect(page.getByText('Nomes gravados na história',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Tipos de ranking'})).toHaveCount(0);
  await page.getByRole('button',{name:'Menu do Hall da Fama',exact:true}).click();await panel('Hall da Fama');
  await expect(page.getByRole('button',{name:'Editar pontuação e apresentação'})).toBeVisible();
  await page.getByRole('button',{name:'Conquistas',exact:true}).click();await expect(page.locator('.scene-panel')).toHaveCount(0);
  for(const width of [1440,768,390,320])await shot('hall',width);
  expect(await page.locator('.hall-of-fame').evaluate(el=>{const s=getComputedStyle(el,'::before');return s.position==='fixed'&&s.backgroundSize.includes('cover');})).toBe(true);
  await page.goto(origin+'/#profiles?user='+user.id); await page.getByRole('button',{name:'Próxima aba: Conquistas',exact:true}).click();await page.getByRole('button',{name:'Próxima aba: Hall da Fama',exact:true}).click();await expect(page.locator('.hall-of-fame.embedded')).toBeVisible();
  for(const width of [1440,390,320])await shot('profile-hall',width);
  await page.getByRole('button',{name:'Menu do Hall da Fama',exact:true}).click();await panel('Hall da Fama');await page.keyboard.press('Escape');
  checks.push('same Hall in profile tab, full background, sidebar categories, no removed eyebrow');
  // Hooks: only the author, only completed missions, exactly one across simultaneous publications.
  const missionId=randomUUID();await pool.query("INSERT INTO board_posts(id,author_id,kind,title,description,location,difficulty,status) VALUES($1,$2,'mission','A ponte esquecida','Uma história de teste suficientemente longa','Bastião','Tranquila','active')",[missionId,user.id]);
  const hook={title:'Ecos da travessia',description:'Os viajantes encontram outro caminho depois da missão.'};
  expect((await owner.request.post(origin+'/api/board/'+missionId+'/hook',{headers:{Origin:origin},data:hook})).status()).toBe(409);
  await pool.query("UPDATE board_posts SET status='completed' WHERE id=$1",[missionId]);
  expect((await stranger.request.post(origin+'/api/board/'+missionId+'/hook',{headers:{Origin:origin},data:hook})).status()).toBe(403);
  const simultaneous=await Promise.all([0,1].map(()=>owner.request.post(origin+'/api/board/'+missionId+'/hook',{headers:{Origin:origin},data:hook})));
  expect(simultaneous.map(r=>r.status()).sort()).toEqual([201,409]);
  expect((await pool.query("SELECT id FROM board_posts WHERE kind='hook' AND source_mission_id=$1",[missionId])).rowCount).toBe(1);
  await pool.query("UPDATE board_posts SET status='closed' WHERE kind='event'");
  await guestPage.goto(origin+'/#board');await expect(guestPage.getByRole('button',{name:'Abrir Eventos',exact:true})).toBeDisabled();
  await guestPage.getByRole('button',{name:'Abrir Ganchos',exact:true}).click();await expect(guestPage.getByRole('button',{name:'Registrar gancho',exact:true})).toBeDisabled();
  await guestPage.getByRole('button',{name:'Fechar lista de avisos'}).click();
  await guestPage.getByRole('button',{name:'Abrir Missões',exact:true}).click();await expect(guestPage.getByRole('button',{name:'Registrar missão',exact:true})).toBeEnabled();
  const event=await api(owner,'/events','POST',{title:'Festival de teste',description:'Um festival para validar missões vinculadas.',location:'Bastião',starts_at:null,status:'open',presentation:{eyebrow:'Encontro',image:'',animation:'none',featured:false,link:''}});
  const mission={kind:'mission',title:'Caminhos do festival',description:'Uma missão para todos os aventureiros do festival.',location:'Bastião',difficulty:'Tranquila',starts_at:new Date(Date.now()+86400000).toISOString(),event_source_id:event.id};
  expect((await stranger.request.post(origin+'/api/board',{headers:{Origin:origin},data:mission})).status()).toBe(409);
  await pool.query("UPDATE board_posts SET status='active' WHERE id=$1",[event.id]);
  const posted=await api(stranger,'/board','POST',mission);expect(posted.event_source_id).toBe(event.id);
  expect((await stranger.request.post(origin+'/api/board',{headers:{Origin:origin},data:{...mission,kind:'event'}})).status()).toBe(403);
  await guestPage.reload();await guestPage.getByRole('button',{name:'Abrir Eventos',exact:true}).click();await expect(guestPage.getByRole('button',{name:'Registrar missão no evento',exact:true})).toBeEnabled();
  checks.push('normal mission available, one hook per completed authored mission, concurrent and ownership checks, inactive events blocked in API and UI');
  expect(errors).toEqual([]);
  await writeFile('test-results/community-immersive/result.json',JSON.stringify({passed:true,checks,errors},null,2));console.log('Community immersive checks passed: '+checks.join('; '));
} finally {await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
