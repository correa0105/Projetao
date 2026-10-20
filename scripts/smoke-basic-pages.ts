import 'dotenv/config';
import { chromium, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Disposable DB only');
const origin='http://localhost:3094';process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db'),{migrate}=await import('../server/migrate'),{seed}=await import('../server/seed'),{createLegacyTestCharacter}=await import('../tests/character-fixtures');
await migrate();await seed();const {createApp}=await import('../server/app');process.env.NODE_ENV='production';const server=createApp().listen(3094,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),out='test-results/basic-pages';await mkdir(out,{recursive:true});
const results:any[]=[];
async function openRules(p:Page){
 const menu=p.locator('.dock-handle');await menu.focus();if(await menu.getAttribute('aria-expanded')!=='true')await p.keyboard.press('Enter');
 await p.getByRole('button',{name:'Biblioteca',exact:true}).click();await p.getByRole('button',{name:'Regras',exact:true}).click();
 await expect(p.getByRole('region',{name:'Livro de regras',exact:true})).toBeVisible();
 await expect(p.locator('.rb-hero h2')).toContainText('Livro de regras');await expect(p.getByRole('heading',{name:'Não foi possível abrir esta página.'})).toHaveCount(0);
}
try{
 for(const mode of ['basic','administrator-preview','administrator']){
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',extraHTTPHeaders:{'Accept-Encoding':'identity'}});
  await context.addInitScript(()=>{localStorage.setItem('alvorada-music-muted','true');localStorage.setItem('alvorada-effects-muted','true');});
  const p=await context.newPage(),errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/net::ERR_FAILED|Failed to load resource:/.test(m.text()))errors.push(m.text());});
  p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+new URL(r.url()).pathname.replace(/\/profiles\/[^/]+\/characters\/[^/]+/,'/profiles/user/characters/character'));});
  const response=await context.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:mode,email:randomUUID()+'@example.test',password:'Test-'+randomUUID()}});
  expect(response.ok(),await response.text()).toBe(true);const user=(await response.json()).user;
  if(mode!=='basic')await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1',[user.id]);
  const character=await createLegacyTestCharacter(user.id,'Aurora');
  await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)',[character.id,await readFile('public/character-silhouette-v2.png')]);
  let attempts=0;if(mode==='basic')await p.route(/\/assets\/Rulebook-[A-Za-z0-9_-]+\.js(?:\?.*)?$/,async route=>{if(attempts++===0)await route.abort('failed');else await route.continue();});
  await p.goto(origin+'/#characters');await expect(p.locator('.character-camp')).toBeVisible();
  if(mode==='administrator-preview'){await p.getByRole('button',{name:'Menu de visualização da conta',exact:true}).click();await p.getByRole('button',{name:'Ver como conta básica',exact:true}).click();}
  await openRules(p);
  if(mode==='basic')expect(attempts).toBe(2);
  await expect(p.getByRole('button',{name:'Editar conteúdo',exact:true})).toHaveCount(mode==='administrator'?1:0);
  await p.reload();await expect(p.getByRole('region',{name:'Livro de regras',exact:true})).toBeVisible();
  await p.getByRole('textbox',{name:'Buscar no livro',exact:true}).fill('personagem');await expect(p.locator('.rb-search-result').first()).toBeVisible();
  await p.locator('.rb-search-result').first().click();await expect(p.locator('.rb-article')).toBeVisible();
  const tabs:any[]=[];
  await p.goto(origin+'/#profiles?user='+encodeURIComponent(user.id));await expect(p.locator('.visiting')).toBeVisible();
  for(const width of [1440,768,390,320]){
   await p.setViewportSize({width,height:960});
   if(width!==1440)await p.getByRole('button',{name:'Próxima aba: Acampamento',exact:true}).click();
   for(const name of ['Acampamento','Conquistas','Hall da Fama','Cartas']){
    if(name!=='Acampamento')await p.getByRole('button',{name:'Próxima aba: '+name,exact:true}).click();
    const active=p.getByRole('tabpanel',{name,exact:true});await expect(active).toBeVisible();
    await expect.poll(()=>p.locator('.main-shell').evaluate(el=>getComputedStyle(el).paddingBottom)).toBe('0px');
    const metrics=await p.evaluate(()=>{const a=document.querySelector('.main-content')!.getBoundingClientRect(),b=document.querySelector('.main-shell')!.getBoundingClientRect();return {height:innerHeight,scroll:document.documentElement.scrollHeight,extraAfterContent:b.bottom-a.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    expect(metrics.extraAfterContent).toBeLessThanOrEqual(1);expect(metrics.overflow).toBe(false);
    if(name==='Acampamento'||name==='Cartas')expect(metrics.scroll).toBeLessThanOrEqual(961);
    tabs.push({name,width,...metrics});await p.screenshot({path:out+'/'+mode+'-'+name.replaceAll(' ','-')+'-'+width+'.png',fullPage:true});
   }
  }
  await p.evaluate(()=>scrollTo(0,0));await openRules(p);await p.screenshot({path:out+'/'+mode+'-rules-320.png'});
  expect(errors).toEqual([]);results.push({mode,rulesMenu:true,rulesReload:true,rulesSearch:true,transientImportRecovered:mode==='basic'?attempts>=2:undefined,tabs,errors});await context.close();
 }
 await writeFile(out+'/result.json',JSON.stringify({passed:true,results},null,2));console.log('PASS regras pelo menu/reload/busca, conta básica/prévia/ADM, recuperação de importação e quatro abas de Perfis em quatro larguras.');
} catch(error){await writeFile(out+'/result.json',JSON.stringify({passed:false,results,error:String(error)},null,2));throw error;}
finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}

