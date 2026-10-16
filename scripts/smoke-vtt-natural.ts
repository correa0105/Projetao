import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import path from 'node:path';
import { newToken } from '../shared/vtt';
import { monsterActions } from '../shared/vtt-monster-actions';
import { naturalStyles, weaponStyleNames } from '../shared/vtt-attack-visual';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3075';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3075, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const gm = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  }),
  player = await browser.newContext({
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  });
await gm.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
const page = await gm.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/vtt-natural', { recursive: true });
await writeFile('test-results/vtt-natural/result.json', JSON.stringify({ passed: false }));
async function api(c: BrowserContext, p: string, data?: unknown, method = 'POST') {
  const r = await c.request.fetch(origin + '/api' + p, {
    method,
    headers: { Origin: origin },
    data,
  });
  return { status: r.status(), data: await r.json() };
}
async function signup(c: BrowserContext, name: string) {
  const r = await api(c, '/auth/sign-up/email', {
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
    visitor = await signup(player, 'Jogador');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  let room = (await api(gm, '/vtt', { name: 'Ataques naturais' })).data;
  expect((await api(player, '/vtt/join', { invite: room.invite })).status).toBe(200);
  room = (await api(gm, '/vtt/rooms/' + room.id, undefined, 'GET')).data;
  const root = '/vtt/rooms/' + room.id,
    scene = room.document.scenes[0];
  scene.fog = false;
  scene.lighting = false;
  scene.width = 1400;
  scene.height = 1000;
  const details =
    'Bite\nAtaque corpo a corpo +99. Acerto: 1d6 + 1 piercing damage.\nRend\nAtaque corpo a corpo +99. Acerto: 1d6 + 1 slashing damage.\nTail\nAtaque corpo a corpo +99. Acerto: 1d6 + 1 bludgeoning damage.';
  const actor = {
    ...newToken(randomUUID(), scene),
    name: 'Adult Black Dragon',
    x: 500,
    y: 450,
    width: 180,
    height: 180,
    controller: owner.id,
    image: '/vtt/monsters/monster-adult-black-dragon.webp',
    sheet: {
      source: 'monster-adult-black-dragon',
      race: '',
      class: '',
      level: 1,
      stats: [18, 16, 16, 12, 12, 12],
      speed: 30,
      biography: '',
      details,
    },
  };
  const target = {
    ...newToken(randomUUID(), scene),
    name: 'Irineu',
    x: 760,
    y: 260,
    width: 110,
    height: 110,
    ac: 0,
    hp: 100,
    image: '/vtt/monsters/monster-knight.webp',
  };
  scene.tokens = [actor, target];
  const setup = await api(gm, root, { revision: room.revision, document: room.document }, 'PUT');
  expect(setup.status, JSON.stringify(setup.data)).toBe(200);
  room = setup.data;
  const actions = monsterActions(details);
  expect(actions.length).toBe(3);
  const bar = (await api(gm, root + '/hotbar', undefined, 'GET')).data;
  actions.forEach((a, i) => {
    bar.document.pages[0].slots[i] = {
      kind: 'monster',
      tokenId: actor.id,
      sourceId: a.id,
      label: a.name,
    };
  });
  const savedBar = await api(
    gm,
    root + '/hotbar',
    { revision: bar.revision, document: bar.document },
    'PUT',
  );
  expect(savedBar.status, JSON.stringify(savedBar.data)).toBe(200);
  await page.goto(origin + '/#vtt');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  async function selectTarget() {
    const b = (await board.boundingBox())!;
    const [x, y, z] = await Promise.all(
      ['x', 'y', 'zoom'].map((k) => board.getAttribute('data-camera-' + k)),
    );
    await board.click({
      position: {
        x: b.width / 2 + (target.x - Number(x)) * Number(z),
        y: b.height / 2 + (target.y - Number(y)) * Number(z),
      },
    });
  }
  for (const [index, name, label] of [
    [0, 'Bite', 'Mordida'],
    [1, 'Rend', 'Garras'],
    [2, 'Tail', 'Cauda'],
  ] as const) {
    await page.getByRole('button', { name: `Atalho ${index + 1} · ${name}`, exact: true }).click();
    await expect(page.getByLabel('Animação do ataque')).toContainText(label);
    if (await page.getByRole('button', { name: 'Rolar ataque', exact: true }).isDisabled())
      await selectTarget();
    await page.getByRole('button', { name: 'Rolar ataque', exact: true }).click();
    await expect(page.locator('.vtt-attack-visuals')).toHaveAttribute('data-active-attacks', '1');
    await page.waitForTimeout(360);
    await page.screenshot({ path: `test-results/vtt-natural/actual-${name}.png` });
    await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
    await page.waitForTimeout(950);
  }
  const messages = (await api(gm, root, undefined, 'GET')).data.messages;
  expect(
    messages
      .filter((m: any) => m.attackVisual?.kind === 'natural')
      .map((m: any) => m.attackVisual.weapon)
      .sort(),
  ).toEqual(['bite', 'claw', 'tail']);
  expect(
    (await api(gm, root, undefined, 'GET')).data.document.scenes[0].tokens.find(
      (t: any) => t.id === target.id,
    ).hp,
  ).toBe(100);
  for (const weapon of naturalStyles) {
    const r = await api(gm, root + '/messages', {
      formula: '1d20+99',
      attack_visual: { actor_id: actor.id, target_id: target.id, kind: 'natural', weapon },
    });
    expect(r.status).toBe(201);
  }
  expect(
    (
      await api(player, root + '/messages', {
        formula: '1d20',
        attack_visual: {
          actor_id: actor.id,
          target_id: target.id,
          kind: 'natural',
          weapon: 'bite',
        },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await api(gm, root + '/messages', {
        formula: '1d6',
        attack_visual: {
          actor_id: actor.id,
          target_id: target.id,
          kind: 'natural',
          weapon: 'bite',
        },
      })
    ).status,
  ).toBe(400);
  // Exercise the actual renderer at fixed times for visual QA, movement and previous weapons.
  const rendered = await build({
    entryPoints: ['src/vtt-weapon-animation.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'NaturalQA',
    platform: 'browser',
  });
  const oldSource = execFileSync(
    'git',
    [
      '-C',
      path.resolve(process.env.VTT_QA_SOURCE_REPO || '.'),
      'show',
      'HEAD:src/vtt-weapon-animation.ts',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  const old = await build({
    stdin: { contents: oldSource, resolveDir: path.resolve('src'), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'PreviousQA',
    platform: 'browser',
  });
  const galleryContext = await browser.newContext({ bypassCSP: true }),
    gallery = await galleryContext.newPage();
  await gallery.goto(origin);
  await gallery.setContent(
    '<style>body{margin:0;background:#171b20;color:#cbbd9f;font:14px Georgia}main{display:grid;grid-template-columns:repeat(4,1fr);padding:20px;gap:12px}section{background:#20272b;border:1px solid #9c865a55;text-align:center;padding:10px}canvas{width:230px;height:180px;background:radial-gradient(#3f4848,#20272b)}</style><main></main>',
  );
  await gallery.addScriptTag({ content: rendered.outputFiles![0].text });
  await gallery.addScriptTag({ content: old.outputFiles![0].text });
  await gallery.addScriptTag({ content: 'window.__name = (value, name) => value;' });
  const stats = await gallery.evaluate(
    async ({ styles, names }) => {
      const current = (window as any).NaturalQA,
        previous = (window as any).PreviousQA;
      await current.preloadNaturalArt();
      await new Promise((r) => setTimeout(r, 300));
      const sample = (style: string, age: number, legacy = false) => {
        const c = document.createElement('canvas');
        c.width = 460;
        c.height = 360;
        const ctx = c.getContext('2d')!;
        ctx.scale(2, 2);
        const e = {
          id: style,
          sceneId: 'test',
          kind: styles.includes(style as any)
            ? 'natural'
            : style === 'bow' || style === 'crossbow'
              ? 'arrow'
              : 'sword',
          weapon: style,
          source: { x: 45, y: 90 },
          target: { x: 135, y: 90 },
          radius: 43,
          hit: true,
          critical: false,
          started: 0,
        };
        (legacy ? previous : current).drawWeaponAnimation(ctx, e, age);
        return c;
      };
      const rows = [];
      for (const style of styles) {
        const section = document.createElement('section'),
          name = document.createElement('div');
        name.textContent = names[style];
        section.append(name);
        const c = sample(style, 550);
        section.append(c);
        document.querySelector('main')!.append(section);
        const a = sample(style, 260).getContext('2d')!.getImageData(0, 0, 460, 360).data,
          b = c.getContext('2d')!.getImageData(0, 0, 460, 360).data;
        let changed = 0,
          visible = 0;
        for (let i = 3; i < a.length; i += 4) {
          if (a[i] !== b[i]) changed++;
          if (b[i]) visible++;
        }
        rows.push({ style, changed, visible });
      }
      const preserved = [];
      for (const style of ['sword', 'axe', 'mace', 'spear', 'dagger', 'bow', 'crossbow'])
        for (const age of [250, 550, 900]) {
          const a = sample(style, age).getContext('2d')!.getImageData(0, 0, 460, 360).data,
            b = sample(style, age, true).getContext('2d')!.getImageData(0, 0, 460, 360).data;
          let changed = 0;
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++;
          preserved.push({ style, age, changed });
        }
      const times = [];
      for (let i = 0; i < 40; i++) {
        const start = performance.now();
        sample(styles[i % styles.length], 300 + i * 10);
        times.push(performance.now() - start);
      }
      return { rows, preserved, p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] };
    },
    { styles: [...naturalStyles], names: weaponStyleNames },
  );
  expect(stats.rows.every((r) => r.visible > 200 && r.changed > 100)).toBe(true);
  expect(stats.preserved.every((r) => r.changed === 0)).toBe(true);
  expect(stats.p95).toBeLessThan(50);
  await gallery.setViewportSize({ width: 1100, height: 1000 });
  await gallery.screenshot({ path: 'test-results/vtt-natural/gallery.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await api(gm, root + '/messages', {
    formula: '1d20',
    attack_visual: { actor_id: actor.id, target_id: target.id, kind: 'natural', weapon: 'bite' },
  });
  expect(reduced.status).toBe(201);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/vtt-natural/result.json',
    JSON.stringify(
      {
        passed: true,
        ui: ['bite', 'claw', 'tail'],
        naturalStyles: [...naturalStyles],
        errors,
        stats,
        noHpMutation: true,
        serverOwnership: true,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS natural attacks: actual hotbar/automatic selection/server validation; thirteen textured families; motion; 21 old weapon frames identical; no HP changes.',
  );
} finally {
  await gm.close();
  await player.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
