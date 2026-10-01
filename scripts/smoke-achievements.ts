import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Use banco isolado alvorada_test_* para testar o cofre.');
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
  viewport: { width: 1440, height: 1600 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let userId = '';
try {
  await page.goto(origin);
  const response = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste Cofre',
      email: `vault-browser-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(response.ok()).toBe(true);
  userId = (await response.json()).user.id;
  const first = await createLegacyTestCharacter(userId, 'Arden');
  const second = await createLegacyTestCharacter(userId, 'Mira');

  await pool.query("INSERT INTO achievements(character_id,code) VALUES($1,'first_character')", [first.id]);
  await page.goto(origin + '/#achievements'); await page.reload();
  await page.locator('.profile-avatar').click();
  await page.getByRole('option', { name: 'Arden', exact: true }).click();
  await expect(page.locator('.catalog-achievement')).toHaveCount(5);
  await page.getByRole('button',{name:'Próxima',exact:true}).click();
  await expect(page.locator('.catalog-achievement')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Próxima',exact:true})).toBeDisabled();
  const search = page.getByRole('searchbox', { name: 'Buscar conquista por nome' });
  await search.fill('CAPITULO');
  await expect(page.locator('.catalog-achievement')).toHaveCount(1);
  await expect(page.locator('.catalog-achievement')).toContainText('O primeiro capítulo');
  await search.fill('inexistente');
  await expect(page.locator('.catalog-achievement')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Nenhuma conquista');
  await search.fill('chamado');
  await page.getByRole('button', {name:'Desbloqueadas', exact:true}).click();
  await expect(page.locator('.catalog-achievement')).toHaveCount(0);
  await page.getByRole('button', {name:'Todas', exact:true}).click();
  await expect(page.locator('.catalog-achievement')).toHaveCount(1);
  await search.fill('');
  await page.getByText('Personalizar estante', {exact:true}).click();
  await page.locator('.material-options label').filter({hasText:'Ébano'}).click();
  await expect(page.getByRole('combobox', {name:'Tipo de estante'})).toHaveValue('classic');
  await expect(page.locator('select[aria-label="Tipo de estante"] option[value="arcane"]')).toHaveJSProperty('disabled', true);
  await expect(page.getByText('Moldura das conquistas',{exact:true})).toHaveCount(0);
  await expect(page.locator('.cabinet-slot[aria-pressed="true"]')).toHaveCount(0);
  const firstSlot = page.getByRole('button',{name:'Posição 1: vazia',exact:true});
  await firstSlot.click();
  await firstSlot.click();
  await expect(firstSlot).toHaveAttribute('aria-pressed','false');
  await firstSlot.click();
  const plus = await firstSlot.locator('.empty-position').boundingBox();
  const slot = await firstSlot.boundingBox();
  expect(Math.abs(plus!.x + plus!.width/2 - slot!.x - slot!.width/2)).toBeLessThan(1);
  expect(Math.abs(plus!.y + plus!.height/2 - slot!.y - slot!.height/2)).toBeLessThan(1);
  await page.getByRole('button',{name:'Exibir na estante',exact:true}).click();
  const trophy = page.getByRole('button',{name:'Posição 1: O primeiro capítulo',exact:true});
  const box = await trophy.boundingBox();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+80,box!.y+box!.height/2,{steps:8});await page.mouse.up();
  const shifted = await trophy.boundingBox();
  expect(shifted!.x-box!.x).toBeGreaterThan(70);
  expect(Math.abs(shifted!.y-box!.y)).toBeLessThan(1);
  await trophy.focus();await page.keyboard.press('ArrowRight');

  await page.getByRole('button',{name:'Salvar estante',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Estante salva.');
  const persisted=await (await page.request.get(origin+'/api/characters/'+first.id+'/achievements')).json();
  expect(persisted.shelf.positions[0]).toBeGreaterThan(10);
  await page.reload();
  await page.getByText('Personalizar estante', {exact:true}).click();
  await expect(page.getByLabel('Ébano',{exact:true})).toBeChecked();
  await expect(page.getByRole('button',{name:'Posição 1: O primeiro capítulo',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Posição 5: vazia',exact:true}).click();
  await page.getByRole('button',{name:'Mover para cá',exact:true}).click();
  await expect(page.getByRole('button',{name:'Posição 1: vazia',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Salvar estante',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Estante salva.');
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/cabinet-desktop.png',fullPage:true});
  const endpoint=origin+'/api/characters/'+first.id+'/achievements';
  for (const slots of [['first_mission',...Array(17).fill(null)],['first_character','first_character',...Array(16).fill(null)]]) {
    expect((await page.request.post(endpoint,{headers:{Origin:origin},data:{material:'walnut',medal_frame:'bronze',slots}})).status()).toBe(400);
  }

  const shelf=(await (await page.request.get(endpoint)).json()).shelf;
  for(const x of [-1,91]) {
    const positions=Array(18).fill(x);
    expect((await page.request.post(endpoint,{headers:{Origin:origin},data:{...shelf,positions}})).status()).toBe(400);
  }
  // Coincident horizontal coordinates are legal; no collision rejection.
  expect((await page.request.post(endpoint,{headers:{Origin:origin},data:{...shelf,positions:Array(18).fill(40)}})).status()).toBe(200);
  await page.request.post(endpoint,{headers:{Origin:origin},data:shelf});
  const other=await browser.newContext();
  const response2=await other.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Outro',email:'shelf-'+randomUUID()+'@example.test',password:'Test-'+randomUUID()}});
  const outsider=(await response2.json()).user.id;
  try {
    expect((await other.request.get(endpoint)).status()).toBe(404);
    expect((await other.request.post(endpoint,{headers:{Origin:origin},data:{material:'walnut',medal_frame:'bronze',slots:Array(18).fill(null)}})).status()).toBe(404);
  } finally {await other.close();await pool.query('DELETE FROM "user" WHERE id=$1',[outsider]);}
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Posição 9: vazia',exact:true}).click();
  await page.getByRole('button',{name:'Mover para cá',exact:true}).click();
  await page.getByRole('button',{name:'Salvar estante',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Estante salva.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/cabinet-mobile.png',fullPage:true});
  await page.locator('.profile-avatar').click();
  await page.getByRole('option',{name:'Mira',exact:true}).click();
  await expect(page.getByLabel('Nogueira',{exact:true})).toBeChecked();
  await expect(page.locator('.cabinet-slot .fantasy-medal')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('Estante ilustrada: materiais, molduras, posições, persistência, bloqueio, isolamento e mobile OK.');
} finally { await browser.close();if(userId)await pool.query('DELETE FROM "user" WHERE id=$1',[userId]);await new Promise<void>(r=>server.close(()=>r()));await pool.end(); }
