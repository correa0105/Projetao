import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', { headers: { Origin: origin }, data: { name: 'Estabulo teste', email: `stable-${randomUUID()}@example.test`, password: `Test-${randomUUID()}` } });
  expect(signup.ok()).toBe(true);
  const hero = await createLegacyTestCharacter((await signup.json()).user.id, 'Cavaleiro');
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [hero.id]);
  const send = (data: unknown) => page.request.post(origin + '/api/stable/purchase', { headers: { Origin: origin }, data });
  const order = { character_id: hero.id, mount_id: 'mule', name: 'Passo Firme', idempotency_key: randomUUID() };
  const stranger = await browser.newContext();
  await stranger.request.post(origin + '/api/auth/sign-up/email', { headers: { Origin: origin }, data: { name: 'Outro', email: `other-${randomUUID()}@example.test`, password: `Test-${randomUUID()}` } });
  expect((await stranger.request.post(origin + '/api/stable/purchase', { headers: { Origin: origin }, data: order })).status()).toBe(404);
  expect((await stranger.request.get(origin + '/api/stable/' + hero.id)).status()).toBe(404);
  await stranger.close();
  const concurrent = await Promise.all([send({...order, price_cp:1}), send(order)]);
  expect(concurrent.map(r => r.status()).sort()).toEqual([200,201]);
  expect((await pool.query('SELECT gold_cp FROM characters WHERE id=$1',[hero.id])).rows[0].gold_cp).toBe(99200);
  expect((await send({...order,name:'Outro'})).status()).toBe(409);
  expect((await send({...order,idempotency_key:randomUUID(),name:''})).status()).toBe(400);
  expect((await send({...order,coat:'alternate'})).status()).toBe(409);
  expect((await send({...order,idempotency_key:randomUUID(),coat:'invalid'})).status()).toBe(400);
  expect((await send({...order,idempotency_key:randomUUID(),mount_id:'dragon'})).status()).toBe(400);
  await pool.query('UPDATE characters SET gold_cp=0 WHERE id=$1',[hero.id]);
  expect((await send({...order,idempotency_key:randomUUID()})).status()).toBe(409);
  await pool.query('UPDATE characters SET gold_cp=99200 WHERE id=$1',[hero.id]);
  await page.goto(origin + '/#stable'); await page.reload();
  await expect(page.getByRole('heading',{name:'Estábulo da Alvorada',exact:true})).toBeVisible();
  await expect(page.locator('.stable-owned')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const name of ['Cavalo de montaria','Cavalo de guerra','Pônei','Mula']) {
    await page.getByRole('button',{name:`Ver ${name}`,exact:true}).click();
    await expect(page.getByAltText(`${name} de corpo inteiro no campo`)).toBeVisible();
    expect(await page.getByAltText(`${name} de corpo inteiro no campo`).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('button',{name:'Ver Pônei',exact:true}).click();
  await page.getByRole('button',{name:'Pampa',exact:true}).click();
  await expect(page.locator('.stable-animal img')).toHaveAttribute('src','/stable/pony-alternate.png');
  await page.getByRole('button',{name:'Ver especificações da montaria'}).click();
  await page.getByLabel('Como vai se chamar?').fill('Pé de Pano');
  await expect(page.locator('.stable-speech')).toContainText('Pé de Pano');
  await page.getByRole('button',{name:'Comprar montaria',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar compra',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await (await page.request.get(origin + '/api/stable/' + hero.id)).json()).some((m: {name:string;coat:string}) => m.name === 'Pé de Pano' && m.coat === 'alternate')).toBe(true);
  await page.reload();
  expect((await (await page.request.get(origin + '/api/stable/' + hero.id)).json()).some((m: {name:string;coat:string}) => m.name === 'Pé de Pano' && m.coat === 'alternate')).toBe(true);
  expect((await pool.query('SELECT gold_cp FROM characters WHERE id=$1',[hero.id])).rows[0].gold_cp).toBe(96200);
  expect((await pool.query('SELECT * FROM character_mounts WHERE character_id=$1',[hero.id])).rowCount).toBe(2);
  await mkdir('test-results',{recursive:true});
  for (const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button',{name:'Ver especificações da montaria'}).click();
    await page.getByLabel('Como vai se chamar?').fill('Sir Cenoura da Estrada Longa');
    await expect(page.locator('.stable-speech')).toContainText('Sir Cenoura');
    await page.getByRole('button',{name:'Fechar',exact:true}).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const keeper = (await page.locator('.stable-keeper > img').boundingBox())!;
    expect(keeper.height).toBeGreaterThan(160);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    expect(keeper.y + keeper.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator(".stable-choices .stable-inspect")).toBeVisible();
    await expect(page.locator(".stable-choices .stable-coats")).toBeVisible();
    const animal = (await page.locator('.stable-animal img').boundingBox())!;
    expect(animal.x).toBeGreaterThanOrEqual(0);
    expect(animal.x+animal.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.locator('.stable-speech').evaluate(el => el.querySelector('p')!.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom)).toBe(true);
    await page.screenshot({path:`test-results/stable-${viewport.width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();
  await page.getByRole('button',{name:'Loja',exact:true}).click();
  await page.getByRole('button',{name:'Empório',exact:true}).click();
  await expect(page.getByRole('region',{name:'Catálogo da loja'})).toBeVisible();
  expect(errors).toEqual([]);
  console.log('Estábulo: ownership, preços, idempotência concorrente, saldo, nomes, persistência, quatro artes e seis viewports OK.');
} catch (e) {
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/stable-failure.png' });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
