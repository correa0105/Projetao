import 'dotenv/config';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { newToken } from '../shared/vtt';
import { monsterActions } from '../shared/vtt-monster-actions';
import { attackOutcome } from '../shared/vtt-attack';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3045';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3045, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { 'X-Vtt-Schema-Version': '2' },
      }),
    ),
  ),
  [gm, player, spectator] = contexts;
const [page, peer] = await Promise.all([gm.newPage(), player.newPage()]),
  errors: string[] = [];
for (const p of [page, peer]) {
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    const native = HTMLMediaElement.prototype.play;
    (window as any).__cues = [];
    HTMLMediaElement.prototype.play = function () {
      const path = new URL(this.src, location.href).pathname;
      if (
        path.includes('/vtt-attacks/') ||
        path.includes('/vtt-effects/') ||
        path.includes('sfx-knifeslice')
      ) {
        (window as any).__cues.push({ path, volume: this.volume });
        this.addEventListener(
          'error',
          () => {
            (window as any).__cues.push({ error: path });
          },
          { once: true },
        );
      }
      return native.call(this);
    };
  });
}
await mkdir('test-results', { recursive: true });
async function api(ctx: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  return { status: r.status(), data: await r.json() };
}
async function signup(ctx: BrowserContext, name: string) {
  const r = await api(ctx, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  expect(r.status).toBe(200);
  await createLegacyTestCharacter(r.data.user.id, name);
  return r.data.user;
}
try {
  const owner = await signup(gm, 'Mestre'),
    user = await signup(player, 'Jogador'),
    watcher = await signup(spectator, 'Visitante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  let room = (await api(gm, '/vtt', 'POST', { name: 'Ataques e cartões' })).data;
  expect((await api(player, '/vtt/join', 'POST', { invite: room.invite })).status).toBe(200);
  expect(
    (await api(spectator, '/vtt/join', 'POST', { invite: room.invite, role: 'spectator' })).status,
  ).toBe(200);
  room = (await api(gm, '/vtt/rooms/' + room.id)).data;
  const scene = room.document.scenes[0];
  scene.lighting = false;
  scene.fog = false;
  scene.width = 1400;
  scene.height = 1000;
  const actor = {
    ...newToken(randomUUID(), scene),
    name: 'Cavaleiro',
    x: 480,
    y: 450,
    width: 130,
    height: 130,
    controller: owner.id,
    image: '/vtt/monsters/monster-knight.webp',
    sheet: {
      source: 'monster-knight',
      race: '',
      class: '',
      level: 1,
      stats: [16, 16, 16, 10, 10, 10],
      speed: 30,
      biography: '',
      details:
        'Espada longa\nMelee Weapon Attack: +99 to hit. Hit: 1d8 + 3 slashing damage.\nArco longo\nRanged Weapon Attack: +99 to hit. Hit: 1d8 + 3 piercing damage.',
    },
  };
  const target = {
    ...newToken(randomUUID(), scene),
    name: 'Alvo',
    x: 920,
    y: 450,
    width: 120,
    height: 120,
    ac: 0,
    image: '/vtt/monsters/monster-assassin.webp',
  };
  const hero = {
    ...newToken(randomUUID(), scene),
    name: 'Jogador',
    x: 650,
    y: 710,
    width: 100,
    height: 100,
    controller: user.id,
  };
  const hidden = {
    ...newToken(randomUUID(), scene),
    name: 'Segredo',
    x: 1100,
    y: 700,
    hidden: true,
  };
  scene.tokens = [actor, target, hero, hidden];
  const setup = await api(gm, '/vtt/rooms/' + room.id, 'PUT', {
    revision: room.revision,
    document: room.document,
  });
  expect(setup.status, JSON.stringify(setup.data)).toBe(200);
  room = setup.data;
  const root = '/vtt/rooms/' + room.id,
    actions = monsterActions(actor.sheet.details);
  expect(actions.length).toBe(2);
  let bar = (await api(gm, root + '/hotbar')).data;
  actions.forEach(
    (a, i) =>
      (bar.document.pages[0].slots[i] = {
        kind: 'monster',
        tokenId: actor.id,
        sourceId: a.id,
        label: a.name,
      }),
  );
  expect(
    (await api(gm, root + '/hotbar', 'PUT', { revision: bar.revision, document: bar.document }))
      .status,
  ).toBe(200);
  await page.goto(origin + '/#vtt');
  await peer.goto(origin + '/#vtt');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  await expect(peer.getByLabel('Mensagem', { exact: true })).toBeVisible();
  const clickToken = async (p: Page, t: { x: number; y: number }, ctrl = false) => {
    const c = p.getByLabel('Tabuleiro da mesa', { exact: true }),
      b = await c.boundingBox();
    const [x, y, z] = await Promise.all(
      ['x', 'y', 'zoom'].map((k) => c.getAttribute('data-camera-' + k)),
    );
    await c.click({
      position: {
        x: b!.width / 2 + (t.x - Number(x)) * Number(z),
        y: b!.height / 2 + (t.y - Number(y)) * Number(z),
      },
      modifiers: ctrl ? ['Control'] : [],
    });
  };
  // Player-created cards, mixed text/images, malformed fallback, persistence.
  await expect(peer.getByRole('button', { name: 'Arma', exact: true })).toHaveCount(0);
  await expect(peer.getByRole('button', { name: 'Ataque de magia', exact: true })).toHaveCount(0);
  await peer
    .getByLabel('Mensagem', { exact: true })
    .fill(
      '/arma Espada de teste | Dano 1d8. Alcance 1,5 m.\n(Arte)[http://localhost:3045/vtt/monsters/monster-knight.webp]',
    );
  await peer.getByRole('button', { name: 'Enviar à mesa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Espada de teste', exact: true })).toBeVisible();
  await peer
    .getByLabel('Mensagem', { exact: true })
    .fill('/magia Raio de teste | Dano 1d10. <script>nunca executar</script>');
  await peer.getByRole('button', { name: 'Enviar à mesa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raio de teste', exact: true })).toBeVisible();
  expect(await page.locator('.vtt-chat-card script').count()).toBe(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Espada de teste', exact: true })).toBeVisible();
  // Selecting tokens leaves sidebar/drafts and the effects editor intact.
  await page.getByLabel('Mensagem', { exact: true }).fill('Rascunho permanece');
  await clickToken(page, actor, true);
  await expect(page.getByLabel('Mensagem', { exact: true })).toHaveValue('Rascunho permanece');
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await clickToken(page, target, true);
  await expect(page.locator('.vtt-soundboard')).toBeVisible();
  await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
  await page.getByRole('button', { name: 'Criar efeito · Gelo', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Efeitos salvos do mestre' });
  await clickToken(page, hero, true);
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('Nome do efeito')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
  console.log('PASS cards/player/persistence/token selection/editor');
  // Actual Ctrl+wheel rotates the selected token, preserves the camera and sidebar, and saves.
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
  await clickToken(page, actor, true);
  await expect(board).toHaveAttribute('data-selection-ids', actor.id);
  const cameraBefore = await Promise.all(
    ['x', 'y', 'zoom'].map((k) => board.getAttribute('data-camera-' + k)),
  );
  const viewportBefore = await page.evaluate(() => ({
    width: innerWidth,
    scale: visualViewport?.scale,
  }));
  await board.hover();
  await page.keyboard.down('Control');
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 100);
  await page.keyboard.up('Control');
  await expect
    .poll(
      async () =>
        (await api(gm, root)).data.document.scenes[0].tokens.find((t: any) => t.id === actor.id)
          .rotation,
    )
    .toBe(45);
  expect(
    await Promise.all(['x', 'y', 'zoom'].map((k) => board.getAttribute('data-camera-' + k))),
  ).toEqual(cameraBefore);
  expect(await page.evaluate(() => ({ width: innerWidth, scale: visualViewport?.scale }))).toEqual(
    viewportBefore,
  );
  await expect(page.locator('.vtt-soundboard')).toBeVisible();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.getByLabel('Mensagem', { exact: true })).toHaveValue('Rascunho permanece');
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await board.hover();
  await page.keyboard.down('Control');
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect
    .poll(
      async () =>
        (await api(gm, root)).data.document.scenes[0].tokens.find((t: any) => t.id === actor.id)
          .rotation,
    )
    .toBe(0);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => board.getAttribute('data-camera-zoom')).not.toBe(cameraBefore[2]);
  await page.reload();
  await expect(board).toBeVisible();
  expect(
    (await api(gm, root)).data.document.scenes[0].tokens.find((t: any) => t.id === actor.id)
      .rotation,
  ).toBe(0);
  await clickToken(peer, hero, true);
  await expect(peer.getByLabel('Tabuleiro da mesa', { exact: true })).toHaveAttribute(
    'data-selection-ids',
    hero.id,
  );
  const peerBoard = peer.getByLabel('Tabuleiro da mesa', { exact: true });
  await peerBoard.hover();
  await peer.keyboard.down('Control');
  await peer.mouse.wheel(0, -100);
  await peer.keyboard.up('Control');
  await expect
    .poll(
      async () =>
        (await api(player, root)).data.document.scenes[0].tokens.find((t: any) => t.id === hero.id)
          .rotation,
    )
    .toBe(345);
  expect((await api(player, root + '/tokens/' + actor.id, 'PATCH', { rotation: 180 })).status).toBe(
    403,
  );
  console.log('PASS Ctrl+wheel rotation/rapid scroll/inverse/zoom/sidebar/persistence/ownership');
  // Compact categories stay in one row; text can be dragged, undone and restored after reload.
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await expect(
    page.getByText('Arraste um monstro para colocá-lo na mesa.', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/entradas SRD 2024/)).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const tabs = page.getByLabel('Categorias da biblioteca');
    await expect(tabs).toBeVisible();
    const boxes = await tabs.locator('button').evaluateAll((buttons) =>
      buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    expect(boxes.length).toBe(4);
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
    expect(boxes.every((b) => b.height <= 38 && b.width > 0)).toBe(true);
    await page.screenshot({ path: `test-results/vtt-library-compact-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'Som', exact: true }).click();
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await clickToken(page, { x: 750, y: 240 });
  await page.getByLabel('Inserir texto no mapa').locator('textarea').fill('Irineu');
  await page.getByRole('button', { name: 'Inserir texto', exact: true }).click();
  let drawing: any;
  await expect
    .poll(async () => {
      drawing = (await api(gm, root)).data.document.scenes[0].drawings.find(
        (d: any) => d.text === 'Irineu',
      );
      return !!drawing;
    })
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Selecionar (V)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const initial = drawing.points[0];
  const dragText = async (from: { x: number; y: number }, dx: number, dy: number, alt = false) => {
    const box = (await board.boundingBox())!;
    const [cx, cy, zoom] = await Promise.all(
      ['x', 'y', 'zoom'].map((k) => board.getAttribute('data-camera-' + k)),
    );
    const z = Number(zoom),
      x = box.x + box.width / 2 + (from.x - Number(cx)) * z,
      y = box.y + box.height / 2 + (from.y - Number(cy)) * z;
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx * z, y + dy * z, { steps: 8 });
    await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
  };
  await dragText({ x: initial.x + 8, y: initial.y - 8 }, 140, 70);
  const savedPoint = async () =>
    (await api(gm, root)).data.document.scenes[0].drawings.find((d: any) => d.id === drawing.id)
      .points[0];
  await expect.poll(savedPoint).toEqual({ x: initial.x + 140, y: initial.y + 70 });
  await expect(page.locator('.vtt-soundboard')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect.poll(savedPoint).toEqual(initial);
  await dragText({ x: initial.x + 8, y: initial.y - 8 }, 33, 19, true);
  await expect
    .poll(async () => {
      const p = await savedPoint();
      return { x: Math.round(p.x), y: Math.round(p.y) };
    })
    .toEqual({ x: initial.x + 33, y: initial.y + 19 });
  const freePosition = await savedPoint();
  await page.reload();
  await expect(board).toBeVisible();
  expect(await savedPoint()).toEqual(freePosition);
  console.log('PASS compact library/text drag/grid/free movement/undo/save/reload/sidebar');
  // Actual hotbar attack flow: attacker selection, target click, animation/audio.
  await page.getByRole('button', { name: 'Atalho 1 · Espada longa', exact: true }).click();
  await expect(page.getByLabel('Animação do ataque')).toBeVisible();
  expect(
    await page
      .getByLabel('Animação do ataque')
      .locator('option')
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value)),
  ).toEqual(['auto', 'none']);
  await expect(page.getByLabel('Animação do ataque')).not.toContainText('flecha');
  await clickToken(page, target);
  await expect(page.getByRole('button', { name: 'Rolar ataque', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Rolar ataque', exact: true }).click();
  await expect(page.locator('.vtt-attack-visuals')).toHaveAttribute('data-active-attacks', '1');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/vtt-sword-attack.png' });
  await page.waitForTimeout(1100);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__cues.some((s: any) => s.path?.includes('knifeslice'))),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  await page.getByRole('button', { name: 'Atalho 2 · Arco longo', exact: true }).click();
  await expect(page.getByLabel('Animação do ataque')).toBeVisible();
  if (!(await page.getByRole('button', { name: 'Rolar ataque', exact: true }).isEnabled()))
    await clickToken(page, target);
  await expect(page.getByLabel('Animação do ataque')).toHaveValue('auto');
  await page.getByRole('button', { name: 'Rolar ataque', exact: true }).click();
  await expect(page.locator('.vtt-attack-visuals')).toHaveAttribute('data-active-attacks', '1');
  await page.waitForTimeout(470);
  await page.screenshot({ path: 'test-results/vtt-arrow-attack.png' });
  await page.waitForTimeout(1000);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__cues.some((s: any) => s.path?.endsWith('bow-release.wav')),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  console.log('PASS UI sword/bow directional animations/sounds');
  // Cosmetic server event validation; rolls control hit, no automatic HP mutation.
  const command = { actor_id: hero.id, target_id: target.id, kind: 'arrow' };
  const hit = await api(player, root + '/messages', 'POST', {
    text: 'Ataque do jogador',
    formula: '2d20kh1+99',
    attack_visual: command,
  });
  expect(hit.status).toBe(201);
  expect(
    (
      await api(player, root + '/messages', 'POST', {
        formula: '1d20',
        attack_visual: { ...command, weapon: 'axe' },
      })
    ).status,
  ).toBe(400);
  const event = hit.data.messages.find((m: any) => m.id === hit.data.createdMessageId);
  expect(event.attackVisual.hit).toBe(attackOutcome(event.roll, target.ac).hit);
  expect(
    (
      await api(player, root + '/messages', 'POST', {
        formula: '1d20',
        attack_visual: { ...command, actor_id: actor.id },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await api(player, root + '/messages', 'POST', {
        formula: '1d20',
        attack_visual: { ...command, target_id: hidden.id },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await api(player, root + '/messages', 'POST', {
        formula: '1d20',
        attack_visual: { ...command, hit: true },
      })
    ).status,
  ).toBe(400);
  expect(
    (await api(player, root + '/messages', 'POST', { formula: '1d6', attack_visual: command }))
      .status,
  ).toBe(400);
  expect(
    (await api(spectator, root + '/messages', 'POST', { formula: '1d20', attack_visual: command }))
      .status,
  ).toBe(403);
  const secret = await api(gm, root + '/messages', 'POST', {
    formula: '1d20',
    private: true,
    attack_visual: { ...command, actor_id: actor.id },
  });
  expect(secret.status).toBe(201);
  expect(
    (await api(player, root)).data.messages.some((m: any) => m.id === secret.data.createdMessageId),
  ).toBe(false);
  expect(
    (await api(gm, root)).data.document.scenes[0].tokens.find((t: any) => t.id === target.id).hp,
  ).toBe(target.hp);
  console.log('PASS server ownership/visibility/private/d20/hit/no HP mutation');
  // Effect cue, deduplication, local volume/mute, visuals-off persistence.
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await page.getByRole('button', { name: 'Mesa', exact: true }).click();
  await page.getByLabel('Volume dos efeitos e ataques', { exact: true }).fill('30');
  let saved = (await api(gm, root)).data;
  saved.document.effects = [
    {
      id: randomUUID(),
      name: 'Gelo de teste',
      kind: 'frost',
      color: '#9dd7ef',
      scale: 3,
      duration: 0,
    },
  ];
  saved = (await api(gm, root, 'PUT', { revision: saved.revision, document: saved.document })).data;
  expect(
    (
      await api(gm, root + '/effects/' + saved.document.effects[0].id + '/apply', 'POST', {
        tokenId: actor.id,
      })
    ).status,
  ).toBe(200);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__cues.some((s: any) => s.path?.endsWith('/ice.wav'))),
    )
    .toBe(true);
  const count = await page.evaluate(
    () => (window as any).__cues.filter((s: any) => s.path?.endsWith('/ice.wav')).length,
  );
  await page.waitForTimeout(3500);
  expect(
    await page.evaluate(
      () => (window as any).__cues.filter((s: any) => s.path?.endsWith('/ice.wav')).length,
    ),
  ).toBe(count);
  const revision = (await api(gm, root)).data.revision;
  await page.getByLabel('Mostrar efeitos visuais', { exact: true }).uncheck();
  await expect(page.locator('.vtt-attack-visuals')).toHaveCount(0);
  await expect(peer.locator('.vtt-workspace')).toHaveAttribute('data-visual-effects', 'on');
  expect((await api(gm, root)).data.revision).toBe(revision);
  await page.reload();
  await expect(page.locator('.vtt-workspace')).toHaveAttribute('data-visual-effects', 'off');
  await expect(page.locator('.vtt-attack-visuals')).toHaveCount(0);
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await page.getByRole('button', { name: 'Mesa', exact: true }).click();
  await expect(page.getByLabel('Volume dos efeitos e ataques', { exact: true })).toHaveValue('30');
  await page.getByLabel('Som dos efeitos e ataques', { exact: true }).uncheck();
  await api(player, root + '/messages', 'POST', { formula: '1d20+99', attack_visual: command });
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => (window as any).__cues.length)).toBe(0);
  await page.getByLabel('Mostrar efeitos visuais', { exact: true }).check();
  await expect(page.locator('.vtt-attack-visuals')).toHaveAttribute('data-active-attacks', '0');
  await page.getByLabel('Som dos efeitos e ataques', { exact: true }).check();
  await api(player, root + '/messages', 'POST', { formula: '1d20+99', attack_visual: command });
  await expect(page.locator('.vtt-attack-visuals')).toHaveAttribute('data-active-attacks', '1');
  await page.waitForTimeout(1400);
  const cues = await page.evaluate(() => (window as any).__cues);
  expect(cues.some((s: any) => s.path?.endsWith('bow-release.wav'))).toBe(true);
  expect(cues.filter((s: any) => s.error)).toEqual([]);
  expect(cues.every((s: any) => s.volume <= 0.3)).toBe(true);
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (!(await page.getByLabel('Mensagem', { exact: true }).isVisible()))
      await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(page.getByLabel('Mensagem', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
  console.log('PASS effects sound once/mute/volume/local low-PC preference/reload/mobile');
  const manifest = JSON.parse(
    await readFile('public/audio/vtt-attack-effects-manifest.json', 'utf8'),
  );
  for (const a of manifest.files) {
    const response = await gm.request.get(origin + a.path);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBe(a.bytes);
  }
  console.log('PASS 21 original audio files served');
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
