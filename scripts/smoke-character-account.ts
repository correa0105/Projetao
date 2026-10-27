import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defaultChoices } from '../shared/character-sheet';
import { guildDocumentSchema } from '../shared/guilds';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório');
const origin = 'http://localhost:3072';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter, testArtImage } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3072, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage(),
  errors: string[] = [],
  out = 'test-results/character-account';
await mkdir(out, { recursive: true });
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(18000);
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.continue();
  const f = resolve('public', '.' + decodeURIComponent(url.pathname));
  if (f.startsWith(resolve('public')) && (await stat(f).catch(() => null))?.isFile())
    return route.fulfill({ path: f });
  return route.continue();
});
async function signup(context: any, name: string) {
  const r = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: { name, email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() },
  });
  expect(r.status()).toBe(200);
  return (await r.json()).user;
}
try {
  const user = await signup(ctx, 'Administrador do acampamento'),
    otherCtx = await browser.newContext(),
    other = await signup(otherCtx, 'Aventureiro visitante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  await pool.query('INSERT INTO character_account_settings(user_id,max_characters)VALUES($1,4)', [
    user.id,
  ]);
  const chars: any[] = [],
    portrait = await testArtImage(),
    token = await readFile('data/vtt/character-art/character-tokens-20261008/nana-top-down-v1.png');
  for (let n = 1; n <= 4; n++) {
    const c = await createLegacyTestCharacter(user.id, 'Aventureiro ' + n);
    chars.push(c);
    await pool.query('UPDATE characters SET creation_slot=$2 WHERE id=$1', [c.id, n]);
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      c.id,
      portrait,
    ]);
    await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
      c.id,
      token,
    ]);
    await pool.query(
      'INSERT INTO character_sheets(character_id,choices,rolls,assignment,rolls_revealed,finalized_at)VALUES($1,$2,$3,$4,6,now())',
      [
        c.id,
        JSON.stringify(defaultChoices(c.race, c.class)),
        JSON.stringify(Array.from({ length: 6 }, () => [4, 4, 4, 4])),
        JSON.stringify([0, 1, 2, 3, 4, 5]),
      ],
    );
  }
  const foreign = await createLegacyTestCharacter(other.id, 'Ficha de outro jogador');
  for (let n = 1; n <= 3; n++) {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO character_art_jobs(id,user_id,creation,reference,status,idempotency_key)VALUES($1,$2,$3,$4,'failed',$1)",
      [
        id,
        user.id,
        JSON.stringify({
          name: 'Rascunho ' + n,
          race: 'Humano',
          class: 'Guerreiro',
          choices: defaultChoices('Humano', 'Guerreiro'),
        }),
        portrait,
      ],
    );
  }
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-stage>.camp-character')).toHaveCount(2);
  await expect(page.locator('.camp-capacity')).toContainText('4 / 4');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const launcher = page.getByRole('button', { name: 'Criações salvas (3)', exact: true });
    await expect(launcher).toBeVisible();
    const b = await launcher.boundingBox();
    expect(b!.x).toBeLessThan(30);
    expect(b!.y).toBeGreaterThan(900);
    expect(b!.width).toBeLessThan(90);
    await page.screenshot({ path: `${out}/camp-${width}.png` });
    await page.getByRole('button', { name: 'Personagens e slots', exact: true }).click();
    await expect(page.locator('.camp-roster-card')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${out}/roster-${width}.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Personagens e slots', exact: true }).click();
  let roster = page.getByRole('dialog', { name: 'Personagens e slots', exact: true });
  await roster
    .locator('.camp-roster-card')
    .filter({ has: page.locator('strong').filter({ hasText: /^Aventureiro 3$/ }) })
    .getByRole('button', { name: 'Exibir à esquerda', exact: true })
    .click();
  await expect(
    roster
      .locator('.camp-roster-card')
      .filter({ has: page.locator('strong').filter({ hasText: /^Aventureiro 3$/ }) }),
  ).toContainText('No acampamento');
  await roster.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('.camp-stage>.camp-character')).toHaveCount(2);
  await expect(page.locator('.camp-stage')).toContainText('Aventureiro 3');
  await page.reload();
  await expect(page.locator('.camp-stage')).toContainText('Aventureiro 3');
  await page.getByRole('button', { name: 'Personagens e slots', exact: true }).click();
  roster = page.getByRole('dialog', { name: 'Personagens e slots', exact: true });
  await roster.getByRole('button', { name: 'Retirar da tela', exact: true }).first().click();
  await expect(roster.getByRole('button', { name: 'Retirar da tela', exact: true })).toHaveCount(1);
  await roster.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('.camp-stage>.camp-character:not(.camp-create-slot)')).toHaveCount(1);
  await page.getByRole('button', { name: 'Criações salvas (3)', exact: true }).click();
  const saved = page.getByRole('dialog', { name: 'Criações salvas', exact: true });
  await expect(saved.locator('details')).toHaveCount(3);
  await saved.locator('summary').first().click();
  await saved.getByRole('button', { name: 'Remover da lista', exact: true }).first().click();
  await expect(saved.locator('details')).toHaveCount(2);
  await saved.getByRole('button', { name: 'Remover 2 criações salvas', exact: true }).click();
  await expect(saved).toHaveCount(0);
  await expect(page.locator('.camp-drafts-launcher')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.camp-drafts-launcher')).toHaveCount(0);
  await page.getByRole('link', { name: 'Abrir ficha', exact: true }).first().click();
  await page.getByRole('button', { name: 'Editar ficha · Admin', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Administrar fichas', exact: true });
  await editor.getByLabel('Ficha para administrar', { exact: true }).selectOption(foreign.id);
  await expect(editor.getByLabel('Nome administrativo', { exact: true })).toHaveValue(foreign.name);
  await editor.getByLabel('Atributo administrativo: Força', { exact: true }).fill('19');
  await editor
    .locator('summary')
    .filter({ hasText: 'Origem, características e aparência' })
    .click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${out}/editor-${width}.png` });
  }
  await editor.getByRole('button', { name: 'Salvar alterações da ficha', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('salva');
  expect(
    (await pool.query('SELECT stats FROM characters WHERE id=$1', [foreign.id])).rows[0].stats[0],
  ).toBe(19);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#profiles?user=' + user.id);
  await page.reload();
  await expect(page.locator('.public-camp-character')).toHaveCount(1);
  const op = await otherCtx.newPage();
  await op.goto(origin + '/#characters');
  await op.getByRole('button', { name: 'Personagens e slots', exact: true }).click();
  await expect(op.locator('.camp-roster-card.is-locked')).toHaveCount(2);
  await op.close();
  await otherCtx.close();
  const gid = randomUUID(),
    guildDoc = guildDocumentSchema.parse({ name: 'Guilda da sombra' });
  (guildDoc as any)._estate_actors = { [chars[0].id]: { x: 30, y: 33.7, scale: 2, rotation: 0 } };
  await pool.query(
    'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,prestige,founding_cp,request_id)VALUES($1,$2,$3,0,0,0,$4)',
    [gid, user.id, JSON.stringify(guildDoc), randomUUID()],
  );
  await pool.query(
    'INSERT INTO player_guild_members(guild_id,user_id,character_id)VALUES($1,$2,$3)',
    [gid, user.id, chars[0].id],
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#guild?id=' + gid);
  await page.evaluate(
    ({ uid, id }) => sessionStorage.setItem('alvorada-selected-character:' + uid, id),
    { uid: user.id, id: chars[0].id },
  );
  await page.reload();
  const actor = page.locator('[data-estate-actor="' + chars[0].id + '"]');
  await expect(actor).toBeVisible();
  await actor.scrollIntoViewIfNeeded();
  await expect(actor.locator('ellipse')).toHaveCount(0);
  await expect(actor.locator('image')).toHaveAttribute('filter', new RegExp('guild-actor-contact'));
  await page.screenshot({ path: out + '/guild-contact.png' });
  await actor.locator('image').screenshot({ path: out + '/guild-contact-close.png' });
  await page.evaluate(() => {
    const img = document.querySelector('[data-estate-actor] image')!;
    img.removeAttribute('filter');
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    for (const [k, v] of Object.entries({
      cy: '1.3',
      rx: '1.3',
      ry: '.5',
      fill: '#000',
      opacity: '.4',
    }))
      ellipse.setAttribute(k, v);
    img.before(ellipse);
  });
  await page.screenshot({ path: out + '/guild-old-comparison.png' });
  expect(errors).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        fourWidths: true,
        twoVisible: true,
        swap: true,
        removeFromDisplay: true,
        publicCamp: true,
        defaultLocks: true,
        adminOther: true,
        savedRemoval: true,
        contactShadow: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log('Camp/account browser passed.');
} catch (e) {
  await page.screenshot({ path: out + '/failure.png' });
  console.log((await page.locator('body').innerText()).slice(-2500));
  console.log(errors);
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
