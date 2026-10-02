import 'dotenv/config';
import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
if(!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))throw new Error('Banco isolado obrigatório');
const origin='http://localhost:3002';process.env.APP_ORIGIN=origin;process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db.js');const {migrate}=await import('../server/migrate.js');const {seed}=await import('../server/seed.js');await migrate();await seed();
const {createApp}=await import('../server/app.js');const server=createApp().listen(3002,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try {
  const signup=await page.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Mapa teste',email:`dragon-${randomUUID()}@example.test`,password:`Test-${randomUUID()}`}});expect(signup.ok()).toBe(true);
  await page.goto(origin+'/#world');const viewport=page.locator('.world-map__viewport');
  await expect(viewport).toHaveAttribute('data-dragon-x',/.+/,{timeout:45000});
  const x=await viewport.getAttribute('data-dragon-x');await expect.poll(()=>viewport.getAttribute('data-dragon-x')).not.toBe(x);
  await expect(viewport).toHaveAttribute('data-dragon-flapping','true',{timeout:15000});await expect(viewport).toHaveAttribute('data-dragon-flapping','false',{timeout:15000});
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/world-dragon-desktop.png'});
  await page.getByRole('button',{name:'Aproximar mapa',exact:true}).click();await page.screenshot({path:'test-results/world-dragon-zoom.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await expect(viewport).toHaveAttribute('data-dragon-flapping','false');await page.waitForTimeout(300);const frozen=await viewport.getAttribute('data-dragon-x');await page.waitForTimeout(300);expect(await viewport.getAttribute('data-dragon-x')).toBe(frozen);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/world-dragon-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);console.log('Dragão: voo, asas, planar, zoom, movimento reduzido e mobile OK.');
} finally {await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
