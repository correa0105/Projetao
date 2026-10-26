import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { soundCatalog } from '../shared/vtt-sounds';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { smokeImmersiveAudio } from './smoke-vtt-immersive';
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
const browser = await chromium.launch({ channel: 'msedge', headless: true, args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] }),
  gmctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  }),
  pc = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  });
await gmctx.grantPermissions(['microphone']);
await pc.grantPermissions(['microphone']);
const errors: string[] = [];
await mkdir('test-results', { recursive: true });
for (const c of [gmctx, pc])
  await c.addInitScript(() => {
    const NativeAudio = window.Audio;
    (window as any).__vttAudios = [];
    (window as any).Audio = function (src?: string) {
      const a = new NativeAudio(src);
      const play = a.play.bind(a);
      (a as any).__plays = [];
      a.play = () => {
        const started = Date.now();
        return play().then(() => (a as any).__plays.push(started));
      };
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
  await createLegacyTestCharacter(gm.id, 'Arden');
  await createLegacyTestCharacter(player.id, 'Mira');
  const created = await gmctx.request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'O abrigo da Alvorada' },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const { id: rid, invite } = await created.json();
  async function enter(p: typeof page) {
    const entry = p.getByRole('region', { name: 'Preferências de entrada da mesa' });
    await expect(entry).toBeVisible({ timeout: 30000 });
    await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
    await expect(p.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  }
  await page.goto(origin + '/#vtt?room=' + rid);
  await enter(page);
  const snapshot = async (c = gmctx) =>
    await (await c.request.get(origin + `/api/vtt/rooms/${rid}/sounds`)).json();
  const joined = await pc.request.post(origin + '/api/vtt/join', {
    headers: { Origin: origin },
    data: { invite, role: 'player' },
  });
  expect(joined.ok(), await joined.text()).toBe(true);
  await peer.goto(origin + '/#vtt?room=' + rid);
  await enter(peer);
  for (const p of [page, peer]) {
    await p.getByRole('button', { name: 'Som', exact: true }).click();
    await p.getByRole('button', { name: 'Ativar áudio neste navegador', exact: true }).click();
  }
  const card = (id: string) => page.locator(`[data-sound-id="${id}"]`);
  const media = (p: typeof page, id: string) =>
    p.evaluate(
      (path) =>
        (window as any).__vttAudios
          .filter((a: HTMLAudioElement) => {
            if (a.src.includes('/audio/vtt/')) (a as any).__original = a.src;
            return (a.src || (a as any).__original || '').endsWith(path);
          })
          .map((a: HTMLAudioElement) => ({
            src: a.src,
            paused: a.paused,
            time: a.currentTime,
            volume: a.volume,
            loop: a.loop,
            ready: a.readyState,
            plays: (a as any).__plays as number[],
          })),
      soundCatalog.find((s) => s.id === id)!.path,
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
  await enter(page);
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Atalho 1 · Lareira acesa', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ambientes', exact: true }).click();
  await expect(card('amb-hearth').getByLabel('Volume de Lareira acesa')).toHaveValue('0.31');
  await page.getByRole('button', { name: 'Efeitos', exact: true }).click();
  await page.getByLabel('Buscar sons').fill('Passo 3');
  const step = card('sfx-footstep02');
  await step.getByRole('button', { name: 'Marcar favorito Passo 3', exact: true }).click();
  await page.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(step).toBeVisible();
  await expect(step.getByRole('button', { name: 'Desmarcar favorito Passo 3' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await snapshot()).soundboard.favorites).toContain('sfx-footstep02');
  await step.getByLabel('Repetir', { exact: true }).check();
  await step.getByLabel('Modo de repetição de Passo 3').selectOption('interval');
  await step.getByLabel('Intervalo em segundos de Passo 3').fill('3');
  await expect
    .poll(
      async () =>
        (await snapshot()).soundboard.settings.find((s: any) => s.sourceId === 'sfx-footstep02')
          ?.repeatEvery,
    )
    .toBe(3);
  await step.getByRole('button', { name: 'Fixar Passo 3', exact: true }).click();
  const stepShortcut = page.getByRole('button', { name: 'Atalho 3 · Passo 3', exact: true });
  await expect(stepShortcut).toBeVisible();
  await stepShortcut.click();
  for (const p of [page, peer]) {
    await expect
      .poll(async () => (await media(p, 'sfx-footstep02')).some((a: any) => a.plays.length >= 3), {
        timeout: 13000,
      })
      .toBe(true);
    const interval = (await media(p, 'sfx-footstep02')).find((a: any) => a.plays.length >= 3)!;
    expect(interval.loop).toBe(false);
    for (let i = 1; i < 3; i++) {
      expect(interval.plays[i] - interval.plays[i - 1]).toBeGreaterThan(2600);
      expect(interval.plays[i] - interval.plays[i - 1]).toBeLessThan(3400);
    }
  }
  await expect
    .poll(async () => (await media(peer, 'sfx-footstep02')).every((a: any) => a.paused))
    .toBe(true);
  await page.screenshot({ path: 'test-results/vtt-sounds-favorites-interval.png' });
  await step.getByRole('button', { name: 'Remover Passo 3', exact: true }).click();
  await expect(step).toHaveCount(0);
  await expect
    .poll(async () =>
      (await snapshot()).soundboard.voices.some((v: any) => v.sourceId === 'sfx-footstep02'),
    )
    .toBe(false);
  await expect
    .poll(async () => (await media(peer, 'sfx-footstep02')).every((a: any) => a.paused && !a.src))
    .toBe(true);
  await page.getByRole('button', { name: 'Removidos', exact: true }).click();
  await expect(step).toBeVisible();
  await expect(step.getByRole('button', { name: 'Tocar Passo 3' })).toHaveCount(0);
  await expect(stepShortcut).toBeVisible();
  await step.getByRole('button', { name: 'Restaurar Passo 3', exact: true }).click();
  await page.reload();
  await enter(page);
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await page.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(step).toBeVisible();
  await expect(step.getByLabel('Intervalo em segundos de Passo 3')).toHaveValue('3');
  await expect(stepShortcut).toBeVisible();
  await step.getByRole('button', { name: 'Desmarcar favorito Passo 3', exact: true }).click();
  await expect(step).toHaveCount(0);
  await page.getByRole('button', { name: 'Efeitos', exact: true }).click();
  await page.getByLabel('Buscar sons').fill('porta de aço');
  await expect(card('sfx-steel-door-open')).toBeVisible();
  await expect(card('sfx-steel-door-close')).toBeVisible();
  await page.getByLabel('Buscar sons').fill('');
  await page.getByRole('button', { name: 'Ambientes', exact: true }).click();
  await expect(card('amb-tense-dungeon')).toBeVisible();

  // Decode every new file in the browser, then exercise actual shared playback.
  const dungeon = soundCatalog.filter(
    (s) => s.id.startsWith('sfx-dungeon-') || s.id.startsWith('amb-dungeon-'),
  );
  expect(dungeon).toHaveLength(40);
  const decoded = await page.evaluate(async (entries) => {
    const audio = new AudioContext();
    try {
      const results = [];
      for (const e of entries) {
        const response = await fetch(e.path);
        if (!response.ok) throw Error('Audio HTTP ' + e.id);
        const buffer = await audio.decodeAudioData(await response.arrayBuffer());
        let peak = 0,
          shortRms = 0;
        const frame = Math.round(buffer.sampleRate * 0.05);
        for (let i = 0; i < buffer.length; i += frame) {
          let power = 0,
            count = 0;
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const samples = buffer.getChannelData(c);
            for (let j = i; j < Math.min(i + frame, buffer.length); j++) {
              const sample = samples[j];
              if (!Number.isFinite(sample)) throw Error('Invalid PCM ' + e.id);
              peak = Math.max(peak, Math.abs(sample));
              power += sample * sample;
              count++;
            }
          }
          shortRms = Math.max(shortRms, Math.sqrt(power / count));
        }
        results.push({
          id: e.id,
          channels: buffer.numberOfChannels,
          duration: buffer.duration,
          peak,
          shortRms,
          path: e.path,
        });
      }
      return results;
    } finally {
      await audio.close();
    }
  }, dungeon);
  for (const result of decoded) {
    expect(result.channels).toBe(2);
    expect(
      Math.abs(result.duration - dungeon.find((s) => s.id === result.id)!.duration),
    ).toBeLessThan(0.01);
    if (result.path.includes('-r2-20261025')) {
      expect(result.peak).toBeLessThan(0.4);
      expect(result.shortRms).toBeLessThan(0.1);
    }
  }
  await page.getByRole('button', { name: 'Efeitos', exact: true }).click();
  await page.getByLabel('Categoria de som').selectOption('Desabamentos');
  await expect(page.locator('[data-sound-id]')).toHaveCount(7);
  await page.getByLabel('Categoria de som').selectOption('Armadilhas');
  await expect(page.locator('[data-sound-id]')).toHaveCount(9);
  await page.getByLabel('Categoria de som').selectOption('Todas');
  await page.getByLabel('Buscar sons').fill('masmorra');
  for (const e of dungeon.filter((s) => s.kind === 'effect'))
    await expect(card(e.id)).toHaveCount(1);
  await page.getByLabel('Buscar sons').fill('teto desabando');
  const collapse = card('sfx-dungeon-ceiling-collapse');
  const privateBefore = (await snapshot()).revision;
  await collapse.getByRole('button', { name: 'Ouvir prévia de Teto desabando' }).click();
  await expect
    .poll(async () =>
      (await media(page, 'sfx-dungeon-ceiling-collapse')).some(
        (a: any) => a.ready >= 3 && a.time > 0.1,
      ),
    )
    .toBe(true);
  expect((await snapshot()).revision).toBe(privateBefore);
  expect(await media(peer, 'sfx-dungeon-ceiling-collapse')).toHaveLength(0);
  await page.getByRole('button', { name: 'Parar prévia', exact: true }).click();
  await collapse.getByRole('button', { name: 'Fixar Teto desabando', exact: true }).click();
  await collapse
    .getByRole('button', { name: 'Marcar favorito Teto desabando', exact: true })
    .click();
  await page.getByRole('button', { name: 'Atalho 4 · Teto desabando', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await media(peer, 'sfx-dungeon-ceiling-collapse')).some(
          (a: any) => a.ready >= 3 && a.time > 0.1,
        ),
      { timeout: 12000 },
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Parar todos', exact: true }).click();
  for (const id of [
    'secret-door-open',
    'pressure-plate',
    'distant-tremor',
    'earthquake',
    'giant-footsteps',
    'floor-fissure',
    'giant-roar',
  ]) {
    const e = dungeon.find((s) => s.id === 'sfx-dungeon-' + id)!;
    await page.getByLabel('Buscar sons').fill(e.name);
    await card(e.id)
      .getByRole('button', { name: 'Tocar ' + e.name, exact: true })
      .click();
    await expect
      .poll(async () => (await media(peer, e.id)).some((a: any) => a.ready >= 3 && a.time > 0.1), {
        timeout: 12000,
      })
      .toBe(true);
    await page.getByRole('button', { name: 'Parar todos', exact: true }).click();
  }
  await page.getByLabel('Buscar sons').fill('');
  await page.getByRole('button', { name: 'Ambientes', exact: true }).click();
  await page.getByLabel('Categoria de som').selectOption('Masmorras');
  await expect(page.locator('[data-sound-id]')).toHaveCount(4);
  await card('amb-dungeon-dripping-cells')
    .getByRole('button', { name: 'Tocar Masmorra úmida com goteiras', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await media(peer, 'amb-dungeon-dripping-cells')).some(
          (a: any) => a.ready >= 3 && a.time > 0.1 && a.loop,
        ),
      { timeout: 12000 },
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Parar todos', exact: true }).click();
  await page.reload();
  await enter(page);
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await page.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(collapse).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Atalho 4 · Teto desabando', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page
    .getByLabel('Mensagem', { exact: true })
    .fill('(Mapa de exemplo)[/profile-signboard-v1.webp]');
  await page.getByRole('button', { name: 'Enviar à mesa', exact: true }).click();
  const chatImage = page.getByRole('img', { name: 'Mapa de exemplo', exact: true });
  await expect(chatImage).toBeVisible();
  await expect
    .poll(async () =>
      chatImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Som', exact: true }).click();
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
  const immersive = await smokeImmersiveAudio(page,peer);
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
        immersive,
        dungeonDecoded: decoded,
        dungeonSharedPlayback: true,
        sharedPlayback: true,
        previewPrivate: true,
        hotbarClickKeyboardDrag: true,
        persistedVolume: true,
        favoritesPersisted: true,
        removalAndRestore: true,
        intervalSeconds: 3,
        sharedIntervalPlayback: true,
        chatImages: true,
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
