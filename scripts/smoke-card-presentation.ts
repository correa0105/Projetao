import 'dotenv/config';
import {chromium, expect, type Locator} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {cards} from '../shared/cards';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Disposable DB only');
const origin = 'http://localhost:3069';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const {pool} = await import('../server/db');
const {migrate} = await import('../server/migrate');
const {seed} = await import('../server/seed');
const {createLegacyTestCharacter} = await import('../tests/character-fixtures');
await migrate(); await seed();
const {createApp} = await import('../server/app');
const savedEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const server = createApp().listen(3069, '127.0.0.1');
process.env.NODE_ENV = savedEnv;
await new Promise<void>(resolve => server.once('listening', resolve));
const browser = await chromium.launch({channel: 'msedge', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
const page = await context.newPage(), errors: string[] = [], missing: string[] = [], checks: unknown[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => {if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/cards/')) missing.push(new URL(r.url()).pathname);});
async function api(route: string, method = 'GET', data?: unknown) {
  const response = await context.request.fetch(origin + '/api' + route, {method, data, headers: {Origin: origin}});
  expect(response.ok(), await response.text()).toBe(true); return response.json();
}
async function captions(scope: Locator) {
  await scope.locator('.arcana-card-art').evaluateAll(async arts => {
    await Promise.all(arts.map(async art => {
      const image = new Image(); image.src = getComputedStyle(art).backgroundImage.slice(5, -2); await image.decode();
    }));
  });
  const rows = await scope.locator('.arcana-card-face').evaluateAll(faces => faces.map(face => {
    const band = face.querySelector('.arcana-card-title')!, name = band.querySelector('.arcana-card-name')!;
    const range = document.createRange(); range.selectNodeContents(name);
    const text = range.getBoundingClientRect(), slot = band.getBoundingClientRect(), card = face.getBoundingClientRect();
    return {name: name.textContent, font: parseFloat(getComputedStyle(name).fontSize), cardWidth: card.width,
      fits: text.width <= slot.width + .5 && text.x >= slot.x - .5 && text.right <= slot.right + .5 && text.top >= slot.top - 1 && text.bottom <= slot.bottom + 1,
      visible: text.width > 0 && text.height > 0, lines: range.getClientRects().length};
  }));
  for (const row of rows) {expect(row.visible, row.name!).toBe(true); expect(row.fits, JSON.stringify(row)).toBe(true); expect(row.font).toBeLessThanOrEqual(row.cardWidth * .076); expect(row.lines).toBe(1);}
  return rows;
}
await mkdir('test-results/card-presentation', {recursive: true});
try {
  const user = (await api('/auth/sign-up/email', 'POST', {name: 'Viajante das cartas', email: randomUUID() + '@example.test', password: 'Test-' + randomUUID()})).user;
  const character = await createLegacyTestCharacter(user.id, 'Viajante');
  await pool.query('UPDATE characters SET gold_cp=200000 WHERE id=$1', [character.id]);
  const purchased = [];
  for (const card of cards.filter(c => c.buyable)) purchased.push((await api('/cards/purchase', 'POST', {character_id: character.id, card_id: card.id, idempotency_key: randomUUID()})).card);
  await api('/cards/' + character.id + '/equipment', 'PUT', {slots: [purchased[2].id, purchased[3].id, purchased[0].id]});
  await page.goto(origin + '/#cards'); await expect(page.locator('.cards-workbench')).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  for (const viewport of [{width:1440,height:1000},{width:1440,height:768},{width:768,height:900},{width:390,height:844},{width:320,height:740}]) {
    await page.setViewportSize(viewport); await page.getByRole('button', {name:'Todas',exact:true}).click();
    const visited = [];
    for (let number = 0; number < 2; number++) {
      await expect(page.locator('.cards-catalog > button')).toHaveCount(4);
      await expect(page.locator('.cards-pagination')).toContainText(`Página ${number + 1} de 2`);
      const labels = await page.locator('.cards-catalog > button').evaluateAll(els => els.map(el => el.getAttribute('aria-label')!));
      for (const name of labels) {
        visited.push(name); await page.getByRole('button', {name,exact:true}).click();
        const levels=viewport.width===1440&&viewport.height===1000||viewport.width===320?[1,2,3]:[1];
        for(const level of levels){
        await page.getByRole('button',{name:'Prévia nível '+level,exact:true}).click();
        await expect(page.locator('.cards-detail-preview .arcana-card-face')).toHaveAttribute('data-level',String(level));
        await expect(page.locator('.cards-detail-preview .arcana-card-metallic')).toHaveCount(level===3?1:0);
        await expect(page.locator('.cards-detail-preview .arcana-card-face')).toHaveAttribute('data-finish',level===3?'chrome':'original');
        const normal = await captions(page.locator('.cards-workbench'));
        await expect(page.locator('.cards-detail-copy > h2')).toHaveText(name);
        await page.getByRole('button', {name:'Inspecionar',exact:true}).click();
        const dialog = page.getByRole('dialog', {name:'Inspecionar '+name,exact:true}); await expect(dialog).toBeVisible();
        await expect(dialog.locator('.arcana-card-face')).toHaveAttribute('data-finish',level===3?'chrome':'original');
        await expect(dialog.locator('.arcana-card-gold')).toHaveCount(level===3?1:0);
        const large = await captions(dialog), bounds = await dialog.boundingBox();
        expect(bounds!.width).toBeLessThanOrEqual(viewport.width); expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
        expect(await dialog.evaluate(el => getComputedStyle(el,'::backdrop').backdropFilter)).toContain('blur');
        if(name==='A Vigília'&&level===1){
          const stage=dialog.getByRole('group',{name:'Girar '+name+' em 3D',exact:true});
          const cardModel=stage.locator('.card-viewer-model'),reverse=stage.locator('.card-viewer-back');
          await expect(reverse).toHaveText('');
          await dialog.getByRole('button',{name:'Virar',exact:true}).click();
          await expect(dialog.getByRole('status')).toHaveText('Verso');
          await page.waitForTimeout(270);
          await expect(stage.locator('.card-viewer-front')).toHaveAttribute('aria-hidden','true');
          expect(await reverse.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('back-raven-20261014.png');
          await page.screenshot({path:`test-results/card-presentation/reverse-${viewport.width}-${viewport.height}.png`});
          await dialog.getByRole('button',{name:'Prévia cromada',exact:true}).click();
          await expect(cardModel).toHaveAttribute('data-finish','chrome');
          expect(await reverse.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('back-raven-20261014.png');
          await page.waitForTimeout(120);
          await page.screenshot({path:`test-results/card-presentation/chrome-reverse-${viewport.width}-${viewport.height}.png`});
          await stage.focus();await page.keyboard.press('Home');await page.waitForTimeout(270);
          await expect(stage.locator('.arcana-card-face')).toHaveAttribute('data-finish','chrome');
          await expect(stage.locator('.card-viewer-front')).toHaveAttribute('aria-hidden','false');
          expect(await stage.locator('.arcana-card-art').evaluate(el=>getComputedStyle(el).filter)).toContain('grayscale');
          await page.screenshot({path:`test-results/card-presentation/chrome-front-${viewport.width}-${viewport.height}.png`});
          const reflection=stage.locator('.arcana-card-metallic');
          await expect(reflection).toHaveCSS('mix-blend-mode','color-dodge');
          await expect(reflection).toHaveCSS('top','0px');
          await expect(reflection).toHaveCSS('bottom','0px');
          await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForTimeout(270);
          expect(await cardModel.evaluate(el=>(el as HTMLElement).style.getPropertyValue('--card-chrome-x'))).not.toBe('48%');
          await page.screenshot({path:`test-results/card-presentation/chrome-front-tilted-${viewport.width}-${viewport.height}.png`});
          await page.keyboard.press('Home');await page.waitForTimeout(270);
          await dialog.getByRole('button',{name:'Prévia cromada',exact:true}).click();
          await stage.focus();await page.keyboard.press('ArrowRight');
          await expect(cardModel).toHaveCSS('--card-rotation-y','15deg');
          await page.keyboard.press('Home');await page.waitForTimeout(270);
          const shape=await stage.boundingBox();
          await page.mouse.move(shape!.x+shape!.width*.15,shape!.y+shape!.height*.45);
          await page.mouse.down();
          await page.mouse.move(shape!.x+shape!.width*.68,shape!.y+shape!.height*.38,{steps:12});
          await page.mouse.up();
          expect(await cardModel.evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--card-rotation-y')))).toBeGreaterThan(180);
          await expect(stage).toHaveAttribute('data-dragging','false');
          await page.waitForTimeout(270);
          await page.screenshot({path:`test-results/card-presentation/drag-rotation-${viewport.width}-${viewport.height}.png`});
          await dialog.getByRole('button',{name:'Restaurar',exact:true}).click();await page.waitForTimeout(270);
          await expect(cardModel).toHaveCSS('--card-rotation-y','0deg');
          await expect(cardModel).toHaveCSS('--card-rotation-x','0deg');
          if(viewport.width===320){
            const cdp=await context.newCDPSession(page);
            const point={x:shape!.x+shape!.width*.2,y:shape!.y+shape!.height*.5};
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:shape!.x+shape!.width*.72,y:point.y}]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            await expect(stage).toHaveAttribute('data-dragging','false');
            expect(await cardModel.evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--card-rotation-y')))).toBeGreaterThan(180);
            await dialog.getByRole('button',{name:'Restaurar',exact:true}).click();await page.waitForTimeout(270);
            await cdp.detach();
          }
          expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(viewport.height);
        }
        if (['O Espelho Partido','A Vigília','O Último Corte','A Lua Errante'].includes(name)) await page.screenshot({path:`test-results/card-presentation/inspect-${cards.find(c=>c.name===name)!.id}-${viewport.width}-${viewport.height}-level-${level}.png`});
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
        checks.push({viewport, name, level, normal, large});
        }
      }
      await page.screenshot({path:`test-results/card-presentation/page-${number+1}-${viewport.width}-${viewport.height}.png`,fullPage:true});
      if (number < 1) await page.getByRole('button', {name:'Próximas cartas',exact:true}).click();
    }
    expect(visited).toEqual(cards.map(c => c.name));
    await expect(page.getByRole('button', {name:'Próximas cartas',exact:true})).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  }
  expect(errors).toEqual([]); expect(missing).toEqual([]);
  expect((await api('/cards/'+character.id)).every((c:{level:number})=>c.level===1)).toBe(true);
  await writeFile('test-results/card-presentation/result.json', JSON.stringify({passed:true,cards:8,captions:true,pagination:true,inspection:true,threeFinishes:true,rotation3D:true,chromePreview:true,chromeBackground:true,goldDetails:true,ravenBack:true,levelThreeChrome:true,touchRotation:true,ownedLevelsUnchanged:true,viewports:5,checks,errors,missing},null,2));
  console.log('Eight cards: titles fit, two pages, ownership and inspection passed at five viewport sizes.');
} catch(error) {
  await page.screenshot({path:'test-results/card-presentation/failure.png',fullPage:true}); throw error;
} finally {
  await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await pool.end();
}
