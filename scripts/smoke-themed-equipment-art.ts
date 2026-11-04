import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Banco descartável obrigatório.');
const origin='http://localhost:3027';
process.env.APP_ORIGIN=process.env.BETTER_AUTH_URL=origin;
const {pool}=await import('../server/db.js');
const {migrate}=await import('../server/migrate.js');
const {seed}=await import('../server/seed.js');
const {createLegacyTestCharacter}=await import('../tests/character-fixtures.js');
await migrate();await seed();
const {createApp}=await import('../server/app.js');
const app=express(),client=resolve('.local/art-cancel-client-20261102');
app.get('/',(_req,res)=>res.sendFile(resolve(client,'index.html'),{dotfiles:'allow'}));
app.use('/assets',express.static(resolve(client,'assets')));
app.use(express.static(resolve('public')));app.use(createApp());
const server=app.listen(3027,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript('window.__name=(fn)=>fn;');
const page=await context.newPage(),root=process.env.THEMATIC_ART_QA_DIR||'.local/equipment-families-20261103';await mkdir(root,{recursive:true});
const errors:string[]=[],checks:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try {
 const signup=await context.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Artes temáticas',email:'thematic-'+randomUUID()+'@example.test',password:'Test-'+randomUUID()}});
 expect(signup.ok()).toBe(true);await createLegacyTestCharacter((await signup.json()).user.id,'Liora');
 const registry=JSON.parse(await readFile('data/thematic-equipment-art-20261102.json','utf8'));
 const ids=registry.assets.filter((asset:any)=>!asset.id.includes('--')).map((asset:any)=>asset.id);
 const samples=(await pool.query("SELECT id,name,image_path,raw_data->>'base_item' AS model,raw_data->>'magic_family' AS family,raw_data->'armor_bundle_pieces' AS pieces FROM catalog_items WHERE active AND id=ANY($1::text[]) ORDER BY id",[ids])).rows;
 expect(samples.length).toBe(ids.length);
 for(const asset of registry.assets){const response=await context.request.get(origin+asset.path);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/webp');}
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(origin+'/#shop');
  const search=page.getByRole('textbox',{name:'Procurar item'});await expect(search).toBeVisible();
  await page.getByRole('navigation',{name:'Categorias da loja'}).getByRole('button',{name:/^Todos\b/}).click();
  for(const {id,family,name,model,image_path:imagePath,pieces} of samples){
   await search.fill(name.replace(/\s*\([^)]*\)\s*$/,''));
   const card=page.locator('.shop-product[data-family="'+family+'"],.shop-product[data-item-id="'+id+'"]').first();await expect(card).toBeVisible();
   const selector=card.getByRole('combobox',{name:/^Tipo de (armadura|arma) de/});
   if(await selector.count())await selector.selectOption(model);
   await expect(card).toHaveAttribute('data-item-id',id);
   const familyImage=card.locator('img.shop-family-object');
   const img=await familyImage.count()?familyImage:card.locator('img').first();
   await expect(img).toHaveAttribute('src',imagePath);
   expect(imagePath).toMatch(/^\/shop\/thematic-equipment-20\d{6}\//);
   await img.evaluate(async el=>{await (el as HTMLImageElement).decode();});
   if(pieces&&['breastplate','half-plate-armor'].includes(model)){
    await expect(card).toContainText('Peça única de armadura');
    await expect(card).not.toContainText('Conjunto completo');
   }else if(pieces)await expect(card).toContainText('Conjunto completo com 6 peças');
   await card.screenshot({path:root+'/'+id+'-'+width+'.png'});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  checks.push(samples.length+' modelos de armaduras, armas e capas: artes, seletores e compras preservados em '+width+' px');
 }
 expect(errors).toEqual([]);
 await writeFile(root+'/result.json',JSON.stringify({passed:true,checks,errors,decodedArtworks:registry.assets.length},null,2));
 console.log(JSON.stringify({passed:true,checks}));
}catch(error){await page.screenshot({path:root+'/failure.png'});throw error;}
finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
