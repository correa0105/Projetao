import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { terrainTextures } from '../shared/vtt-terrain';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/world-pins', { recursive: true });
const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
async function api(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const response = await context.request.fetch(origin + '/api' + path, { method, headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
try {
  const account = await api('/auth/sign-up/email', {
    name: 'Cartógrafo',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [account.user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  await createLegacyTestCharacter(account.user.id, 'Explorador');
  await page.goto(origin + '/#world', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.world-map')).toHaveAttribute('data-status', 'ready', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Reino do Norte', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mapa do Reino do Norte' })).toHaveAttribute(
    'data-status',
    'ready',
    { timeout: 60000 },
  );
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Editar mapa', exact: true })).toHaveCount(0);
  await expect(page.locator('.kingdom-editor')).toHaveCount(0);
  await page.getByRole('button', { name: 'Adicionar pin', exact: true }).click();
  await page.mouse.click(520, 460);
  const modal = page.getByRole('dialog', { name: 'Novo pin do mapa', exact: true });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Nome do local', { exact: true }).fill('Portão das histórias');
  await modal
    .getByLabel('Descrição curta', { exact: true })
    .fill('As aventuras começam neste portão.');
  await modal.getByRole('button', { name: 'Salvar pin', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const drawer = page.getByRole('complementary', {
    name: 'Missões de Portão das histórias',
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'História', exact: true }).click();
  await drawer.getByRole('button', { name: 'Escrever História', exact: true }).click();
  const editor = drawer.getByRole('region', { name: 'Editor de crônica', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Adicionar caixa de texto', exact: true }).click();
  await editor.getByLabel('Tipo de caixa').selectOption('parchment');
  await editor.getByLabel('Título do bloco', { exact: true }).fill('Os viajantes do portão');
  await editor
    .getByLabel('Texto', { exact: true })
    .fill('Uma lembrança das aventuras vividas neste lugar.');
  let releasePreview!: () => void;
  let previewWaiting = false;
  let interceptPreview = true;
  const heldPreview = new Promise<void>((resolve) => (releasePreview = resolve));
  await page.route('**/api/lore/images/*', async (route) => {
    if (interceptPreview) {
      interceptPreview = false;
      previewWaiting = true;
      await heldPreview;
    }
    await route.continue();
  });
  for (let i = 0; i < 3; i++) {
    await editor
      .getByLabel('Enviar imagem para a crônica', { exact: true })
      .setInputFiles('public/stable/paddock-camp-v2.webp');
    await expect(editor.locator('.lore-upload-preview')).toHaveCount(i + 1);
    if (i === 0) {
      await expect.poll(() => previewWaiting).toBe(true);
      await expect(page.locator('[data-asset-loading]')).toHaveCount(0);
      await expect(editor).toBeVisible();
      releasePreview();
    }
  }
  expect(await drawer.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/world-pins/editor-images.png' });
  await editor.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(drawer).toContainText('Os viajantes do portão');
  await page.screenshot({ path: 'test-results/world-pins/story-desktop.png' });
  const atlas = await api('/atlas');
  const place = atlas.locations.find((p: any) => p.name === 'Portão das histórias');
  expect(place.history_preview.length).toBe(3);
  await drawer.getByRole('button', { name: 'Missões', exact: true }).click();
  await drawer.getByRole('button', { name: 'Registrar missão aqui', exact: true }).click();
  const form = page.locator('.board-post-form');
  await expect(form.getByLabel('Reino', { exact: true })).toHaveValue('reino-do-norte');
  await expect(form.getByLabel('Área específica da missão', { exact: true })).toHaveValue(place.id);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar lista de missões', exact: true }).click();
  const pin = page.getByRole('button', { name: 'Missões de Portão das histórias', exact: true });
  await pin.hover();
  const nameBox = await pin.locator('.kingdom-place__name').boundingBox();
  const iconBox = await pin.locator('.kingdom-pin-icon').boundingBox();
  expect(nameBox!.y + nameBox!.height).toBeLessThan(iconBox!.y);
  await expect(pin.locator('.atlas-pin-bubble')).toHaveCount(3);
  await expect
    .poll(() =>
      pin
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/world-pins/pin-hover.png' });
  const before = await pin.boundingBox();
  await page.mouse.move(800, 650);
  await page.mouse.down();
  await page.mouse.move(900, 680, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await pin.boundingBox())!.x).not.toBe(before!.x);
  await page.getByRole('button', { name: 'Ocultar todos os pins', exact: true }).click();
  await expect(page.locator('.kingdom-place')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Mostrar todos os pins', exact: true }),
  ).toBeVisible();
  await pool.query(
    "INSERT INTO board_posts(author_id,kind,status,title,description,location,difficulty,region_id,location_id) VALUES($1,'mission','completed','Retorno ao portão','Uma aventura que já foi concluída neste local.',$2,'Tranquila',$3,$4)",
    [account.user.id, place.name, place.region_id, place.id],
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.world-map')).toHaveAttribute('data-status', 'ready', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Reino do Norte', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mapa do Reino do Norte' })).toHaveAttribute(
    'data-status',
    'ready',
    { timeout: 60000 },
  );
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.kingdom-place')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar todos os pins', exact: true }).click();
  await expect(pin).toBeVisible();
  await pin.click();
  await expect(
    drawer.getByRole('heading', { name: 'Retorno ao portão', exact: true }),
  ).toBeVisible();
  await drawer.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(
    drawer.getByRole('heading', { name: 'Retorno ao portão', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fechar lista de missões', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await page.getByRole('button', { name: 'Abrir missões do Reino do Norte', exact: true }).click();
  const regionDrawer = page.locator('.atlas-missions-drawer');
  await regionDrawer.getByRole('button', { name: 'História', exact: true }).click();
  await expect(
    regionDrawer.getByRole('button', { name: 'Escrever História', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/world-pins/story-mobile.png' });
  await regionDrawer.getByRole('button', { name: 'Fechar lista de missões', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await pin.click();
  await drawer.getByRole('button', { name: 'Excluir pin', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Excluir pin do mapa', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(pin).toBeVisible();
  await drawer.getByRole('button', { name: 'Excluir pin', exact: true }).click();
  const [deletion] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/pin') && r.request().method() === 'DELETE'),
    confirmation.getByRole('button', { name: 'Excluir pin', exact: true }).click(),
  ]);
  expect(deletion.status()).toBe(200);
  await expect(pin).toHaveCount(0);
  await expect(confirmation).toHaveCount(0);
  const preservedPlace = (await api('/atlas')).locations.find((p: any) => p.id === place.id);
  expect(preservedPlace.pin_visible).toBe(false);
  expect(preservedPlace.history_preview).toHaveLength(3);
  expect(
    (await pool.query('SELECT count(*)::int n FROM board_posts WHERE location_id=$1', [place.id]))
      .rows[0].n,
  ).toBe(1);
  await page.screenshot({ path: 'test-results/world-pins/pin-deleted.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: editor antigo ausente; administrador cancela/confirma exclusão do pin sem perder História ou missão; visibilidade, prévias e celular preservados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/world-pins/failure.png' });
  console.log('FAILURE UI', await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
