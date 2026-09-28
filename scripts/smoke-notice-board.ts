import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Use banco isolado alvorada_test_* para testar o mural.');
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
let userId='';
try {
 await page.goto(origin);
 const signup=await page.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Mural teste',email:'notice-'+randomUUID()+'@example.test',password:'Notice-'+randomUUID()}});
 userId=(await signup.json()).user.id;
 const character=await createLegacyTestCharacter(userId);
 await pool.query(`INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,starts_at)
 VALUES($1,'mission','Missão de revisão A','Uma missão para validar os controles do mural.','Vigília','Tranquila',now()+interval '2 days'),
 ($1,'mission','Missão de revisão B','Outra missão para validar todos os cartões.','Vigília','Moderada',now()+interval '3 days')`,[userId]);
 await page.goto(origin+'/#board');await page.reload();
 await expect(page.getByRole('button',{name:'Abrir Missões',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 await page.screenshot({path:'test-results/notice-village-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Abrir Missões',exact:true}).click();
 await expect(page.locator('#notice-category-panel')).toBeVisible();
 const panel=page.locator('#notice-category-panel');
 await expect(panel.locator('.quest-card.compact')).toHaveCount(0);
 await expect(panel.getByRole('button',{name:/^Ver /})).toHaveCount(0);
 const card=panel.locator('.quest-card').filter({hasText:'Missão de revisão B'});
 await card.getByRole('button',{name:'Participar',exact:true}).click();
 await expect(card.getByRole('button',{name:'Inscrito',exact:true})).toBeDisabled();
 await expect(panel.getByRole('status')).toContainText('Inscrição confirmada');
 expect((await pool.query('SELECT count(*)::int AS n FROM mission_participants WHERE character_id=$1',[character.id])).rows[0].n).toBe(1);
 await card.getByRole('button',{name:'Iniciar',exact:true}).click();
 await expect(card.getByRole('button',{name:'Concluir',exact:true})).toBeVisible();
 await card.getByRole('button',{name:'Encerrar',exact:true}).click();
 await expect(card).toHaveCount(0);
 await panel.getByRole('button',{name:'Histórico',exact:true}).click();
 await expect(card).toBeVisible();
 await expect(card.getByRole('button',{name:'Participar',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'Todos',exact:true}).click();
 await expect(panel.locator('.quest-card').filter({hasText:'Missão de revisão A'})).toBeVisible();
 await expect(card).toBeVisible();
 await panel.getByRole('button',{name:'Atuais',exact:true}).click();
 await page.getByRole('button',{name:'Publicar missão',exact:true}).click();
 await expect(page.getByRole('dialog').last()).toBeVisible();
 const form=page.getByRole('dialog').last();
 await form.locator('[name="title"]').fill('Publicação pela interface');
 await form.locator('[name="starts_at"]').fill('2030-10-20T18:00');
 await form.locator('[name="location"]').fill('Vigília');
 await form.locator('[name="description"]').fill('Uma aventura publicada pelo formulário do mural.');
 await form.getByRole('button',{name:'Publicar no mural',exact:true}).click();
 await expect(panel.locator('.quest-card').filter({hasText:'Publicação pela interface'})).toBeVisible();
 await page.getByRole('button',{name:'Publicar missão',exact:true}).click();
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect(panel).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(panel).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Abrir Missões',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Abrir Missões',exact:true}).click();
 await page.getByRole('button',{name:'Fechar lista de avisos'}).click();
 await page.getByRole('button',{name:'Abrir Eventos',exact:true}).click();
 await expect(page.getByRole('button',{name:'Publicar evento',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Fechar lista de avisos'}).click();
 await page.getByRole('button',{name:'Abrir Ganchos',exact:true}).click();
 await expect(page.locator('#notice-category-panel')).toContainText('Ganchos nascem');
 await page.getByRole('button',{name:'Fechar lista de avisos'}).click();
 await expect(page.getByRole('button',{name:'Abrir Ganchos',exact:true})).toBeFocused();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Abrir Missões',exact:true}).click();
 await page.screenshot({path:'test-results/notice-village-mobile.png',fullPage:true});
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 expect(errors).toEqual([]);console.log('Mural: cartões completos, inscrição persistida, ações do autor, filtros, categorias, formulário, permissão visual, Escape, foco e mobile OK.');
}finally {await browser.close();if(userId)await pool.query('DELETE FROM "user" WHERE id=$1',[userId]);await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
