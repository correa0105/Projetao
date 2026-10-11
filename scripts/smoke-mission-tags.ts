import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3005';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js'),
  { createApp } = await import('../server/app.js');
const server = createApp().listen(3005, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results', { recursive: true });
const errors: string[] = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1868, height: 940 },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // The built app and every API response are real; public media comes from the exact reviewed source tree.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.continue();
    const file = resolve('public', '.' + decodeURIComponent(url.pathname));
    if (file.startsWith(resolve('public')) && (await stat(file).catch(() => null))?.isFile())
      return route.fulfill({ path: file });
    return route.continue();
  });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Admin de tags',
      email: 'tags-ui-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [uid]);
  const character = await createLegacyTestCharacter(uid, 'Arden'),
    sibling = await createLegacyTestCharacter(uid, 'Mira');
  await page.goto(origin + '/#achievements');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tags da jornada' })).toBeVisible();
  await page.getByRole('button', { name: 'Administrar tags', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'Administrar tags e conquistas' });
  await expect(manager).toBeVisible();
  const initialTags = await page.request
    .get(origin + '/api/mission-tags/catalog')
    .then((r) => r.json());
  for (const name of [
    'Goblin',
    'Kobold',
    'Esqueleto',
    'Zumbi',
    'Orc',
    'Hobgoblin',
    'Gnoll',
    'Bugurso',
    'Ogro',
    'Cubo gelatinoso',
  ]) {
    expect(
      initialTags.tags.filter(
        (t: { name: string; active: boolean }) => t.name === name && t.active,
      ),
    ).toHaveLength(1);
  }
  await manager.getByLabel('Nome da tag', { exact: true }).fill('Exploração');
  await manager.getByLabel('Descrição da tag', { exact: true }).fill('Explore lugares novos.');
  await manager.getByRole('button', { name: 'Salvar tag', exact: true }).click();
  await expect(page.getByText('Tag salva.', { exact: true })).toBeVisible();
  await manager.getByRole('button', { name: 'Conquistas e recompensas', exact: true }).click();
  await manager
    .getByRole('combobox', { name: /^Tag da conquista/ })
    .selectOption({ label: 'Goblin' });
  await manager.getByLabel('Quantidade de tags', { exact: true }).fill('2');
  await manager.getByLabel('Nome da conquista', { exact: true }).fill('Guardião das Estradas');
  await manager
    .getByLabel('Descrição da conquista', { exact: true })
    .fill('Conclua duas missões com a tag Goblin.');
  await manager.getByRole('combobox', { name: /^Tipo de recompensa/ }).selectOption('title');
  await manager
    .getByRole('combobox', { name: /^Recompensa/ })
    .selectOption({ label: 'Voz da Alvorada' });
  await manager.getByRole('button', { name: 'Adicionar recompensa', exact: true }).click();
  await manager.getByRole('combobox', { name: /^Tipo de recompensa/ }).selectOption('item');
  await manager.getByLabel('Buscar recompensa', { exact: true }).fill('Luvas');
  const item = manager.getByRole('combobox', { name: /^Recompensa/ });
  await item.selectOption({ index: 1 });
  await manager.getByRole('button', { name: 'Adicionar recompensa', exact: true }).click();
  await manager.getByRole('combobox', { name: /^Tipo de recompensa/ }).selectOption('house');
  await manager
    .getByRole('combobox', { name: /^Recompensa/ })
    .selectOption({ label: 'Cadeira Heráldica' })
    .catch(async () => {
      const choice = await manager
        .getByRole('combobox', { name: /^Recompensa/ })
        .locator('option')
        .allTextContents();
      const i = choice.findIndex((s) => /Cadeira/.test(s));
      expect(i).toBeGreaterThan(0);
      await manager.getByRole('combobox', { name: /^Recompensa/ }).selectOption({ index: i });
    });
  await manager.getByRole('button', { name: 'Adicionar recompensa', exact: true }).click();
  await manager.getByRole('button', { name: 'Salvar conquista por tags', exact: true }).click();
  await expect(page.getByText(/Conquista salva\./)).toBeVisible();
  await manager.getByRole('button', { name: 'Fechar', exact: true }).click();
  const catalog = await page.request
      .get(origin + '/api/mission-tags/catalog')
      .then((r) => r.json()),
    goblin = catalog.tags.find((t: { name: string }) => t.name === 'Goblin'),
    goal = catalog.achievements.find((a: { title: string }) => a.title === 'Guardião das Estradas');
  expect(goal.rewards).toHaveLength(3);
  await page.goto(origin + '/#missions');
  await page.getByRole('button', { name: 'Abrir Missões', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar missão', exact: true }).click();
  const publish = page.getByRole('dialog', { name: 'Um chamado à guilda' });
  await publish.getByLabel('Título', { exact: true }).fill('Goblin na estrada');
  await publish.getByLabel('Local', { exact: true }).fill('Estrada');
  await publish
    .getByLabel('Descrição', { exact: true })
    .fill('Uma missão na estrada para afastar os goblins.');
  const future = new Date(Date.now() + 3600000),
    date = new Date(future.getTime() - future.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  await publish.getByLabel('Data e hora de início').fill(date);
  await publish.getByLabel('Goblin', { exact: true }).check();
  await publish.getByRole('button', { name: 'Publicar no mural', exact: true }).click();
  await expect(publish).toHaveCount(0);
  const posts = await page.request.get(origin + '/api/board').then((r) => r.json()),
    first = posts.find((p: { title: string }) => p.title === 'Goblin na estrada');
  expect(first.tags).toEqual([{ id: goblin.id, name: 'Goblin' }]);
  async function finish(id: string) {
    expect(
      (
        await page.request.post(origin + '/api/board/' + id + '/join', {
          headers: { Origin: origin },
          data: { character_id: character.id },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.patch(origin + '/api/board/' + id, {
          headers: { Origin: origin },
          data: { status: 'active' },
        })
      ).status(),
    ).toBe(200);
    const r = await page.request.post(origin + '/api/board/' + id + '/complete', {
      headers: { Origin: origin },
      data: {
        summary: 'A missão foi concluída com sucesso.',
        rewards: [{ character_id: character.id }],
      },
    });
    expect(r.status()).toBe(200);
  }
  await finish(first.id);
  await page.goto(origin + '/#achievements');
  await expect(page.locator('[data-tag-id="' + goblin.id + '"] .tag-total')).toHaveText('1');
  const second = await page.request
    .post(origin + '/api/board', {
      headers: { Origin: origin },
      data: {
        kind: 'mission',
        title: 'Segunda estrada',
        description: 'Outra missão envolvendo goblins.',
        location: 'Estrada',
        difficulty: 'Moderada',
        starts_at: future.toISOString(),
        tag_ids: [goblin.id],
      },
    })
    .then((r) => r.json());
  await finish(second.id);
  await page.reload();
  await expect(page.locator('[data-tag-id="' + goblin.id + '"] .tag-total')).toHaveText('2');
  await page
    .getByRole('searchbox', { name: 'Buscar conquista por nome' })
    .fill('Guardião das Estradas');
  const entry = page.locator('.catalog-achievement[data-code="' + goal.code + '"]');
  await expect(entry).toHaveAttribute('data-earned', 'true');
  await expect(entry.locator('.tag-rewards li')).toHaveCount(3);
  await entry.getByRole('button', { name: 'Exibir na estante', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar estante', exact: true }).first().click();
  await expect(page.locator('.cabinet-slot .tag-medal')).toHaveCount(1);
  const state = await page.request
    .get(origin + '/api/characters/' + character.id + '/tags')
    .then((r) => r.json());
  expect(state.grants).toHaveLength(1);
  expect(state.grants[0].rewards).toHaveLength(3);
  const metrics = [];
  for (const width of [1868, 1440, 900, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 940 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const aligned = await page.evaluate(() => {
      const room = document.querySelector('.main-shell')!,
        cabinet = document.querySelector('.cabinet-room-stage .fantasy-cabinet')!,
        a = room.getBoundingClientRect(),
        b = cabinet.getBoundingClientRect();
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth - innerWidth,
        delta: Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2),
        position: getComputedStyle(room, '::before').backgroundPosition,
      };
    });
    if (aligned.overflow > 1) {
      console.log(
        'Overflow',
        aligned,
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('body *'))
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
              width: e.getBoundingClientRect().width,
            }))
            .filter((e) => e.right > innerWidth + 1)
            .slice(-30),
        ),
      );
      await page.screenshot({
        path: 'test-results/tags-overflow-' + width + '.png',
        fullPage: true,
      });
    }
    expect(aligned.overflow).toBeLessThanOrEqual(1);
    expect(aligned.delta).toBeLessThan(2);
    expect(aligned.position).not.toContain('2.6');
    metrics.push(aligned);
    if ([1868, 390].includes(width)) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: 'test-results/tags-room-' + width + '.png', fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Administrar tags', exact: true }).click();
  await manager.getByRole('button', { name: 'Conquistas e recompensas', exact: true }).click();
  await manager.getByRole('button', { name: 'Editar Guardião das Estradas', exact: true }).click();
  await expect(manager.getByLabel('Quantidade de tags')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/tags-manager-mobile.png' });
  await manager.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.locator('.profile-avatar').click();
  await page.getByRole('option', { name: 'Mira', exact: true }).click();
  await expect(page.locator('[data-tag-id="' + goblin.id + '"] .tag-total')).toHaveText('0');
  await page.goto(origin + '/#lore');
  for (const width of [1868, 1440, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 940 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator('.lore-scene-art')).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    const heading = page.locator('.page-header h1');
    await expect(heading).toHaveText(/Crônicas & lore/i);
    expect(await page.locator('.lore-hero h1').count()).toBe(0);
    const header = await heading.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        fontSize: parseFloat(getComputedStyle(e).fontSize),
      };
    });
    expect(header.top).toBeLessThan(width > 900 ? 40 : 100);
    expect(header.left).toBeGreaterThanOrEqual(0);
    expect(header.right).toBeLessThanOrEqual(width);
    expect(header.fontSize).toBeLessThanOrEqual(26);
    expect(
      await page.locator('.lore-scene-art').evaluate((e) => getComputedStyle(e).backgroundImage),
    ).toContain('lore-world-v2.webp');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if ([1868, 390].includes(width))
      await page.screenshot({ path: 'test-results/lore-world-v2-' + width + '.png' });
  }
  for (const index of [0, 5, 2]) {
    await page.locator('.lore-era').nth(index).click();
    await expect(page.locator('.lore-era').nth(index)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'idle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page.locator('.page-header h1').evaluate((e) => e.getBoundingClientRect().left),
    ).toBeGreaterThanOrEqual(0);
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/mission-tags-browser-metrics.json',
    JSON.stringify({ metrics, errors, goal: goal.code, lore: 'lore-world-v2.webp' }, null, 2),
  );
  console.log(
    'PASS real tag/achievement/reward admin UI, illustrated rewards, mission publication, one per completed mission, auto-delivery, shelf, character isolation, frozen awarded rule, six responsive sizes, centered chandelier and new Lore background.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
