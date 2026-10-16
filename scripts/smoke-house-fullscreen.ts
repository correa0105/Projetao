import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Disposable database required');
const origin = 'http://localhost:3070';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate(); await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3070, '127.0.0.1');
await new Promise<void>(r => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
await context.addInitScript(() => { localStorage.setItem('alvorada-music-muted', 'true'); localStorage.setItem('alvorada-effects-muted', 'true'); });
const page = await context.newPage(), errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const request = async (path: string, data?: unknown, method = 'POST') => {
  const r = await context.request.fetch(origin + '/api' + path, { method, headers: { Origin: origin }, data });
  expect(r.ok(), await r.text()).toBe(true); return r.json();
};
const trigger = page.getByRole('button', { name: 'Menu da House', exact: true });
async function openMenu() { if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click(); }
async function tool(name: string) { await openMenu(); await page.getByRole('navigation', { name: 'Controles da casa' }).getByRole('button', { name, exact: true }).click(); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); }
await mkdir('test-results/house-fullscreen', { recursive: true });
await writeFile('test-results/house-fullscreen/result.json', JSON.stringify({ passed: false }));
try {
  const account = await request('/auth/sign-up/email', { name: 'Casa imersiva', email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() });
  const hero = await createLegacyTestCharacter(account.user.id, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=500000,portrait_revision=1 WHERE id=$1', [hero.id]);
  await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [hero.id, await readFile('public/character-silhouette-v2.png')]);
  const homeId = (await request('/house', { character_id: hero.id })).id;
  const itemId = (await request('/house/purchase', { character_id: hero.id, catalog_id: 'table', idempotency_key: randomUUID() })).item_id;
  const state = await request('/house/' + homeId, undefined, 'GET');
  const placement = { id: randomUUID(), kind: 'item', ref: itemId, x: .4, y: .78, scale: .2, rotation: 0, facing: 0, layer: 3 };
  state.rooms[0].placements = [placement];
  await request('/house/' + homeId, { revision: state.revision, name: state.name, rooms: state.rooms }, 'PUT');
  await request('/house/' + homeId + '/presence', { character_id: hero.id, variant_id: null, room: 'sala', x: .65, y: .82, scale: .19, layer: 602 }, 'PUT');
  const results = [];
  for (const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1266,height:659},{width:768,height:1024},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(viewport); await page.goto(origin + '/#house'); await page.reload();
    const item = page.locator('[data-house-piece="' + placement.id + '"]');
    await expect(item).toBeVisible();
    await expect.poll(() => page.locator('.house-actor img').evaluate((e:HTMLImageElement) => e.complete && e.naturalWidth>0)).toBe(true);
    await expect(page.locator('.house-sidebar')).toHaveCount(0);
    await expect(page.getByRole('navigation', {name:'Controles da casa'})).toBeHidden();
    const slot = (await page.locator('.house-stage-slot').boundingBox())!;
    expect(slot).toEqual({x:0,y:0,width:viewport.width,height:viewport.height});
    await page.locator('.house-scene').evaluate(async e => { const src=getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+)/)![1]; const image=new Image();image.src=src;await image.decode(); });
    const scene = (await page.locator('.house-scene').boundingBox())!;
    expect(Math.abs(scene.width/scene.height-16/9)).toBeLessThan(.01);
    if(viewport.width/viewport.height<1.2) {
      const pan=await page.locator('.house-stage-slot').evaluate(e=>{const initial=e.scrollLeft;e.scrollLeft=initial>100?initial-100:initial+100;const moved=e.scrollLeft;e.scrollLeft=initial;return Math.abs(moved-initial);});
      expect(pan).toBeGreaterThan(90);
    }
    await expect(page.locator('.page-header')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
    await page.screenshot({path:`test-results/house-fullscreen/scene-${viewport.width}.png`});
    await trigger.focus(); await page.keyboard.press('Enter'); await expect(trigger).toHaveAttribute('aria-expanded','true');
    const menu = (await page.locator('.house-controls').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);expect(menu.x+menu.width).toBeLessThanOrEqual(viewport.width);
    expect(menu.y+menu.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.getByRole('button',{name:'Recompensas',exact:true})).toHaveCount(0);
    await page.screenshot({path:`test-results/house-fullscreen/menu-${viewport.width}.png`});
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await openMenu();await page.mouse.click(viewport.width-2,viewport.height/2);await expect(trigger).toHaveAttribute('aria-expanded','false');
    await tool('Decorar');await expect(page.locator('.house-panel')).toBeVisible();
    expect(await page.locator('.house-scene').boundingBox()).toEqual(scene);
    await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
    await tool('Mobília');expect(await page.locator('.house-catalog > button').count()).toBeGreaterThanOrEqual(12);
    await page.locator('.house-catalog > button').last().scrollIntoViewIfNeeded();
    await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
    await tool('Convidados');await expect(page.locator('.house-panel')).toBeVisible();
    await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
    await tool('Personagem');await expect(page.getByLabel('Camada do personagem',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Espelhar imagem',exact:true}).click();
    await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
    await tool('RP');const input=page.getByLabel('Mensagem de Aurora',{exact:true});
    const composer=(await page.locator('.house-rp-compose').boundingBox())!;
    expect(composer.x).toBeGreaterThanOrEqual(0);expect(composer.x+composer.width).toBeLessThanOrEqual(viewport.width+1);
    await input.fill('Olá '+viewport.width);await input.press('Enter');
    await expect(page.getByRole('log',{name:'Conversa de RP'})).toContainText('Olá '+viewport.width);await expect(input).toBeFocused();
    await tool('Configurações');await page.getByLabel('Manter RP aberto',{exact:true}).check();
    await page.getByRole('button',{name:'Fechar painel',exact:true}).click();await expect(input).toBeVisible();
    await tool('Configurações');await page.getByLabel('Manter RP aberto',{exact:true}).uncheck();
    await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
    await openMenu();await page.getByRole('button',{name:'Cozinha',exact:true}).click();
    await expect(trigger).toHaveAttribute('aria-expanded','false');await expect(page.locator('.house-scene-title small')).toHaveText('Cozinha');
    await openMenu();await page.getByRole('button',{name:'Sala',exact:true}).click();
    await expect(item).toBeVisible();
    if (viewport.width===1440) {
      const actor=page.locator('.house-actor'),b=(await actor.boundingBox())!,grab={x:b.x+b.width*.3,y:b.y+b.height*.5};
      await page.mouse.move(grab.x,grab.y);await page.mouse.down();await page.mouse.move(grab.x+25,grab.y-20,{steps:5});
      const held=(await actor.boundingBox())!;expect(Math.abs(held.x+held.width*.3-grab.x-25)).toBeLessThan(2);expect(Math.abs(held.y+held.height*.5-grab.y+20)).toBeLessThan(2);await page.mouse.up();
    }
    await item.click({button:'right'});await expect(page.getByRole('dialog',{name:'Ajustes da peça',exact:true})).toBeVisible();
    const facing=results.length%2===0?'1':'2';
    await page.getByLabel('Direção da peça',{exact:true}).selectOption(facing);await page.keyboard.press('Escape');
    await openMenu();await page.getByRole('button',{name:'Salvar mudanças',exact:true}).click();
    await expect(page.getByRole('button',{name:'Salvo',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
    await page.reload();await expect(item).toHaveAttribute('data-facing',facing);
    const saved=await request('/house/'+homeId,undefined,'GET');expect(saved.rooms[0].placements[0].x).toBe(.4);expect(saved.rooms[0].placements[0].y).toBe(.78);
    await pool.query("UPDATE house_messages SET created_at=now()-interval '2 seconds' WHERE user_id=$1",[account.user.id]);
    results.push(viewport);
  }
  await openMenu();await page.getByRole('link',{name:'Sair da House',exact:true}).click();
  await expect(page.locator('.house-workspace')).toHaveCount(0);await expect(page.locator('.page-header')).toBeVisible();
  expect(await page.evaluate(()=>document.body.classList.contains('house-immersive'))).toBe(false);
  expect(errors).toEqual([]);await writeFile('test-results/house-fullscreen/result.json',JSON.stringify({passed:true,results,errors}));
  console.log('House fullscreen passed: six sizes, unified menu/keyboard/outside dismissal, room switch, all player tools, RP/pin/focus, unchanged scene geometry, drag, context menu, save/reload and exit.');
} catch(e) { await page.screenshot({path:'test-results/house-fullscreen/failure.png',fullPage:true});throw e; }
finally { await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end(); }
