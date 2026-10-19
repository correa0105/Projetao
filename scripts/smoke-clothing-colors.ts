import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { purchaseContents } from '../shared/armor-bundles';
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
  const collection=JSON.parse(await readFile('data/shop-clothing-colors-20261018.json','utf8'));
  expect(collection.ready).toBe(true);expect(collection.items).toHaveLength(40);
  const catalog=await page.request.get(origin+'/api/catalog').then(r=>r.json());
  for(const item of collection.items){
    const actual=catalog.find((x:any)=>x.id===item.id);expect(actual?.base_item).toBe(item.raw_data.clothing_model);
    expect(actual?.category).toBe('Cosméticos');
    expect((await sharp('public'+item.image_path).stats()).isOpaque).toBe(false);
    expect((await page.request.get(origin+item.image_path)).ok()).toBe(true);
    expect((await page.request.get(origin+item.audio_path)).ok()).toBe(true);
  }
  await page.goto(origin+'/#shop');await page.reload();
  await page.getByRole('button',{name:/^Cosméticos/}).click();
  await expect(page.locator('.shop-product')).toHaveCount(28);
  const garments=page.locator('.shop-product[data-family="Clothing"]');
  await expect(garments).toHaveCount(8);
  for(const card of await garments.all()){
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('select')).toHaveCount(1);
    await expect(card.locator('select option:not([disabled])')).toHaveCount(5);
    await expect(card.getByRole('button',{name:/Comprar/})).toBeDisabled();
    await expect(card.locator('.shop-family-box')).toHaveCount(0);
    const selector=card.locator('select');
    const values=await selector.locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value));
    const images=new Set<string>();
    for(const value of values){
      await selector.selectOption(value);await expect(card).toHaveAttribute('data-item-id',value);
      await expect(card.getByRole('button',{name:/Comprar/})).toBeEnabled();
      const data=collection.items.find((x:any)=>x.id===value);
      const img=card.locator('.shop-product-art img');await expect(img).toHaveAttribute('src',data.image_path);await img.evaluate(n=>(n as HTMLImageElement).loading='eager');
      await expect.poll(()=>img.evaluate(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalWidth>0)).toBe(true);
      images.add(await img.getAttribute('src')||'');
    }expect(images.size).toBe(5);
  }
  await page.getByLabel('Procurar item').fill('Camiseta de linho');
  await expect(page.locator('.shop-product')).toHaveCount(1);
  const linen=page.locator('.shop-product'),select=linen.locator('select');
  await select.selectOption('cosmetic-shirt-linen-blue');await linen.getByRole('button',{name:/Comprar/}).click();
  await select.selectOption('cosmetic-shirt-linen-wine');await linen.getByRole('button',{name:/Comprar/}).click();
  await page.getByRole('button',{name:'Abrir carrinho: 2 itens'}).click();
  const cart=page.getByRole('dialog',{name:'Seu carrinho'});
  await expect(cart).toContainText('Camiseta de linho (Azul-anil)');await expect(cart).toContainText('Camiseta de linho (Vinho)');
  await cart.getByRole('button',{name:'Fechar',exact:true}).click();
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:'test-results/clothing-colors-'+width+'.png',fullPage:true});
  }
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1',[uid]);
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1',[character.id]);
  let total=0;
  for(const item of collection.items){
    const input={character_id:character.id,item_id:item.id,quantity:1,idempotency_key:randomUUID()};
    expect((await page.request.post(origin+'/api/purchases',{headers:{Origin:origin},data:input})).status()).toBe(201);
    expect((await page.request.post(origin+'/api/purchases',{headers:{Origin:origin},data:input})).status()).toBe(200);
    expect((await page.request.post(origin+'/api/inventory/equipment',{headers:{Origin:origin},data:{character_id:character.id,item_id:item.id,slot:item.raw_data.equipment_slots[0]}})).status()).toBe(200);
    total+=item.price_cp;
  }
  expect(Number((await pool.query('SELECT gold_cp FROM characters WHERE id=$1',[character.id])).rows[0].gold_cp)).toBe(100000-total);
  const inventory=(await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id',[character.id])).rows;expect(inventory).toHaveLength(new Set(collection.items.flatMap((item: {id:string})=>purchaseContents(item.id))).size);
  await seed();expect((await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id',[character.id])).rows).toEqual(inventory);
  expect(errors).toEqual([]);
  await writeFile('test-results/clothing-colors-result.json',JSON.stringify({passed:true,models:8,colorsPerModel:5,items:40,separateCartLines:true,purchaseReplay:true,equipment:true,seedPreserved:true,widths:[1440,768,390],errors},null,2));
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
