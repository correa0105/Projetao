import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3004, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  }),
  ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
  page = await ctx.newPage(),
  peerPage = await ctx2.newPage(),
  errors: string[] = [];
for (const p of [page, peerPage]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  async function signup(context: typeof ctx, name: string) {
    const r = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name,
        email: `social-ui-${randomUUID()}@example.test`,
        password: `Test-${randomUUID()}`,
      },
    });
    expect(r.ok()).toBe(true);
    return (await r.json()).user;
  }
  const owner = await signup(ctx, 'Administrador'),
    peer = await signup(ctx2, 'Viajante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Arden'),
    b = await createLegacyTestCharacter(owner.id, 'Mira'),
    c = await createLegacyTestCharacter(peer.id, 'Lyra');
  const png = await sharp(await readFile('public/shop/merchant-v2.png'))
    .resize({ height: 900 })
    .png()
    .toBuffer();
  for (const ch of [a, b, c]) {
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      ch.id,
      png,
    ]);
    await pool.query(
      'UPDATE characters SET portrait_revision=1,biography=$2,gold_cp=100000 WHERE id=$1',
      [ch.id, 'Uma jornada pelo Norte, entre estradas e histórias.'],
    );
    await pool.query(
      'INSERT INTO achievements(character_id,code)VALUES($1,$2)ON CONFLICT DO NOTHING',
      [ch.id, 'first_purchase'],
    );
    await pool.query(
      "INSERT INTO achievement_shelves(character_id,material,medal_frame,slots,positions,rows)VALUES($1,'walnut','bronze',$2,$3,$4)ON CONFLICT(character_id)DO UPDATE SET slots=$2,positions=$3,rows=$4",
      [
        ch.id,
        JSON.stringify(['first_character', 'first_purchase']),
        JSON.stringify([25, 60]),
        JSON.stringify([0, 1]),
      ],
    );
    await pool.query(
      'INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,displayed)VALUES($1,$2,$3,1000,$4,true)',
      [
        ch.id,
        ch.id === b.id ? 'pony' : 'riding-horse',
        ch.id === b.id ? 'Faísca' : 'Bruma',
        randomUUID(),
      ],
    );
  }
  for (const [ch, pet, name] of [
    [a, 'dog', 'Brasa'],
    [b, 'frog', 'Pingo'],
    [c, 'cat', 'Nuvem'],
  ] as const) {
    const context = ch.id === c.id ? ctx2 : ctx;
    expect(
      (
        await context.request.post(origin + '/api/pets/purchase', {
          headers: { Origin: origin },
          data: {
            character_id: ch.id,
            pet_id: pet,
            name,
            appearance: 'original',
            idempotency_key: randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
  }
  await pool.query(
    "INSERT INTO character_cards(character_id,card_id,slot,price_cp,idempotency_key)VALUES($1,'vigil',1,5000,$2)",
    [a.id, randomUUID()],
  );
  await page.goto(origin + '/#hall');
  await expect(page.locator('.hall-champion')).toHaveCount(3);
  await page.getByRole('button', { name: 'Editar pontuação e apresentação' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Hall da Fama');
  await page.getByRole('button', { name: 'Salvar critérios' }).click();
  await expect(page.locator('.social-modal')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/hall-desktop.png', fullPage: true });
  await page
    .locator('.hall-champion')
    .filter({ has: page.getByText('Arden', { exact: true }) })
    .click();
  await expect(page).toHaveURL(new RegExp('profiles\\?user=' + owner.id));
  await expect(page.locator('.public-camp-heading')).toContainText('Arden');
  await expect(page.locator('.public-camp-pet')).toContainText('Brasa');
  await expect(page.locator('.public-camp-mount')).toContainText('Bruma');
  await page.getByRole('button', { name: 'Selecionar Mira no perfil' }).click();
  await expect(page.locator('.public-camp-pet')).toContainText('Pingo');
  await expect(page.locator('.public-camp-mount')).toContainText('Faísca');
  await page.screenshot({ path: 'test-results/profile-camp-desktop.png', fullPage: true });
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Conquistas', exact: true })
    .click();
  await expect(page.locator('.public-achievements')).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Ver conquistas de Arden' }).click();
  await expect(page.locator('.public-achievements h2')).toHaveText('Conquistas de Arden');
  await expect(page.locator('.antique-portrait')).toHaveCount(4);
  await expect(page.locator('.public-achievements .cabinet-slot')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver conquistas de Arden' }).hover();
  await expect
    .poll(() =>
      page
        .locator('.profile-panels-strip')
        .evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running')),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/profile-achievements-desktop.png', fullPage: true });
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Ficha', exact: true })
    .click();
  await expect(page.locator('.public-sheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.public-sheet')).toContainText('História');
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Cartas', exact: true })
    .click();
  await expect(page.locator('.public-cards .arcana-card-face')).toHaveCount(1);
  await page.getByRole('button', { name: 'Personalizar perfil' }).click();
  await page.getByLabel('Frase de apresentação').fill('Pelas estradas da Alvorada.');
  await page.getByLabel('Sobre você', { exact: true }).fill('Um lugar para novas histórias.');
  await page.getByRole('button', { name: 'Salvar meu perfil' }).click();
  await expect(page.locator('.visited-profile-heading')).toContainText(
    'Pelas estradas da Alvorada.',
  );
  await page.goto(origin + '/#profiles');
  await expect(page.locator('.profile-directory article')).toHaveCount(2);
  await page.getByLabel('Localizador de perfil').fill(peer.id);
  await expect(page.locator('.profile-directory article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Visitar perfil', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar amigo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toBeVisible();
  await peerPage.goto(origin + '/#profiles?user=' + owner.id);
  await expect(peerPage.getByRole('button', { name: 'Personalizar perfil' })).toHaveCount(0);
  await peerPage.getByRole('button', { name: 'Aceitar amizade', exact: true }).click();
  await peerPage.getByRole('button', { name: 'Conversar', exact: true }).click();
  await expect(peerPage.getByLabel('Mensagem privada', { exact: true })).toBeVisible();
  await peerPage
    .getByLabel('Mensagem privada', { exact: true })
    .fill('Nos vemos na próxima aventura!');
  await peerPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(peerPage.locator('.direct-chat-history')).toContainText('Nos vemos');
  await page.reload();
  await page.getByRole('button', { name: 'Conversar', exact: true }).click();
  await expect(page.locator('.direct-chat-history')).toContainText('Nos vemos');
  await page.getByLabel('Mensagem privada', { exact: true }).fill('Combinado.');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(peerPage.locator('.direct-chat-history')).toContainText('Combinado.', {
    timeout: 8000,
  });
  await page.screenshot({ path: 'test-results/profile-chat-desktop.png', fullPage: true });
  await page.goto(origin + '/#achievements');
  await expect(page.locator('.antique-portrait')).toHaveCount(4);
  await page.getByRole('button', { name: 'Ver conquistas de Mira' }).click();
  await expect(page.locator('.antique-portrait.selected')).toHaveAttribute(
    'aria-label',
    'Ver conquistas de Mira',
  );
  await page.screenshot({ path: 'test-results/own-achievements-frames.png', fullPage: true });
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('A cripta da Alvorada');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const panel = page.locator('.vtt-panel-content');
  await page.getByRole('button', { name: 'Ficha', exact: true }).click();
  await panel.getByRole('button').filter({ hasText: 'Arden' }).click();
  await expect(panel).toContainText('Arden');
  await page.getByRole('button', { name: 'Token', exact: true }).first().click();
  await expect(panel.getByLabel('Nome', { exact: true })).toHaveValue('Arden');
  await panel.getByLabel('Nome', { exact: true }).fill('Arden · aventureiro');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect(page.locator('.vtt-saved')).toContainText('Salvo');
  await page.getByRole('button', { name: 'Cena', exact: true }).click();
  await panel.getByLabel('Tipo de grade').selectOption('hex-point');
  await panel.getByLabel('Tamanho da célula').fill('80');
  await panel.getByLabel('Tamanho da célula').blur();
  await page.getByRole('button', { name: 'Barreira de luz', exact: true }).click();
  const bounds = await page.locator('canvas').boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.6, bounds!.y + bounds!.height * 0.55);
  await page.mouse.up();
  await expect(panel).toContainText('Parede 1');
  await page.getByRole('button', { name: 'Bibliotecas', exact: true }).click();
  await panel.getByRole('button', { name: 'Monstros', exact: true }).click();
  await panel.getByLabel('Buscar na biblioteca', { exact: true }).fill('Goblin');
  await expect(panel.locator('.vtt-compendium button').first()).toBeVisible();
  await panel.locator('.vtt-compendium button').first().click();
  await panel.getByRole('button', { name: 'Adicionar ao tabuleiro', exact: true }).click();
  await page.getByRole('button', { name: 'Dados e chat', exact: true }).click();
  await panel.getByLabel('Rolagem', { exact: true }).fill('2d20kh1+3');
  await panel.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  await expect(page.locator('.vtt-roll')).toContainText('2d20kh1+3');
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar imagem PNG', exact: true }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/\.png$/);
  await file.saveAs('test-results/vtt-map-export.png');
  await page.screenshot({ path: 'test-results/vtt-desktop.png' });
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  const rooms = await (await ctx.request.get(origin + '/api/vtt')).json(),
    rid = rooms.rooms[0].id;
  let mesa = await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid)).json();
  mesa.document.scenes[0].walls = [
    {
      id: randomUUID(),
      a: { x: 1150, y: 400 },
      b: { x: 1150, y: 1200 },
      kind: 'wall',
      open: false,
    },
  ];
  expect(
    (
      await ctx.request.put(origin + '/api/vtt/rooms/' + rid, {
        headers: { Origin: origin },
        data: { revision: mesa.revision, document: mesa.document },
      })
    ).ok(),
  ).toBe(true);
  await peerPage.goto(origin + '/#vtt');
  await peerPage.getByLabel('Código de convite', { exact: true }).fill(mesa.invite);
  await peerPage.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await peerPage.getByRole('button', { name: 'Ficha', exact: true }).click();
  await peerPage
    .locator('.vtt-panel-content')
    .getByRole('button')
    .filter({ hasText: 'Lyra' })
    .click();
  await expect(peerPage.locator('.vtt-panel-content h3').filter({ hasText: 'Lyra' })).toBeVisible();
  await peerPage.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
  const playerBoard = await peerPage.locator('canvas').boundingBox();
  expect(playerBoard).not.toBeNull();
  const px = playerBoard!.x + playerBoard!.width / 2,
    py = playerBoard!.y + playerBoard!.height / 2;
  await peerPage.mouse.move(px, py);
  await peerPage.mouse.down();
  await peerPage.mouse.move(px + 90, py);
  await peerPage.mouse.up();
  await expect(peerPage.locator('.vtt-notice')).toContainText('Uma barreira bloqueia o movimento.');
  await peerPage.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await peerPage.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await peerPage.mouse.move(px, py);
  await peerPage.mouse.down();
  await peerPage.mouse.move(px - 70, py);
  await peerPage.mouse.up();
  await expect
    .poll(async () => {
      const st = await (await ctx2.request.get(origin + '/api/vtt/rooms/' + rid)).json();
      return st.document.scenes[0].tokens.find((t: any) => t.characterId === c.id)?.x;
    })
    .toBeLessThan(1120);
  await peerPage.screenshot({ path: 'test-results/vtt-player.png' });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/#profiles?user=' + owner.id);
    await page
      .locator('.profile-visit-nav')
      .getByRole('button', { name: 'Conquistas', exact: true })
      .click();
    await expect(page.locator('.public-achievements')).toHaveAttribute('aria-hidden', 'false');
    await expect
      .poll(() =>
        page
          .locator('.profile-panels-strip')
          .evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running')),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/profile-frames-${width}.png`, fullPage: true });
    await page.goto(origin + '/#hall');
    await expect(page.locator('.hall-champion')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/hall-${width}.png`, fullPage: true });
    await page.goto(origin + '/#vtt');
    await expect(page.locator('canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/vtt-${width}.png` });
  }
  expect(errors).toEqual([]);
  console.log(
    'Hall, perfis por ID, seleção de companheiros, molduras, ficha/cartas somente leitura, amizade e chat em duas contas, VTT com ficha/grid/barreira/monstro/dados/exportação e layouts 1440/768/390/320 verificados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/vtt-social-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
