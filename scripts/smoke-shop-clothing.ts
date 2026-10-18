import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3005';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js'),
  { createApp } = await import('../server/app.js');
process.env.NODE_ENV='production';
const server = createApp().listen(3005, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results', { recursive: true });
const errors: string[] = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1868, height: 940 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  await context.setExtraHTTPHeaders({'Accept-Encoding':'identity'});page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  // The built app and every API response are real; public media comes from the exact reviewed source tree.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.continue();
    const file = resolve('public', '.' + decodeURIComponent(url.pathname));
    if (file.startsWith(resolve('public')) && (await stat(file).catch(() => null))?.isFile())
      return route.fulfill({ path: file });
    return route.continue();
  });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Admin de tags',
      email: 'tags-ui-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [uid]);
  const character = await createLegacyTestCharacter(uid, 'Arden'),
    sibling = await createLegacyTestCharacter(uid, 'Mira');
  const {readFile}=await import('node:fs/promises');
  const sharp=(await import('sharp')).default;
  const clothing=JSON.parse(await readFile('data/shop-clothing-20261018.json','utf8'));
  expect(clothing.ready).toBe(true);expect(clothing.items).toHaveLength(8);
  const catalog=await page.request.get(origin+'/api/catalog').then(r=>r.json());
  for(const item of clothing.items){
    const actual=catalog.find((x:any)=>x.id===item.id);expect(actual).toBeTruthy();expect(actual.category).toBe('Cosméticos');expect(Number(actual.price_cp)).toBe(item.price_cp);
    const stats=await sharp('public'+item.image_path).stats();expect(stats.isOpaque).toBe(false);
    expect((await page.request.get(origin+item.image_path)).ok()).toBe(true);
    expect((await page.request.get(origin+item.audio_path)).ok()).toBe(true);
  }
  await page.goto(origin+'/#shop');await page.reload();
  await page.getByRole('button',{name:/^Cosméticos/}).click();
  await page.getByLabel('Procurar item').fill('Camiseta');
  await expect(page.locator('.shop-product')).toHaveCount(2);
  await page.getByRole('button',{name:'Examinar Camiseta de linho',exact:true}).click();
  await expect(page.getByRole('status',{name:'Comentário do vendedor'})).toContainText(clothing.items[0].merchant_comment);
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    await page.locator('.shop-product img').evaluateAll(nodes=>nodes.forEach(n=>(n as HTMLImageElement).loading='eager'));
    await expect.poll(()=>page.locator('.shop-product img').evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalWidth>0))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:'test-results/clothing-'+width+'.png',fullPage:true});
  }
  await page.getByLabel('Procurar item').fill('');await expect(page.locator('.shop-product')).toHaveCount(28);
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/clothing-all.png',fullPage:true});
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1',[uid]);
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1',[character.id]);
  let total=0;
  for(const item of clothing.items){
    const input={character_id:character.id,item_id:item.id,quantity:1,idempotency_key:randomUUID()};
    const first=await page.request.post(origin+'/api/purchases',{headers:{Origin:origin},data:input});expect(first.status()).toBe(201);
    const replay=await page.request.post(origin+'/api/purchases',{headers:{Origin:origin},data:input});expect(replay.status()).toBe(200);
    const equipped=await page.request.post(origin+'/api/inventory/equipment',{headers:{Origin:origin},data:{character_id:character.id,item_id:item.id,slot:item.raw_data.equipment_slots[0]}});expect(equipped.status()).toBe(200);
    const wrong=await page.request.post(origin+'/api/inventory/equipment',{headers:{Origin:origin},data:{character_id:character.id,item_id:item.id,slot:'head'}});expect(wrong.status()).toBe(400);
    total+=item.price_cp;
  }
  expect(Number((await pool.query('SELECT gold_cp FROM characters WHERE id=$1',[character.id])).rows[0].gold_cp)).toBe(100000-total);
  const inventoryBefore=(await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id',[character.id])).rows;
  const purchasesBefore=(await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id',[character.id])).rows;
  await seed();
  expect((await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id',[character.id])).rows).toEqual(inventoryBefore);
  expect((await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id',[character.id])).rows).toEqual(purchasesBefore);
  await page.goto(origin+'/#achievements');await page.reload();
  const scrolls=page.locator('.title-hall-cards .title-seal img');await expect(scrolls.first()).toBeVisible();expect(await scrolls.count()).toBeGreaterThanOrEqual(3);
  await expect.poll(()=>scrolls.evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalWidth>0))).toBe(true);
  const backgrounds=await page.evaluate(()=>['.title-hall','.fantasy-catalog'].map(sel=>{const s=getComputedStyle(document.querySelector(sel)!);return {image:s.backgroundImage,color:s.backgroundColor,size:s.backgroundSize}}));
  expect(backgrounds[0]).toEqual(backgrounds[1]);
  expect(await page.locator('.title-seal').first().evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});await page.locator('.title-hall').scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('.title-hall').screenshot({path:'test-results/title-scroll-'+width+'.png'});
  }
  expect(errors).toEqual([]);
  await writeFile('test-results/clothing-titles-result.json',JSON.stringify({passed:true,items:8,cosmetics:28,purchaseReplay:true,equipment:true,wrongSlotRejected:true,seedPreserved:true,woodMatchesCatalog:true,sealedScrolls:true,widths:[1440,768,390],errors},null,2));
} finally {await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
