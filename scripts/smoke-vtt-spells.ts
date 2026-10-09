import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion, vttUpdateMessage } from '../shared/vtt-protocol';
import { spellProfile, preparedSpell } from '../shared/vtt-spells';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3046';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3046, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  [gm, player, spectator] = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
      }),
    ),
  );
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
  const c = await createLegacyTestCharacter(r.data.user.id, name);
  await pool.query('INSERT INTO character_sheets(character_id,choices,prepared) VALUES($1,$2,$3)', [
    c.id,
    'null',
    JSON.stringify(['bless', 'burning-hands', 'fog-cloud', 'magic-missile', 'cure-wounds']),
  ]);
  return { ...r.data.user, character: c };
}
try {
  const owner = await signup(gm, 'Mestre das magias'),
    user = await signup(player, 'Conjurador'),
    watcher = await signup(spectator, 'Visitante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  let room = (await api(gm, '/vtt', 'POST', { name: 'Magias e áreas' })).data;
  const root = '/vtt/rooms/' + room.id;
  const stale = await gm.request.get(origin + '/api' + root, {
    headers: { 'X-Vtt-Schema-Version': '3' },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toBe(vttUpdateMessage);
  expect((await api(player, '/vtt/join', 'POST', { invite: room.invite })).status).toBe(200);
  expect(
    (await api(spectator, '/vtt/join', 'POST', { invite: room.invite, role: 'spectator' })).status,
  ).toBe(200);
  room = (await api(gm, root)).data;
  const scene = room.document.scenes[0];
  scene.lighting = false;
  scene.fog = false;
  scene.width = 1800;
  scene.height = 1200;
  scene.grid = { ...scene.grid, size: 100, scale: 5, unit: 'ft', diagonal: 'euclidean' };
  const caster = {
    ...newToken(randomUUID(), scene),
    name: 'Conjurador',
    x: 400,
    y: 500,
    width: 100,
    height: 100,
    hp: 20,
    maxHp: 20,
    characterId: user.character.id,
    controller: user.id,
  };
  const npc = {
    ...newToken(randomUUID(), scene),
    name: 'Dragão',
    x: 1000,
    y: 500,
    width: 160,
    height: 160,
    hp: 100,
    maxHp: 100,
    controller: owner.id,
    sheet: {
      source: 'custom',
      race: '',
      class: '',
      level: 1,
      stats: [10, 10, 10, 10, 10, 10],
      speed: 30,
      biography: '',
      details:
        'Fire Breath\nDexterity Saving Throw: DC 18, each creature in a 60-foot Cone. 14d6 Fire damage.',
    },
  };
  const a = { ...newToken(randomUUID(), scene), name: 'Alvo A', x: 600, y: 500 },
    b = { ...newToken(randomUUID(), scene), name: 'Alvo B', x: 700, y: 500 },
    hidden = { ...newToken(randomUUID(), scene), name: 'Segredo', x: 500, y: 650, hidden: true };
  scene.tokens = [caster, npc, a, b, hidden];
  const saved = await api(gm, root, 'PUT', { revision: room.revision, document: room.document });
  expect(saved.status, JSON.stringify(saved.data)).toBe(200);
  await pool.query(
    'INSERT INTO vtt_character_links(room_id,character_id,imported_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
    [room.id, user.character.id, user.id],
  );
  await pool.query(
    'INSERT INTO vtt_character_resources(character_id,slots_total,slots_used) VALUES($1,$2,$3)',
    [user.character.id, JSON.stringify(Array(9).fill(10)), JSON.stringify(Array(9).fill(0))],
  );
  const command = (
    name: string,
    slot: number,
    targets: string[] = [],
    points: { x: number; y: number; angle: number }[] = [],
  ) => ({
    actor_id: caster.id,
    scene_id: scene.id,
    spell_id: spellProfile(name)!.id,
    slot,
    targets,
    points,
    idempotency_key: randomUUID(),
  });
  const bless = command('Bless', 3, [a.id, b.id]);
  const one = await api(player, root + '/spells', 'POST', bless);
  expect(one.status, JSON.stringify(one.data)).toBe(201);
  expect(one.data.effect.profile.count).toBe(5);
  expect((await api(player, root + '/spells', 'POST', bless)).data.effect.id).toBe(
    one.data.effect.id,
  );
  expect((await api(player, root + '/sheets/' + caster.id)).data.resources.slots_used[2]).toBe(1);
  expect((await api(player, root + '/spells', 'POST', { ...bless, slot: 2 })).status).toBe(409);
  const bad = command('Bless', 1, [hidden.id]);
  expect((await api(player, root + '/spells', 'POST', bad)).status).toBe(403);
  expect((await api(player, root + '/sheets/' + caster.id)).data.resources.slots_used[0]).toBe(0);
  expect((await api(spectator, root + '/spells', 'POST', command('Bless', 1, [a.id]))).status).toBe(
    403,
  );
  expect(
    (await api(player, root + '/spells', 'POST', { ...command('Bless', 1, [a.id]), free: true }))
      .status,
  ).toBe(403);
  expect(
    (
      await api(
        player,
        root + '/spells',
        'POST',
        command('Fireball', 3, [], [{ x: 700, y: 500, angle: 0 }]),
      )
    ).status,
  ).toBe(403);
  const fog = await api(
    player,
    root + '/spells',
    'POST',
    command('Fog Cloud', 2, [], [{ x: 900, y: 500, angle: 0 }]),
  );
  expect(fog.status, JSON.stringify(fog.data)).toBe(201);
  expect(fog.data.effect.profile.size).toBe(40);
  expect(
    (
      await api(player, root + '/spells/' + fog.data.effect.id, 'PATCH', {
        scene_id: scene.id,
        points: [{ x: 1000, y: 600, angle: 0 }],
      })
    ).status,
  ).toBe(400);
  const moon = await api(gm, root + '/spells', 'POST', {
    ...command('Moonbeam', 2, [], [{ x: 900, y: 500, angle: 0 }]),
    actor_id: npc.id,
    free: true,
  });
  expect(moon.status, JSON.stringify(moon.data)).toBe(201);
  const moved = await api(gm, root + '/spells/' + moon.data.effect.id, 'PATCH', {
    scene_id: scene.id,
    points: [{ x: 1000, y: 600, angle: 0 }],
  });
  expect(moved.status, JSON.stringify(moved.data)).toBe(200);
  expect(moved.data.effect.started).toBe(moon.data.effect.started);
  expect(moved.data.effect.expires).toBe(moon.data.effect.expires);
  expect(moved.data.effect.points[0].x).toBe(1000);
  expect((await api(player, root + '/sheets/' + caster.id)).data.resources.slots_used[1]).toBe(1);
  expect(
    (
      await api(spectator, root + '/spells/' + fog.data.effect.id, 'PATCH', {
        scene_id: scene.id,
        points: [{ x: 600, y: 600, angle: 0 }],
      })
    ).status,
  ).toBe(403);
  let effects = (await api(player, root + '/spells')).data.effects;
  expect(effects.some((e: any) => e.id === one.data.effect.id)).toBe(false);
  expect(effects.some((e: any) => e.id === fog.data.effect.id)).toBe(true);
  const missile = await api(
    player,
    root + '/spells',
    'POST',
    command('Magic Missile', 2, [a.id, a.id, b.id, b.id]),
  );
  expect(missile.status, JSON.stringify(missile.data)).toBe(201);
  expect(
    (await api(player, root + '/spells', 'POST', command('Magic Missile', 2, [a.id]))).status,
  ).toBe(400);
  expect(
    (
      await api(player, root + '/spells', 'POST', {
        ...command('Bless', 1, [a.id]),
        actor_id: npc.id,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await api(
        player,
        root + '/spells',
        'POST',
        command('Bless', 1, [a.id, b.id, caster.id, npc.id]),
      )
    ).status,
  ).toBe(400);
  const breath = await api(gm, root + '/spells', 'POST', {
    actor_id: npc.id,
    scene_id: scene.id,
    action_id: 'action-0',
    slot: 0,
    targets: [],
    points: [{ x: 1000, y: 500, angle: Math.PI }],
    idempotency_key: randomUUID(),
  });
  expect(breath.status, JSON.stringify(breath.data)).toBe(201);
  expect(breath.data.effect.profile.size).toBe(60);
  expect((await api(player, root + '/spells/' + breath.data.effect.id, 'DELETE')).status).toBe(403);
  expect((await api(gm, root + '/spells/' + breath.data.effect.id, 'DELETE')).status).toBe(200);
  const knife = await api(gm, root + '/spells', 'POST', {
    ...command('Ice Knife', 1, [a.id]),
    actor_id: npc.id,
    free: true,
  });
  expect(knife.status, JSON.stringify(knife.data)).toBe(201);
  expect(knife.data.effect.points).toEqual([{ x: a.x, y: a.y, angle: 0 }]);
  const endowed = await api(gm, root + '/spells', 'POST', {
    ...command("Dragon's Breath", 2, [caster.id]),
    free: true,
    variant: 2,
  });
  expect(endowed.status, JSON.stringify(endowed.data)).toBe(201);
  const breathRequest = {
    actor_id: caster.id,
    scene_id: scene.id,
    effect_id: endowed.data.effect.id,
    slot: 0,
    targets: [],
    points: [{ x: caster.x, y: caster.y, angle: 0 }],
    idempotency_key: randomUUID(),
  };
  const exhaled = await api(player, root + '/spells', 'POST', breathRequest);
  expect(exhaled.status, JSON.stringify(exhaled.data)).toBe(201);
  expect(exhaled.data.effect.profile.size).toBe(15);
  expect(exhaled.data.effect.profile.visual.family).toBe('lightning');
  expect(exhaled.data.effect.concentration).toBe(false);
  expect(
    (await api(player, root + '/spells')).data.effects.some(
      (e: any) => e.id === endowed.data.effect.id,
    ),
  ).toBe(true);
  expect(
    (
      await api(player, root + '/spells', 'POST', {
        ...breathRequest,
        actor_id: a.id,
        idempotency_key: randomUUID(),
      })
    ).status,
  ).toBe(403);
  await api(gm, root + '/spells/' + endowed.data.effect.id, 'DELETE');
  expect(
    (
      await api(player, root + '/spells', 'POST', {
        ...breathRequest,
        idempotency_key: randomUUID(),
      })
    ).status,
  ).toBe(409);
  const types = [
    'Bless',
    'Fog Cloud',
    'Spirit Guardians',
    'Wall of Fire',
    'Invisibility',
    'Major Image',
    'Bestow Curse',
  ];
  for (const name of types) {
    const p = preparedSpell(spellProfile(name)!, Math.max(5, spellProfile(name)!.level));
    const targets = p.mode === 'targets' ? [p.range <= 5 ? npc.id : a.id] : [];
    const points = p.mode === 'area' || p.mode === 'point' ? [{ x: 800, y: 500, angle: 0 }] : [];
    const next = await api(gm, root + '/spells', 'POST', {
      ...command(name, Math.max(5, p.level), targets, points),
      actor_id: npc.id,
      free: true,
    });
    expect(next.status, name + JSON.stringify(next.data)).toBe(201);
  }
  const page = await player.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir('test-results', { recursive: true });
  await page.goto(origin + '/#vtt');
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await expect(page.locator('.vtt-scene-spells')).toBeVisible();
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent('vtt-prepare-spell', { detail: { actorId: id, spellId: 'Bless' } }),
      ),
    caster.id,
  );
  await expect(page.getByLabel('Preparação da magia')).toBeVisible();
  await page.getByLabel('Nível do espaço de magia').selectOption('4');
  await expect(page.locator('.vtt-spell-instruction')).toContainText('0/6');
  expect((await api(player, root + '/sheets/' + caster.id)).data.resources.slots_used[3]).toBe(0);
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true }),
    box = (await board.boundingBox())!,
    cx = Number(await board.getAttribute('data-camera-x')),
    cy = Number(await board.getAttribute('data-camera-y')),
    zoom = Number(await board.getAttribute('data-camera-zoom'));
  await board.click({
    position: { x: box.width / 2 + (a.x - cx) * zoom, y: box.height / 2 + (a.y - cy) * zoom },
  });
  await expect(page.locator('.vtt-spell-instruction')).toContainText('1/6');
  await page.screenshot({ path: 'test-results/vtt-spells-targets.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirmar conjuração', exact: true }).click();
  await expect(page.getByLabel('Preparação da magia')).toHaveCount(0);
  expect((await api(player, root + '/sheets/' + caster.id)).data.resources.slots_used[3]).toBe(1);
  await page.reload();
  await expect(page.locator('.vtt-scene-spells')).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      (id) =>
        window.dispatchEvent(
          new CustomEvent('vtt-prepare-spell', {
            detail: { actorId: id, spellId: 'Burning Hands' },
          }),
        ),
      caster.id,
    );
    await expect(page.getByLabel('Preparação da magia')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.getByLabel('Cancelar conjuração').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent('vtt-prepare-spell', { detail: { actorId: id, spellId: 'Fog Cloud' } }),
      ),
    caster.id,
  );
  await expect(page.getByLabel('Preparação da magia')).toBeVisible();
  await page.getByLabel('Nível do espaço de magia').selectOption('3');
  await expect(page.locator('.vtt-spell-footprint')).toContainText('60 pés');
  await page.getByLabel('Cancelar conjuração').click();
  const gmPage = await gm.newPage();
  gmPage.on('pageerror', (e) => errors.push(e.message));
  await gmPage.goto(origin + '/#vtt');
  await expect(gmPage.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await gmPage.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await gmPage.getByLabel('Respingos de sangue', { exact: true }).uncheck();
  await gmPage.getByLabel('Automático ao zerar PV', { exact: true }).uncheck();
  await gmPage.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent('vtt-prepare-spell', { detail: { actorId: id, spellId: 'Blur' } }),
      ),
    npc.id,
  );
  await expect(gmPage.getByLabel('Preparação da magia')).toBeVisible();
  await expect(gmPage.locator('.vtt-notice')).toHaveCount(0);
  const savedSettings = (await api(gm, root)).data.document;
  expect(savedSettings.bloodEnabled).toBe(false);
  expect(savedSettings.automaticDeath).toBe(false);
  await gmPage.getByRole('button', { name: 'Confirmar conjuração', exact: true }).click();
  await expect(gmPage.getByLabel('Preparação da magia')).toHaveCount(0);
  expect(
    (await api(gm, root + '/spells')).data.effects.some(
      (effect: any) => effect.actorId === npc.id && effect.profile.id === 'spell-blur',
    ),
  ).toBe(true);
  await gmPage.close();
  const current = (await api(gm, root)).data;
  current.document.scenes[0].tokens.find((t: any) => t.id === caster.id).hp = 0;
  expect(
    (await api(gm, root, 'PUT', { revision: current.revision, document: current.document })).status,
  ).toBe(200);
  effects = (await api(gm, root + '/spells')).data.effects;
  expect(effects.some((e: any) => e.actorId === caster.id && e.concentration)).toBe(false);
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [owner.id]);
  expect(
    (
      await api(gm, root + '/spells', 'POST', {
        ...command('Fireball', 3, [], [{ x: 800, y: 500, angle: 0 }]),
        actor_id: npc.id,
        free: true,
      })
    ).status,
  ).toBe(403);
  expect(errors).toEqual([]);
  console.log(
    'PASS spell atomic expenditure/idempotency/known spells/ownership/hidden targets/GM revoke',
  );
  console.log(
    'PASS upcast targets/areas/projectile distribution/breath/concentration replacement/death/removal/reload/4 widths',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
