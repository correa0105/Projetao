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
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let userId = '';
try {
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mural teste',
      email: 'notice-' + randomUUID() + '@example.test',
      password: 'Notice-' + randomUUID(),
    },
  });
  userId = (await signup.json()).user.id;
  const character = await createLegacyTestCharacter(userId);
  await pool.query(
    `INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,starts_at)
 VALUES($1,'mission','Missão de revisão A','Uma missão para validar os controles do mural.','Vigília','Tranquila',now()+interval '2 days'),
 ($1,'mission','Missão de revisão B','Outra missão para validar todos os cartões.','Vigília','Moderada',now()+interval '3 days')`,
    [userId],
  );
  await page.goto(origin + '/#board');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Abrir Missões', exact: true })).toBeVisible();
  const paper = page.getByRole('button', { name: 'Abrir aviso: Missão de revisão A', exact: true });
  await expect(paper).toBeVisible();
  await paper.focus();
  await paper.press('ArrowRight');
  await expect(page.getByText('Salvando posição…')).toHaveCount(0);
  const paperBox = (await paper.boundingBox())!;
  const surface = (await page.locator('.notice-board-surface').boundingBox())!;
  await page.mouse.move(paperBox.x + paperBox.width / 2, paperBox.y + paperBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(surface.x + surface.width + 100, surface.y + surface.height + 100, {
    steps: 12,
  });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            'SELECT paper_x,paper_y FROM board_posts WHERE title=$1 AND author_id=$2',
            ['Missão de revisão A', userId],
          )
        ).rows[0],
    )
    .toEqual({ paper_x: 1, paper_y: 1 });
  await expect(page.locator('#notice-category-panel')).toHaveCount(0);
  await page.reload();
  await expect(paper).toBeVisible();
  const moved = (await paper.boundingBox())!;
  expect(moved.x + moved.width).toBeLessThanOrEqual(surface.x + surface.width + 1);
  expect(moved.y + moved.height).toBeLessThanOrEqual(surface.y + surface.height + 1);
  await paper.click();
  await expect(page.locator('#notice-category-panel')).toContainText('Missão de revisão A');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/notice-village-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir Missões', exact: true }).click();
  await expect(page.locator('#notice-category-panel')).toBeVisible();
  const panel = page.locator('#notice-category-panel');
  await expect(panel.locator('.quest-card.compact')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^Ver / })).toHaveCount(0);
  const card = panel.locator('.quest-card').filter({ hasText: 'Missão de revisão B' });
  await card.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Inscrito', exact: true })).toBeDisabled();
  await expect(panel.getByRole('status')).toContainText('Inscrição confirmada');
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM mission_participants WHERE character_id=$1',
        [character.id],
      )
    ).rows[0].n,
  ).toBe(1);
  await card.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await expect(card).toHaveCount(0);
  await panel.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Participar', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(
    panel.locator('.quest-card').filter({ hasText: 'Missão de revisão A' }),
  ).toBeVisible();
  await expect(card).toBeVisible();
  await panel.getByRole('button', { name: 'Atuais', exact: true }).click();
  await panel.getByRole('button', { name: 'Registrar missão', exact: true }).click();
  await expect(page.getByRole('dialog').last()).toBeVisible();
  const form = page.getByRole('dialog').last();
  await form.locator('[name="title"]').fill('Publicação pela interface');
  await form.locator('[name="starts_at"]').fill('2030-10-20T18:00');
  await form.locator('[name="location"]').fill('Vigília');
  await form
    .locator('[name="description"]')
    .fill('Uma aventura publicada pelo formulário do mural.');
  await form.getByRole('button', { name: 'Selo', exact: true }).click();
  await form.getByRole('button', { name: 'Publicar no mural', exact: true }).click();
  await expect(
    panel.locator('.quest-card').filter({ hasText: 'Publicação pela interface' }),
  ).toBeVisible();
  await panel.getByRole('button', { name: 'Registrar missão', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir Missões', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Abrir Missões', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar lista de avisos' }).click();
  await page.getByRole('button', { name: 'Abrir Eventos', exact: true }).click();
  await panel.getByRole('button', { name: 'Registrar missão', exact: true }).click();
  await expect(
    page.getByRole('dialog').last().getByRole('combobox', { name: 'Tipo', exact: true }),
  ).toHaveValue('mission');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publicar evento', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar lista de avisos' }).click();
  await page.getByRole('button', { name: 'Abrir Ganchos', exact: true }).click();
  await panel.getByRole('button', { name: 'Registrar missão', exact: true }).click();
  await expect(
    page.getByRole('dialog').last().getByRole('combobox', { name: 'Tipo', exact: true }),
  ).toHaveValue('mission');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('#notice-category-panel')).toContainText('Ganchos nascem');
  await page.getByRole('button', { name: 'Fechar lista de avisos' }).click();
  await expect(page.getByRole('button', { name: 'Abrir Ganchos', exact: true })).toBeFocused();
  const published = page.getByRole('button', {
    name: 'Abrir aviso: Publicação pela interface',
    exact: true,
  });
  await expect(published.locator('img')).toHaveAttribute('src', '/notices/paper-seal.png');
  await pool.query(
    `INSERT INTO board_posts(author_id,kind,title,description,location,difficulty)
 SELECT $1,'mission','Aviso adicional '||n,'Descrição da aventura adicional.','Vigília','Tranquila' FROM generate_series(1,30) n`,
    [userId],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Abrir Missões', exact: true }).click();
  await expect(panel.locator('.quest-card')).toHaveCount(6);
  await panel.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(panel.getByRole('navigation', { name: 'Páginas dos avisos' })).toContainText('2 de');
  await panel.getByRole('searchbox').fill('publicacao pela interface');
  await expect(panel.locator('.quest-card')).toHaveCount(1);
  await expect(panel).toContainText('Publicação pela interface');
  await panel.getByRole('button', { name: 'Localizar no mural', exact: true }).click();
  await expect(published).toBeFocused();
  await expect(panel).toHaveCount(0);
  await published.click();
  await expect(panel).toContainText('Publicação pela interface');
  await panel.getByRole('button', { name: 'Fechar lista de avisos' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/notice-board-mobile-papers.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Abrir Missões', exact: true }).click();
  await page.screenshot({ path: 'test-results/notice-village-mobile.png', fullPage: true });
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await pool.query('UPDATE characters SET level=4,progression_missions=22,gold_cp=0 WHERE id=$1', [
    character.id,
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir Missões', exact: true }).click();
  await panel.getByRole('button', { name: 'Registrar missão', exact: true }).click();
  const examForm = page.getByRole('dialog').last();
  await examForm.getByLabel('Título', { exact: true }).fill('Ascensão ao Bronze');
  for (const [rank,amount] of [['Ferro','150'],['Bronze','230'],['Adamantium','300'],['Ametista','390'],['Obsidiana','500']]) {
    await examForm.getByLabel('Patente da missão',{exact:true}).selectOption(rank);
    await expect(examForm.locator('[name="reward"]')).toHaveValue(amount);
  }
  await examForm.getByLabel('Patente da missão',{exact:true}).selectOption('Ferro');
  await examForm.getByLabel('Categoria da missão').selectOption('4');
  await examForm.locator('[name="starts_at"]').fill('2030-10-20T18:00');
  await examForm.locator('[name="location"]').fill('Vigília');
  await examForm
    .locator('[name="description"]')
    .fill('Um teste para ascender à patente de Bronze.');
  await expect(examForm.locator('[name="reward"]')).toHaveValue('150');
  await expect(examForm.locator('[name="reward"]')).toHaveAttribute('readonly','');
  await examForm.getByRole('button', { name: 'Publicar no mural', exact: true }).click();
  await panel.getByRole('searchbox').fill('Ascensão ao Bronze');
  const examCard = panel.locator('.quest-card').filter({ hasText: 'Ascensão ao Bronze' });
  await expect(examCard).toContainText('Teste de patente · Bronze');
  await examCard.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect(examCard.getByRole('button', { name: 'Inscrito', exact: true })).toBeDisabled();
  await examCard.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await examCard.getByRole('button', { name: 'Concluir', exact: true }).click();
  const completion = page.getByRole('dialog').last();
  await expect(completion).toContainText('150 PO');
  await completion
    .getByLabel('Resumo da missão')
    .fill('O personagem completou o teste de patente com sucesso.');
  await completion.getByRole('button', { name: 'Confirmar conclusão', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            'SELECT level,progression_missions,gold_cp FROM characters WHERE id=$1',
            [character.id],
          )
        ).rows[0],
    )
    .toEqual({ level: 5, progression_missions: 22, gold_cp: 15000 });
  await page.goto(origin + '/#profile');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Patente e progressão' })).toContainText(
    'Bronze',
  );
  await expect(page.getByRole('region', { name: 'Patente e progressão' })).toContainText(
    '22/30 missões válidas',
  );
  const boostSelect = page.getByLabel('Distribuição dos bônus do antecedente');
  const boostValues = await boostSelect.locator('option:not([disabled])').evaluateAll(
    options => options.map(option => (option as HTMLOptionElement).value),
  );
  expect(boostValues).toHaveLength(7);
  for (const value of boostValues) {
    const nonzero = value.split(',').map(Number).filter(Boolean).sort();
    expect([[1, 2], [1, 1, 1]]).toContainEqual(nonzero);
  }
  await boostSelect.selectOption(boostValues[6]);
  await expect(boostSelect).toHaveValue(boostValues[6]);
  await boostSelect.selectOption(boostValues[0]);
  await expect(boostSelect).toHaveValue(boostValues[0]);
  await page.screenshot({path:'test-results/sheet-rank-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/sheet-rank-mobile.png'});
  await page.getByRole('button', { name: /^Pendências e notificações/ }).click();
  const notificationPanel = page.getByRole('region', { name: 'Pendências e notificações' });
  await expect(notificationPanel.getByText('Nível 5 alcançado')).toBeVisible();
  await page.screenshot({ path: 'test-results/notifications-mobile.png' });
  await notificationPanel.getByRole('button', { name: 'Marcar como lido' }).click();
  await expect(notificationPanel.getByText('Nível 5 alcançado')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/notifications-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(notificationPanel).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Pendências e notificações/ })).toBeFocused();
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Criar personagem' }).click();
  await expect(page.getByRole('dialog', { name: 'Uma nova história' })).toBeVisible();
  await page.screenshot({ path: 'test-results/sheet-creation-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/sheet-creation-desktop.png' });
  expect(errors).toEqual([]);
  console.log(
    'Mural: cartões completos, inscrição persistida, ações do autor, filtros, categorias, formulário, permissão visual, Escape, foco e mobile OK.',
  );
} finally {
  await browser.close();
  if (userId) await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
