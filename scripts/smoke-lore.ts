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
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
async function noOverflow() {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Escriba teste',
      email: `lore-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const testUser = (await signup.json()).user;
  await pool.query('INSERT INTO lore_folder_managers(user_id) VALUES($1)', [testUser.id]);
  await page.goto(origin + '/#lore');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Biblioteca de lore' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crônicas & lore.' })).toBeVisible();
  await expect(page.locator('.lore-page-link')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Abrir os arquivos' })).toHaveCount(0);
  await expect(page.getByText('Terras, crenças e histórias que atravessam as eras.')).toHaveCount(
    0,
  );
  expect(page.url()).toBe(origin + '/#lore');
  await expect(page.getByRole('region', { name: 'Biblioteca de lore' })).toBeVisible();
  await expect(page.locator('.lore-page-link [data-scroll-state="closed"]')).toHaveCount(2);
  await expect(page.locator('.lore-vase-icon').first()).toBeVisible();
  await page.setViewportSize({ width: 1890, height: 1000 });
  const heroBounds = await page.locator('.lore-hero').boundingBox();
  expect(heroBounds!.x).toBe(0);
  expect(heroBounds!.width).toBe(1890);
  await page.screenshot({ path: 'test-results/lore-library-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Editar pasta Lendas', exact: true }).click();
  const editFolder = page.getByRole('dialog');
  await editFolder.getByLabel('Nome da pasta').fill('Lendas antigas');
  await editFolder.getByRole('button', { name: 'Salvar pasta' }).click();
  await expect(editFolder).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Editar pasta Lendas antigas', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova pasta / subpasta' }).click();
  const folderDialog = page.getByRole('dialog');
  await folderDialog.getByLabel('Nome da pasta').fill('Portos antigos');
  const folders = (await (await page.request.get(origin + '/api/lore')).json()).folders;
  const cities = folders.find(
    (item: { region_id: string; name: string }) =>
      item.region_id === 'reino-do-norte' && item.name === 'Cidades',
  );
  await folderDialog.getByLabel('Dentro da pasta').selectOption(cities.id);
  await folderDialog.getByRole('button', { name: 'Criar pasta', exact: true }).click();
  await expect(folderDialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova crônica', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.getByLabel('Título da crônica').fill('As muralhas de Vigília');
  await create.getByRole('button', { name: 'Criar rascunho', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Editor de crônica' });
  await expect(editor).toBeVisible();
  await editor
    .getByLabel('Subtítulo', { exact: true })
    .fill('O arquivo das cidades · Uma crônica ilustrada');
  await editor.getByLabel('Título do bloco', { exact: true }).fill('À sombra do bastião');
  await editor
    .getByLabel('Texto', { exact: true })
    .fill(
      'Vigília reúne viajantes, artesãos e aventureiros entre suas muralhas de pedra. Os caminhos do Reino do Norte convergem para a cidade.\n\nNas crônicas, cada rua preserva uma história. Ao longe, a névoa cobre os caminhos e as torres anunciam a chegada de novos viajantes.',
    );
  await editor.getByLabel('Tipo de caixa').selectOption('parchment');
  await editor
    .getByLabel('Enviar imagem para a crônica')
    .setInputFiles('public/alvorada-dawn-banner.png');
  await expect(editor.locator('.lore-edit-block')).toHaveCount(2);
  const imageBlock = editor.getByRole('region', { name: 'Bloco 2', exact: true });
  await imageBlock.getByLabel('Formato').selectOption('portrait');
  await imageBlock.getByLabel('Posição').selectOption('left');
  await imageBlock.getByLabel('Enquadramento').selectOption('contain');
  await imageBlock.getByLabel('Descrição da imagem').fill('Fortaleza nas montanhas ao amanhecer');
  await imageBlock.getByLabel('Legenda').fill('As terras do Reino do Norte');
  for (const alignment of ['left', 'center', 'right']) {
    await imageBlock.getByLabel('Posição').selectOption(alignment);
    await editor.getByRole('button', { name: 'Prévia', exact: true }).click();
    await expect(editor.locator(`.lore-block--portrait.lore-align--${alignment}`)).toBeVisible();
    await editor.getByRole('button', { name: 'Voltar à edição', exact: true }).click();
  }
  await imageBlock.getByLabel('Formato').selectOption('half-landscape');
  expect(await imageBlock.getByLabel('Posição').locator('option').allTextContents()).toEqual([
    'Esquerda',
    'Direita',
  ]);
  await imageBlock.getByLabel('Posição').selectOption('left');
  await editor.getByRole('button', { name: 'Subir bloco 2' }).click();
  await editor.getByRole('button', { name: 'Adicionar caixa de texto', exact: true }).click();
  const third = editor.getByRole('region', { name: 'Bloco 3', exact: true });
  await third.getByLabel('Tipo de caixa').selectOption('quote');
  await third
    .getByLabel('Texto', { exact: true })
    .fill('Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois.');
  await editor.getByRole('button', { name: 'Prévia', exact: true }).click();
  await expect(editor.locator('.lore-block--half-landscape.lore-align--left')).toBeVisible();
  await expect(editor.locator('.lore-text--parchment')).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-editor-preview.png', fullPage: true });
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'As muralhas de Vigília', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.lore-image img')).toHaveAttribute(
    'alt',
    'Fortaleza nas montanhas ao amanhecer',
  );
  await page.reload();
  await page.getByRole('button').filter({ hasText: 'As muralhas de Vigília' }).click();
  await expect(page.locator('.lore-text--quote')).toContainText('Honre a palavra');
  await expect(page.locator('.lore-image-frame--cinematic')).toBeVisible();
  await expect(page.locator('.lore-reader-title [data-scroll-state="open"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/lore-reader-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Editar crônica', exact: true }).click();
  const updatedEditor = page.getByRole('region', { name: 'Editor de crônica' });
  await updatedEditor
    .getByRole('region', { name: 'Bloco 1', exact: true })
    .getByLabel('Formato')
    .selectOption('landscape');
  await updatedEditor
    .getByRole('region', { name: 'Bloco 1', exact: true })
    .getByLabel('Enquadramento')
    .selectOption('cover');
  await updatedEditor.getByRole('button', { name: 'Prévia', exact: true }).click();
  await expect(page.locator('.lore-block--landscape')).toBeVisible();
  await updatedEditor.getByRole('button', { name: 'Voltar à edição', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-editor-mobile.png', fullPage: true });
  await updatedEditor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(updatedEditor).toHaveCount(0);
  await expect(page.locator('.lore-block--landscape')).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-reader-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const movingFrame = page.locator('.lore-image-frame--cinematic');
  await movingFrame.scrollIntoViewIfNeeded();
  const bounds = await movingFrame.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.8, bounds!.y + bounds!.height * 0.3);
  await expect
    .poll(() => movingFrame.evaluate((element) => element.style.getPropertyValue('--image-x')))
    .not.toBe('');
  expect(
    await page
      .locator('.lore-image-mist')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('lore-mist');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.lore-image-mist')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.getByLabel('Região').selectOption('coroa-da-geada');
  await expect(page.getByRole('heading', { name: 'Um capítulo por escrever' })).toBeVisible();
  await noOverflow();
  await page.screenshot({ path: 'test-results/lore-empty-mobile.png', fullPage: true });
  await page.getByLabel('Região').selectOption('reino-do-norte');
  await page.getByRole('button', { name: 'Excluir pasta Portos antigos', exact: true }).click();
  const removeFolder = page.getByRole('dialog');
  await removeFolder.getByLabel('Guardar crônicas em').selectOption(cities.id);
  await page.screenshot({ path: 'test-results/lore-delete-folder-desktop.png', fullPage: true });
  await removeFolder.getByRole('button', { name: 'Excluir pasta', exact: true }).click();
  await expect(removeFolder).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Editar pasta Portos antigos', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button').filter({ hasText: 'As muralhas de Vigília' }).click();
  await expect(page.locator('.lore-reader-title [data-scroll-state="open"]')).toBeVisible();
  await expect(page.locator('.lore-text--quote')).toContainText('Honre a palavra');
  await page.getByRole('button', { name: 'Voltar ao arquivo' }).click();
  await page.getByRole('button', { name: 'Pastas excluídas', exact: true }).click();
  const trash = page.getByRole('dialog');
  await trash.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(trash).toContainText('Nenhuma pasta excluída.');
  await trash.getByRole('button', { name: 'Fechar' }).click();
  await expect(
    page.getByRole('button', { name: 'Editar pasta Portos antigos', exact: true }),
  ).toBeVisible();
  await noOverflow();
  expect(errors).toEqual([]);
  console.log(
    'Lore desktop/celular: largura completa, ícones, edição/exclusão/restauração de pastas, editor, publicação e persistência aprovados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/lore-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
