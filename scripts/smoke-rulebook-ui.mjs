import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { INITIAL_RULEBOOK, rulebookDocumentSchema } from '../shared/rulebook.ts';

await mkdir('test-results/rulebook-fixture', { recursive: true });
await writeFile(
  'test-results/rulebook-fixture/main.tsx',
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Rulebook } from '../../src/Rulebook';
import { SiteMusicProvider, useSoundEffects } from '../../src/SiteMusic';
import { PageHeader } from '../../src/PageHeader';
import { FlashMessages } from '../../src/FlashMessage';
import '../../src/styles.css';
import '../../src/alvorada.css';
import '../../src/journey.css';
import '../../src/theme.css';
import '../../src/disclosures.css';
import '../../src/page-header.css';
import '../../src/npc-speech.css';
function Fixture() {
  const [active, setActive] = React.useState(true);
  const effects = useSoundEffects();
  window.rulebookFixture = { setActive, effects };
  return <><div className="app-shell" data-page="rules">
  <div className="main-shell"><PageHeader title="Regras da mesa"><span /></PageHeader>
    <main className="main-content"><div className="page-header-spacer" aria-hidden="true" /><Rulebook active={active} /></main></div>
</div><FlashMessages /></>;
}
createRoot(document.getElementById('root')!).render(<SiteMusicProvider><Fixture /></SiteMusicProvider>);
`,
);
const server = await createServer({
  server: { host: '127.0.0.1', port: 3037, strictPort: true },
  logLevel: 'error',
  plugins: [
    {
      name: 'rulebook-fixture',
      configureServer(instance) {
        instance.middlewares.use('/rulebook-fixture', async (_request, response) => {
          response.setHeader('content-type', 'text/html');
          response.end(
            await instance.transformIndexHtml(
              '/rulebook-fixture',
              '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div><script type="module" src="/test-results/rulebook-fixture/main.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let document = structuredClone(INITIAL_RULEBOOK),
  revision = 0;
const snapshots = new Map([[0, structuredClone(document)]]);
const imageSrc = '/api/rulebook/images/00000000-0000-4000-8000-000000000001';
const upload = await readFile('public/rules/rulebook-desk.webp');
const puts = [];
let saveDelay = 0,
  uploadDelay = 0,
  historyDelay = 0,
  historyResponses = 0;
const failures = [];
async function pageFor(owner = true, viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'false');
    localStorage.setItem('alvorada-effects-volume', '0.4');
    window.rulebookAudio = [];
    HTMLMediaElement.prototype.play = function () {
      window.rulebookAudio.push({
        action: 'play',
        src: this.src,
        volume: this.volume,
        player: this,
      });
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.rulebookAudio.push({ action: 'pause', src: this.src });
    };
  });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route(/\/api\/rulebook(?:\/|$|\?)/, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === imageSrc) {
      await route.fulfill({ contentType: 'image/webp', body: upload });
      return;
    }
    if (path === '/api/rulebook/history') {
      await route.fulfill({
        json: {
          revisions: [...snapshots].reverse().map(([value, doc]) => ({
            revision: value,
            title: doc.title,
            updated_at: '2026-10-04T18:00:00Z',
          })),
        },
      });
      return;
    }
    if (path.startsWith('/api/rulebook/history/')) {
      const value = Number(path.split('/').pop());
      if (historyDelay) await new Promise((resolve) => setTimeout(resolve, historyDelay));
      await route.fulfill({ json: { document: snapshots.get(value), revision: value } });
      historyResponses++;
      return;
    }
    if (request.method() === 'POST') {
      if (uploadDelay) await new Promise((resolve) => setTimeout(resolve, uploadDelay));
      await route.fulfill({
        json: {
          id: imageSrc.split('/').pop(),
          src: imageSrc,
          name: 'imagem.webp',
          width: 1672,
          height: 941,
        },
      });
      return;
    }
    if (request.method() === 'PUT') {
      const data = request.postDataJSON();
      puts.push(data);
      if (saveDelay) await new Promise((resolve) => setTimeout(resolve, saveDelay));
      if (data.revision !== revision) {
        await route.fulfill({ status: 409, json: { error: 'A publicação mudou.' } });
        return;
      }
      const parsed = rulebookDocumentSchema.safeParse(data.document);
      if (!parsed.success) {
        await route.fulfill({ status: 400, json: { error: parsed.error.issues[0].message } });
        return;
      }
      document = parsed.data;
      revision++;
      snapshots.set(revision, structuredClone(document));
    }
    await route.fulfill({ json: { document, revision, can_edit: owner } });
  });
  await page.goto('http://127.0.0.1:3037/rulebook-fixture');
  await expect(page.locator('.rb-hero h2')).toHaveText(document.title);
  return page;
}
try {
  const reader = await pageFor(false);
  await expect(reader.getByRole('button', { name: 'Editar conteúdo' })).toHaveCount(0);
  await expect(reader.locator('.rb-item-actions')).toHaveCount(0);
  await expect(reader.locator('.rb-chapter-mark .rb-emblem')).toHaveCount(6);
  expect(
    await reader.evaluate(
      () =>
        window.rulebookAudio.filter((a) => a.action === 'play' && /shop-counter/.test(a.src))
          .length,
    ),
  ).toBe(0);
  await reader.getByRole('button', { name: /Entrar no códice/ }).click();
  expect(
    await reader.evaluate(
      () => window.rulebookAudio.filter((a) => a.action === 'play' && /leather/.test(a.src)).length,
    ),
  ).toBe(1);
  await expect(
    reader.locator('a[href="https://creativecommons.org/licenses/by/4.0/legalcode"]'),
  ).toBeVisible();
  await reader.screenshot({ path: 'test-results/rulebook-reader-desktop.png', fullPage: true });
  await reader.getByRole('textbox', { name: 'Buscar no livro' }).fill('PERICIAS');
  await expect(reader.locator('.rb-search-result')).not.toHaveCount(0);
  await reader.locator('.rb-search-result').first().click();
  await expect(reader.locator('.rb-article')).toContainText('Criar um aventureiro');
  await reader.getByRole('button', { name: /^Próximo/ }).click();
  await expect(reader.locator('.rb-article')).toContainText('Uma rolagem para a ficha');
  expect(
    await reader.evaluate(
      () => window.rulebookAudio.filter((a) => a.action === 'play' && /paper/.test(a.src)).length,
    ),
  ).toBe(2);
  await reader.evaluate(() => window.rulebookFixture.effects.setVolume(0.2));
  await expect
    .poll(() =>
      reader.evaluate(
        () => window.rulebookAudio.find((a) => /paper/.test(a.src) && a.player)?.player.volume,
      ),
    )
    .toBe(0.17);
  await reader.evaluate(() => window.rulebookFixture.effects.toggle());
  await expect
    .poll(() =>
      reader.evaluate(
        () => window.rulebookAudio.find((a) => /paper/.test(a.src) && a.player)?.player.muted,
      ),
    )
    .toBe(true);
  await reader.getByRole('button', { name: /^Próximo/ }).click();
  expect(
    await reader.evaluate(
      () => window.rulebookAudio.filter((a) => a.action === 'play' && /paper/.test(a.src)).length,
    ),
  ).toBe(2);
  await reader.evaluate(() => {
    window.rulebookFixture.effects.toggle();
    window.rulebookFixture.effects.setVolume(0);
  });
  await reader.getByRole('button', { name: /^Próximo/ }).click();
  expect(
    await reader.evaluate(
      () => window.rulebookAudio.filter((a) => a.action === 'play' && /paper/.test(a.src)).length,
    ),
  ).toBe(2);
  await reader.evaluate(() => {
    window.rulebookFixture.effects.setVolume(0.4);
    window.rulebookFixture.setActive(false);
  });
  await expect(reader.locator('.rulebook')).toHaveAttribute('data-active', 'false');
  await reader.getByRole('button', { name: /^Próximo/ }).click();
  expect(
    await reader.evaluate(
      () => window.rulebookAudio.filter((a) => a.action === 'play' && /paper/.test(a.src)).length,
    ),
  ).toBe(2);
  await reader.close();
  const mobile = await pageFor(false, { width: 390, height: 844 });
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
  await mobile.screenshot({ path: 'test-results/rulebook-reader-mobile.png', fullPage: true });
  await mobile.getByRole('button', { name: 'Abrir índice' }).click();
  await expect(mobile.locator('.rb-index-body')).toBeVisible();
  await mobile.locator('.rb-article-button').nth(1).click();
  await expect(mobile.getByRole('button', { name: 'Abrir índice' })).toBeVisible();
  await expect(mobile.locator('.rb-article')).toContainText('Criar um aventureiro');
  await mobile.close();

  const actions = await pageFor();
  await expect(
    actions.getByRole('button', { name: 'Editar capítulo Atributos e ficha', exact: true }),
  ).toBeVisible();
  await expect(
    actions.getByRole('button', { name: 'Excluir artigo Criar um aventureiro', exact: true }),
  ).toHaveText('Excluir');
  await actions.screenshot({ path: 'test-results/rulebook-actions-desktop.png', fullPage: true });
  await actions
    .getByRole('button', { name: 'Excluir capítulo A vida na guilda', exact: true })
    .click();
  await expect(actions.getByRole('dialog')).toContainText('2 artigos');
  await actions.getByRole('button', { name: 'Manter como está', exact: true }).click();
  await expect(actions.locator('.rb-editor-bar')).toHaveCount(0);
  await actions
    .getByRole('button', { name: 'Editar capítulo Atributos e ficha', exact: true })
    .click();
  await expect(
    actions.getByRole('textbox', { name: 'Título do capítulo', exact: true }),
  ).toHaveValue('Atributos e ficha');
  await expect(
    actions.getByRole('textbox', { name: 'Título do capítulo', exact: true }),
  ).toBeFocused();
  await actions
    .getByRole('textbox', { name: 'Descrição do capítulo', exact: true })
    .fill('Rascunho conservado ao editar outro artigo.');
  await actions
    .getByRole('button', { name: 'Editar artigo Uma rolagem para a ficha', exact: true })
    .click();
  await expect(actions.getByRole('textbox', { name: 'Título do artigo', exact: true })).toHaveValue(
    'Uma rolagem para a ficha',
  );
  await expect(
    actions.getByRole('textbox', { name: 'Título do artigo', exact: true }),
  ).toBeFocused();
  await expect(
    actions.getByRole('textbox', { name: 'Descrição do capítulo', exact: true }),
  ).toHaveValue('Rascunho conservado ao editar outro artigo.');
  await actions.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await actions.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await actions
    .getByRole('button', { name: 'Excluir capítulo A vida na guilda', exact: true })
    .click();
  await actions
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir capítulo', exact: true })
    .click();
  await expect(actions.locator('.rb-editor-bar')).toBeVisible();
  await expect(
    actions.getByRole('button', { name: 'Editar capítulo A vida na guilda', exact: true }),
  ).toHaveCount(0);
  expect(document.chapters).toHaveLength(INITIAL_RULEBOOK.chapters.length);
  await actions.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await actions.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await actions
    .getByRole('button', { name: 'Excluir artigo Criar um aventureiro', exact: true })
    .click();
  await actions
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir artigo', exact: true })
    .click();
  await expect(
    actions.getByRole('button', { name: 'Editar artigo Criar um aventureiro', exact: true }),
  ).toHaveCount(0);
  expect(document.chapters[0].articles).toHaveLength(INITIAL_RULEBOOK.chapters[0].articles.length);
  await actions.close();

  const mobileActions = await pageFor(true, { width: 390, height: 844 });
  await mobileActions.getByRole('button', { name: 'Abrir índice', exact: true }).click();
  await mobileActions
    .getByRole('button', { name: 'Editar capítulo A vida na guilda', exact: true })
    .click();
  await expect(
    mobileActions.getByRole('button', { name: 'Fechar índice', exact: true }),
  ).toBeVisible();
  await expect(
    mobileActions.getByRole('textbox', { name: 'Título do capítulo', exact: true }),
  ).toHaveValue('A vida na guilda');
  await mobileActions
    .getByRole('textbox', { name: 'Descrição do capítulo', exact: true })
    .fill('Descrição ainda no rascunho.');
  await mobileActions
    .getByRole('button', { name: 'Excluir artigo Uma guilda, muitas jornadas', exact: true })
    .click();
  await mobileActions
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir artigo', exact: true })
    .click();
  await expect(
    mobileActions.getByRole('textbox', { name: 'Descrição do capítulo', exact: true }),
  ).toHaveValue('Descrição ainda no rascunho.');
  expect(
    await mobileActions.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await mobileActions.screenshot({
    path: 'test-results/rulebook-actions-mobile.png',
    fullPage: true,
  });
  await mobileActions.close();

  const page = await pageFor();
  await page.getByRole('button', { name: 'Editar conteúdo' }).click();
  await expect(page.getByRole('textbox', { name: 'Título do códice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar capítulo', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Título do capítulo', exact: true })
    .fill('Leis da Vigília');
  await page
    .getByRole('textbox', { name: 'Descrição do capítulo' })
    .fill('Acordos vivos da nossa mesa.');
  await page.getByRole('button', { name: 'Usar símbolo: Espadas', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Usar símbolo: Espadas', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Adicionar primeiro artigo', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título do artigo', exact: true }).fill('Uma mesa unida');
  await page
    .getByRole('textbox', { name: 'Resumo do artigo' })
    .fill('Princípios compartilhados para as próximas aventuras.');
  await page.getByRole('textbox', { name: 'Etiqueta', exact: true }).fill('Acordo da guilda');
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Texto', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Texto', exact: true })
    .fill('Cada voz tem lugar na mesa.\n\nOs acordos podem evoluir com a campanha.');
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Citação / nota', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Título da citação ou nota' }).fill('Acordo da guilda');
  await page
    .getByRole('textbox', { name: 'Texto da citação ou nota' })
    .fill('Respeite cada voz e acolha as diferenças.');
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Lista', exact: true })
    .click();
  await page.getByRole('checkbox', { name: 'Numerar esta lista' }).check();
  await page.getByRole('textbox', { name: 'Item 1', exact: true }).fill('Espaço para todos.');
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Item 2', exact: true })
    .fill('Diálogo antes da decisão.');
  await page.getByRole('button', { name: 'Mover item 1 para baixo', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Item 1', exact: true })).toHaveValue(
    'Diálogo antes da decisão.',
  );
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Tabela', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Título da coluna 1', exact: true }).fill('Situação');
  await page.getByRole('textbox', { name: 'Título da coluna 2', exact: true }).fill('Conduta');
  await page.getByRole('textbox', { name: 'Linha 1, coluna 1', exact: true }).fill('Um desacordo');
  await page.getByRole('textbox', { name: 'Linha 1, coluna 2', exact: true }).fill('Conversar');
  await page.getByRole('button', { name: 'Adicionar coluna', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título da coluna 3', exact: true }).fill('Notas');
  await page.getByRole('textbox', { name: 'Linha 1, coluna 3', exact: true }).fill('Ouvir todos');
  await page.getByRole('button', { name: 'Mover coluna 3 para a esquerda', exact: true }).click();
  await page
    .locator('.rb-block-picker')
    .getByRole('button', { name: 'Imagem', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Excluir bloco 1', exact: true })).toHaveText(
    'Excluir bloco',
  );
  await page.locator('.rb-cover-editor > summary').click();
  uploadDelay = 800;
  await page
    .getByLabel('Arquivo de imagem', { exact: true })
    .setInputFiles({ name: 'retrato.webp', mimeType: 'image/webp', buffer: upload });
  await expect(
    page.getByRole('textbox', { name: 'Imagem — endereço', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Importar códice', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Histórico', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Título do artigo', exact: true }).fill('Uma mesa unida');
  await expect(page.locator('.rb-edit-block .rb-image-preview img')).toHaveAttribute(
    'src',
    imageSrc,
  );
  await expect(page.getByRole('textbox', { name: 'Imagem — endereço', exact: true })).toBeEnabled();
  uploadDelay = 0;
  await page
    .getByRole('textbox', { name: 'Legenda e descrição da imagem' })
    .fill('Ilustração da cuidadora da guilda.');
  await page.getByRole('button', { name: 'Mover bloco 5 para cima', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Título do códice', exact: true })
    .fill('O códice da Vigília');
  await page.getByRole('button', { name: 'Remover capa', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover capa', exact: true }).click();
  await expect(page.locator('.rb-hero')).toHaveAttribute('data-has-cover', 'false');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.rb-edit-state')).toContainText('Tudo salvo');
  expect(document.title).toBe('O códice da Vigília');
  expect(document.cover_image).toBe(null);
  expect(document.chapters.at(-1).symbol).toBe('swords');
  const article = document.chapters.at(-1).articles[0];
  expect(article.blocks.map((block) => block.type)).toEqual([
    'text',
    'callout',
    'list',
    'image',
    'table',
  ]);
  expect(article.blocks.at(-1).columns).toEqual(['Situação', 'Notas', 'Conduta']);
  expect(article.blocks.at(-1).rows[0]).toEqual(['Um desacordo', 'Ouvir todos', 'Conversar']);
  await page.screenshot({ path: 'test-results/rulebook-editor-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Prévia', exact: true }).click();
  await expect(page.locator('.rb-edit-block')).toHaveCount(0);
  await expect(page.locator('.rb-article')).toContainText('Cada voz tem lugar na mesa.');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título do artigo', exact: true }).fill('Texto enviado');
  saveDelay = 800;
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Título do artigo', exact: true })
    .fill('Texto digitado durante o envio');
  await expect(page.locator('.rb-edit-state')).toContainText('Alterações por salvar');
  await expect(page.getByRole('textbox', { name: 'Título do artigo', exact: true })).toHaveValue(
    'Texto digitado durante o envio',
  );
  expect(document.chapters.at(-1).articles[0].title).toBe('Texto enviado');
  saveDelay = 0;
  await page
    .getByRole('textbox', { name: 'Título do artigo', exact: true })
    .fill('Meu rascunho preservado');
  revision++;
  snapshots.set(revision, structuredClone(document));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.rb-conflict')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título do artigo', exact: true })).toHaveValue(
    'Meu rascunho preservado',
  );
  const downloadEvent = page.waitForEvent('download');
  if (!(await page.locator('.rb-cover-editor').evaluate((element) => element.open)))
    await page.locator('.rb-cover-editor > summary').click();
  await page.getByRole('button', { name: 'Exportar códice', exact: true }).click();
  const copy = await downloadEvent;
  await copy.saveAs('test-results/rulebook-draft-export.json');
  expect(
    JSON.parse(await readFile('test-results/rulebook-draft-export.json', 'utf8')).chapters.at(-1)
      .articles[0].title,
  ).toBe('Meu rascunho preservado');
  await page.getByLabel('Arquivo JSON do códice').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(page.getByText(/Este arquivo não é um códice válido/)).toBeVisible();
  const imported = structuredClone(document);
  imported.title = 'Cópia importada';
  await page.getByLabel('Arquivo JSON do códice').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Importar códice', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Título do códice', exact: true })).toHaveValue(
    'Cópia importada',
  );
  await page.close();
  const history = await pageFor();
  await history.getByRole('button', { name: 'Editar conteúdo' }).click();
  await history
    .getByRole('textbox', { name: 'Título do códice', exact: true })
    .fill('Antes da restauração');
  await history.locator('.rb-cover-editor > summary').click();
  await history.getByRole('button', { name: 'Histórico', exact: true }).click();
  await history
    .getByRole('dialog')
    .getByRole('button', { name: /^Versão 0 / })
    .click();
  await history
    .getByRole('dialog')
    .getByRole('button', { name: 'Carregar versão', exact: true })
    .click();
  await expect(history.getByRole('textbox', { name: 'Título do códice', exact: true })).toHaveValue(
    INITIAL_RULEBOOK.title,
  );
  const currentRevision = revision;
  await history.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(history.locator('.rb-edit-state')).toContainText('Tudo salvo');
  expect(puts.at(-1).revision).toBe(currentRevision);
  expect(document.title).toBe(INITIAL_RULEBOOK.title);
  await history.setViewportSize({ width: 390, height: 844 });
  await history.screenshot({ path: 'test-results/rulebook-editor-mobile.png', fullPage: true });
  expect(await history.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
  await history.setViewportSize({ width: 1440, height: 1000 });
  const historyCount = historyResponses;
  historyDelay = 800;
  await history.getByRole('button', { name: 'Histórico', exact: true }).click();
  await history
    .getByRole('dialog')
    .getByRole('button', { name: /^Versão 0 / })
    .click();
  await history.keyboard.press('Escape');
  await expect(history.getByRole('dialog')).toHaveCount(0);
  await history
    .getByRole('textbox', { name: 'Título do códice', exact: true })
    .fill('Editado depois de fechar o histórico');
  await expect.poll(() => historyResponses).toBe(historyCount + 1);
  await expect(history.getByRole('textbox', { name: 'Título do códice', exact: true })).toHaveValue(
    'Editado depois de fechar o histórico',
  );
  historyDelay = 0;
  const large = structuredClone(INITIAL_RULEBOOK);
  large.chapters = [
    {
      id: 'large-chapter',
      title: 'Uma cópia completa',
      description: '',
      articles: [
        {
          id: 'large-first',
          title: 'Apresentação',
          summary: '',
          tag: '',
          blocks: [{ id: 'large-intro', type: 'text', text: 'A cópia continua abaixo.' }],
        },
        {
          id: 'large-tables',
          title: 'Tabelas completas',
          summary: '',
          tag: '',
          blocks: Array.from({ length: 80 }, (_, index) => ({
            id: 'large-table-' + index,
            type: 'table',
            columns: Array(20).fill('abcd'),
            rows: Array.from({ length: 120 }, () => Array(20).fill('abcd')),
          })),
        },
      ],
    },
  ];
  expect(rulebookDocumentSchema.safeParse(large).success).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(large, null, 2))).toBeGreaterThan(2 * 1024 * 1024);
  await history.getByLabel('Arquivo JSON do códice').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(large)),
  });
  await history
    .getByRole('dialog')
    .getByRole('button', { name: 'Importar códice', exact: true })
    .click();
  const largeDownload = history.waitForEvent('download');
  await history.getByRole('button', { name: 'Exportar códice', exact: true }).click();
  await (await largeDownload).saveAs('test-results/rulebook-large-export.json');
  const largeCopy = await readFile('test-results/rulebook-large-export.json');
  expect(largeCopy.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(rulebookDocumentSchema.parse(JSON.parse(largeCopy.toString()))).toEqual(large);
  await history
    .getByLabel('Arquivo JSON do códice')
    .setInputFiles({ name: 'own-export.json', mimeType: 'application/json', buffer: largeCopy });
  await history
    .getByRole('dialog')
    .getByRole('button', { name: 'Importar códice', exact: true })
    .click();
  await expect(history.getByRole('textbox', { name: 'Título do códice', exact: true })).toHaveValue(
    large.title,
  );
  await history.close();
  expect(failures).toEqual([]);
  console.log(
    JSON.stringify({
      reader: true,
      mobile: true,
      editAllBlocks: true,
      tableReorder: true,
      uploads: true,
      uploadPendingProtected: true,
      saveWhileTyping: true,
      cancelledHistoryProtected: true,
      largeExportRoundTrip: true,
      removeCover: true,
      preview: true,
      conflictDraft: true,
      importExport: true,
      historyKeepsCurrentRevision: true,
      directEditDelete: true,
      directMobileActions: true,
      puts: puts.length,
    }),
  );
} finally {
  await browser.close();
  await server.close();
}
