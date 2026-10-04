import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { RULEBOOK_EDITOR_EMAIL, type RulebookResponse } from '../shared/rulebook.js';

const databaseUrl = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(databaseUrl.hostname) ||
  !/^\/alvorada_test_[0-9a-f]{32}$/.test(databaseUrl.pathname)
)
  throw new Error('Banco local descartável obrigatório.');

const origin = 'http://localhost:3038';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3038, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const readerContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const reader = await readerContext.newPage();
const errors: string[] = [];
for (const current of [page, reader])
  current.on('pageerror', (error) => errors.push(error.message));
async function publication(): Promise<RulebookResponse> {
  const response = await page.request.get(origin + '/api/rulebook');
  expect(response.ok()).toBe(true);
  return response.json();
}
async function save() {
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.rb-edit-state')).toContainText('Tudo salvo');
}
try {
  for (const [current, email, name] of [
    [page, RULEBOOK_EDITOR_EMAIL, 'Cronista do códice'],
    [reader, `rules-reader-${randomUUID()}@example.test`, 'Leitora da guilda'],
  ] as const) {
    const response = await current.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: { name, email, password: `Test-${randomUUID()}` },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto(origin + '/#rules');
  const initial = await publication();
  expect(initial.can_edit).toBe(true);
  await expect(page.locator('.rb-hero h2')).toHaveText(initial.document.title);
  await page.getByRole('button', { name: 'Editar conteúdo', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Título do códice', exact: true })
    .fill('O códice da Vigília');
  await page.getByRole('button', { name: 'Adicionar capítulo', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Título do capítulo', exact: true })
    .fill('Acordos da mesa');
  await page.getByRole('button', { name: 'Adicionar primeiro artigo', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Título do artigo', exact: true })
    .fill('Uma mesa para todos');
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Texto', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Texto', exact: true })
    .fill('Cada voz tem lugar nesta aventura.');
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Imagem', exact: true })
    .click();
  const art = await readFile(new URL('../public/rules/rulebook-desk.webp', import.meta.url));
  await page
    .getByLabel('Arquivo de imagem', { exact: true })
    .setInputFiles({ name: 'capa-da-guilda.webp', mimeType: 'image/webp', buffer: art });
  await expect(page.getByRole('textbox', { name: 'Imagem — endereço', exact: true })).toHaveValue(
    /^\/api\/rulebook\/images\/[a-f0-9-]+$/,
  );
  await page
    .getByRole('textbox', { name: 'Legenda e descrição da imagem', exact: true })
    .fill('O livro que reúne os acordos da guilda.');
  await page.locator('.rb-cover-editor > summary').click();
  await page.getByRole('button', { name: 'Remover capa', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover capa', exact: true }).click();
  await expect(page.locator('.rb-hero')).toHaveAttribute('data-has-cover', 'false');
  await save();
  const published = await publication();
  expect(published.document.title).toBe('O códice da Vigília');
  expect(published.document.cover_image).toBeNull();
  const article = published.document.chapters.at(-1)!.articles[0];
  const image = article.blocks.find((block) => block.type === 'image')!;
  expect(image.type).toBe('image');
  if (image.type !== 'image') throw new Error('Imagem não publicada.');
  expect((await reader.request.get(origin + image.src)).ok()).toBe(true);
  await reader.goto(origin + '/#rules');
  await expect(reader.locator('.rb-hero h2')).toHaveText(published.document.title);
  await expect(reader.getByRole('button', { name: 'Editar conteúdo', exact: true })).toHaveCount(0);
  await reader
    .getByRole('textbox', { name: 'Buscar no livro', exact: true })
    .fill('UMA MESA PARA TODOS');
  await reader.locator('.rb-search-result').click();
  await expect(reader.locator('.rb-article')).toContainText('Cada voz tem lugar nesta aventura.');
  await expect(reader.locator('.rb-article img')).toHaveAttribute('src', image.src);
  await expect
    .poll(() =>
      reader
        .locator('.rb-article img')
        .evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await mkdir('test-results', { recursive: true });
  await reader.screenshot({ path: 'test-results/rulebook-real-reader-mobile.png', fullPage: true });
  expect(await reader.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
  await reader.reload();
  await expect(reader.locator('.rb-hero h2')).toHaveText(published.document.title);
  await expect(reader.locator('.rb-hero')).toHaveAttribute('data-has-cover', 'false');

  await page
    .getByRole('textbox', { name: 'Título do códice', exact: true })
    .fill('Rascunho preservado ao visitar o início');
  await page.evaluate(() => {
    location.hash = 'overview';
  });
  await expect(page.locator('.rulebook')).toBeHidden();
  await page.evaluate(() => {
    location.hash = 'rules';
  });
  await expect(page.getByRole('textbox', { name: 'Título do códice', exact: true })).toHaveValue(
    'Rascunho preservado ao visitar o início',
  );
  await page
    .getByRole('textbox', { name: 'Título do códice', exact: true })
    .fill(published.document.title);
  await page
    .getByRole('button', { name: 'Excluir artigo Uma mesa para todos', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir artigo', exact: true })
    .click();
  await save();
  const deleted = await publication();
  expect(deleted.document.chapters.at(-1)!.articles).toHaveLength(0);
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp('^Versão ' + published.revision + ' ') })
    .click();
  await expect(page.getByRole('textbox', { name: 'Título do códice', exact: true })).toHaveValue(
    published.document.title,
  );
  await save();
  const restored = await publication();
  expect(restored.revision).toBe(deleted.revision + 1);
  expect(restored.document).toEqual(published.document);
  await page.reload();
  await expect(page.locator('.rb-hero h2')).toHaveText(published.document.title);
  await page.screenshot({ path: 'test-results/rulebook-real-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    'Regras: owner edita e publica, upload persistente, leitor/reload, capa removida, rascunho entre abas, exclusão e recuperação com histórico, desktop e celular OK.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
