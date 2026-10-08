import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { soundCatalog } from '../shared/vtt-sounds';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(3004, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  gmctx = await browser.newContext({ viewport: { width: 1440, height: 950 } }),
  pc = await browser.newContext({ viewport: { width: 1280, height: 850 } });
const errors: string[] = [];
await mkdir('test-results', { recursive: true });
for (const c of [gmctx, pc])
  await c.addInitScript(() => {
    const NativeAudio = window.Audio;
    (window as any).__vttAudios = [];
    (window as any).Audio = function (src?: string) {
      const a = new NativeAudio(src);
      (window as any).__vttAudios.push(a);
      return a;
    };
    window.Audio.prototype = NativeAudio.prototype;
    localStorage.setItem('alvorada-music-muted', 'false');
    localStorage.setItem('alvorada-effects-muted', 'false');
    localStorage.setItem('alvorada-music-volume', '.7');
    localStorage.setItem('alvorada-effects-volume', '.7');
  });
const page = await gmctx.newPage(),
  peer = await pc.newPage();
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
try {
  async function signup(c: typeof gmctx, name: string) {
    const r = await c.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: { name, email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() },
    });
    expect(r.ok()).toBe(true);
    return (await r.json()).user;
  }
  const gm = await signup(gmctx, 'Mestre dos sons'),
    player = await signup(pc, 'Viajante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [gm.id]);
  await createLegacyTestCharacter(gm.id, 'Arden');
  await createLegacyTestCharacter(player.id, 'Mira');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('O abrigo da Alvorada');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const rows = await pool.query('SELECT id,invite FROM vtt_rooms WHERE owner_id=$1', [gm.id]);
  const rid = rows.rows[0].id,
    invite = rows.rows[0].invite;
  const snapshot = async (c = gmctx) =>
    await (await c.request.get(origin + `/api/vtt/rooms/${rid}/sounds`)).json();
  await pc.request.post(origin + '/api/vtt/join', {
    headers: { Origin: origin },
    data: { invite, role: 'player' },
  });
  await peer.goto(origin + '/#vtt');
  await expect(peer.locator('.vtt-workspace')).toBeVisible();
  for (const p of [page, peer]) {
    await p.getByRole('button', { name: 'Som', exact: true }).click();
    await p.getByRole('button', { name: 'Ativar áudio neste navegador', exact: true }).click();
  }
  const card = (id: string) => page.locator(`[data-sound-id="${id}"]`);
  const media = (p: typeof page, id: string) =>
    p.evaluate(
      (id) =>
        (window as any).__vttAudios
          .filter((a: HTMLAudioElement) => {
            if (a.src.includes('/audio/vtt/')) (a as any).__original = a.src;
            return (a.src || (a as any).__original || '').endsWith('/' + id + '.ogg');
          })
          .map((a: HTMLAudioElement) => ({
            src: a.src,
            paused: a.paused,
            time: a.currentTime,
            volume: a.volume,
            loop: a.loop,
            ready: a.readyState,
          })),
      id,
    );
  const before = await snapshot();
  await card('music-old-inn')
    .getByRole('button', { name: 'Ouvir prévia de A antiga taverna' })
    .click();
  await expect(page.getByRole('button', { name: 'Parar prévia', exact: true })).toBeVisible();
  expect((await snapshot()).revision).toBe(before.revision);
  await page.getByRole('button', { name: 'Parar prévia', exact: true }).click();
  await card('music-old-inn')
    .getByRole('button', { name: 'Tocar A antiga taverna', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await media(peer, 'music-old-inn')).some(
          (a: any) => !a.paused && a.ready >= 3 && a.time > 0.1,
        ),
      { timeout: 12000 },
    )
    .toBe(true);
  await card('music-old-inn').getByLabel('Volume de A antiga taverna').fill('0.24');
  await expect
    .poll(
      async () =>
        (await snapshot()).soundboard.settings.find((s: any) => s.sourceId === 'music-old-inn')
          ?.volume,
    )
    .toBe(0.24);
  await page.getByRole('button', { name: 'Ambientes', exact: true }).click();
  await card('amb-hearth')
    .getByRole('button', { name: 'Tocar Lareira acesa', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await media(peer, 'amb-hearth')).some((a: any) => !a.paused && a.ready >= 3 && a.loop),
      { timeout: 12000 },
    )
    .toBe(true);
  await card('amb-hearth').getByLabel('Volume de Lareira acesa').fill('0.31');
  await expect
    .poll(
      async () =>
        (await snapshot()).soundboard.settings.find((s: any) => s.sourceId === 'amb-hearth')
          ?.volume,
    )
    .toBe(0.31);
  await card('amb-hearth')
    .getByRole('button', { name: 'Fixar Lareira acesa', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Atalho 1 · Lareira acesa', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Atalho 1 · Lareira acesa', exact: true }).click();
  await expect
    .poll(async () =>
      (await snapshot()).soundboard.voices.some((v: any) => v.sourceId === 'amb-hearth'),
    )
    .toBe(false);
  await page
    .locator('canvas[aria-label="Tabuleiro da mesa"]')
    .click({ position: { x: 100, y: 100 } });
  await page.keyboard.press('1');
  await expect
    .poll(async () =>
      (await snapshot()).soundboard.voices.some((v: any) => v.sourceId === 'amb-hearth'),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Efeitos', exact: true }).click();
  await page.getByLabel('Buscar sons').fill('abrir porta');
  const door = card('sfx-dooropen-1');
  await door
    .getByRole('button', { name: 'Fixar Abrir porta 1', exact: true })
    .dragTo(page.getByRole('button', { name: 'Atalho 2 · vazio', exact: true }));
  await expect(
    page.getByRole('button', { name: 'Atalho 2 · Abrir porta 1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Atalho 2 · Abrir porta 1', exact: true }).click();
  await expect
    .poll(async () => (await media(peer, 'sfx-dooropen-1')).length, { timeout: 12000 })
    .toBe(1);
  await page.getByRole('button', { name: 'Atalho 2 · Abrir porta 1', exact: true }).click();
  await expect
    .poll(async () => (await media(peer, 'sfx-dooropen-1')).length, { timeout: 12000 })
    .toBe(2);
  expect((await media(peer, 'music-old-inn')).filter((a: any) => a.src && a.loop).length).toBe(1);
  await page.getByLabel('Buscar sons').fill('');
  await page.getByRole('button', { name: 'Ambientes', exact: true }).click();
  await page.screenshot({ path: 'test-results/vtt-sound-library-desktop.png' });
  await page.getByRole('button', { name: 'Parar todos', exact: true }).click();
  await expect.poll(async () => (await snapshot()).soundboard.voices.length).toBe(0);
  await expect
    .poll(async () => (await media(peer, 'amb-hearth')).every((a: any) => a.paused))
    .toBe(true);
  expect(
    (await snapshot()).soundboard.settings.find((s: any) => s.sourceId === 'amb-hearth').volume,
  ).toBe(0.31);
  await page.reload();
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Atalho 1 · Lareira acesa', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ambientes', exact: true }).click();
  await expect(card('amb-hearth').getByLabel('Volume de Lareira acesa')).toHaveValue('0.31');
  const sizes = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (!(await page.getByLabel('Buscar sons').isVisible()))
      await page.getByRole('button', { name: 'Som', exact: true }).click();
    await expect(page.getByLabel('Buscar sons')).toBeVisible();
    const bounds = await page
      .locator('.vtt-soundboard')
      .evaluate((e) => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
    if (width < 700) {
      const panel = await page.locator('.vtt-panel').boundingBox(),
        hotbar = await page.locator('.vtt-hotbar-slots').boundingBox();
      expect(panel!.y + panel!.height).toBeLessThan(hotbar!.y);
    }
    sizes.push({ viewport: width, ...bounds });
    await page.screenshot({ path: `test-results/vtt-sound-library-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByRole('button', { name: 'Atalho 1 · Lareira acesa', exact: true }).click();
  await expect.poll(async () => (await snapshot()).soundboard.voices.length).toBe(1);
  await page.goto(origin + '/#characters');
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (window as any).__vttAudios.every(
          (a: HTMLAudioElement) => a.paused && !a.getAttribute('src'),
        ),
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/vtt-sounds-browser.json',
    JSON.stringify(
      {
        catalog: soundCatalog.length,
        sharedPlayback: true,
        previewPrivate: true,
        hotbarClickKeyboardDrag: true,
        persistedVolume: true,
        cleanup: true,
        sizes,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      catalog: soundCatalog.length,
      sharedPlayback: true,
      hotbar: true,
      responsive: sizes,
      errors,
    }),
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
