import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { blankEvent } from '../shared/events.js';
import { calendarDate } from '../shared/calendar.js';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3003';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3003, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.addInitScript(() => {
  const play = HTMLMediaElement.prototype.play,
    log: { source: string; voice: HTMLMediaElement }[] = [];
  (window as any).__petVoices = log;
  HTMLMediaElement.prototype.play = function () {
    if (this.src.includes('/audio/pets/')) log.push({ source: this.src, voice: this });
    return play.call(this);
  };
});
await mkdir('test-results', { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Administrador',
      email: `calendar-ui-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const owner = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Arden'),
    b = await createLegacyTestCharacter(owner.id, 'Mira');
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=ANY($1::uuid[])', [[a.id, b.id]]);
  async function pet(characterId: string, petId: string, name: string) {
    const r = await context.request.post(origin + '/api/pets/purchase', {
      headers: { Origin: origin },
      data: {
        character_id: characterId,
        pet_id: petId,
        name,
        appearance: 'original',
        idempotency_key: randomUUID(),
      },
    });
    expect(r.status()).toBe(201);
    return (await r.json()).pet;
  }
  const first = await pet(a.id, 'dog', 'Brasa'),
    second = await pet(a.id, 'cat', 'Bolota'),
    third = await pet(b.id, 'frog', 'Pingo');
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Selecionar Arden', exact: true }).click();
  await expect(page.locator('.camp-pet')).toHaveAttribute('data-pet-id', first.id);
  await page.goto(origin + '/#pets');
  await expect(page.locator('.garalho-dialogue')).toHaveCount(0);
  await expect(page.locator('.garalho-reply')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conversar com Garalho', exact: true }).click();
  await expect(page.locator('.garalho-dialogue header')).toContainText('Garalho');
  await expect(page.locator('.garalho-reply')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quem é você?', exact: true }).click();
  await expect(page.locator('.garalho-reply')).toContainText('Miau');
  await expect(page.locator('.garalho-sign-front p')).toContainText('fiscal dos cochilos', {
    timeout: 5000,
  });
  await page.screenshot({ path: 'test-results/garalho-dialogue-v3.png' });
  await page.getByRole('button', { name: 'Fechar conversa com Garalho', exact: true }).click();
  const before = await page.evaluate(() => (window as any).__petVoices.length);
  await page
    .locator('.pet-shop-choices button')
    .filter({ has: page.getByText('Corvo', { exact: true }) })
    .click();
  await expect(page.locator('.garalho-sign-front p')).toContainText('Conte suas moedas', {
    timeout: 5000,
  });
  expect(
    await page.evaluate(
      (index) =>
        (window as any).__petVoices.slice(index).map((item: any) => item.source.split('/').at(-1)),
      before,
    ),
  ).toEqual(['raven-caw-v3.wav']);
  await page.locator('.pet-appearances button').last().click();
  await expect(page.locator('.pet-shop-preview [role=img]')).toHaveAttribute(
    'aria-label',
    'Corvo das sombras',
  );
  await expect
    .poll(() =>
      page.evaluate(
        (index) =>
          (window as any).__petVoices
            .slice(index)
            .map((item: any) => item.source.split('/').at(-1)),
        before,
      ),
    )
    .toEqual(['raven-caw-v3.wav', 'raven-caw-v3.wav']);
  await expect(page.locator('.garalho-reply')).toHaveCount(0);
  await page
    .locator('.pet-shop-choices button')
    .filter({ has: page.getByText('Cão', { exact: true }) })
    .click();
  await page.getByRole('button', { name: 'Editar raça', exact: true }).click();
  const breed = page.getByRole('dialog', { name: 'Editar raça do mascote', exact: true });
  await breed.getByLabel('Nome da raça', { exact: true }).fill('Retriever dourado');
  await breed.getByRole('button', { name: 'Salvar raça', exact: true }).click();
  await expect(breed).not.toBeVisible();
  await expect(page.locator('.pet-breed-heading')).toContainText('Retriever dourado');
  await page.getByLabel('Como vai se chamar?', { exact: true }).fill('Amora');
  await page.getByRole('button', { name: 'Levar este companheiro', exact: true }).click();
  await expect(page.locator('.pet-shop-notice')).toContainText('Amora');
  await page.goto(origin + '/#inventory');
  await expect(page.locator('.inventory-pets')).toContainText('Retriever dourado');
  const amora = page.getByRole('button', { name: 'Mostrar Amora no acampamento', exact: true });
  await amora.click();
  await expect(amora).toHaveAttribute('aria-pressed', 'true');
  const amoraId = (await context.request.get(origin + `/api/pets/${a.id}`))
    .json()
    .then((items) => items.find((item: any) => item.name === 'Amora').id);
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-pet')).toHaveAttribute('data-pet-id', await amoraId);
  await expect(page.locator('.camp-pet')).toHaveCount(1);
  await expect(page.locator('.camp-pet .pet-art svg image')).toHaveAttribute(
    'href',
    '/pets/classics-a-v3.png',
  );
  await expect
    .poll(() => page.locator('.camp-pet').evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(1);
  const camp = (await page.locator('.character-camp').boundingBox())!,
    companion = (await page.locator('.camp-pet').boundingBox())!;
  expect(companion.x).toBeGreaterThan(camp.x + camp.width * 0.65);
  await page.screenshot({ path: 'test-results/camp-pet-desktop.png' });
  await page.getByRole('button', { name: 'Selecionar Mira', exact: true }).click();
  await expect(page.locator('.camp-pet')).toHaveAttribute('data-pet-id', third.id);
  await expect(page.locator('.camp-pet')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect
    .poll(() => page.locator('.camp-pet').evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(1);
  await page.screenshot({ path: 'test-results/camp-pet-mobile.png' });
  await page.goto(origin + '/#inventory');
  await expect(
    page.getByRole('button', { name: 'Mostrar Pingo no acampamento', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const month = calendarDate(new Date()).slice(0, 7),
    day = month + '-15';
  for (const title of [
    'Encontro na taverna',
    'Feira dos artesãos',
    'Duelo amistoso',
    'Sessão da guilda',
  ]) {
    const r = await context.request.post(origin + '/api/events', {
      headers: { Origin: origin },
      data: {
        ...blankEvent,
        title,
        description: 'Um encontro para todos.',
        starts_at: day + 'T19:00:00-03:00',
        location: 'Praça da vila',
      },
    });
    expect(r.status()).toBe(201);
  }
  await page.goto(origin + '/#overview');
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await expect(page.locator('.calendar-day')).toHaveCount(42);
  await page.locator(`.calendar-day[data-date="${day}"]`).click();
  await expect(page.locator('.calendar-appointment')).toHaveCount(4);
  await expect(page.locator(`.calendar-day[data-date="${day}"]`)).toContainText('+1 compromisso');
  await page.getByRole('button', { name: 'Editar calendário', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Editar calendário', exact: true });
  await settings.getByLabel('Título do calendário', { exact: true }).fill('O calendário da mesa');
  await settings
    .getByLabel('Apresentação', { exact: true })
    .fill('Todo encontro começa com um dia marcado.');
  await settings.getByLabel('Primeiro dia da semana', { exact: true }).selectOption('sunday');
  await settings.getByRole('button', { name: 'Salvar calendário', exact: true }).click();
  await expect(settings).not.toBeVisible();
  await expect(page.locator('.calendar-cover')).toContainText('O calendário da mesa');
  await expect(page.locator('.calendar-weekdays span').first()).toHaveText('Dom');
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Criar evento', exact: true });
  await create.getByLabel('Título', { exact: true }).fill('Noite de jogos');
  await create.getByLabel('Descrição', { exact: true }).fill('Dados, conversa e pão quente.');
  await create.getByLabel('Local', { exact: true }).fill('Taverna');
  await create.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(create).not.toBeVisible();
  await expect(page.locator('.calendar-appointment')).toHaveCount(5);
  await page.getByRole('button', { name: 'Editar Noite de jogos', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Editar evento', exact: true });
  await edit.getByLabel('Título', { exact: true }).fill('Noite de dados');
  await edit.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(page.locator('.calendar-day-detail')).toContainText('Noite de dados');
  await page.locator('.guild-calendar').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/calendar-desktop.png', fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.calendar-appointment')).toHaveCount(5);
    await page.screenshot({ path: `test-results/calendar-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await expect(page.locator('.calendar-appointment')).toHaveCount(0);
  await page.getByLabel('Ir para outro mês', { exact: true }).fill(month);
  await page.locator(`.calendar-day[data-date="${day}"]`).click();
  await expect(page.locator('.calendar-appointment')).toHaveCount(5);
  await page.getByRole('button', { name: 'Editar Noite de dados', exact: true }).click();
  const remove = page.getByRole('dialog', { name: 'Editar evento', exact: true });
  await remove.getByRole('button', { name: 'Excluir evento', exact: true }).click();
  await remove
    .getByRole('button', { name: 'Confirmar exclusão de “Noite de dados”', exact: true })
    .click();
  await expect(remove).not.toBeVisible();
  await expect(page.locator('.calendar-appointment')).toHaveCount(4);
  const meetingDay = month + '-20';
  await pool.query(
    `INSERT INTO home_updates(author_id,title,body,kind,layout,image_side,image_fit,text_align,text_size,starts_at,location) VALUES($1,'Reunião de planejamento','Vamos preparar a próxima jornada.','meeting','compact','left','contain','left','normal',$2,'Taverna')`,
    [owner.id, meetingDay + 'T20:00:00-03:00'],
  );
  await page.getByRole('button', { name: 'Diário', exact: true }).first().click();
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.locator(`.calendar-day[data-date="${meetingDay}"]`).click();
  await expect(page.locator('.calendar-appointment')).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar Reunião de planejamento', exact: true }).click();
  const publication = page.locator('dialog.journal-editor');
  await expect(publication).toBeVisible();
  await publication.getByLabel('Título', { exact: true }).first().fill('Planejamento da jornada');
  await publication.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(publication).not.toBeVisible();
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.locator(`.calendar-day[data-date="${meetingDay}"]`).click();
  await expect(page.locator('.calendar-day-detail')).toContainText('Planejamento da jornada');
  await page.goto(origin + '/#events');
  await expect(page.locator('.events-backdrop')).toHaveCSS(
    'background-image',
    /notice-village-empty-v4/,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() =>
      page.locator('.event-feature').evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  await page.screenshot({ path: 'test-results/events-village.png' });
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [owner.id]);
  await page.goto(origin + '/#overview');
  await page.reload();
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await expect(page.locator('.calendar-cover')).toContainText('O calendário da mesa');
  await expect(page.getByRole('button', { name: 'Editar calendário', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo compromisso', exact: true })).toHaveCount(0);
  await page.goto(origin + '/#pets');
  await expect(page.getByRole('button', { name: 'Editar raça', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Calendário: criação/edição/exclusão, aparência, eventos compartilhados, mobile e permissões; mascote nomeado e escolhido por personagem, raça persistida, miado sob pergunta e som único do animal OK.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/calendar-pets-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
