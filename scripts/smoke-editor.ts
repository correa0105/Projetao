import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';

// Run the production UI against a separate app instance. Only this test
// instance substitutes the editor email; server/index.ts always uses the
// fixed account from shared/kingdom-editor.ts.
const probe = createServer();
await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
const address = probe.address();
if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');
const base = `http://127.0.0.1:${address.port}`;
await new Promise<void>((resolve) => probe.close(() => resolve()));
process.env.APP_ORIGIN = base;
process.env.BETTER_AUTH_URL = base;

const [{ createApp }, { pool }] = await Promise.all([
  import('../server/app.js'),
  import('../server/db.js'),
]);
const email = `editor-browser-${randomUUID()}@example.test`;
const app = createApp({ kingdomEditorEmail: email });
const server = app.listen(address.port, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
let userId: string | null = null;
try {
  const signup = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { Origin: base },
    data: { name: 'Editor de teste', email, password: `Editor-${randomUUID()}` },
  });
  expect(signup.status()).toBe(200);
  userId = (await signup.json()).user.id;
  const character = await context.request.post(`${base}/api/characters`, {
    headers: { Origin: base },
    data: {
      name: 'Cartógrafo',
      race: 'Elfo',
      class: 'Patrulheiro',
      stats: [15, 14, 13, 12, 10, 8],
    },
  });
  expect(character.status()).toBe(201);
  await page.goto(`${base}/#world`);
  const north = page.getByRole('button', { name: 'Reino do Norte', exact: true });
  await expect(north).toBeVisible({ timeout: 30000 });
  await north.click();
  const map = page.locator('.kingdom-map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30000 });
  await map.getByRole('button', { name: 'Editar mapa' }).click();
  const editor = map.getByRole('complementary', { name: 'Editor do mapa do reino' });
  await expect(editor).toBeVisible();
  const zoom = editor.getByRole('slider', { name: 'Zoom de trabalho' });
  await zoom.fill('700');
  expect(Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1);
  await editor.getByRole('button', { name: 'Restaurar visão inicial' }).click();

  const image = await sharp({
    create: { width: 2048, height: 1536, channels: 3, background: '#728266' },
  })
    .png()
    .toBuffer();
  await editor.locator('input[type=file]').setInputFiles({
    name: 'fundo.png',
    mimeType: 'image/png',
    buffer: image,
  });
  await expect(map).toHaveAttribute('data-image-width', '2048');
  await expect(map).toHaveAttribute('data-image-height', '1536');
  await expect(map).toHaveAttribute('data-tilt', '1');
  await editor.getByRole('button', { name: 'Remover fundo (área vazia)' }).click();
  await expect(map).toHaveAttribute('data-custom-background', 'false');
  await expect(map).toHaveAttribute('data-image-width', '4096');
  await expect(map).toHaveAttribute('data-image-height', '3072');
  await expect(map).toHaveAttribute('data-tilt', '0.58');
  await expect(editor).toContainText('A área do mapa está vazia');
  console.log('Editor visual OK: acesso, zoom, upload proporcional e restauração vazia.');
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (userId) await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await pool.end();
}
